import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { adminGuard } from './admin-guard';
import { AuthService } from './auth.service';

describe('adminGuard', () => {
  // WritableSignal lets individual tests set the admin state without
  // re-configuring the TestBed module.
  const isAdmin = signal(false);

  const authServiceMock = { isAdmin };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  it('allows navigation when isAdmin is true', () => {
    isAdmin.set(true);

    const result = TestBed.runInInjectionContext(() => adminGuard(
      // adminGuard ignores both arguments -- pass empty stubs
      {} as Parameters<typeof adminGuard>[0],
      {} as Parameters<typeof adminGuard>[1],
    ));

    expect(result).toBe(true);
  });

  it('redirects to / when isAdmin is false', () => {
    isAdmin.set(false);

    const result = TestBed.runInInjectionContext(() => adminGuard(
      {} as Parameters<typeof adminGuard>[0],
      {} as Parameters<typeof adminGuard>[1],
    ));

    expect(result).not.toBe(true);

    const router = TestBed.inject(Router);
    const expected = router.createUrlTree(['/']);

    expect((result as UrlTree).toString()).toBe(expected.toString());
  });
});
