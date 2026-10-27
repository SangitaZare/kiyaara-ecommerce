import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, safeReturnUrl } from '../services/auth.service';

// For pages that need a login (checkout, My orders).
// Not logged in? Go to /login and come back here afterwards.
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

// For the login and sign-up pages. Already logged in? Skip them.
export const guestGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn()
    ? router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl')))
    : true;
};

// NEW (4C): for the admin panel.
// Not logged in: the admin sign-in page. A shopper: the "staff only" page. An admin: come in.
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
  }
  return auth.isAdmin() ? true : router.createUrlTree(['/staff-only']);
};

// NEW (4C): for the admin sign-in page. Already signed in as an admin? Go straight to the panel.
export const adminLoginGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAdmin()) return true;
  const returnUrl = safeReturnUrl(route.queryParamMap.get('returnUrl'));
  return router.parseUrl(returnUrl.startsWith('/admin') ? returnUrl : '/admin');
};
