import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';
import { AuthPanelComponent } from '../auth-panel/auth-panel.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, AuthPanelComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: '../auth.css'
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  readonly year = new Date().getFullYear();

  sending = signal(false);
  sentTo = signal('');          // the email we sent the link to ('' = not sent yet)
  error = signal('');

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  get emailInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.form.controls.email.value.trim();
    this.sending.set(true);
    this.error.set('');

    this.auth.forgotPassword(email).subscribe({
      next: () => {
        this.sending.set(false);
        this.sentTo.set(email);
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        this.error.set(err.status === 0
          ? "Can't reach the store right now. Check that the API is running, then try again."
          : 'Something went wrong. Please try again.');
      }
    });
  }

  tryAnotherEmail(): void {
    this.sentTo.set('');
    this.form.reset();
  }
}