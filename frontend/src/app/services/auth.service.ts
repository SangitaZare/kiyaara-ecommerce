import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  AuthResponse, ChangePasswordRequest, CustomerProfile, LoginRequest,
  RegisterRequest, ResetPasswordRequest, UpdateProfileRequest
} from '../models/auth.model';

// Only go back to a page of this site after login: "/checkout" yes, "https://other.site" or "//x" no
export function safeReturnUrl(url: string | null | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = `${API_BASE_URL}/auth`;
  private readonly storageKey = 'kiyaara-session';

  // The current login, or null. Saved in the browser so a refresh keeps you logged in.
  private session = signal<AuthResponse | null>(this.load());

  // ---------- What the pages read ----------
  customer = computed(() => this.session()?.customer ?? null);
  token = computed(() => this.session()?.token ?? null);
  isLoggedIn = computed(() => this.session() !== null);
  firstName = computed(() => this.customer()?.fullName.split(' ')[0] ?? '');
  initial = computed(() => this.firstName().charAt(0).toUpperCase());
  isAdmin = computed(() => this.customer()?.role === 'Admin');

  // ---------- Calls to the API ----------
  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request).pipe(
      tap(response => this.start(response))
    );
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(response => this.start(response))
    );
  }

  // The admin sign-in page. The same API call, but a shopper account is NOT kept
  // logged in here: the page shows "this is a shopper account" instead.
  adminLogin(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(response => {
        if (response.customer.role === 'Admin') this.start(response);
      })
    );
  }

  forgotPassword(email: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(request: ResetPasswordRequest): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/reset-password`, request);
  }

  // My account: change name and mobile. The saved login is updated too, so the header
  // and the checkout form show the new details straight away.
  updateProfile(request: UpdateProfileRequest): Observable<CustomerProfile> {
    return this.http.put<CustomerProfile>(`${this.apiUrl}/me`, request).pipe(
      tap(profile => {
        const current = this.session();
        if (!current) return;
        const updated: AuthResponse = { ...current, customer: profile };
        this.session.set(updated);
        this.save(updated);
      })
    );
  }

  // My account: change the password while logged in
  changePassword(request: ChangePasswordRequest): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/change-password`, request);
  }

  // ---------- Logging out ----------
  // The "Log out" button: forget the login and go to the home page
  // (the admin panel's "Sign out" passes '/admin/login' instead)
  logout(goTo = '/'): void {
    this.endSession();
    this.router.navigateByUrl(goTo);
  }

  // Forget the login without moving (used when the API refuses an old token)
  endSession(): void {
    this.session.set(null);
    this.save(null);
  }

  // ---------- Browser storage ----------
  private start(response: AuthResponse): void {
    this.session.set(response);
    this.save(response);
  }

  private load(): AuthResponse | null {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) ?? 'null') as AuthResponse | null;
      // An ended login counts as logged out
      return saved && new Date(saved.expiresAt) > new Date() ? saved : null;
    } catch {
      return null;
    }
  }

  private save(response: AuthResponse | null): void {
    try {
      if (response) localStorage.setItem(this.storageKey, JSON.stringify(response));
      else localStorage.removeItem(this.storageKey);
    } catch {
      // Storage blocked (private window): the login still works until refresh
    }
  }
}