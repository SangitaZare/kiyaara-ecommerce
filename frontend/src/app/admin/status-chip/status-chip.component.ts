import { Component, input } from '@angular/core';
import { OrderStatus } from '../../models/order.model';

// <app-status-chip [status]="o.status" />  ->  a small coloured pill with a dot
@Component({
  selector: 'app-status-chip',
  standalone: true,
  template: `<span [class]="'chip ' + status().toLowerCase()"><span class="dot"></span>{{ status() }}</span>`,
  styles: [`
    .chip {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 12px;
      font-size: 0.75rem; font-weight: 700; white-space: nowrap;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .placed    { background: #e8eef7; color: #2f4a7a; }
    .packed    { background: #fdf3e2; color: #8a5a12; }
    .shipped   { background: #e4f0ee; color: #0b5d5e; }
    .delivered { background: #e7f4ec; color: #2e7d5b; }
    .cancelled { background: #fdecee; color: #b3261e; }
  `]
})
export class StatusChipComponent {
  status = input.required<OrderStatus>();
}