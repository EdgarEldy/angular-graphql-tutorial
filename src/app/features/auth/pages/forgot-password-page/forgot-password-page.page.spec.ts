import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ForgotPasswordPagePage } from './forgot-password-page.page';
import { AuthFeature } from '../../data/auth-feature';

/**
 * Tests for ForgotPasswordPagePage.
 *
 * Key property: the page ALWAYS transitions to submitted=true after a submit,
 * regardless of the backend response. This prevents email enumeration.
 */
describe('ForgotPasswordPagePage', () => {
  let component: ForgotPasswordPagePage;
  let fixture: ComponentFixture<ForgotPasswordPagePage>;
  let authFeatureSpy: jasmine.SpyObj<AuthFeature>;

  beforeEach(async () => {
    authFeatureSpy = jasmine.createSpyObj<AuthFeature>('AuthFeature', ['requestPasswordReset']);

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPagePage, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [{ provide: AuthFeature, useValue: authFeatureSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordPagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not submit when email is invalid', () => {
    component.submit();
    expect(authFeatureSpy.requestPasswordReset).not.toHaveBeenCalled();
    expect(component.submitted()).toBeFalse();
  });

  it('should transition to submitted on success (email enumeration protection)', () => {
    authFeatureSpy.requestPasswordReset.and.returnValue(of({ data: { requestPasswordReset: true } }));
    component.form.controls.email.setValue('user@example.com');
    component.submit();
    expect(component.submitted()).toBeTrue();
  });

  it('should transition to submitted even when backend returns an error (email enumeration protection)', () => {
    // Even a network error must not reveal that the email does not exist
    authFeatureSpy.requestPasswordReset.and.returnValue(throwError(() => new Error('network')));
    component.form.controls.email.setValue('user@example.com');
    component.submit();
    expect(component.submitted()).toBeTrue();
  });
});
