import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

// jsdom does not implement window.matchMedia; stub it before Shell is
// constructed so the signal initialisation in shell.ts does not throw.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

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

  it('toggles the dark mode on toggleTheme()', () => {
    // The redesigned shell uses a custom sidebar; sidenav was replaced by
    // a darkMode signal that controls the data-theme attribute on <html>.
    const initial = component.darkMode();
    component.toggleTheme();
    expect(component.darkMode()).toBe(!initial);
  });
});
