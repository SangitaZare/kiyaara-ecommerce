import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';
import { StatusChipComponent } from '../status-chip/status-chip.component';
import { imageOf, inr } from '../../shared/product-utils';
import { shortWhen } from '../../shared/order-status';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, StatusChipComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['../admin.css', './dashboard.component.css']
})
export class DashboardComponent {
  private dashboard = inject(DashboardService);
  auth = inject(AuthService);              // NEW (4C): for "Signed in as Asha"

  readonly inr = inr;
  readonly imageOf = imageOf;
  readonly shortWhen = shortWhen;

  // "Wednesday, 7 October"
  readonly today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  // undefined = loading, null = the API didn't answer, otherwise the numbers
  summary = toSignal(this.dashboard.getSummary().pipe(catchError(() => of(null))));

  // The four cards at the top; each one opens the matching list, already filtered
  stats = computed(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Orders today', value: s.ordersToday, note: `${inr(s.salesToday)} in sales`,
        tone: 'ink', link: '/admin/orders', query: {} },
      { label: 'Waiting to pack', value: s.waitingToPack, note: 'Placed, not packed yet',
        tone: 'packed', link: '/admin/orders', query: { status: 'Placed' } },
      { label: 'On the way', value: s.onTheWay, note: 'Shipped to customers',
        tone: 'shipped', link: '/admin/orders', query: { status: 'Shipped' } },
      { label: 'Low or sold out', value: s.runningLow + s.soldOut, note: 'Products to restock',
        tone: 'alert', link: '/admin/products', query: { stock: 'low' } }
    ];
  });
}
