import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';
import { signal } from '@angular/core';
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
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  const mockActivatedRoute = {
    snapshot: { queryParamMap: { get: (_key: string) => null } },
  };

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['login'],
      {
        // Signal stubs required by AuthService's readonly signal properties
        currentUser: signal(null) as unknown as AuthService['currentUser'],
        isAuthenticated: signal(false) as unknown as AuthService['isAuthenticated'],
        isAdmin: signal(false) as unknown as AuthService['isAdmin'],
      },
    );

    await TestBed.configureTestingModule({
      imports: [LoginPagePage, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
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
    expect(component.form.invalid).toBeTrue();
  });

  it('should mark email invalid when format is wrong', () => {
    component.form.controls.email.setValue('not-an-email');
    component.form.controls.email.markAsTouched();
    expect(component.emailControl.hasError('email')).toBeTrue();
  });

  it('should not call login when form is invalid', () => {
    component.submit();
    expect(authServiceSpy.login).not.toHaveBeenCalled();
  });

  it('should call login with form values when form is valid', () => {
    authServiceSpy.login.and.returnValue(of({ data: { login: { token: 'tok', user: {} as never } } }));
    component.form.setValue({ email: 'test@example.com', password: 'password' });
    component.submit();
    expect(authServiceSpy.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    });
  });

  it('should set errorMessage when login returns errors', () => {
    const graphqlError = { message: 'Invalid credentials', extensions: { classification: 'BAD_REQUEST' } };
    authServiceSpy.login.and.returnValue(of({ errors: [graphqlError] } as never));
    component.form.setValue({ email: 'test@example.com', password: 'wrong' });
    component.submit();
    expect(component.errorMessage()).not.toBeNull();
  });

  it('should navigate on successful login', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    authServiceSpy.login.and.returnValue(of({ data: { login: { token: 'tok', user: {} as never } } }));
    component.form.setValue({ email: 'test@example.com', password: 'password123' });
    component.submit();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });
});
