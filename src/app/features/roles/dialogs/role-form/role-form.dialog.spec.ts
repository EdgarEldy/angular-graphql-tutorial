import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RoleFormDialog, type RoleFormDialogData } from './role-form.dialog';
import { Roles } from '../../data/roles';

/**
 * Smoke tests for RoleFormDialog.
 *
 * Dialogs require MAT_DIALOG_DATA and MatDialogRef providers. The Roles
 * service is replaced with a mock since no actual mutation is triggered here.
 */
describe('RoleFormDialog', () => {
  let component: RoleFormDialog;
  let fixture: ComponentFixture<RoleFormDialog>;

  const rolesMock = {
    createRole: vi.fn(),
    updateRole: vi.fn(),
  };

  const dialogRefMock = { close: vi.fn() };

  function setup(data: RoleFormDialogData): void {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: data });
    fixture = TestBed.createComponent(RoleFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [RoleFormDialog, NoopAnimationsModule],
      providers: [
        { provide: Roles, useValue: rolesMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: { role: null } },
      ],
    }).compileComponents();
  });

  it('opens in create mode when role is null', () => {
    setup({ role: null });
    expect(component.isEdit()).toBe(false);
  });

  it('opens in edit mode when a role is provided', () => {
    setup({ role: { id: '1', roleName: 'ADMIN', permissions: [] } });
    expect(component.isEdit()).toBe(true);
    expect(component.form.controls.roleName.value).toBe('ADMIN');
  });

  it('does not submit when form is invalid (empty roleName)', () => {
    setup({ role: null });
    component.submit();
    expect(rolesMock.createRole).not.toHaveBeenCalled();
  });
});
