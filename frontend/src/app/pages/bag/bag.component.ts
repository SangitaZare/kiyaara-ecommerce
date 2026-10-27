import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CartService, FREE_DELIVERY_FROM } from '../../services/cart.service';
import { deliveryDate, discountPercent, imageOf, inr } from '../../shared/product-utils';

@Component({
  selector: 'app-bag',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './bag.component.html',
  styleUrl: './bag.component.css'
})
export class BagComponent {
  cart = inject(CartService);

  readonly inr = inr;
  readonly imageOf = imageOf;
  readonly discountPercent = discountPercent;
  readonly deliveryBy = deliveryDate();

  // How full the free-delivery bar is, 0 to 100
  progress = computed(() =>
    Math.min(100, Math.round((this.cart.subtotal() / FREE_DELIVERY_FROM) * 100))
  );
}