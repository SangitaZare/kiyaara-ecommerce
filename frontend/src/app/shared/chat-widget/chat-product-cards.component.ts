import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProductCard } from '../../models/assistant.model';
import { discountPercent, imageOf, inr } from '../product-utils';

// The products an assistant reply mentions, as small cards: a row you can scroll in the
// small chat, a grid in the big one. Each card opens the product page.
@Component({
  selector: 'app-chat-product-cards',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <ul class="cards" [attr.aria-label]="products().length === 1 ? '1 product' : products().length + ' products'">
      @for (p of products(); track p.id) {
        <li>
          <a class="card" [routerLink]="['/product', p.id]" (click)="opened.emit()"
             [attr.aria-label]="label(p)">
            <div class="media">
              <img [src]="image(p)" [alt]="" loading="lazy">
              @if (!p.inStock) {
                <span class="tag">Sold out</span>
              } @else if (off(p) > 0) {
                <span class="tag off">{{ off(p) }}% off</span>
              }
              @if (p.rating) {
                <span class="rating">{{ p.rating }} <mat-icon>star</mat-icon></span>
              }
            </div>
            <div class="info">
              <span class="brand">{{ p.brand }}</span>
              <span class="name">{{ p.name }}</span>
              <span class="price">
                <strong>{{ inr(p.price) }}</strong>
                @if (off(p) > 0) { <s>{{ inr(p.mrp) }}</s> }
              </span>
              <span class="view">View <mat-icon>arrow_forward</mat-icon></span>
            </div>
          </a>
        </li>
      }
    </ul>
  `,
  styleUrl: './chat-product-cards.component.css'
})
export class ChatProductCardsComponent {
  readonly products = input.required<ProductCard[]>();
  readonly opened = output<void>();

  protected readonly inr = inr;
  protected image = (p: ProductCard) => imageOf(p);
  protected off = (p: ProductCard) => discountPercent(p);

  // One sentence a screen reader can read for the whole card
  protected label(p: ProductCard): string {
    const price = this.off(p) > 0 ? `${inr(p.price)}, ${this.off(p)}% off ${inr(p.mrp)}` : inr(p.price);
    return `${p.brand} ${p.name}, ${price}${p.inStock ? '' : ', sold out'}`;
  }
}
