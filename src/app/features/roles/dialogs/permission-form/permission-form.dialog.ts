import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Apollo } from 'apollo-angular';
import { Roles } from '../../data/roles';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { CreatePermissionMutation, PermissionFieldsFragment } from '../../../../core/graphql/generated/graphql';

/**
 * Data passed to PermissionFormDialog. Currently create-only (no edit
 * because the schema has no updatePermission mutation).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PermissionFormDialogData {}

/**
 * Typed form for creating a permission.
 */
interface PermissionForm {
  resource: FormControl<string>;
  action: FormControl<string>;
}

/**
 * Create-permission dialog.
 *
 * PermissionInput requires resource and action. There is no updatePermission
 * mutation in the schema, so this dialog is create-only. On success it closes
 * with the created Permission so the caller can refetch the list.
 */
@Component({
  selector: 'app-permission-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './permission-form.dialog.html',
  styleUrl: './permission-form.dialog.scss',
})
export class PermissionFormDialog {
  // inject() replaces constructor injection in Angular 21
  readonly data = inject<PermissionFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PermissionFormDialog>);
  private readonly rolesService = inject(Roles);
  private readonly notification = inject(Notification);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<PermissionForm>({
    resource: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    action: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  get resourceControl(): AbstractControl { return this.form.controls.resource; }
  get actionControl(): AbstractControl { return this.form.controls.action; }

  /**
   * Submits the permission form.
   *
   * On success closes with the created Permission. On BAD_REQUEST shows the
   * backend message inline.
   */
  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const { resource, action } = this.form.getRawValue();
    this.rolesService.createPermission({ resource, action }).subscribe({
      next: (result: Apollo.MutateResult<CreatePermissionMutation>) => {
        this.loading.set(false);
        // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
        if (result.error) {
          const appError = mapError(result.error as Error);
          this.errorMessage.set(appError.message);
          return;
        }
        const perm: PermissionFieldsFragment | undefined = result.data?.createPermission;
        if (perm) {
          this.notification.success('Permission created successfully.');
          this.dialogRef.close(perm);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('An unexpected error occurred. Please try again.');
      },
    });
  }
}
