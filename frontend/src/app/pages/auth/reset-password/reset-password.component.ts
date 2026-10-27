import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';
import { AuthPanelComponent } from '../auth-panel/auth-panel.component';

// Opened from the email link: /reset-password?email=priya%40example.com&token=4F2A...
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, AuthPanelComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: '../auth.css'
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private query = inject(ActivatedRoute).snapshot.queryParamMap;

  readonly email = this.query.get('email') ?? '';
  readonly token = this.query.get('token') ?? '';
  readonly linkComplete = this.email !== '' && this.token !== '';
  readonly year = new Date().getFullYear();

  showPassword = signal(false);
  sending = signal(false);
  done = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)]]
  });

  private password = toSignal(this.form.controls.newPassword.valueChanges, { initialValue: '' });
  rules = computed(() => {
    const p = this.password();
    return [
      { text: 'At least 8 characters', ok: p.length >= 8 },
      { text: 'A letter and a number', ok: /[A-Za-z]/.test(p) && /\d/.test(p) }
    ];
  });

  get passwordInvalid(): boolean {
    const control = this.form.controls.newPassword;
    return control.invalid && control.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sending.set(true);
    this.error.set('');

    this.auth.resetPassword({ email: this.email, token: this.token, newPassword: this.form.controls.newPassword.value })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.done.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.sending.set(false);
          if (err.status === 0) {
            this.error.set("Can't reach the store right now. Check that the API is running, then try again.");
          } else if (err.status === 400 && err.error?.errors) {
            const messages = Object.values(err.error.errors).flat() as string[];
            this.error.set(messages[0] ?? 'This reset link is wrong or has expired. Ask for a new one.');
          } else {
            this.error.set('Something went wrong. Please try again.');
          }
        }
      });
  }
}