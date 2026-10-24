import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PermissionFormDialog } from './permission-form.dialog';
import { Roles } from '../../data/roles';

/**
 * Smoke tests for PermissionFormDialog.
 *
 * This dialog is create-only (no updatePermission mutation in the schema).
 * MAT_DIALOG_DATA and MatDialogRef providers are required for standalone
 * dialog components that inject them.
 */
describe('PermissionFormDialog', () => {
  let component: PermissionFormDialog;
  let fixture: ComponentFixture<PermissionFormDialog>;

  const rolesMock = { createPermission: vi.fn() };
  const dialogRefMock = { close: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [PermissionFormDialog, NoopAnimationsModule],
      providers: [
        { provide: Roles, useValue: rolesMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PermissionFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with an invalid form (both fields empty)', () => {
    expect(component.form.invalid).toBe(true);
  });

  it('does not call createPermission when form is invalid', () => {
    component.submit();
    expect(rolesMock.createPermission).not.toHaveBeenCalled();
  });
});
