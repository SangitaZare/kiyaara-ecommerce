import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';
import { firstError } from '../../../shared/order-status';

interface Message { text: string; ok: boolean; }

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  auth = inject(AuthService);
  private fb = inject(FormBuilder);

  // Same rules as UpdateProfileRequest and ChangePasswordRequest in the API
  profileForm = this.fb.nonNullable.group({
    fullName: [this.auth.customer()?.fullName ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    mobile: [this.auth.customer()?.mobile ?? '', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]]
  });

  passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).{8,100}$/)]]
  });

  savingProfile = signal(false);
  savingPassword = signal(false);
  profileMessage = signal<Message | null>(null);
  passwordMessage = signal<Message | null>(null);
  showPasswords = signal(false);

  isInvalid(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile.set(true);
    this.profileMessage.set(null);

    this.auth.updateProfile(this.profileForm.getRawValue()).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.profileMessage.set({ text: 'Saved. Your details are updated.', ok: true });
      },
      error: (err: HttpErrorResponse) => {
        this.savingProfile.set(false);
        this.profileMessage.set({ text: firstError(err, "We couldn't save your details. Please try again."), ok: false });
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.savingPassword.set(true);
    this.passwordMessage.set(null);

    this.auth.changePassword(this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.passwordMessage.set({ text: 'Password changed. Use it the next time you log in.', ok: true });
      },
      error: (err: HttpErrorResponse) => {
        this.savingPassword.set(false);
        this.passwordMessage.set({ text: firstError(err, "We couldn't change your password. Please try again."), ok: false });
      }
    });
  }
}