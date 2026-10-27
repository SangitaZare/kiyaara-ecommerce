import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService, safeReturnUrl } from '../../../services/auth.service';
import { AuthPanelComponent } from '../auth-panel/auth-panel.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, AuthPanelComponent],
  templateUrl: './login.component.html',
  styleUrl: '../auth.css'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private query = inject(ActivatedRoute).snapshot.queryParamMap;

  // Where to go after logging in: /login?returnUrl=/checkout comes back to the checkout
  readonly returnUrl = safeReturnUrl(this.query.get('returnUrl'));
  readonly fromCheckout = this.returnUrl.startsWith('/checkout');
  readonly loginEnded = this.query.get('expired') === '1';
  readonly year = new Date().getFullYear();

  showPassword = signal(false);
  sending = signal(false);
  error = signal('');
  googleNote = signal(false);

  form = this.fb.nonNullable.group({
    email: [this.query.get('email') ?? '', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  isInvalid(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  // Keep returnUrl when moving to "Create an account", so the checkout still comes back
  registerParams(): Record<string, string> {
    return this.returnUrl === '/' ? {} : { returnUrl: this.returnUrl };
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sending.set(true);
    this.error.set('');

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl),
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