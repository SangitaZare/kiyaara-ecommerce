import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { AuthService } from '../services/auth.service';

// Runs for EVERY HttpClient request. It adds "Authorization: Bearer <token>" when you are
// logged in, so no service has to remember to do it.
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();

  // NEW (4C): the sign-in calls (login, register, forgot and reset password) never send a token.
  // So a wrong password on the admin sign-in page can't log out whoever is already logged in.
  const isSignInCall = request.url.startsWith(`${API_BASE_URL}/auth/`) && !request.url.endsWith('/auth/me');

  // Only our own API gets the token, never another website
  const sent = token && !isSignInCall && request.url.startsWith(API_BASE_URL)
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(sent).pipe(
    catchError((error: HttpErrorResponse) => {
      // The API refused our token (the login ended): log out and ask to log in again.
      // A wrong password also gives 401, but that request had no token, so it is left alone.
      if (error.status === 401 && sent !== request) {
        auth.endSession();
        // CHANGED (4C): in the admin panel, go back to the admin sign-in page instead
        const loginPage = router.url.startsWith('/admin') ? '/admin/login' : '/login';
        router.navigate([loginPage], { queryParams: { returnUrl: router.url, expired: 1 } });
      }
      return throwError(() => error);
    })
  );
};
