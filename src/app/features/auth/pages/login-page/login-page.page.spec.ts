import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { LoginPagePage } from './login-page.page';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * Tests for LoginPagePage.
 *
 * Covers: form validation, successful login navigation, and inline error
 * display on a failed login (BAD_REQUEST).
 */
describe('LoginPagePage', () => {
  let component: LoginPagePage;
  let fixture: ComponentFixture<LoginPagePage>;

  const mockActivatedRoute = {
    snapshot: { queryParamMap: { get: (_key: string) => null } },
  };

  // vi.fn() + signal stubs replace jasmine.createSpyObj with properties
  const authServiceMock = {
    login: vi.fn(),
    logout: vi.fn(),
    restoreSession: vi.fn(),
    currentUser: signal(null),
    isAuthenticated: signal(false),
    isAdmin: signal(false),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [LoginPagePage, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with an invalid form', () => {
    // toBe(true) is the Vitest equivalent of Jasmine's toBeTrue()
    expect(component.form.invalid).toBe(true);
  });

  it('should mark email invalid when format is wrong', () => {
    component.form.controls.email.setValue('not-an-email');
    component.form.controls.email.markAsTouched();
    expect(component.emailControl.hasError('email')).toBe(true);
  });

  it('should not call login when form is invalid', () => {
    component.submit();
    expect(authServiceMock.login).not.toHaveBeenCalled();
  });

  it('should call login with form values when form is valid', () => {
    authServiceMock.login.mockReturnValue(
      of({ data: { login: { token: 'tok', user: {} } }, loading: false }),
    );
    component.form.setValue({ email: 'test@example.com', password: 'password' });
    component.submit();
    expect(authServiceMock.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
  });

  it('should set errorMessage when login returns a GraphQL error', () => {
    // Apollo v4: error is in result.error, a CombinedGraphQLErrors instance
    const error = new CombinedGraphQLErrors({
      errors: [{ message: 'Invalid credentials', extensions: { classification: 'BAD_REQUEST' } }],
    });
    authServiceMock.login.mockReturnValue(of({ error, data: null, loading: false }));
    component.form.setValue({ email: 'test@example.com', password: 'wrong' });
    component.submit();
    expect(component.errorMessage()).not.toBeNull();
  });

  it('should navigate to returnUrl on successful login', () => {
    const router = TestBed.inject(Router);
    // vi.spyOn replaces jasmine's spyOn; mockResolvedValue replaces .and.returnValue(Promise.resolve)
    const spy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    authServiceMock.login.mockReturnValue(
      of({ data: { login: { token: 'tok', user: {} } }, loading: false }),
    );
    component.form.setValue({ email: 'test@example.com', password: 'password123' });
    component.submit();
    expect(spy).toHaveBeenCalledWith('/');
  });
});
