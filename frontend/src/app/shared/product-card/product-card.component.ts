import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../models/product.model';
import { WishlistService } from '../../services/wishlist.service';
import { discountPercent, imageOf, inr } from '../product-utils';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="wrap">
      <a class="card" [routerLink]="['/product', product().id]">
        <div class="media">
          <img [src]="image()" [alt]="product().brand + ' ' + product().name" loading="lazy">

          @if (tag(); as t) {
            <span class="tag" [class.sold]="t.sold">{{ t.label }}</span>
          }

          @if (product().rating) {
            <span class="rating">
              {{ product().rating }} <mat-icon>star</mat-icon>
              <span class="count">{{ shortCount() }}</span>
            </span>
          }
        </div>

        <div class="info">
          <div class="brand">{{ product().brand }}</div>
          <div class="name">{{ product().name }}</div>
          <div class="price">
            <span class="now">{{ inr(product().price) }}</span>
            @if (off() > 0) {
              <span class="mrp">{{ inr(product().mrp) }}</span>
              <span class="off">{{ off() }}% off</span>
            }
          </div>
        </div>
      </a>

      <!-- Heart sits over the photo, outside the link -->
      <button type="button" class="heart" [class.on]="saved()"
              [attr.aria-pressed]="saved()"
              [attr.aria-label]="saved() ? 'Remove ' + product().name + ' from wishlist' : 'Save ' + product().name + ' to wishlist'"
              (click)="wishlist.toggle(product().id)">
        <mat-icon>{{ saved() ? 'favorite' : 'favorite_border' }}</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .wrap { position: relative; }

    .card { display: block; color: var(--k-ink); }
    .card:hover .brand { color: var(--k-peacock); }

    .media { position: relative; aspect-ratio: 3 / 4; overflow: hidden; background: var(--k-mist); }
    .media img { width: 100%; height: 100%; object-fit: cover; }

    /* Bestseller / Only 3 left / Sold out */
    .tag {
      position: absolute; top: 12px; left: 12px; padding: 4px 10px; border-radius: 12px;
      background: var(--k-marigold); color: var(--k-ink); font-size: 0.75rem; font-weight: 700;
    }
    .tag.sold { background: var(--k-ink); color: #fff; }

    /* Rating chip */
    .rating {
      position: absolute; left: 10px; bottom: 10px;
      display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
      background: rgba(255, 255, 255, 0.95); border-radius: 4px;
      font-size: 0.75rem; font-weight: 700;
    }
    .rating mat-icon { font-size: 14px; width: 14px; height: 14px; color: var(--k-marigold); }
    .rating .count { font-weight: 500; color: var(--k-muted); border-left: 1px solid var(--k-line); padding-left: 6px; }

    /* Heart button: outline, then filled red when saved */
    .heart {
      position: absolute; top: 8px; right: 8px; width: 44px; height: 44px;
      border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 1px 3px rgba(31, 36, 48, 0.15);
      color: var(--k-ink); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .heart mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .heart:hover { color: #d63447; }
    .heart.on { color: #d63447; }
    .heart.on mat-icon { animation: pop 250ms ease-out; }
    @keyframes pop { 50% { transform: scale(1.25); } }

    .info { padding: 10px 2px 0; }
    .brand { font-weight: 700; font-size: 0.9375rem; }
    .name {
      margin-top: 2px; font-size: 0.875rem; color: var(--k-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .price { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; font-size: 0.875rem; }
    .now { font-weight: 700; }
    .mrp { font-size: 0.8125rem; color: var(--k-muted); text-decoration: line-through; }
    .off { font-size: 0.8125rem; font-weight: 600; color: var(--k-sale); }

    @media (prefers-reduced-motion: reduce) {
      .heart.on mat-icon { animation: none; }
    }
  `]
})
export class ProductCardComponent {
  wishlist = inject(WishlistService);

  product = input.required<Product>();

  image = computed(() => imageOf(this.product()));
  off = computed(() => discountPercent(this.product()));
  saved = computed(() => this.wishlist.has(this.product().id));

  // Sold out first, then low stock, then bestseller
  tag = computed(() => {
    const p = this.product();
    if (p.stock === 0) return { label: 'Sold out', sold: true };
    if (p.stock < 5) return { label: `Only ${p.stock} left`, sold: false };
    if (p.rating >= 4.5 && p.ratingCount >= 800) return { label: 'Bestseller', sold: false };
    return null;
  });

  shortCount = computed(() => {
    const count = this.product().ratingCount;
    return count >= 1000 ? (count / 1000).toFixed(1) + 'k' : String(count);
  });

  readonly inr = inr;
}