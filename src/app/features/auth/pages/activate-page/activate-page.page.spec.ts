import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ActivatePagePage } from './activate-page.page';
import { AuthFeature } from '../../data/auth-feature';

/**
 * Tests for ActivatePagePage.
 *
 * Covers: missing token in URL, successful activation, and BAD_REQUEST error.
 * The page is automatic -- it reads the token from the URL and calls the
 * mutation on init without any form interaction.
 */
describe('ActivatePagePage', () => {
  let component: ActivatePagePage;
  let fixture: ComponentFixture<ActivatePagePage>;

  // vi.fn() creates a Vitest mock function (replaces jasmine.createSpyObj)
  const authFeatureMock = {
    activateAccount: vi.fn(),
  };

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
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ActivatePagePage, NoopAnimationsModule, RouterModule.forRoot([])],
      providers: [
        { provide: AuthFeature, useValue: authFeatureMock },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('shows error state when token is missing in the URL', () => {
    createWithToken(null);
    fixture.detectChanges();
    expect(component.state()).toBe('error');
    expect(authFeatureMock.activateAccount).not.toHaveBeenCalled();
  });

  it('calls activateAccount and transitions to success when token is present', () => {
    // mockReturnValue replaces jasmine's .and.returnValue()
    authFeatureMock.activateAccount.mockReturnValue(
      of({ data: { activateAccount: true }, loading: false }),
    );
    createWithToken('valid-token');
    fixture.detectChanges();
    expect(authFeatureMock.activateAccount).toHaveBeenCalledWith('valid-token');
    expect(component.state()).toBe('success');
  });

  it('sets error state when the mutation returns a BAD_REQUEST error', () => {
    // Apollo v4: error is in result.error, a CombinedGraphQLErrors instance
    const error = new CombinedGraphQLErrors({
      errors: [{ message: 'Invalid token', extensions: { classification: 'BAD_REQUEST' } }],
    });
    authFeatureMock.activateAccount.mockReturnValue(
      of({ error, data: null, loading: false }),
    );
    createWithToken('expired-token');
    fixture.detectChanges();
    expect(component.state()).toBe('error');
    expect(component.errorMessage()).not.toBeNull();
  });
});
