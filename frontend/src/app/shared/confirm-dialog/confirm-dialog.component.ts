import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button class="danger" [mat-dialog-close]="true">{{ data.confirmText }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    /* Red button for a destructive action (token names for newer and older Material versions) */
    .danger {
      --mat-button-filled-container-color: #b3261e;
      --mat-button-filled-label-text-color: #ffffff;
      --mdc-filled-button-container-color: #b3261e;
      --mdc-filled-button-label-text-color: #ffffff;
    }
  `]
})
export class ConfirmDialogComponent {
  data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}