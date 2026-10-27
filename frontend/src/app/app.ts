import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';
import { CheckoutHeaderComponent } from './layout/checkout-header/checkout-header.component';

// NEW (4B): full-page screens with their own logo, so the store header and footer step aside
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, CheckoutHeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private router = inject(Router);

  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  // Admin pages have their own sidebar
  isAdmin = computed(() => this.url().startsWith('/admin'));

  // NEW: log in, create account, forgot and reset password
  isAuthPage = computed(() => AUTH_PAGES.some(page => this.url().startsWith(page)));

  // NEW: true when the store header and footer should be hidden
  fullPage = computed(() => this.isAdmin() || this.isAuthPage());

  // 0 = normal store page; 1, 2, 3 = the checkout steps
  checkoutStep = computed(() => {
    const url = this.url();
    if (url.startsWith('/bag')) return 1;
    if (url.startsWith('/checkout')) return 2;
    if (url.startsWith('/order/')) return 3;
    return 0;
  });
}