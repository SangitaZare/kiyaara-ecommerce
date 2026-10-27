import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';
import { LOW_STOCK_BELOW, SECTIONS, stockLook } from '../../shared/catalog';
import { discountPercent, imageOf, inr } from '../../shared/product-utils';
import { firstError } from '../../shared/order-status';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './product-list.component.html',
  styleUrls: ['../admin.css', './product-list.component.css']
})
export class ProductListComponent {
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);

  readonly inr = inr;
  readonly imageOf = imageOf;
  readonly discountPercent = discountPercent;
  readonly stockLook = stockLook;
  readonly sections = ['All', ...SECTIONS];

  // undefined = loading, null = the API didn't answer
  private loaded = toSignal(this.productService.getAll().pipe(catchError(() => of(null))));

  // Starts as the loaded list; a delete removes the row without loading everything again
  products = linkedSignal(() => this.loaded());

  section = signal('All');
  search = signal('');

  // The dashboard's "Low or sold out" card opens /admin/products?stock=low with this switched on
  private query = toSignal(this.route.queryParamMap);
  lowOnly = linkedSignal(() => this.query()?.get('stock') === 'low');

  confirmId = signal<number | null>(null);    // the row showing "Delete? Yes / Keep"
  deleting = signal(false);
  message = signal<{ text: string; ok: boolean } | null>(null);

  // How many products each section chip stands for
  counts = computed(() => {
    const list = this.products() ?? [];
    const counts: Record<string, number> = { All: list.length };
    for (const s of SECTIONS) {
      counts[s] = list.filter(p => p.gender === s).length;
    }
    return counts;
  });

  lowCount = computed(() => (this.products() ?? []).filter(p => p.stock < LOW_STOCK_BELOW).length);

  // The rows after the section chip, the low-stock chip and the search box
  rows = computed(() => {
    const section = this.section();
    const low = this.lowOnly();
    const q = this.search().trim().toLowerCase();
    return (this.products() ?? []).filter(p =>
      (section === 'All' || p.gender === section) &&
      (!low || p.stock < LOW_STOCK_BELOW) &&
      (!q || `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q))
    );
  });

  askDelete(id: number): void {
    this.confirmId.set(id);
    this.message.set(null);
  }

  remove(product: Product): void {
    this.deleting.set(true);
    this.productService.delete(product.id).subscribe({
      next: () => {
        this.products.update(list => (list ?? []).filter(p => p.id !== product.id));
        this.confirmId.set(null);
        this.deleting.set(false);
        this.message.set({ ok: true, text: `${product.name} was deleted. It no longer shows in the store.` });
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.message.set({ ok: false, text: firstError(err, `Couldn't delete ${product.name}. Please try again.`) });
      }
    });
  }
}