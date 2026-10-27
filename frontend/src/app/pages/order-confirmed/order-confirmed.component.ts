import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OrderService } from '../../services/order.service';
import { deliveryDate, imageOf, inr } from '../../shared/product-utils';
import { ORDER_FLOW, isToday, reachedAt } from '../../shared/order-status';

@Component({
  selector: 'app-order-confirmed',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './order-confirmed.component.html',
  styleUrl: './order-confirmed.component.css'
})
export class OrderConfirmedComponent {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);

  readonly inr = inr;
  readonly imageOf = imageOf;

  // undefined = loading, null = not found, Order = loaded
  order = toSignal(
    this.route.paramMap.pipe(
      map(params => Number(params.get('id'))),
      switchMap(id => this.orderService.getById(id).pipe(catchError(() => of(null))))
    )
  );

  // "Sunday, 11 October"
  deliveryLong = computed(() => {
    const o = this.order();
    return o
      ? new Date(o.expectedDelivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
      : '';
  });

  // NEW: the heading follows the real status the admin sets
  headline = computed(() => {
    switch (this.order()?.status) {
      case 'Packed': return 'Your order is packed';
      case 'Shipped': return 'Your order is on the way';
      case 'Delivered': return 'Your order is delivered';
      case 'Cancelled': return 'This order is cancelled';
      default: return 'Your order is placed';
    }
  });

  // NEW: steps are ticked up to the real status; reached steps show when they happened
  steps = computed(() => {
    const o = this.order();
    if (!o) return [];
    const placed = new Date(o.placedAt);
    const reached = ORDER_FLOW.indexOf(o.status);     // -1 when cancelled

    return ORDER_FLOW.map((status, i) => {
      const at = reachedAt(o, status);
      const done = i <= reached;
      let when: string;
      if (at) when = isToday(at) ? 'Today' : deliveryDate(0, at);
      else if (done) when = 'Done';
      else if (status === 'Delivered') when = 'By ' + deliveryDate(0, new Date(o.expectedDelivery));
      else when = deliveryDate(i, placed);           // expected: packed next day, shipped the day after
      return { label: status, when, done };
    });
  });
}