import { Component, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatBadgeModule],
  // 4B: a click anywhere else, or the Escape key, closes the account menu
  host: {
    '(document:click)': 'closeIfOutside($event)',
    '(document:keydown.escape)': 'closeMenu()'
  },
  template: `
    <div class="strip">Free delivery on orders above &#8377;999. Easy 15-day returns.</div>

    <div class="bar">
      <div class="container bar-inner">
        <a routerLink="/" class="logo" aria-label="Kiyaara home">Kiyaara<span class="dot">.</span></a>

        <nav aria-label="Shop sections">
          <a routerLink="/shop/women" routerLinkActive="active">Women</a>
          <a routerLink="/shop/men" routerLinkActive="active">Men</a>
          <a routerLink="/shop/kids" routerLinkActive="active">Kids</a>
          <a routerLink="/shop" [queryParams]="{ sort: 'new' }">New in</a>
        </nav>

        <div class="search" role="search">
          <mat-icon>search</mat-icon>
          <input #term type="search" placeholder="Search for kurtas, sarees, brands"
                 aria-label="Search products" (keydown.enter)="search(term.value)">
        </div>

        <div class="actions">
          <!-- CHANGED (4C): the Admin link shows only for admins -->
          @if (auth.isAdmin()) {
            <a routerLink="/admin" class="action admin-link">
              <mat-icon>storefront</mat-icon>
              <span>Admin</span>
            </a>
          }

          <!-- 4B: Log in, or the account menu once logged in -->
          @if (auth.isLoggedIn()) {
            <div class="account">
              <button type="button" class="action account-button" (click)="toggleMenu()"
                      aria-haspopup="true" aria-controls="account-menu" [attr.aria-expanded]="menuOpen()">
                <span class="avatar" [class.staff]="auth.isAdmin()">{{ auth.initial() }}</span>
                <span>{{ auth.firstName() }}</span>
              </button>

              @if (menuOpen()) {
                <div class="menu" id="account-menu">
                  <div class="menu-head">
                    <strong>Hi, {{ auth.firstName() }}</strong>
                    <span>{{ auth.customer()?.email }}</span>
                  </div>
                  <a routerLink="/account/orders" (click)="closeMenu()"><mat-icon>receipt_long</mat-icon> My orders</a>
                  <a routerLink="/account/profile" (click)="closeMenu()"><mat-icon>person_outline</mat-icon> My account</a>
                  <a routerLink="/wishlist" (click)="closeMenu()"><mat-icon>favorite_border</mat-icon> Wishlist</a>
                  <button type="button" class="logout" (click)="logOut()"><mat-icon>logout</mat-icon> Log out</button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/login" routerLinkActive="active" class="action">
              <mat-icon>person_outline</mat-icon>
              <span>Log in</span>
            </a>
          }

          <a routerLink="/wishlist" routerLinkActive="active" class="action"
             [attr.aria-label]="'Wishlist, ' + wishlist.count() + ' items'">
            <mat-icon [matBadge]="wishlist.count()" [matBadgeHidden]="wishlist.count() === 0"
                      matBadgeSize="small">favorite_border</mat-icon>
            <span>Wishlist</span>
          </a>
          <a routerLink="/bag" class="action" [attr.aria-label]="'Bag, ' + cart.count() + ' items'">
            <mat-icon [matBadge]="cart.count()" [matBadgeHidden]="cart.count() === 0"
                      matBadgeSize="small">shopping_bag</mat-icon>
            <span>Bag</span>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; position: sticky; top: 0; z-index: 100; }

    .strip {
      background: var(--k-peacock); color: #e6f2f2;
      font-size: 0.8125rem; text-align: center; padding: 7px 16px;
    }
    .bar { background: #fff; border-bottom: 1px solid var(--k-line); }
    .bar-inner { display: flex; align-items: center; gap: 32px; height: 72px; }

    .logo { font-family: var(--k-display); font-size: 1.875rem; color: var(--k-peacock); letter-spacing: 0.02em; }
    .logo .dot { color: var(--k-marigold); }

    nav { display: flex; gap: 26px; height: 100%; }
    nav a {
      display: flex; align-items: center; font-weight: 600; font-size: 0.9375rem;
      border-bottom: 3px solid transparent;
    }
    nav a:hover { color: var(--k-peacock); }
    nav a.active { border-bottom-color: var(--k-marigold); }

    .search {
      flex: 1; max-width: 440px; height: 42px; padding: 0 14px;
      display: flex; align-items: center; gap: 8px;
      background: var(--k-mist); border-radius: 6px; color: var(--k-muted);
    }
    .search:focus-within { outline: 2px solid var(--k-peacock); }
    .search input {
      flex: 1; min-width: 0; border: 0; background: transparent;
      font: inherit; color: var(--k-ink); outline: none;
    }

    .actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
    .action {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      padding: 4px 8px; font-size: 0.75rem; font-weight: 600;
    }
    .action:hover, .action.active { color: var(--k-peacock); }

    /* NEW (4C): the Admin link in soft haldi, and a dark avatar for staff */
    .admin-link { border-radius: 8px; background: #fdf3e2; color: #8a5a12; font-weight: 700; }
    .admin-link:hover { color: #6b4409; }
    .avatar.staff { background: var(--k-ink); }

    /* ===== Account button and menu (4B) ===== */
    .account { position: relative; }
    .account-button { border: 0; background: transparent; cursor: pointer; font: inherit; font-size: 0.75rem; font-weight: 700; color: var(--k-peacock); }
    .avatar {
      width: 24px; height: 24px; border-radius: 50%; background: var(--k-peacock); color: #fff;
      font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }

    .menu {
      position: absolute; top: calc(100% + 10px); right: -12px; width: 250px; box-sizing: border-box; padding: 8px;
      border-radius: 12px; background: #fff; border: 1px solid var(--k-line);
      box-shadow: 0 12px 32px rgba(31, 36, 48, 0.14);
      display: flex; flex-direction: column;
    }
    .menu-head { padding: 10px 12px 12px; margin-bottom: 6px; border-bottom: 1px solid var(--k-line); display: flex; flex-direction: column; gap: 2px; }
    .menu-head span { font-size: 0.8125rem; color: var(--k-muted); overflow: hidden; text-overflow: ellipsis; }
    .menu a, .menu .logout {
      min-height: 44px; padding: 0 12px; border-radius: 8px; box-sizing: border-box;
      display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 0.9375rem; color: var(--k-ink);
    }
    .menu mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .menu a:hover { background: var(--k-mist); }
    .menu .logout { width: 100%; border: 0; background: transparent; font: inherit; font-weight: 600; color: #8c1d18; cursor: pointer; }
    .menu .logout:hover { background: #fdecee; }

    /* Tablets and phones: menu and search move to their own rows */
    @media (max-width: 900px) {
      .bar-inner { flex-wrap: wrap; height: auto; gap: 8px 16px; padding-top: 10px; padding-bottom: 10px; }
      nav { order: 3; width: 100%; height: auto; overflow-x: auto; gap: 22px; }
      nav a { padding: 6px 0; }
      .search { order: 4; max-width: none; flex-basis: 100%; }
    }
  `]
})
export class HeaderComponent {
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);
  cart = inject(CartService);
  wishlist = inject(WishlistService);
  auth = inject(AuthService);

  menuOpen = signal(false);

  search(value: string): void {
    const q = value.trim();
    this.router.navigate(['/shop'], { queryParams: q ? { q } : {} });
  }

  toggleMenu(): void {
    this.menuOpen.update(open => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  // Close the menu when the click was not inside the account area
  closeIfOutside(event: MouseEvent): void {
    const account = this.host.nativeElement.querySelector('.account');
    if (this.menuOpen() && !account?.contains(event.target as Node)) this.closeMenu();
  }

  logOut(): void {
    this.closeMenu();
    this.auth.logout();
  }
}
