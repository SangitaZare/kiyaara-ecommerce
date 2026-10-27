import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

// Shown when a logged-in shopper (not an admin) tries to open /admin/*
@Component({
  selector: 'app-staff-only',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="wrap">
      <mat-icon>lock_outline</mat-icon>
      <h1>This area is for Kiyaara staff</h1>
      <p>Your account doesn't have access to the admin panel.</p>
      <a routerLink="/">Back to the shop</a>
    </div>
  `,
  styles: [`
    .wrap {
      max-width: 420px; margin: 96px auto; padding: 0 24px;
      display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px;
    }
    mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--k-muted); }
    h1 { font-size: 1.375rem; margin: 0; }
    p { color: var(--k-muted); margin: 0; }
    a { color: var(--k-peacock); font-weight: 600; margin-top: 8px; }
  `]
})
export class StaffOnlyComponent {}
