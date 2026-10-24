import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { ActivatePagePage } from './activate-page.page';
import { AuthFeature } from '../../data/auth-feature';

/**
 * Tests for ActivatePagePage.
 *
 * Covers: missing token in URL, successful activation, and BAD_REQUEST error.
 */
describe('ActivatePagePage', () => {
  let component: ActivatePagePage;
  let fixture: ComponentFixture<ActivatePagePage>;
  let authFeatureSpy: jasmine.SpyObj<AuthFeature>;

  function createWithToken(token: string | null): void {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: { queryParamMap: { get: (_key: string) => token } },
      },
    });
    fixture = TestBed.createComponent(ActivatePagePage);
    component = fixture.componentInstance;
  }

  beforeEach(async () => {
    authFeatureSpy = jasmine.createSpyObj<AuthFeature>('AuthFeature', ['activateAccount']);

    await TestBed.configureTestingModule({
      imports: [ActivatePagePage, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [
        { provide: AuthFeature, useValue: authFeatureSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('should show error state when token is missing', () => {
    createWithToken(null);
    fixture.detectChanges();
    expect(component.state()).toBe('error');
    expect(authFeatureSpy.activateAccount).not.toHaveBeenCalled();
  });

  it('should call activateAccount when token is present', () => {
    authFeatureSpy.activateAccount.and.returnValue(of({ data: { activateAccount: true } }));
    createWithToken('valid-token');
    fixture.detectChanges();
    expect(authFeatureSpy.activateAccount).toHaveBeenCalledWith('valid-token');
    expect(component.state()).toBe('success');
  });

  it('should set error state on BAD_REQUEST', () => {
    const graphqlError = { message: 'Invalid token', extensions: { classification: 'BAD_REQUEST' } };
    authFeatureSpy.activateAccount.and.returnValue(of({ errors: [graphqlError] } as never));
    createWithToken('expired-token');
    fixture.detectChanges();
    expect(component.state()).toBe('error');
    expect(component.errorMessage()).not.toBeNull();
  });
});
