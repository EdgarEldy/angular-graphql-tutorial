import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { RegisterPagePage } from './register-page.page';
import { AuthFeature } from '../../data/auth-feature';

/**
 * Tests for RegisterPagePage.
 *
 * Covers: form validation (all fields required, email format, password min length),
 * the activation-required post-submit state, and inline BAD_REQUEST error display.
 */
describe('RegisterPagePage', () => {
  let component: RegisterPagePage;
  let fixture: ComponentFixture<RegisterPagePage>;

  // vi.fn() replaces jasmine.createSpyObj
  const authFeatureMock = { register: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [RegisterPagePage, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [{ provide: AuthFeature, useValue: authFeatureMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not call register when form is invalid', () => {
    component.submit();
    expect(authFeatureMock.register).not.toHaveBeenCalled();
  });

  it('should require a valid email format', () => {
    component.form.controls.email.setValue('bad-email');
    component.form.controls.email.markAsTouched();
    // toBe(true) is the Vitest equivalent of Jasmine's toBeTrue()
    expect(component.emailControl.hasError('email')).toBe(true);
  });

  it('should require password min length of 8', () => {
    component.form.controls.password.setValue('short');
    component.form.controls.password.markAsTouched();
    expect(component.passwordControl.hasError('minlength')).toBe(true);
  });

  it('should set registered signal to true on success', () => {
    authFeatureMock.register.mockReturnValue(
      of({ data: { register: { id: '1', email: 'jane@example.com' } }, loading: false }),
    );
    component.form.setValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
    });
    component.submit();
    expect(component.registered()).toBe(true);
  });

  it('should show inline error on BAD_REQUEST and not set registered', () => {
    // Apollo v4: error is in result.error, a CombinedGraphQLErrors instance
    const error = new CombinedGraphQLErrors({
      errors: [{ message: 'Email already taken', extensions: { classification: 'BAD_REQUEST' } }],
    });
    authFeatureMock.register.mockReturnValue(of({ error, data: null, loading: false }));
    component.form.setValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
    });
    component.submit();
    // toBe(false) is the Vitest equivalent of Jasmine's toBeFalse()
    expect(component.registered()).toBe(false);
    expect(component.errorMessage()).not.toBeNull();
  });
});
