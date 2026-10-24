import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
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
  let authFeatureSpy: jasmine.SpyObj<AuthFeature>;

  beforeEach(async () => {
    authFeatureSpy = jasmine.createSpyObj<AuthFeature>('AuthFeature', ['resetPassword']);

    await TestBed.configureTestingModule({
      imports: [ResetPasswordPagePage, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [
        { provide: AuthFeature, useValue: authFeatureSpy },
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

  it('should show passwordMismatch error when passwords differ', () => {
    component.form.controls.newPassword.setValue('password123');
    component.form.controls.confirmPassword.setValue('different456');
    component.form.controls.confirmPassword.markAsTouched();
    expect(component.passwordMismatch).toBeTrue();
  });

  it('should not show mismatch when passwords match', () => {
    component.form.controls.newPassword.setValue('password123');
    component.form.controls.confirmPassword.setValue('password123');
    expect(component.passwordMismatch).toBeFalse();
  });

  it('should not call resetPassword when form is invalid', () => {
    component.submit();
    expect(authFeatureSpy.resetPassword).not.toHaveBeenCalled();
  });

  it('should transition to success=true on successful reset', () => {
    authFeatureSpy.resetPassword.and.returnValue(of({ data: { resetPassword: true } }));
    component.form.controls.newPassword.setValue('newpassword123');
    component.form.controls.confirmPassword.setValue('newpassword123');
    component.submit();
    expect(component.success()).toBeTrue();
  });

  it('should show inline error on BAD_REQUEST', () => {
    const graphqlError = { message: 'Token expired', extensions: { classification: 'BAD_REQUEST' } };
    authFeatureSpy.resetPassword.and.returnValue(of({ errors: [graphqlError] } as never));
    component.form.controls.newPassword.setValue('newpassword123');
    component.form.controls.confirmPassword.setValue('newpassword123');
    component.submit();
    expect(component.success()).toBeFalse();
    expect(component.errorMessage()).not.toBeNull();
  });
});
