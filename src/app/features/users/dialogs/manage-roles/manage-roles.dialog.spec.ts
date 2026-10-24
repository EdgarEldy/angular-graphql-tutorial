import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, NEVER } from 'rxjs';
import { ApolloTestingModule } from 'apollo-angular/testing';
import { ManageRolesDialog, type ManageRolesDialogData } from './manage-roles.dialog';
import { Users } from '../../data/users';
import { Roles } from '../../../roles/data/roles';

/** User with one assigned role -- used to seed the dialog's initial state. */
const mockUser = {
  __typename: 'User' as const,
  id: '1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  enabled: true,
  accountLocked: false,
  roles: [
    { __typename: 'Role' as const, id: '10', roleName: 'ADMIN' },
  ],
};

/** An additional role not yet assigned to the user. */
const viewerRole = {
  __typename: 'Role' as const,
  id: '20',
  roleName: 'VIEWER',
  permissions: [],
};

describe('ManageRolesDialog', () => {
  let component: ManageRolesDialog;
  let fixture: ComponentFixture<ManageRolesDialog>;

  // Subject that simulates the roles watchQuery stream from the Roles service
  const rolesValueChanges = new Subject<object>();

  const rolesMock = {
    watchRoles: vi.fn().mockReturnValue({
      valueChanges: rolesValueChanges.asObservable(),
      refetch: vi.fn(),
    }),
  };

  const usersMock = {
    assignRoleToUser: vi.fn().mockReturnValue(NEVER),
    removeRoleFromUser: vi.fn().mockReturnValue(NEVER),
  };

  const dialogRefMock = { close: vi.fn() };

  const dialogData: ManageRolesDialogData = { user: mockUser };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      // ApolloTestingModule satisfies any transitive Apollo DI tokens even
      // though Users and Roles are fully mocked here.
      imports: [ManageRolesDialog, NoopAnimationsModule, ApolloTestingModule],
      providers: [
        { provide: Users, useValue: usersMock },
        { provide: Roles, useValue: rolesMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageRolesDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders user name in the dialog title', () => {
    const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
    expect(title.textContent).toContain('John Doe');
  });

  it('shows available roles in the select after roles load', () => {
    // Emit roles from the watchRoles stream; viewerRole is not yet assigned
    rolesValueChanges.next({
      data: {
        roles: [
          { __typename: 'Role', id: '10', roleName: 'ADMIN', permissions: [] },
          { __typename: 'Role', id: '20', roleName: 'VIEWER', permissions: [] },
        ],
      },
    });

    fixture.detectChanges();

    // availableRoles() filters out roles the user already has (ADMIN is assigned)
    expect(component.availableRoles().length).toBe(1);
    expect(component.availableRoles()[0].roleName).toBe(viewerRole.roleName);
    expect(component.loadingRoles()).toBe(false);
  });

  it('shows assigned roles as chips', () => {
    fixture.detectChanges();

    // The user has one assigned role (ADMIN); it should appear as a chip
    const chips = fixture.nativeElement.querySelectorAll('mat-chip');
    expect(chips.length).toBe(1);
    expect((chips[0] as HTMLElement).textContent).toContain('ADMIN');
  });
});
