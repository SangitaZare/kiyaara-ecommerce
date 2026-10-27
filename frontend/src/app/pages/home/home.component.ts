import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';
import { ProductCardComponent } from '../../shared/product-card/product-card.component';
import { imageOf } from '../../shared/product-utils';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, ProductCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private productService = inject(ProductService);
  readonly imageOf = imageOf;

  loadError = signal(false);

  // toSignal turns the HTTP call into a signal; [] until the data arrives
  products = toSignal(
    this.productService.getAll().pipe(
      catchError(() => {
        this.loadError.set(true);
        return of([] as Product[]);
      })
    ),
    { initialValue: [] as Product[] }
  );

  // Hero collage: one product from each of these categories
  heroProducts = computed(() =>
    ['Sarees', 'Kurta Sets', 'Jewellery']
      .map(category => this.products().find(p => p.category === category))
      .filter((p): p is Product => !!p)
  );

  // The first product of each category becomes that category's tile
  categoryTiles = computed(() => {
    const firstByCategory = new Map<string, Product>();
    for (const p of this.products()) {
      if (!firstByCategory.has(p.category)) firstByCategory.set(p.category, p);
    }
    return [...firstByCategory.values()].slice(0, 6);
  });

  newArrivals = computed(() =>
    [...this.products()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4)
  );

  steals = computed(() =>
    this.products().filter(p => p.price < 999 && p.stock > 0).slice(0, 4)
  );
}