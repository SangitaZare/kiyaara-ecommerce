import { Product } from '../models/product.model';
import { API_BASE_URL } from '../api.config';

// NEW (4D): where the API itself lives, 'https://localhost:7001' (API_BASE_URL without '/api')
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

// 50 for a product with MRP 2999 and price 1499
export function discountPercent(p: Pick<Product, 'price' | 'mrp'>): number {
  return p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
}

// 7,39,800 style Indian number format with the rupee sign
export function inr(value: number): string {
  return '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// The photo, or a branded placeholder when there isn't one yet.
// CHANGED (4D): uploaded photos ('/uploads/products/...') live on the API, not in the Angular app,
// so they get the API's address in front. The 12 starter photos ('/images/products/...') stay as they are.
export function imageOf(item: { imageUrl: string; name: string }): string {
  const url = item.imageUrl;
  if (!url) {
    return `https://placehold.co/600x800/0b5d5e/ffffff?text=${encodeURIComponent(item.name)}&font=lora`;
  }
  return url.startsWith('/uploads/') ? API_ORIGIN + url : url;
}

// "Sun, 11 Oct": the store's standard delivery time is 4 days
export function deliveryDate(days = 4, from: Date = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
