import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Shell } from './shell';
import { AuthService } from '../../auth/auth.service';

/**
 * Smoke test for the Shell layout component.
 *
 * Shell injects AuthService (for isAdmin and logout) and Router (for
 * navigation after logout). Both are provided via mocks so no real network
 * or Apollo client is needed.
 */
describe('Shell', () => {
  let component: Shell;
  let fixture: ComponentFixture<Shell>;

  const authServiceMock = {
    logout: vi.fn(),
    currentUser: signal(null),
    isAuthenticated: signal(false),
    isAdmin: signal(false),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Shell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggles the sidenav on toggleSidenav()', () => {
    const initial = component.sidenavOpen();
    component.toggleSidenav();
    expect(component.sidenavOpen()).toBe(!initial);
  });
});
