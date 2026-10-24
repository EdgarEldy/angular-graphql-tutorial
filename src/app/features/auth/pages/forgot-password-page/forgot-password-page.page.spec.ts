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

  // vi.fn() replaces jasmine.createSpyObj
  const authFeatureMock = { requestPasswordReset: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPagePage, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [{ provide: AuthFeature, useValue: authFeatureMock }],
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
    expect(authFeatureMock.requestPasswordReset).not.toHaveBeenCalled();
    // toBe(false) is the Vitest equivalent of Jasmine's toBeFalse()
    expect(component.submitted()).toBe(false);
  });

  it('transitions to submitted on success (email enumeration protection)', () => {
    authFeatureMock.requestPasswordReset.mockReturnValue(
      of({ data: { requestPasswordReset: true }, loading: false }),
    );
    component.form.controls.email.setValue('user@example.com');
    component.submit();
    // toBe(true) is the Vitest equivalent of Jasmine's toBeTrue()
    expect(component.submitted()).toBe(true);
  });

  it('transitions to submitted even when backend returns an error (email enumeration protection)', () => {
    // Even a network error must not reveal whether the email is registered
    authFeatureMock.requestPasswordReset.mockReturnValue(
      throwError(() => new Error('network')),
    );
    component.form.controls.email.setValue('user@example.com');
    component.submit();
    expect(component.submitted()).toBe(true);
  });
});
