import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { OrderService } from '../../services/order.service';
import { OrderStatus } from '../../models/order.model';
import { StatusChipComponent } from '../status-chip/status-chip.component';
import { ALL_STATUSES, ORDER_FLOW, firstError, longWhen, reachedAt } from '../../shared/order-status';
import { deliveryDate, imageOf, inr } from '../../shared/product-utils';

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  imports: [RouterLink, MatIconModule, StatusChipComponent],
  templateUrl: './order-detail.component.html',
  styleUrls: ['../admin.css', './order-detail.component.css']
})
export class OrderDetailComponent {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);

  readonly inr = inr;
  readonly imageOf = imageOf;
  readonly longWhen = longWhen;

  // The order from the API: undefined = loading, null = not found
  private loaded = toSignal(
    this.route.paramMap.pipe(
      map(params => Number(params.get('id'))),
      switchMap(id => this.orderService.getById(id).pipe(catchError(() => of(null))))
    )
  );

  // Starts as the loaded order; after "Save status" it holds the order the API sent back
  order = linkedSignal(() => this.loaded());

  // The option the admin has clicked; resets to the real status whenever the order changes
  selected = linkedSignal(() => this.order()?.status);

  saving = signal(false);
  message = signal<{ text: string; ok: boolean } | null>(null);

  // The four tracker steps, from the saved status (not the clicked one)
  steps = computed(() => {
    const o = this.order();
    if (!o) return [];
    const reached = ORDER_FLOW.indexOf(o.status);     // -1 when cancelled
    return ORDER_FLOW.map((status, i) => {
      const at = reachedAt(o, status);
      const done = i <= reached;
      let when = '';
      if (at) when = deliveryDate(0, at);
      else if (status === 'Delivered') when = 'By ' + deliveryDate(0, new Date(o.expectedDelivery));
      return { label: status, done, when };
    });
  });

  // The five status options; the ones the API would refuse are greyed out
  options = computed(() => {
    const o = this.order();
    if (!o) return [];
    return ALL_STATUSES.map(status => ({
      status,
      hint: status === 'Delivered' ? 'Final' : status === 'Cancelled' ? 'Returns stock' : '',
      allowed: status === o.status || o.nextStatuses.includes(status)
    }));
  });

  isFinal = computed(() => this.order()?.nextStatuses.length === 0);
  hasChange = computed(() => !!this.order() && this.selected() !== this.order()!.status);
  warnCancel = computed(() => this.hasChange() && this.selected() === 'Cancelled');

  // Total MRP minus what the customer pays for the items
  discount = computed(() => {
    const o = this.order();
    return o ? o.totalMrp - o.subtotal : 0;
  });

  choose(status: OrderStatus): void {
    this.selected.set(status);
    this.message.set(null);
  }

  save(): void {
    const o = this.order();
    const status = this.selected();
    if (!o || !status || status === o.status) return;

    this.saving.set(true);
    this.message.set(null);

    this.orderService.updateStatus(o.id, status).subscribe({
      next: saved => {
        this.order.set(saved);              // tracker, chip and options all follow
        this.saving.set(false);
        const firstName = saved.address.fullName.split(' ')[0];
        this.message.set({ ok: true, text: `Saved. ${firstName} now sees "${saved.status}".` });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.message.set({ ok: false, text: firstError(err, "Couldn't save the status. Please try again.") });
      }
    });
  }
}