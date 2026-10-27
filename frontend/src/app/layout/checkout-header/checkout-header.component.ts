import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-checkout-header',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <header class="bar">
      <div class="container inner">
        <a routerLink="/" class="logo" aria-label="Kiyaara home">Kiyaara<span class="dot">.</span></a>

        <ol class="steps" aria-label="Checkout steps">
          @for (s of steps; track s.number; let last = $last) {
            <li class="step" [class.done]="s.number < step()" [class.current]="s.number === step()"
                [attr.aria-current]="s.number === step() ? 'step' : null">
              <span class="num">
                @if (s.number < step()) { <mat-icon>check</mat-icon> } @else { {{ s.number }} }
              </span>
              <span>{{ s.label }}</span>
            </li>
            @if (!last) {
              <li class="line" [class.done]="s.number < step()" aria-hidden="true"></li>
            }
          }
        </ol>

        @if (step() < 3) {
          <span class="secure"><mat-icon>lock</mat-icon> Secure checkout</span>
        } @else {
          <a routerLink="/shop" class="secure link">Continue shopping</a>
        }
      </div>
    </header>
  `,
  styles: [`
    .bar { background: #fff; border-bottom: 1px solid var(--k-line); }
    .inner {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 16px; padding-top: 16px; padding-bottom: 16px;
    }
    .logo { font-family: var(--k-display); font-size: 1.875rem; color: var(--k-peacock); letter-spacing: 0.02em; }
    .logo .dot { color: var(--k-marigold); }

    .steps {
      display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
      margin: 0; padding: 0; list-style: none;
      font-size: 0.875rem; font-weight: 600; color: var(--k-muted);
    }
    .step { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 3px solid transparent; }
    .num {
      width: 24px; height: 24px; box-sizing: border-box; border-radius: 50%;
      border: 1px solid #c9d2d2; display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem;
    }
    .num mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .step.done, .step.current { color: var(--k-peacock); }
    .step.done .num, .step.current .num { background: var(--k-peacock); border-color: var(--k-peacock); color: #fff; }
    .step.current { border-bottom-color: var(--k-marigold); }

    .line { width: 40px; height: 1px; background: #c9d2d2; }
    .line.done { height: 2px; background: var(--k-peacock); }

    .secure { display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--k-muted); }
    .secure mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .secure.link { min-height: 44px; font-size: 0.875rem; font-weight: 600; color: var(--k-peacock); }

    @media (max-width: 700px) {
      .line { display: none; }
      .steps { gap: 4px 16px; }
    }
  `]
})
export class CheckoutHeaderComponent {
  step = input(1);

  readonly steps = [
    { number: 1, label: 'Bag' },
    { number: 2, label: 'Address and payment' },
    { number: 3, label: 'Confirmed' }
  ];
}