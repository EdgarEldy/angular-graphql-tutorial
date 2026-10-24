import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ResetPasswordPagePage } from './reset-password-page.page';
import { AuthFeature } from '../../data/auth-feature';

/**
 * Tests for ResetPasswordPagePage.
 *
 * Covers: password-match cross-field validation, missing token handling,
 * successful reset, and inline BAD_REQUEST error display.
 */
describe('ResetPasswordPagePage', () => {
  let component: ResetPasswordPagePage;
  let fixture: ComponentFixture<ResetPasswordPagePage>;

  // vi.fn() replaces jasmine.createSpyObj
  const authFeatureMock = { resetPassword: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ResetPasswordPagePage, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [
        { provide: AuthFeature, useValue: authFeatureMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (_key: string) => 'valid-token' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordPagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows passwordMismatch error when passwords differ', () => {
    component.form.controls.newPassword.setValue('password123');
    component.form.controls.confirmPassword.setValue('different456');
    component.form.controls.confirmPassword.markAsTouched();
    // toBe(true) is the Vitest equivalent of Jasmine's toBeTrue()
    expect(component.passwordMismatch).toBe(true);
  });

  it('clears mismatch error when passwords match', () => {
    component.form.controls.newPassword.setValue('password123');
    component.form.controls.confirmPassword.setValue('password123');
    // toBe(false) is the Vitest equivalent of Jasmine's toBeFalse()
    expect(component.passwordMismatch).toBe(false);
  });

  it('does not call resetPassword when form is invalid', () => {
    component.submit();
    expect(authFeatureMock.resetPassword).not.toHaveBeenCalled();
  });

  it('transitions to success=true on successful reset', () => {
    authFeatureMock.resetPassword.mockReturnValue(
      of({ data: { resetPassword: true }, loading: false }),
    );
    component.form.controls.newPassword.setValue('newpassword123');
    component.form.controls.confirmPassword.setValue('newpassword123');
    component.submit();
    expect(component.success()).toBe(true);
  });

  it('shows inline error on BAD_REQUEST and does not set success', () => {
    // Apollo v4: error is in result.error, a CombinedGraphQLErrors instance
    const error = new CombinedGraphQLErrors({
      errors: [{ message: 'Token expired', extensions: { classification: 'BAD_REQUEST' } }],
    });
    authFeatureMock.resetPassword.mockReturnValue(of({ error, data: null, loading: false }));
    component.form.controls.newPassword.setValue('newpassword123');
    component.form.controls.confirmPassword.setValue('newpassword123');
    component.submit();
    expect(component.success()).toBe(false);
    expect(component.errorMessage()).not.toBeNull();
  });
});
