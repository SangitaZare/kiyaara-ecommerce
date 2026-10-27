import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { Order, OrderStatus, PlaceOrderRequest } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/orders`;

  // Goes up by one after every status change, so the admin sidebar badge can refresh itself
  readonly changes = signal(0);

  place(request: PlaceOrderRequest): Observable<Order> {
    return this.http.post<Order>(this.apiUrl, request);
  }

  getById(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/${id}`);
  }

  // NEW (4B): the logged-in customer's own orders, newest first (the token is added by the interceptor)
  getMine(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/mine`);
  }
  // The customer cancels their own order (only before it ships)
  cancel(id: number): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/${id}/cancel`, {});
  }
  // Admin: every order, newest first
  getAll(): Observable<Order[]> {
    return this.http.get<Order[]>(this.apiUrl);
  }

  // Admin: PUT api/orders/1003/status with { "status": "Packed" }
  updateStatus(id: number, status: OrderStatus): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      tap(() => this.changes.update(n => n + 1))
    );
  }
}