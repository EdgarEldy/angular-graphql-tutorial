import { Injectable, signal, computed } from '@angular/core';
import { AUTH_TOKEN_KEY } from './auth.models';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly _token = signal<string | null>(this.loadToken());

  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  getToken(): string | null {
    return this._token();
  }

  setToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    this._token.set(token);
  }

  clearToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    this._token.set(null);
  }

  private loadToken(): string | null {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }
}
