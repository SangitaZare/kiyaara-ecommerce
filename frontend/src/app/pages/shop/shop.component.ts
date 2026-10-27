import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { discountPercent } from '../../shared/product-utils';

interface PriceRange { id: string; label: string; min: number; max: number; }

const PRICE_RANGES: PriceRange[] = [
  { id: 'all', label: 'Any price', min: 0, max: Infinity },
  { id: 'under-500', label: 'Under ₹500', min: 0, max: 499 },
  { id: '500-999', label: '₹500 to ₹999', min: 500, max: 999 },
  { id: '1000-1999', label: '₹1,000 to ₹1,999', min: 1000, max: 1999 },
  { id: '2000-up', label: '₹2,000 and above', min: 2000, max: Infinity }
];

const SORTS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'new', label: "What's new" },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'discount', label: 'Biggest discount' },
  { id: 'rating', label: 'Customer rating' }
];

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [
    MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule,
    MatRadioModule, MatSelectModule, ProductCardComponent
  ],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.css'
})
export class ShopComponent {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);

  readonly priceRanges = PRICE_RANGES;
  readonly sorts = SORTS;
  readonly discounts = [0, 10, 30, 50];

  // ---------- Data ----------
  loading = signal(true);
  loadError = signal(false);

  private products = toSignal(
    this.productService.getAll().pipe(
      catchError(() => {
        this.loadError.set(true);
        return of([] as Product[]);
      }),
      finalize(() => this.loading.set(false))
    ),
    { initialValue: [] as Product[] }
  );

  // ---------- URL ----------
  private params = toSignal(this.route.paramMap, { requireSync: true });
  private query = toSignal(this.route.queryParamMap, { requireSync: true });

  gender = computed(() => (this.params().get('gender') ?? '').toLowerCase());
  searchTerm = computed(() => (this.query().get('q') ?? '').trim());

  title = computed(() => {
    if (this.searchTerm()) return `Results for "${this.searchTerm()}"`;
    const g = this.gender();
    return g ? g[0].toUpperCase() + g.slice(1) : 'All products';
  });

  // ---------- Filters (start from the URL, reset when it changes) ----------
  selectedCategories = linkedSignal(() => {
    const category = this.query().get('category');
    return category ? [category] : [];
  });
  sort = linkedSignal(() => this.query().get('sort') ?? 'recommended');
  priceRange = linkedSignal(() => { this.params(); this.query(); return 'all'; });
  minDiscount = linkedSignal(() => { this.params(); this.query(); return 0; });
  selectedSizes = linkedSignal<string[]>(() => { this.params(); this.query(); return []; });
  showFilters = signal(false);   // phones: filters open or closed

  // Products in this section and search, before the sidebar filters
  private sectionProducts = computed(() => {
    const gender = this.gender();
    const term = this.searchTerm().toLowerCase();
    return this.products().filter(p =>
      (!gender || p.gender.toLowerCase() === gender) &&
      (!term || [p.name, p.brand, p.category].some(v => v.toLowerCase().includes(term)))
    );
  });

  // Filter options come from the products actually in this section
  categories = computed(() => [...new Set(this.sectionProducts().map(p => p.category))].sort());
  sizes = computed(() => [...new Set(this.sectionProducts().flatMap(p => p.sizes))]);

  results = computed(() => {
    const range = PRICE_RANGES.find(r => r.id === this.priceRange()) ?? PRICE_RANGES[0];
    const categories = this.selectedCategories();
    const sizes = this.selectedSizes();

    const list = this.sectionProducts().filter(p =>
      (categories.length === 0 || categories.includes(p.category)) &&
      p.price >= range.min && p.price <= range.max &&
      discountPercent(p) >= this.minDiscount() &&
      (sizes.length === 0 || p.sizes.some(s => sizes.includes(s)))
    );

    return this.sortProducts(list);
  });

  activeFilterCount = computed(() =>
    this.selectedCategories().length + this.selectedSizes().length +
    (this.priceRange() !== 'all' ? 1 : 0) + (this.minDiscount() > 0 ? 1 : 0)
  );

  // ---------- Actions ----------
  toggleCategory(category: string, checked: boolean): void {
    this.selectedCategories.update(list =>
      checked ? [...list, category] : list.filter(c => c !== category));
  }

  toggleSize(size: string): void {
    this.selectedSizes.update(list =>
      list.includes(size) ? list.filter(s => s !== size) : [...list, size]);
  }

  clearFilters(): void {
    this.selectedCategories.set([]);
    this.selectedSizes.set([]);
    this.priceRange.set('all');
    this.minDiscount.set(0);
  }

  private sortProducts(list: Product[]): Product[] {
    const sorted = [...list];
    switch (this.sort()) {
      case 'new': return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      case 'price-asc': return sorted.sort((a, b) => a.price - b.price);
      case 'price-desc': return sorted.sort((a, b) => b.price - a.price);
      case 'discount': return sorted.sort((a, b) => discountPercent(b) - discountPercent(a));
      case 'rating': return sorted.sort((a, b) => b.rating - a.rating);
      default: return sorted;   // recommended = the API's order
    }
  }
}