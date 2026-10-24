import { Injectable, signal, computed } from '@angular/core';
import { AUTH_TOKEN_KEY } from './auth.models';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly _token = signal<string | null>(this.loadToken());

  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  /**
   * Returns the current JWT token from the reactive signal.
   *
   * Prefer reading the `token` signal directly in templates; use this method in
   * non-reactive contexts such as interceptors and Apollo connectionParams where
   * a plain value is needed at call time rather than a derived reactive expression.
   *
   * @returns The raw JWT string, or null if the user is not authenticated.
   */
  getToken(): string | null {
    return this._token();
  }

  /**
   * Persists a new token to localStorage and updates the reactive signal.
   *
   * Writing to localStorage ensures the token survives a page reload. Updating the signal
   * simultaneously keeps computed values (isAuthenticated, nav guards) consistent without
   * requiring a separate read cycle.
   *
   * @param token - A valid JWT string received from the login or register mutation.
   */
  setToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    this._token.set(token);
  }

  /**
   * Removes the token from localStorage and resets the signal to null.
   *
   * Called by the error link on UNAUTHENTICATED errors (expired token) and by an explicit
   * logout action. Setting the signal to null triggers all downstream computed signals
   * (isAuthenticated, guards) to re-evaluate synchronously.
   */
  clearToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    this._token.set(null);
  }

  /**
   * Reads the persisted token from localStorage at service initialisation time.
   *
   * Wrapped in try/catch because localStorage access can throw a SecurityError in
   * private-browsing modes where storage is blocked by the browser. Returning null
   * in that case means the app starts in a logged-out state rather than crashing.
   *
   * @returns The stored JWT string, or null if absent or inaccessible.
   */
  private loadToken(): string | null {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }
}
