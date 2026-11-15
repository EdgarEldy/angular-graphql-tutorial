import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { UpdateProfileDialog, UpdateProfileDialogData } from './update-profile.dialog';
import { AuthFeature } from '../../data/auth-feature';
import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notification/notification.service';

const dialogData: UpdateProfileDialogData = {
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
};

describe('UpdateProfileDialog', () => {
  let component: UpdateProfileDialog;
  let fixture: ComponentFixture<UpdateProfileDialog>;

  const authFeatureMock = { updateProfile: vi.fn() };
  const authServiceMock = { updateSessionUser: vi.fn() };
  const notificationMock = { error: vi.fn() };
  const dialogRefMock = { close: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [UpdateProfileDialog, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AuthFeature, useValue: authFeatureMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: NotificationService, useValue: notificationMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateProfileDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should pre-fill the form with the dialog data', () => {
    expect(component.form.controls.firstName.value).toBe('Alice');
    expect(component.form.controls.lastName.value).toBe('Smith');
    expect(component.form.controls.email.value).toBe('alice@example.com');
  });

  it('should mark email invalid when format is wrong', () => {
    component.form.controls.email.setValue('not-an-email');
    component.form.controls.email.markAsTouched();
    expect(component.emailControl.hasError('email')).toBe(true);
  });

  it('should not call updateProfile when form is invalid', () => {
    component.form.controls.email.setValue('bad-email');
    component.submit();
    expect(authFeatureMock.updateProfile).not.toHaveBeenCalled();
  });

  it('should call updateProfile and close the dialog with the updated user on success', () => {
    const updatedUser = {
      __typename: 'User',
      id: '1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      enabled: true,
      accountLocked: false,
      roles: [],
    };
    authFeatureMock.updateProfile.mockReturnValue(
      of({ data: { updateProfile: updatedUser }, error: undefined, loading: false }),
    );

    component.submit();

    expect(authFeatureMock.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
    );
    expect(dialogRefMock.close).toHaveBeenCalledWith(updatedUser);
  });

  it('should set serverError and keep dialog open on BAD_REQUEST', () => {
    const error = new CombinedGraphQLErrors({
      errors: [{ message: 'Email already in use', extensions: { classification: 'BAD_REQUEST' } }],
    });
    authFeatureMock.updateProfile.mockReturnValue(
      of({ error, data: null, loading: false }),
    );

    component.submit();

    expect(component.serverError()).not.toBeNull();
    expect(dialogRefMock.close).not.toHaveBeenCalled();
  });
});
