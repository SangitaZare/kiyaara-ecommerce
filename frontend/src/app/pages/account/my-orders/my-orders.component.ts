import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';
import { OrderService } from '../../../services/order.service';
import { Order } from '../../../models/order.model';
import { StatusChipComponent } from '../../../admin/status-chip/status-chip.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { ORDER_FLOW, firstError, reachedAt, shortWhen } from '../../../shared/order-status';
import { deliveryDate, imageOf, inr } from '../../../shared/product-utils';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [RouterLink, MatIconModule, StatusChipComponent],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.css'
})
export class MyOrdersComponent {
  auth = inject(AuthService);
  private orderService = inject(OrderService);
  private dialog = inject(MatDialog);

  readonly inr = inr;
  readonly imageOf = imageOf;

  loading = signal(true);
  loadError = signal(false);
  cancellingId = signal<number | null>(null);     // the order being cancelled right now
  cancelError = signal('');

  private orders = signal<Order[]>([]);

  constructor() {
    this.orderService.getMine().subscribe({
      next: list => {
        this.orders.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      }
    });
  }

  // "+91 98470 12345"
  mobile = computed(() => {
    const m = this.auth.customer()?.mobile ?? '';
    return m.length === 10 ? `+91 ${m.slice(0, 5)} ${m.slice(5)}` : m;
  });

  countText = computed(() => {
    const n = this.orders().length;
    return n === 1 ? '1 order' : `${n} orders`;
  });

  // Everything one order card shows, worked out once
  cards = computed(() => this.orders().map(order => {
    const reached = ORDER_FLOW.indexOf(order.status);       // -1 when cancelled
    const first = order.items[0];
    const more = order.items.length - 1;

    return {
      order,
      headline: this.headline(order),
      itemsText: first ? (more > 0 ? `${first.name} and ${more} more` : first.name) : 'Order',
      placed: shortWhen(order.placedAt),
      note: order.paymentMethod === 'UPI'
        ? 'Paid by UPI'
        : order.status === 'Cancelled' ? 'Cash on delivery. Nothing to pay.' : 'Cash on delivery',
      photos: order.items.slice(0, 2),
      // The progress bar is for orders still on their way
      showTrack: reached >= 0 && order.status !== 'Delivered',
      steps: ORDER_FLOW.map((name, i) => ({ name, done: i <= reached })),
      action: order.status === 'Delivered' || order.status === 'Cancelled' ? 'View details' : 'Track order',
      // The API says where an order may go next: "Cancelled" is there only for Placed and Packed orders
      canCancel: order.nextStatuses.includes('Cancelled')
    };
  }));

  // "Cancel order" button: ask first, then call the API
  cancel(order: Order): void {
    this.cancelError.set('');

    const data: ConfirmDialogData = {
      title: `Cancel order ${order.orderNumber}?`,
      message: "The items go back on the shelf. This can't be undone.",
      confirmText: 'Yes, cancel order'
    };

    this.dialog.open(ConfirmDialogComponent, { data }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.cancellingId.set(order.id);
      this.orderService.cancel(order.id).subscribe({
        next: updated => {
          // Swap the old order for the cancelled one: the card updates by itself
          this.orders.update(list => list.map(o => (o.id === updated.id ? updated : o)));
          this.cancellingId.set(null);
        },
        error: (err: HttpErrorResponse) => {
          this.cancellingId.set(null);
          this.cancelError.set(firstError(err, "We couldn't cancel this order. Please try again."));
        }
      });
    });
  }

  private headline(order: Order): string {
    const arriving = 'Arriving by ' + deliveryDate(0, new Date(order.expectedDelivery));
    switch (order.status) {
      case 'Packed': return `Packed. ${arriving}`;
      case 'Shipped': return `On the way. ${arriving}`;
      case 'Delivered': return 'Delivered on ' + deliveryDate(0, reachedAt(order, 'Delivered') ?? new Date(order.expectedDelivery));
      case 'Cancelled': return 'Cancelled on ' + deliveryDate(0, reachedAt(order, 'Cancelled') ?? new Date(order.placedAt));
      default: return `Order placed. ${arriving}`;
    }
  }
}