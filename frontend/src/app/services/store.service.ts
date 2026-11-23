import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api.config';

interface DeliveryInfo {
  freeFrom: number;
  fee: number;
}

// Shop-wide rules the pages show, read once from the API (GET /api/store/delivery), so the banners,
// the bag estimate, checkout and the AI assistant all use the numbers the server actually charges.
@Injectable({ providedIn: 'root' })
export class StoreService {
  private http = inject(HttpClient);

  // Shown until the API answers (and if it can't be reached); replaced by the server's values
  readonly freeDeliveryFrom = signal(999);
  readonly deliveryFee = signal(79);

  constructor() {
    this.http.get<DeliveryInfo>(`${API_BASE_URL}/store/delivery`).subscribe({
      next: info => {
        this.freeDeliveryFrom.set(info.freeFrom);
        this.deliveryFee.set(info.fee);
      },
      error: () => { /* keep the starting values; checkout still charges the server's amount */ }
    });
  }
}
