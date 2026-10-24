import { TestBed } from '@angular/core/testing';
import { Auth } from './auth';
import { AUTH_TOKEN_KEY } from './auth.models';

describe('Auth', () => {
  let service: Auth;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(Auth);
  });

  afterEach(() => localStorage.clear());

  it('initializes with null token when localStorage is empty', () => {
    expect(service.token()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('stores the token in localStorage and exposes it via signal', () => {
    service.setToken('test-jwt');
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('test-jwt');
    expect(service.token()).toBe('test-jwt');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('clears token from localStorage and signal on clearToken', () => {
    service.setToken('test-jwt');
    service.clearToken();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(service.token()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('loads an existing token from localStorage on construction', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'persisted-jwt');
    const freshService = new Auth();
    expect(freshService.token()).toBe('persisted-jwt');
  });
});
