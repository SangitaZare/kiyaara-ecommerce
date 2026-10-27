import { Injectable, computed, effect, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly storageKey = 'kiyaara-wishlist';

  ids = signal<number[]>(this.load());
  count = computed(() => this.ids().length);

  constructor() {
    effect(() => this.save(this.ids()));
  }

  has(id: number): boolean {
    return this.ids().includes(id);
  }

  toggle(id: number): void {
    this.ids.update(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  }

  private load(): number[] {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) ?? '[]');
    } catch {
      return [];
    }
  }

  private save(ids: number[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(ids));
    } catch {
      // Storage blocked (private window): hearts still work until refresh
    }
  }
}