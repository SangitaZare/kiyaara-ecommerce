import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService, safeReturnUrl } from '../../../services/auth.service';
import { AuthPanelComponent } from '../auth-panel/auth-panel.component';

type Field = 'fullName' | 'email' | 'mobile' | 'password';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, AuthPanelComponent],
  templateUrl: './register.component.html',
  styleUrl: '../auth.css'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private query = inject(ActivatedRoute).snapshot.queryParamMap;

  readonly returnUrl = safeReturnUrl(this.query.get('returnUrl'));
  readonly year = new Date().getFullYear();

  showPassword = signal(false);
  sending = signal(false);
  errors = signal<string[]>([]);
  googleNote = signal(false);

  // Same rules as RegisterRequest in AuthModels.cs
  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    mobile: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    password: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)]]
  });

  // The two password rules, ticked green as you type
  private password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  rules = computed(() => {
    const p = this.password();
    return [
      { text: 'At least 8 characters', ok: p.length >= 8 },
      { text: 'A letter and a number', ok: /[A-Za-z]/.test(p) && /\d/.test(p) }
    ];
  });

  isInvalid(field: Field): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  loginParams(): Record<string, string> {
    return this.returnUrl === '/' ? {} : { returnUrl: this.returnUrl };
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      document.querySelector<HTMLElement>('form input.ng-invalid')?.focus();
      return;
    }

    this.sending.set(true);
    this.errors.set([]);

    const value = this.form.getRawValue();
    this.auth.register({ ...value, fullName: value.fullName.trim(), email: value.email.trim() }).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl),     // logged in straight away
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        this.errors.set(this.readErrors(err));
      }
    });
  }

  private readErrors(err: HttpErrorResponse): string[] {
    if (err.status === 0) {
      return ["Can't reach the store right now. Check that the API is running, then try again."];
    }
    if (err.status === 400 && err.error?.errors) {
      return [...new Set(Object.values(err.error.errors).flat() as string[])];
    }
    return ['Something went wrong while creating your account. Please try again.'];
  }
}