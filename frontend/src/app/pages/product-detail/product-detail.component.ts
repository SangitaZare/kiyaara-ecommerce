import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';

import { catchError, map, of, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product.model';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { discountPercent, imageOf, inr } from '../../shared/product-utils';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, ProductCardComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css'
})
export class ProductDetailComponent {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private cart = inject(CartService);
  private snackBar = inject(MatSnackBar);
  private titleService = inject(Title);
  private router = inject(Router);

  readonly inr = inr;
  readonly imageOf = imageOf;

  // undefined = still loading, null = not found, Product = loaded
  product = toSignal(
    this.route.paramMap.pipe(
      map(params => Number(params.get('id'))),
      switchMap(id => this.productService.getById(id).pipe(catchError(() => of(null))))
    )
  );

  private allProducts = toSignal(
    this.productService.getAll().pipe(catchError(() => of([] as Product[]))),
    { initialValue: [] as Product[] }
  );

  off = computed(() => {
    const p = this.product();
    return p ? discountPercent(p) : 0;
  });

  // Same category first, then the same section
  similar = computed(() => {
    const p = this.product();
    if (!p) return [];
    const others = this.allProducts().filter(x => x.id !== p.id);
    const sameCategory = others.filter(x => x.category === p.category);
    const sameSection = others.filter(x => x.gender === p.gender && x.category !== p.category);
    return [...sameCategory, ...sameSection].slice(0, 4);
  });

  // Reset these whenever a different product opens
  selectedSize = linkedSignal(() => {
    const p = this.product();
    return p && p.sizes.length === 1 ? p.sizes[0] : '';   // auto-pick "Free Size"
  });
  sizeError = linkedSignal(() => { this.product(); return false; });
  deliveryMessage = linkedSignal(() => { this.product(); return ''; });
  pincode = signal('');

  constructor() {
    // Browser tab shows the product name
    effect(() => {
      const p = this.product();
      if (p) this.titleService.setTitle(`${p.brand} ${p.name} | Kiyaara`);
    });
  }

  chooseSize(size: string): void {
    this.selectedSize.set(size);
    this.sizeError.set(false);
  }

  addToBag(p: Product): void {
    if (p.sizes.length > 0 && !this.selectedSize()) {
      this.sizeError.set(true);
      return;
    }
    this.cart.add(p, this.selectedSize());
    const size = this.selectedSize() ? `, size ${this.selectedSize()}` : '';
   this.snackBar
  .open(`Added to bag${size}`, 'View bag', { duration: 4000 })
  .onAction()
  .subscribe(() => this.router.navigate(['/bag']));
  }

  checkDelivery(): void {
    const pin = this.pincode().trim();
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      this.deliveryMessage.set('Enter a valid 6-digit pincode.');
      return;
    }
    const date = new Date();
    date.setDate(date.getDate() + 4);
    const day = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    this.deliveryMessage.set(`Delivery by ${day} to ${pin}. Pay on delivery available.`);
  }
}