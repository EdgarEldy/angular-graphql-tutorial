import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { Roles } from '../../data/roles';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { RoleFieldsFragment } from '../../../../core/graphql/generated/graphql';

/**
 * Data passed to RoleFormDialog via MAT_DIALOG_DATA.
 */
export interface RoleFormDialogData {
  role: RoleFieldsFragment | null;
}

/**
 * Typed form for create/edit role. RoleInput has a single field: roleName.
 */
interface RoleForm {
  roleName: FormControl<string>;
}

/**
 * Create/edit role dialog.
 *
 * Opened from RoleListPage with RoleFormDialogData. The form has a single
 * field: roleName. On success the dialog closes with the saved Role; on
 * BAD_REQUEST the error is shown inline and the dialog stays open.
 */
@Component({
  selector: 'app-role-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './role-form.dialog.html',
  styleUrl: './role-form.dialog.scss',
})
export class RoleFormDialog {
  // inject() replaces constructor injection in Angular 21
  readonly data = inject<RoleFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RoleFormDialog>);
  private readonly rolesService = inject(Roles);
  private readonly notification = inject(Notification);

  readonly isEdit = computed(() => this.data.role !== null);
  readonly title = computed(() => (this.isEdit() ? 'Edit role' : 'Create role'));
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<RoleForm>({
    roleName: new FormControl(this.data.role?.roleName ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  get roleNameControl(): AbstractControl { return this.form.controls.roleName; }

  /**
   * Submits the role form (create or update).
   *
   * On success closes with the saved Role. On BAD_REQUEST shows the backend
   * message inline and keeps the dialog open.
   */
  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const { roleName } = this.form.getRawValue();
    const roleId = this.data.role?.id;

    // Separate branches are required because the TypeScript union of two Observable types
    // (Observable<MutateResult<CreateRoleMutation>> | Observable<MutateResult<UpdateRoleMutation>>)
    // does not have a usable subscribe() overload; each branch gets a concrete type.
    if (roleId) {
      this.rolesService.updateRole(roleId, { roleName }).subscribe({
        next: (result) => {
          this.loading.set(false);
          // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
          if (result.error) {
            this.errorMessage.set(mapError(result.error as Error).message);
            return;
          }
          const savedRole = result.data?.updateRole;
          if (savedRole) {
            this.notification.success('Role updated successfully.');
            this.dialogRef.close(savedRole);
          }
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('An unexpected error occurred. Please try again.');
        },
      });
    } else {
      this.rolesService.createRole({ roleName }).subscribe({
        next: (result) => {
          this.loading.set(false);
          // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
          if (result.error) {
            this.errorMessage.set(mapError(result.error as Error).message);
            return;
          }
          const savedRole = result.data?.createRole;
          if (savedRole) {
            this.notification.success('Role created successfully.');
            this.dialogRef.close(savedRole);
          }
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('An unexpected error occurred. Please try again.');
        },
      });
    }
  }
}
