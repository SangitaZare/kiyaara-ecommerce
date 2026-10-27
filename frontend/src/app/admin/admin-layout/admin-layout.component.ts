import { Component, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, filter, map, merge, of, switchMap } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { DashboardService } from '../../services/dashboard.service';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css'
})
export class AdminLayoutComponent {
  private router = inject(Router);
  private dashboard = inject(DashboardService);
  private orderService = inject(OrderService);
  auth = inject(AuthService);              // NEW (4C): who is signed in

  // Refresh the badge when the admin opens another page or saves a status
  private refresh$ = merge(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)),
    toObservable(this.orderService.changes)          // also fires once at the start
  );

  // How many orders are waiting to be packed (the marigold badge next to "Orders")
  waiting = toSignal(
    this.refresh$.pipe(
      switchMap(() => this.dashboard.getSummary().pipe(
        map(s => s.waitingToPack),
        catchError(() => of(0))
      ))
    ),
    { initialValue: 0 }
  );

  // NEW (4C): forget the admin sign-in and go back to the admin sign-in page
  signOut(): void {
    this.auth.logout('/admin/login');
  }
}