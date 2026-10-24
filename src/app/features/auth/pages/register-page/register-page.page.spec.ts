import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
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
  let authFeatureSpy: jasmine.SpyObj<AuthFeature>;

  beforeEach(async () => {
    authFeatureSpy = jasmine.createSpyObj<AuthFeature>('AuthFeature', ['register']);

    await TestBed.configureTestingModule({
      imports: [RegisterPagePage, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [{ provide: AuthFeature, useValue: authFeatureSpy }],
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
    expect(authFeatureSpy.register).not.toHaveBeenCalled();
  });

  it('should require a valid email format', () => {
    component.form.controls.email.setValue('bad-email');
    component.form.controls.email.markAsTouched();
    expect(component.emailControl.hasError('email')).toBeTrue();
  });

  it('should require password min length of 8', () => {
    component.form.controls.password.setValue('short');
    component.form.controls.password.markAsTouched();
    expect(component.passwordControl.hasError('minlength')).toBeTrue();
  });

  it('should set registered signal to true on success', () => {
    authFeatureSpy.register.and.returnValue(of({ data: { register: { token: null, user: {} as never } } }));
    component.form.setValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
    });
    component.submit();
    expect(component.registered()).toBeTrue();
  });

  it('should show inline error on BAD_REQUEST and not set registered', () => {
    const graphqlError = { message: 'Email already taken', extensions: { classification: 'BAD_REQUEST' } };
    authFeatureSpy.register.and.returnValue(of({ errors: [graphqlError] } as never));
    component.form.setValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'password123',
    });
    component.submit();
    expect(component.registered()).toBeFalse();
    expect(component.errorMessage()).not.toBeNull();
  });
});
