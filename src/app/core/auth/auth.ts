import { Injectable, signal, computed } from '@angular/core';
import { AUTH_TOKEN_KEY, AUTH_REFRESH_TOKEN_KEY } from './auth.models';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly _token = signal<string | null>(this.loadToken());
  // Refresh token is persisted separately so it survives a page reload.
  private readonly _refreshToken = signal<string | null>(this.loadRefreshToken());

  readonly token = this._token.asReadonly();
  readonly refreshToken = this._refreshToken.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  /**
   * Decoded JWT payload derived from the current access token.
   *
   * Recomputes every time the token signal changes (login, logout, refresh).
   * Returns null when no token is present or when the payload cannot be parsed
   * (malformed base64, invalid JSON). This avoids throwing in a computed signal,
   * which would propagate an error into every consumer.
   *
   * The cast to { sub, exp, iat } covers the standard JWT claims present in
   * every Spring Security token; additional custom claims are ignored here.
   *
   * @returns Parsed payload object, or null.
   */
  readonly claims = computed((): { sub: string; exp: number; iat: number } | null => {
    const token = this._token();
    if (!token) return null;
    try {
      // JWT has three base64url segments: header.payload.signature
      const segment = token.split('.')[1];
      // base64url uses '-' and '_' instead of '+' and '/' -- replace before atob()
      return JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  });

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
   * Persists both the access token and the refresh token, then updates signals.
   *
   * The access token is used for every API request; the refresh token is stored
   * for future silent renewal when the access token expires. Writing both to
   * localStorage ensures they survive page reloads. Signals update simultaneously
   * so guards and computed values re-evaluate without an extra read cycle.
   *
   * @param accessToken - The JWT access token from the login or refresh mutation.
   * @param refreshToken - The refresh token from the same mutation, or null if absent.
   */
  setTokens(accessToken: string, refreshToken: string | null | undefined): void {
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    this._token.set(accessToken);
    if (refreshToken) {
      localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
      this._refreshToken.set(refreshToken);
    }
  }

  /**
   * Removes both tokens from localStorage and resets both signals to null.
   *
   * Called by the error link on UNAUTHENTICATED errors (expired token) and by an
   * explicit logout action. Setting signals to null triggers all downstream computed
   * signals (isAuthenticated, guards) to re-evaluate synchronously.
   */
  clearToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    this._token.set(null);
    this._refreshToken.set(null);
  }

  /**
   * Returns the current refresh token from the reactive signal.
   *
   * Use in contexts where a plain value is needed (interceptors, auth-feature
   * refreshToken call) rather than a reactive expression.
   *
   * @returns The stored refresh token string, or null if absent.
   */
  getRefreshToken(): string | null {
    return this._refreshToken();
  }

  /**
   * Reads the persisted access token from localStorage at service initialisation time.
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

  /**
   * Reads the persisted refresh token from localStorage at service initialisation time.
   *
   * @returns The stored refresh token string, or null if absent or inaccessible.
   */
  private loadRefreshToken(): string | null {
    try {
      return localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }
}
