import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { OrderService } from '../../services/order.service';
import { OrderStatus } from '../../models/order.model';
import { StatusChipComponent } from '../status-chip/status-chip.component';
import { ALL_STATUSES, shortWhen } from '../../shared/order-status';
import { inr } from '../../shared/product-utils';

type Filter = 'All' | OrderStatus;

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [RouterLink, StatusChipComponent],
  templateUrl: './orders.component.html',
  styleUrls: ['../admin.css', './orders.component.css']
})
export class OrdersComponent {
  private orderService = inject(OrderService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly inr = inr;
  readonly shortWhen = shortWhen;
  readonly filters: Filter[] = ['All', ...ALL_STATUSES];

  // undefined = loading, null = the API didn't answer
  orders = toSignal(this.orderService.getAll().pipe(catchError(() => of(null))));

  // The status filter lives in the address (?status=Placed), so dashboard cards can link straight to it
  filter = toSignal(
    this.route.queryParamMap.pipe(map(q => (q.get('status') ?? 'All') as Filter)),
    { initialValue: 'All' as Filter }
  );

  search = signal('');

  // How many orders each chip stands for
  counts = computed(() => {
    const list = this.orders() ?? [];
    const counts: Record<string, number> = { All: list.length };
    for (const status of ALL_STATUSES) {
      counts[status] = list.filter(o => o.status === status).length;
    }
    return counts;
  });

  // The rows after the status chip and the search box
  rows = computed(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    return (this.orders() ?? []).filter(o =>
      (f === 'All' || o.status === f) &&
      (!q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.address.fullName.toLowerCase().includes(q) ||
        o.address.city.toLowerCase().includes(q))
    );
  });

  pick(f: Filter): void {
    // Changes only the ?status= part of the address; the page stays
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: f === 'All' ? null : f },
      queryParamsHandling: 'merge'
    });
  }
}