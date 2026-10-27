import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService, safeReturnUrl } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule],
  templateUrl: './admin-login.components.html',
  styleUrl: './admin-login.components.css'
})
export class AdminLoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private query = inject(ActivatedRoute).snapshot.queryParamMap;

  // After signing in, go back to the admin page you wanted (only pages inside /admin)
  private wanted = safeReturnUrl(this.query.get('returnUrl'));
  readonly returnUrl = this.wanted.startsWith('/admin') ? this.wanted : '/admin';
  readonly signInEnded = this.query.get('expired') === '1';
  readonly year = new Date().getFullYear();

  showPassword = signal(false);
  sending = signal(false);
  error = signal('');
  shopperEmail = signal('');     // set when a shopper account tries to sign in here

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  isInvalid(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sending.set(true);
    this.error.set('');
    this.shopperEmail.set('');

    this.auth.adminLogin(this.form.getRawValue()).subscribe({
      next: response => {
        if (response.customer.role === 'Admin') {
          this.router.navigateByUrl(this.returnUrl);
        } else {
          // Right password, but a shopper account: say so, and don't sign in
          this.sending.set(false);
          this.shopperEmail.set(response.customer.email);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        if (err.status === 401) {
          this.error.set("That email and password don't match. Check them and try again.");
        } else if (err.status === 0) {
          this.error.set("Can't reach the store right now. Check that the API is running, then try again.");
        } else {
          this.error.set('Something went wrong. Please try again.');
        }
      }
    });
  }
}
