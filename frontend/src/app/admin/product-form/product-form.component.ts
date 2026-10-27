import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, catchError, map, of, switchMap } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { Product, ProductSave } from '../../models/product.model';
import { CATEGORIES, LOW_STOCK_BELOW, SECTIONS, SIZE_OPTIONS } from '../../shared/catalog';
import { discountPercent, imageOf, inr } from '../../shared/product-utils';
import { firstError } from '../../shared/order-status';

type Field = 'name' | 'brand' | 'description' | 'price' | 'mrp' | 'stock';

// ---------- NEW (4D): the photo box ----------

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;              // 5 MB, the same limit as PhotoStorage.cs in the API

// idle = no upload going on (the drop zone shows), uploading = the bar is moving, done = uploaded, not saved yet
type PhotoPhase = 'idle' | 'uploading' | 'done';

interface PhotoUploadState {
  name: string;        // kurta-set-front.jpg
  size: string;        // 1.8 MB
  dims: string;        // 900 × 1200 px (filled in once the browser has read the photo)
  wide: boolean;       // wider than tall: the store card will crop its sides
  preview: string;     // a temporary blob: address for the photo on your computer, shown in the tile
  progress: number;    // 0 to 100
}

interface PhotoMessage { title: string; text: string; }

// "1.8 MB" or "640 KB"
function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Splits "kurta.jpg is 8.4 MB. Choose a photo under 5 MB." into a bold first sentence and the rest
function splitMessage(message: string): PhotoMessage {
  const end = message.indexOf('. ');
  return end > 0
    ? { title: message.slice(0, end + 1), text: message.slice(end + 2) }
    : { title: message, text: '' };
}

// Same rule as Product.Validate() in the API: the price can't be above the MRP
function priceNotAboveMrp(group: AbstractControl): ValidationErrors | null {
  const price = Number(group.get('price')?.value) || 0;
  const mrp = Number(group.get('mrp')?.value) || 0;
  return mrp > 0 && price > mrp ? { priceAboveMrp: true } : null;
}

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './product-form.component.html',
  styleUrls: ['../admin.css', './product-form.component.css']
})
export class ProductFormComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private destroyRef = inject(DestroyRef);

  readonly sections = SECTIONS;
  readonly categories = CATEGORIES;
  readonly sizeOptions = SIZE_OPTIONS;
  readonly inr = inr;

  // Same limits as Product.cs
  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    brand: ['Kiyaara Studio', [Validators.required, Validators.maxLength(60)]],
    category: [CATEGORIES[0], Validators.required],
    gender: ['Women', Validators.required],
    description: ['', Validators.maxLength(1000)],
    imageUrl: [''],                                   // filled by the photo box, not typed any more
    price: [0, [Validators.required, Validators.min(1), Validators.max(1000000)]],
    mrp: [0, [Validators.min(0), Validators.max(1000000)]],
    stock: [0, [Validators.required, Validators.min(0), Validators.max(10000)]],
    moreSizes: ['']
  }, { validators: priceNotAboveMrp });

  productId = signal<number | null>(null);          // null = adding a new product
  sizes = signal<string[]>([]);                     // the size chips that are switched on
  rating = signal({ rating: 0, count: 0 });         // kept from the API; the form doesn't change it
  status = signal<'loading' | 'ready' | 'missing'>('loading');
  saving = signal(false);
  submitted = signal(false);
  message = signal<{ text: string; ok: boolean } | null>(null);

  // NEW (4D): the photo box
  photoPhase = signal<PhotoPhase>('idle');
  upload = signal<PhotoUploadState | null>(null);    // the photo being uploaded (or just uploaded)
  photoError = signal<PhotoMessage | null>(null);
  dragging = signal(false);                          // a photo is being dragged over the drop zone
  savedImageUrl = signal('');                        // the photo the store shows now, for Undo
  private uploadSub: Subscription | null = null;

  // Every change in the form as a signal, so the shop preview follows what you type
  private values = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  isNew = computed(() => this.productId() === null);

  // Chips plus anything typed in "More sizes" (28, 30, 4-5Y...)
  allSizes = computed(() => {
    const extra = this.values().moreSizes.split(',').map(s => s.trim()).filter(s => s);
    return [...this.sizes(), ...extra];
  });
  sizeError = computed(() => this.allSizes().length === 0);

  // NEW (4D)
  hasPhoto = computed(() => this.values().imageUrl.trim() !== '');

  // Save waits for the upload to finish, and needs a photo
  canSave = computed(() => !this.saving() && this.photoPhase() !== 'uploading' && this.hasPhoto());

  // The 3:4 tile: the new photo straight from your computer while it uploads, otherwise the photo in the form
  tileImage = computed(() => {
    const u = this.upload();
    if (u && this.photoPhase() !== 'idle') return u.preview;
    const url = this.values().imageUrl.trim();
    return url ? imageOf({ imageUrl: url, name: 'Kiyaara' }) : '';
  });

  // The line at the bottom of the shop preview
  photoNote = computed(() => {
    if (this.photoPhase() === 'uploading') return { text: 'Photo: uploading the new one...', tone: 'busy' };
    if (this.photoPhase() === 'done') return { text: 'Photo: new, shows in the store after you save', tone: 'new' };
    if (!this.hasPhoto()) return { text: 'Photo: missing, add one before you save', tone: 'missing' };
    return { text: 'Photo: in the store now', tone: 'ok' };
  });

  // Everything the preview card shows
  preview = computed(() => {
    const v = this.values();
    const price = Number(v.price) || 0;
    const mrp = Number(v.mrp) > 0 ? Number(v.mrp) : price;   // no MRP = no discount, like the API
    const stock = Number(v.stock) || 0;
    const r = this.rating();
    const url = v.imageUrl.trim();

    let tag: { text: string; tone: string } | null = null;
    if (stock === 0) tag = { text: 'Sold out', tone: 'sold' };
    else if (stock < LOW_STOCK_BELOW) tag = { text: `Only ${stock} left`, tone: 'low' };
    else if (r.rating >= 4.5 && r.count >= 800) tag = { text: 'Bestseller', tone: 'low' };

    return {
      name: v.name.trim() || 'Product name',
      brand: v.brand.trim() || 'Brand',
      image: url ? imageOf({ imageUrl: url, name: v.name.trim() || 'Kiyaara' }) : '',   // '' = "No photo" box
      price,
      mrp,
      off: discountPercent({ price, mrp }),
      tag,
      rating: r.rating,
      ratingCount: r.count >= 1000 ? (r.count / 1000).toFixed(1) + 'k' : String(r.count),
      section: v.gender,
      category: v.category,
      stockText: stock === 0 ? "Sold out: shoppers can't add it to the bag"
               : stock < LOW_STOCK_BELOW ? `Only ${stock} left: shows a low-stock tag`
               : `${stock} in stock`
    };
  });

  constructor() {
    // /admin/products/new = empty form; /admin/products/3 = load product 3
    this.route.paramMap.pipe(
      map(params => params.get('id')),
      switchMap(id => id === 'new'
        ? of(null)
        : this.productService.getById(Number(id)).pipe(catchError(() => of(undefined)))),
      takeUntilDestroyed()
    ).subscribe(product => {
      if (product === undefined) {
        this.status.set('missing');
        return;
      }
      this.fill(product);
      this.status.set('ready');
    });

    // NEW (4D): leaving the page in the middle of an upload stops it and frees the preview
    this.destroyRef.onDestroy(() => this.clearUpload());
  }

  // Put a product (or empty values for a new one) into the form
  private fill(p: Product | null): void {
    const sizes = p?.sizes ?? [];
    this.productId.set(p?.id ?? null);
    this.rating.set({ rating: p?.rating ?? 0, count: p?.ratingCount ?? 0 });
    this.sizes.set(sizes.filter(s => SIZE_OPTIONS.includes(s)));
    this.form.reset({
      name: p?.name ?? '',
      brand: p?.brand ?? 'Kiyaara Studio',
      category: p?.category ?? CATEGORIES[0],
      gender: p?.gender ?? 'Women',
      description: p?.description ?? '',
      imageUrl: p?.imageUrl ?? '',
      price: p?.price ?? 0,
      mrp: p?.mrp ?? 0,
      stock: p?.stock ?? 0,
      moreSizes: sizes.filter(s => !SIZE_OPTIONS.includes(s)).join(', ')
    });
    this.submitted.set(false);

    // NEW (4D): a fresh photo box for this product
    this.savedImageUrl.set(p?.imageUrl ?? '');
    this.clearUpload();
    this.photoError.set(null);
  }

  // Red message under a field: after you leave it, or after pressing Save
  showError(field: Field): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  setSection(section: string): void {
    this.form.controls.gender.setValue(section);
  }

  toggleSize(size: string): void {
    this.sizes.update(list => list.includes(size)
      ? list.filter(s => s !== size)
      : [...list, size].sort((a, b) => SIZE_OPTIONS.indexOf(a) - SIZE_OPTIONS.indexOf(b)));
  }

  // ---------- Photo box (NEW 4D) ----------

  // "Choose a photo" opens the hidden file picker; this runs when you pick a file
  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';                  // so picking the same file again still counts as a change
    if (file) this.startUpload(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();            // "you may drop here" (without it, the browser opens the photo itself)
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    // Moving over the text inside the box also fires dragleave: only react when the pointer really leaves
    const box = event.currentTarget as HTMLElement;
    if (event.relatedTarget instanceof Node && box.contains(event.relatedTarget)) return;
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.startUpload(file);
  }

  private startUpload(file: File): void {
    this.photoError.set(null);
    this.message.set(null);

    // The same checks as the API, so a wrong file stops here and nothing is sent
    if (!PHOTO_TYPES.includes(file.type)) {
      this.photoError.set({ title: `${file.name} isn't a photo.`, text: 'Choose a JPG, PNG or WebP file.' });
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      this.photoError.set({ title: `${file.name} is ${fileSize(file.size)}.`, text: 'Choose a photo under 5 MB.' });
      return;
    }

    // Replacing a photo that was uploaded but not saved: go back to the store's photo first,
    // so a failed upload never leaves an unsaved photo behind
    if (this.photoPhase() === 'done') this.form.controls.imageUrl.setValue(this.savedImageUrl());
    this.clearUpload();

    const preview = URL.createObjectURL(file);
    this.upload.set({ name: file.name, size: fileSize(file.size), dims: '', wide: false, preview, progress: 0 });
    this.photoPhase.set('uploading');

    // Read the photo's width and height in the browser, for the "wider than tall" warning
    const img = new Image();
    img.onload = () => this.upload.update(u => u && u.preview === preview
      ? { ...u, dims: `${img.naturalWidth} × ${img.naturalHeight} px`, wide: img.naturalWidth > img.naturalHeight }
      : u);
    img.src = preview;

    this.uploadSub = this.productService.uploadPhoto(file).subscribe({
      next: event => {
        if (event.type === HttpEventType.UploadProgress) {
          // Hold at 99% until the API answers, so 100% means "saved on the API"
          const percent = Math.round((event.loaded / (event.total ?? file.size)) * 100);
          this.upload.update(u => u ? { ...u, progress: Math.min(99, percent) } : u);
        } else if (event.type === HttpEventType.Response && event.body) {
          this.upload.update(u => u ? { ...u, progress: 100 } : u);
          this.photoPhase.set('done');
          // The form's photo field now holds the new address; Save sends it to the API
          this.form.controls.imageUrl.setValue(event.body.url);
          this.form.controls.imageUrl.markAsDirty();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.clearUpload();
        if (err.status === 401) return;          // the interceptor has already sent you to sign in again
        if (err.status === 0) {
          this.photoError.set({ title: "The upload didn't finish.", text: 'Check that the API is running, then try again.' });
        } else if (err.status === 403) {
          this.photoError.set({ title: 'Only admins can upload photos.', text: 'Sign in with an admin account.' });
        } else {
          this.photoError.set(splitMessage(firstError(err, "The upload didn't finish. Please try again.")));
        }
      }
    });
  }

  cancelUpload(): void {
    this.clearUpload();
  }

  // Back to the photo the store shows now (or no photo, for a new product)
  undoPhoto(): void {
    this.clearUpload();
    this.photoError.set(null);
    this.form.controls.imageUrl.setValue(this.savedImageUrl());
  }

  removePhoto(): void {
    this.photoError.set(null);
    this.form.controls.imageUrl.setValue('');
    this.form.controls.imageUrl.markAsDirty();
  }

  // Stops an upload that is still going, and frees the temporary preview
  private clearUpload(): void {
    this.uploadSub?.unsubscribe();
    this.uploadSub = null;
    const u = this.upload();
    if (u) URL.revokeObjectURL(u.preview);
    this.upload.set(null);
    this.photoPhase.set('idle');
    this.dragging.set(false);
  }

  // ---------- Save ----------

  save(): void {
    this.submitted.set(true);
    this.message.set(null);
    if (!this.canSave()) return;               // still uploading, or no photo yet (the button is off too)
    if (this.form.invalid || this.sizeError()) {
      document.querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid')?.focus();
      return;
    }

    const v = this.form.getRawValue();
    const product: ProductSave = {
      name: v.name.trim(),
      brand: v.brand.trim(),
      category: v.category,
      gender: v.gender,
      description: v.description.trim(),
      imageUrl: v.imageUrl.trim(),
      price: v.price,
      mrp: v.mrp || v.price,
      stock: v.stock,
      sizes: this.allSizes()
    };

    const id = this.productId();
    this.saving.set(true);

    if (id === null) {
      // POST: the API sends back the new product with its id
      this.productService.create(product).subscribe({
        next: created => {
          this.saving.set(false);
          this.message.set({ ok: true, text: `Added. ${created.name} now shows in the store.` });
          this.router.navigate(['/admin/products', created.id], { replaceUrl: true });   // same page, now editing it
        },
        error: (err: HttpErrorResponse) => this.failed(err)
      });
    } else {
      // PUT: the API answers 204 No Content
      const newPhoto = product.imageUrl !== this.savedImageUrl();
      this.productService.update(id, product).subscribe({
        next: () => {
          this.saving.set(false);
          this.form.markAsPristine();
          // NEW (4D): the uploaded photo is now the store's photo
          this.savedImageUrl.set(product.imageUrl);
          this.clearUpload();
          this.message.set({
            ok: true,
            text: newPhoto ? 'Saved. The store now shows the new photo.' : 'Saved. The store now shows these details.'
          });
        },
        error: (err: HttpErrorResponse) => this.failed(err)
      });
    }
  }

  private failed(err: HttpErrorResponse): void {
    this.saving.set(false);
    this.message.set({ ok: false, text: firstError(err, "Couldn't save the product. Please try again.") });
  }
}
