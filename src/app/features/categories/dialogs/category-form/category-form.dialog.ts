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
import { Categories } from '../../data/categories';
import { Notification } from '../../../../core/notification/notification';
import { mapError } from '../../../../core/graphql/error-mapper';
import type { CategoryFieldsFragment } from '../../../../core/graphql/generated/graphql';

/**
 * Data passed to CategoryFormDialog via MAT_DIALOG_DATA.
 *
 * When category is null the dialog is in create mode and calls createCategory.
 * When category is provided the dialog is in edit mode and calls updateCategory.
 */
export interface CategoryFormDialogData {
  category: CategoryFieldsFragment | null;
}

/**
 * Typed form for create/update category.
 *
 * CategoryInput has a single field (categoryName), so the form is a single
 * FormControl. Wrapping it in a FormGroup keeps the pattern consistent with
 * other feature dialogs and allows future fields to be added easily.
 */
interface CategoryForm {
  categoryName: FormControl<string>;
}

/**
 * Create/edit category dialog.
 *
 * Opened from CategoryListPage with CategoryFormDialogData. In create mode
 * the form is empty; in edit mode it is pre-filled with the existing name.
 *
 * On success the dialog closes with the saved Category. The caller can use
 * this result to trigger a refetch (create) or rely on cache normalisation
 * (update, since the mutation returns the Category entity). On BAD_REQUEST
 * the dialog stays open and shows the backend message inline.
 */
@Component({
  selector: 'app-category-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './category-form.dialog.html',
  styleUrl: './category-form.dialog.scss',
})
export class CategoryFormDialog {
  // inject() replaces constructor injection in Angular 21
  readonly data = inject<CategoryFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CategoryFormDialog>);
  private readonly categoriesService = inject(Categories);
  private readonly notification = inject(Notification);

  /** True when editing an existing category; false when creating a new one. */
  readonly isEdit = computed(() => this.data.category !== null);
  readonly title = computed(() => (this.isEdit() ? 'Edit category' : 'Create category'));

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<CategoryForm>({
    // nonNullable:true ensures getRawValue() returns string, not string | null.
    // This is required by strict TypeScript so we never pass null to the API.
    categoryName: new FormControl(this.data.category?.categoryName ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /**
   * Getter used in the template to access the categoryName control.
   *
   * Returning AbstractControl (not FormControl<string>) keeps the template
   * decoupled from the generic type parameter and avoids a lint warning.
   */
  get categoryNameControl(): AbstractControl {
    return this.form.controls.categoryName;
  }

  /**
   * Submits the create or update mutation.
   *
   * In create mode calls createCategory and closes with the returned category.
   * In edit mode calls updateCategory; Apollo normalises the result into the
   * cache, so the list page row updates automatically without a refetch.
   *
   * On BAD_REQUEST the dialog stays open and displays the backend message so
   * the user can correct the input and resubmit. On any other error a generic
   * message is shown inline.
   */
  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    const { categoryName } = this.form.getRawValue();
    const categoryId = this.data.category?.id;

    // Separate branches required because the TypeScript union of two Observable types
    // (MutateResult<CreateCategoryMutation> | MutateResult<UpdateCategoryMutation>)
    // does not have a usable subscribe() overload; each branch gets a concrete type.
    if (categoryId) {
      this.categoriesService.updateCategory(categoryId, { categoryName }).subscribe({
        next: (result) => {
          this.loading.set(false);
          // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
          if (result.error) {
            this.errorMessage.set(mapError(result.error as Error).message);
            return;
          }
          const savedCategory = result.data?.updateCategory;
          if (savedCategory) {
            this.notification.success('Category updated successfully.');
            this.dialogRef.close(savedCategory);
          }
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('An unexpected error occurred. Please try again.');
        },
      });
    } else {
      this.categoriesService.createCategory({ categoryName }).subscribe({
        next: (result) => {
          this.loading.set(false);
          // result.error is the Apollo v4 singular error (replaces v3 result.errors[])
          if (result.error) {
            this.errorMessage.set(mapError(result.error as Error).message);
            return;
          }
          const savedCategory = result.data?.createCategory;
          if (savedCategory) {
            this.notification.success('Category created successfully.');
            this.dialogRef.close(savedCategory);
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
