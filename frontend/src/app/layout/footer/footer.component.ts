import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer>
      <div class="container cols">
        <div>
          <div class="logo">Kiyaara<span class="dot">.</span></div>
          <p>Everyday and festive fashion from Indian labels.</p>
        </div>
        <div>
          <h3>Shop</h3>
          <div class="links">
            <a routerLink="/shop/women">Women</a>
            <a routerLink="/shop/men">Men</a>
            <a routerLink="/shop/kids">Kids</a>
            <a routerLink="/shop" [queryParams]="{ sort: 'new' }">New in</a>
          </div>
        </div>
        <div>
          <h3>Customer care</h3>
          <div class="links">
            <span>Free delivery above &#8377;999</span>
            <span>Easy 15-day returns</span>
            <span>Pay on delivery</span>
          </div>
        </div>
      </div>
      <div class="container">
        <p class="legal">&copy; 2026 Kiyaara. A demo store built with Angular and ASP.NET Core. No real orders are placed.</p>
      </div>
    </footer>
  `,
  styles: [`
    footer { background: var(--k-ink); color: #c9ced6; margin-top: 64px; }
    .cols { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 32px; padding-top: 48px; padding-bottom: 32px; }
    .logo { font-family: var(--k-display); font-size: 1.75rem; color: #fff; }
    .logo .dot { color: var(--k-marigold); }
    p { max-width: 36ch; line-height: 1.6; }
    h3 { color: #fff; font-size: 0.875rem; margin: 0 0 12px; }
    .links { display: flex; flex-direction: column; gap: 8px; font-size: 0.875rem; }
    .links a:hover { color: #fff; }
    .legal {
      max-width: none; margin: 0; padding: 16px 0 24px;
      border-top: 1px solid #343a46; font-size: 0.8125rem;
    }
    @media (max-width: 700px) { .cols { grid-template-columns: 1fr; } }
  `]
})
export class FooterComponent {}