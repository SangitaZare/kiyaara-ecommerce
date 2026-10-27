import { Injectable, computed, effect, signal } from '@angular/core';
import { Product } from '../models/product.model';

export interface CartItem {
  product: Product;
  size: string;
  quantity: number;
}

export const FREE_DELIVERY_FROM = 999;
export const DELIVERY_FEE = 79;
export const MAX_QUANTITY = 5;

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storageKey = 'kiyaara-bag';

  items = signal<CartItem[]>(this.load());

  // ---------- Totals (recalculate automatically) ----------
  count = computed(() => this.items().reduce((n, i) => n + i.quantity, 0));
  mrpTotal = computed(() => this.items().reduce((sum, i) => sum + i.product.mrp * i.quantity, 0));
  subtotal = computed(() => this.items().reduce((sum, i) => sum + i.product.price * i.quantity, 0));
  discount = computed(() => this.mrpTotal() - this.subtotal());
  freeDelivery = computed(() => this.subtotal() >= FREE_DELIVERY_FROM);
  deliveryFee = computed(() => (this.items().length === 0 || this.freeDelivery() ? 0 : DELIVERY_FEE));
  total = computed(() => this.subtotal() + this.deliveryFee());
  amountForFreeDelivery = computed(() => Math.max(FREE_DELIVERY_FROM - this.subtotal(), 0));

  constructor() {
    // Save the bag whenever it changes, so it survives a refresh
    effect(() => this.save(this.items()));
  }

  // ---------- Actions ----------
  add(product: Product, size: string): void {
    this.items.update(items => {
      const existing = items.find(i => i.product.id === product.id && i.size === size);
      return existing
        ? items.map(i => (i === existing ? { ...i, quantity: Math.min(this.maxQuantity(i), i.quantity + 1) } : i))
        : [...items, { product, size, quantity: 1 }];
    });
  }

  changeQuantity(item: CartItem, delta: number): void {
    const quantity = Math.min(this.maxQuantity(item), Math.max(1, item.quantity + delta));
    this.items.update(items => items.map(i => (i === item ? { ...i, quantity } : i)));
  }

  remove(item: CartItem): void {
    this.items.update(items => items.filter(i => i !== item));
  }

  clear(): void {
    this.items.set([]);
  }

  // Up to 5 of an item, and never more than the stock we last saw
  maxQuantity(item: CartItem): number {
    return Math.max(1, Math.min(MAX_QUANTITY, item.product.stock));
  }

  // ---------- Browser storage ----------
  private load(): CartItem[] {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) ?? '[]');
    } catch {
      return [];
    }
  }

  private save(items: CartItem[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch {
      // Storage blocked (private window): the bag still works until refresh
    }
  }
}