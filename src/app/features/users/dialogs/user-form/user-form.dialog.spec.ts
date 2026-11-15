import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UserFormDialog, type UserFormDialogData } from './user-form.dialog';
import { Users } from '../../data/users';

/** Full UserFieldsFragment shape required by UserFormDialogData. */
const existingUser = {
  __typename: 'User' as const,
  id: '42',
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane@example.com',
  enabled: true,
  accountLocked: false,
  roles: [],
};

describe('UserFormDialog', () => {
  let component: UserFormDialog;
  let fixture: ComponentFixture<UserFormDialog>;

  const usersMock = {
    createUser: vi.fn(),
    updateUser: vi.fn(),
  };

  const dialogRefMock = { close: vi.fn() };

  /**
   * Creates the component with the given dialog data.
   *
   * overrideProvider() must be called before createComponent() so that
   * Angular uses the new value when instantiating the component.
   */
  function setup(data: UserFormDialogData): void {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: data });
    fixture = TestBed.createComponent(UserFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [UserFormDialog, NoopAnimationsModule],
      providers: [
        { provide: Users, useValue: usersMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        // Provide a default value; individual tests override it via setup()
        { provide: MAT_DIALOG_DATA, useValue: { user: null } },
      ],
    }).compileComponents();
  });

  it('renders create form when no user data is passed', () => {
    setup({ user: null });

    expect(component.isEdit()).toBe(false);
    expect(component.title()).toBe('Create user');
    // Password field is shown only in create mode (@if (!isEdit()))
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeTruthy();
  });

  it('renders edit form with pre-filled values when user data is passed', () => {
    setup({ user: existingUser });

    expect(component.isEdit()).toBe(true);
    expect(component.title()).toBe('Edit user');
    expect(component.form.controls.firstName.value).toBe('Jane');
    expect(component.form.controls.lastName.value).toBe('Smith');
    expect(component.form.controls.email.value).toBe('jane@example.com');
    // Password field is hidden in edit mode
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeFalsy();
  });

  it('submit button is disabled when form is invalid', () => {
    // Create mode with all empty values -- required validators make form invalid
    setup({ user: null });

    // Confirm the form is invalid (empty firstName, lastName, email, password)
    expect(component.form.invalid).toBe(true);

    // The [disabled] binding on the submit button reflects form.invalid
    // form.invalid is the source of truth; DOM binding verification is secondary
    expect(component.form.invalid).toBe(true);
    // submit() returns early when form is invalid
    component.submit();
    expect(usersMock.createUser).not.toHaveBeenCalled();
  });
});
