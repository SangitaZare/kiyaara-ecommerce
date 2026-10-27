import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { AddressType, PaymentMethod, PlaceOrderRequest } from '../../models/order.model';
import { INDIAN_STATES } from '../../shared/indian-states';
import { imageOf, inr } from '../../shared/product-utils';

type Field = 'fullName' | 'mobile' | 'pincode' | 'city' | 'state' | 'house' | 'area' | 'landmark';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})
export class CheckoutComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private auth = inject(AuthService);              // NEW (4B)
  cart = inject(CartService);

  readonly inr = inr;
  readonly imageOf = imageOf;
  readonly states = INDIAN_STATES;

  payment = signal<PaymentMethod>('COD');
  placing = signal(false);
  serverErrors = signal<string[]>([]);

  // NEW (4B): the logged-in customer's name and mobile are filled in for you (you can still change them)
  private customer = this.auth.customer();

  // Same rules as DeliveryAddress in Order.cs
  form = this.fb.nonNullable.group({
    fullName: [this.customer?.fullName ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    mobile: [this.customer?.mobile ?? '', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    pincode: ['', [Validators.required, Validators.pattern(/^[1-9]\d{5}$/)]],
    city: ['', [Validators.required, Validators.maxLength(60)]],
    state: ['', Validators.required],
    house: ['', [Validators.required, Validators.maxLength(120)]],
    area: ['', [Validators.required, Validators.maxLength(120)]],
    landmark: ['', Validators.maxLength(120)],
    addressType: ['Home' as AddressType]
  });

  isInvalid(field: Field): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  setAddressType(type: AddressType): void {
    this.form.controls.addressType.setValue(type);
  }

  placeOrder(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();   // shows every red message
      document.querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid')?.focus();
      return;
    }

    const request: PlaceOrderRequest = {
      items: this.cart.items().map(i => ({ productId: i.product.id, size: i.size, quantity: i.quantity })),
      address: this.form.getRawValue(),
      paymentMethod: this.payment()
    };

    this.placing.set(true);
    this.serverErrors.set([]);

    // The interceptor adds the login token, so the API knows whose order this is
    this.orderService.place(request).subscribe({
      next: order => {
        this.cart.clear();                          // the bag is now an order
        this.router.navigate(['/order', order.id]);
      },
      error: (err: HttpErrorResponse) => {
        this.placing.set(false);
        this.serverErrors.set(this.readErrors(err));
      }
    });
  }

  private readErrors(err: HttpErrorResponse): string[] {
    if (err.status === 0) {
      return ["Can't reach the store right now. Check that the API is running, then try again."];
    }
    if (err.status === 401) {
      return ['Your login has ended. Please log in again to place your order.'];   // NEW (4B)
    }
    if (err.status === 400 && err.error?.errors) {
      // Same "errors" format for automatic validation and the controller's own checks
      return [...new Set(Object.values(err.error.errors).flat() as string[])];
    }
    return ['Something went wrong while placing your order. Please try again.'];
  }
}