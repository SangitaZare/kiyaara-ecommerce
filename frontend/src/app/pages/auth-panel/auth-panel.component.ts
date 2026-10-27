import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

// The calm brand panel beside the login forms (no photos).
// <app-auth-panel variant="login" />  deep peacock, for log in, forgot and reset password
// <app-auth-panel variant="join" />   warm cream, for create account
@Component({
  selector: 'app-auth-panel',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="panel" [class.join]="variant() === 'join'">
      <!-- soft rings in a corner (decoration only) -->
      <svg class="rings" width="420" height="420" viewBox="0 0 420 420" aria-hidden="true">
        <circle cx="210" cy="210" r="200" fill="none" stroke-width="1.5" class="ring" />
        <circle cx="210" cy="210" r="160" fill="none" stroke-width="1.5" stroke-dasharray="3 9" class="ring" />
        <circle cx="210" cy="210" r="120" fill="none" stroke-width="1.5" class="ring" />
        <circle cx="210" cy="210" r="80" class="sun" />
      </svg>

      <span class="badge"><span class="dot"></span>{{ variant() === 'join' ? 'NEW HERE?' : 'YOUR KIYAARA ACCOUNT' }}</span>

      @if (variant() === 'join') {
        <div class="body">
          <div>
            <h2>Join Kiyaara in under a minute.</h2>
            <p class="intro">One account for your bag, your orders and your delivery details.</p>
          </div>
          <ol class="steps">
            @for (step of joinSteps; track step.title; let i = $index, last = $last) {
              <li>
                <span class="rail">
                  <span class="num" [class.first]="i === 0">{{ i + 1 }}</span>
                  @if (!last) { <span class="line"></span> }
                </span>
                <span class="text">
                  <strong>{{ step.title }}</strong>
                  <span>{{ step.text }}</span>
                </span>
              </li>
            }
          </ol>
        </div>
      } @else {
        <div class="body">
          <div>
            <h2>Handpicked styles for every day and every celebration.</h2>
            <p class="intro">Log in once and everything you need is in one place.</p>
          </div>
          <ul class="perks">
            @for (perk of loginPerks; track perk.title) {
              <li>
                <span class="perk-icon"><mat-icon>{{ perk.icon }}</mat-icon></span>
                <span class="text">
                  <strong>{{ perk.title }}</strong>
                  <span>{{ perk.text }}</span>
                </span>
              </li>
            }
          </ul>
        </div>
      }

      <div class="promises">
        <span>Free delivery above &#8377;999</span>
        <span>Easy 15-day returns</span>
        <span>Pay on delivery</span>
      </div>
    </div>
  `,
  styles: [`
    :host { flex: 1 1 520px; min-width: 0; box-sizing: border-box; padding: 16px; display: flex; }

    /* ===== Login: deep peacock with a faint block-print pattern ===== */
    .panel {
      flex: 1; min-height: 560px; box-sizing: border-box; position: relative; overflow: hidden;
      padding: 56px 52px; border-radius: 24px; color: #fff;
      display: flex; flex-direction: column; justify-content: space-between; gap: 40px;
      background:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.07' stroke-width='1.2'%3E%3Ccircle cx='28' cy='20' r='6'/%3E%3Ccircle cx='28' cy='36' r='6'/%3E%3Ccircle cx='20' cy='28' r='6'/%3E%3Ccircle cx='36' cy='28' r='6'/%3E%3C/g%3E%3Ccircle cx='28' cy='28' r='2' fill='%23f4a521' fill-opacity='0.18'/%3E%3C/svg%3E"),
        linear-gradient(155deg, #0e6e6f 0%, #0b5d5e 45%, #073c3d 100%);
    }
    .rings { position: absolute; right: -140px; top: -140px; pointer-events: none; }
    .ring { stroke: #fff; stroke-opacity: 0.09; }
    .sun { fill: var(--k-marigold); fill-opacity: 0.12; }

    .badge, .body, .promises { position: relative; }   /* above the rings */

    .badge {
      align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 999px;
      background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.22);
      font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em;
    }
    .badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--k-marigold); }

    .body { display: flex; flex-direction: column; gap: 28px; }
    h2 { margin: 0; max-width: 470px; font-family: var(--k-display); font-weight: 400; font-size: 2.5rem; line-height: 1.18; }
    .intro { margin: 14px 0 0; max-width: 430px; font-size: 1rem; line-height: 1.6; color: #cfe5e2; }

    .perks { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 18px; }
    .perks li { display: flex; align-items: flex-start; gap: 14px; }
    .perk-icon {
      flex: none; width: 42px; height: 42px; border-radius: 12px; color: #f6c76a;
      background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.18);
      display: flex; align-items: center; justify-content: center;
    }
    .perk-icon mat-icon { font-size: 21px; width: 21px; height: 21px; }
    .text { display: flex; flex-direction: column; gap: 2px; }
    .text strong { font-size: 1rem; }
    .text span { font-size: 0.875rem; line-height: 1.5; color: #cfe5e2; }

    .promises { display: flex; flex-wrap: wrap; gap: 8px; }
    .promises span {
      padding: 8px 14px; border-radius: 999px; font-size: 0.8125rem; font-weight: 600;
      background: rgba(255, 255, 255, 0.10); border: 1px solid rgba(255, 255, 255, 0.20);
    }

    /* ===== Create account: warm cream, peacock text ===== */
    .panel.join {
      color: var(--k-ink);
      background:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cg fill='none' stroke='%230b5d5e' stroke-opacity='0.07' stroke-width='1.2'%3E%3Ccircle cx='28' cy='20' r='6'/%3E%3Ccircle cx='28' cy='36' r='6'/%3E%3Ccircle cx='20' cy='28' r='6'/%3E%3Ccircle cx='36' cy='28' r='6'/%3E%3C/g%3E%3Ccircle cx='28' cy='28' r='2' fill='%23f4a521' fill-opacity='0.35'/%3E%3C/svg%3E"),
        linear-gradient(160deg, #fdf6ea 0%, #fdf3e2 50%, #f6e6c9 100%);
    }
    .join .rings { right: auto; top: auto; left: -170px; bottom: -170px; }
    .join .ring { stroke: var(--k-peacock); stroke-opacity: 0.08; }
    .join .sun { fill-opacity: 0.14; }
    .join .badge { background: rgba(255, 255, 255, 0.7); border-color: rgba(11, 93, 94, 0.15); color: var(--k-peacock); }
    .join h2 { color: var(--k-peacock); }
    .join .intro, .join .text span { color: var(--k-muted); }
    .join .promises span { background: #fff; border-color: rgba(11, 93, 94, 0.15); color: var(--k-peacock); }

    .steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
    .steps li { display: flex; align-items: stretch; gap: 16px; }
    .rail { flex: none; width: 40px; display: flex; flex-direction: column; align-items: center; }
    .num {
      width: 40px; height: 40px; box-sizing: border-box; border-radius: 50%; border: 1px solid var(--k-peacock);
      background: #fff; color: var(--k-peacock); font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .num.first { background: var(--k-peacock); color: #fff; }
    .line { flex: 1; width: 1px; min-height: 18px; background: rgba(11, 93, 94, 0.25); }
    .steps .text { padding: 8px 0 20px; }

    /* ===== Phones: the panel goes under the form and gets shorter ===== */
    @media (max-width: 760px) {
      :host { order: 2; }
      .panel { min-height: 0; padding: 32px 24px; }
      h2 { font-size: 1.75rem; }
    }
  `]
})
export class AuthPanelComponent {
  variant = input<'login' | 'join'>('login');

  readonly loginPerks = [
    { icon: 'local_shipping', title: 'Track every order', text: 'See each order move from placed to delivered.' },
    { icon: 'bolt', title: 'Check out faster', text: 'Your name and mobile are filled in for you.' },
    { icon: 'verified_user', title: 'Your password stays safe', text: 'It is stored securely and never shown to anyone.' }
  ];

  readonly joinSteps = [
    { title: 'Create your account', text: 'Just your name, email, mobile and a password.' },
    { title: 'Fill your bag', text: 'Kurtas, sarees, everyday wear and more.' },
    { title: 'Track it to your door', text: 'Follow every order on your My orders page.' }
  ];
}