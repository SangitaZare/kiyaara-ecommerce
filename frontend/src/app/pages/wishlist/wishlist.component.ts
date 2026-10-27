import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProductService } from '../../services/product.service';
import { WishlistService } from '../../services/wishlist.service';
import { Product } from '../../models/product.model';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, ProductCardComponent],
  template: `
    <div class="container page">
      <h1>My wishlist <span class="count">{{ items().length }} items</span></h1>

      @if (loadError()) {
        <p class="notice">We couldn't load products. Start the API in Visual Studio, then refresh this page.</p>
      }

      @if (loading()) {
        <p class="hint">Loading your wishlist...</p>
      } @else if (items().length === 0) {
        <div class="empty">
          <div class="empty-icon"><mat-icon>favorite_border</mat-icon></div>
          <h2>Your wishlist is empty</h2>
          <p>Tap the heart on any product to save it here.</p>
          <a mat-flat-button routerLink="/shop">Start shopping</a>
        </div>
      } @else {
        <p class="hint">Open a product to choose your size and add it to your bag.</p>
        <div class="grid">
          @for (p of items(); track p.id) {
            <app-product-card [product]="p" />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding-top: 32px; padding-bottom: 64px; }

    h1 {
      margin: 0; display: flex; align-items: baseline; gap: 12px;
      font-family: var(--k-display); font-weight: 400; font-size: 2rem;
    }
    .count { font-family: var(--k-body); font-size: 0.9375rem; font-weight: 500; color: var(--k-muted); }
    .hint { margin: 6px 0 24px; color: var(--k-muted); }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 32px 20px; }

    .empty { max-width: 440px; margin: 0 auto; padding: 64px 0; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
    .empty-icon {
      width: 72px; height: 72px; border-radius: 50%; background: #fdecee; color: #d63447;
      display: flex; align-items: center; justify-content: center;
    }
    .empty-icon mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .empty h2 { margin: 8px 0 0; font-family: var(--k-display); font-weight: 400; font-size: 1.75rem; }
    .empty p { margin: 0 0 12px; color: var(--k-muted); }

    .notice { margin: 20px 0 0; padding: 12px 16px; border-radius: 4px; background: #fdf3e2; border: 1px solid #f3d29a; }
  `]
})
export class WishlistComponent {
  private productService = inject(ProductService);
  private wishlist = inject(WishlistService);

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

  // Newest saved first; products removed from the store are skipped
  items = computed(() =>
    [...this.wishlist.ids()]
      .reverse()
      .map(id => this.products().find(p => p.id === id))
      .filter((p): p is Product => !!p)
  );
}