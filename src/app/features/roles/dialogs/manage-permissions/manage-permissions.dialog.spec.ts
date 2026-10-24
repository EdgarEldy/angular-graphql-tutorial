import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NEVER } from 'rxjs';
import { ManagePermissionsDialog, type ManagePermissionsDialogData } from './manage-permissions.dialog';
import { Roles } from '../../data/roles';

/**
 * Smoke tests for ManagePermissionsDialog.
 *
 * The dialog calls watchPermissions() in its constructor to load available
 * permissions. The Roles service is mocked with a QueryRef stub whose
 * valueChanges never emits (no permissions loaded), testing the empty/loading
 * branch. MAT_DIALOG_DATA and MatDialogRef providers are required by the DI graph.
 */
describe('ManagePermissionsDialog', () => {
  let component: ManagePermissionsDialog;
  let fixture: ComponentFixture<ManagePermissionsDialog>;

  const rolesMock = {
    watchPermissions: vi.fn().mockReturnValue({
      valueChanges: NEVER,
      refetch: vi.fn(),
    }),
    assignPermissionToRole: vi.fn(),
    removePermissionFromRole: vi.fn(),
  };

  const dialogRefMock = { close: vi.fn() };

  const dialogData: ManagePermissionsDialogData = {
    role: { id: '1', roleName: 'EDITOR', permissions: [] },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ManagePermissionsDialog, NoopAnimationsModule],
      providers: [
        { provide: Roles, useValue: rolesMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManagePermissionsDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the role name in the dialog title area', () => {
    expect(component.role().roleName).toBe('EDITOR');
  });

  it('starts in loading state while permissions are fetching', () => {
    expect(component.loadingPermissions()).toBe(true);
  });

  it('closes the dialog on close()', () => {
    component.close();
    expect(dialogRefMock.close).toHaveBeenCalled();
  });
});
