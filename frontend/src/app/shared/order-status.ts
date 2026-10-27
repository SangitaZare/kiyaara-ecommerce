import { HttpErrorResponse } from '@angular/common/http';
import { Order, OrderStatus } from '../models/order.model';

// The normal journey of an order; Cancelled can happen before Shipped
export const ORDER_FLOW: OrderStatus[] = ['Placed', 'Packed', 'Shipped', 'Delivered'];
export const ALL_STATUSES: OrderStatus[] = [...ORDER_FLOW, 'Cancelled'];

// When the order reached a status, or undefined if it hasn't (or skipped it)
export function reachedAt(order: Order, status: OrderStatus): Date | undefined {
  const change = order.history.find(h => h.status === status);
  return change ? new Date(change.at) : undefined;
}

export function isToday(date: Date): boolean {
  return date.toDateString() === new Date().toDateString();
}

// "3:42 pm"
export function timeOf(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// "Today, 3:42 pm" or "Tue, 6 Oct": for order lists
export function shortWhen(iso: string): string {
  const date = new Date(iso);
  return isToday(date)
    ? `Today, ${timeOf(date)}`
    : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// "Tue, 6 Oct at 6:20 pm": for the order page header
export function longWhen(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} at ${timeOf(date)}`;
}

// The first message from an ASP.NET "errors" response, or a friendly fallback
export function firstError(err: HttpErrorResponse, fallback: string): string {
  if (err.status === 0) return "Can't reach the API. Check that it is running, then try again.";
  const messages = Object.values(err.error?.errors ?? {}).flat() as string[];
  return messages[0] ?? fallback;
}