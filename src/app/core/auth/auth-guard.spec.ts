import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth-guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  // WritableSignal lets individual tests set the authentication state without
  // re-configuring the TestBed module.
  const isAuthenticated = signal(false);

  const authServiceMock = { isAuthenticated };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  it('allows navigation when isAuthenticated is true', () => {
    isAuthenticated.set(true);

    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/dashboard' } as RouterStateSnapshot,
      ),
    );

    expect(result).toBe(true);
  });

  it('redirects to /login with returnUrl when isAuthenticated is false', () => {
    isAuthenticated.set(false);

    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/dashboard' } as RouterStateSnapshot,
      ),
    );

    // The guard must return a UrlTree, not a boolean
    expect(result).not.toBe(true);

    const router = TestBed.inject(Router);
    const expected = router.createUrlTree(['/login'], {
      queryParams: { returnUrl: '/dashboard' },
    });

    // Serialize both trees for a reliable string comparison
    expect((result as UrlTree).toString()).toBe(expected.toString());
  });
});
