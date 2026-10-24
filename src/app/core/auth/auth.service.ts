import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { FetchResult } from '@apollo/client/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { Auth } from './auth';
import { WsClientService } from '../graphql/ws-client';
import {
  LoginDocument,
  LogoutDocument,
  MeDocument,
  type LoginMutation,
  type LoginMutationVariables,
  type LogoutMutation,
  type MeQuery,
  type MeQueryVariables,
} from '../graphql/generated/graphql';

/** Shape of the currently signed-in user as returned by the `me` query. */
export type SessionUser = NonNullable<MeQuery['me']>;

/**
 * Manages the authenticated user session for the entire application.
 *
 * Responsibilities are divided between two services to keep concerns separate:
 * {@link Auth} owns raw token persistence (localStorage, signal); this service
 * owns the higher-level session -- calling the API, storing the typed user
 * object, and coordinating side-effects (WS reconnect, cache eviction) on
 * login and logout.
 *
 * Components and guards read `currentUser`, `isAuthenticated`, and `isAdmin`
 * as readonly signals; they never call Apollo or the token service directly.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apollo = inject(Apollo);
  private readonly auth = inject(Auth);
  private readonly wsClientService = inject(WsClientService);

  private readonly _session = signal<SessionUser | null>(null);

  /** The signed-in user, or null when the session is anonymous. */
  readonly currentUser = this._session.asReadonly();

  /**
   * True when a user is signed in.
   *
   * Derived from `_session` rather than from `Auth.isAuthenticated` so the
   * signal reflects the fully-loaded session, not just token presence.
   */
  readonly isAuthenticated = computed(() => this._session() !== null);

  /**
   * True when the signed-in user holds at least one role named `ADMIN`.
   *
   * Used by the Shell to toggle the Administration nav group and by
   * `adminGuard` to protect admin-only routes.
   */
  readonly isAdmin = computed(() =>
    this._session()?.roles.some((r) => r.roleName === 'ADMIN') ?? false,
  );

  constructor() {
    // Mirror token-layer clears (e.g. the UNAUTHENTICATED error link) into the
    // session signal so that guards and the nav re-evaluate immediately.
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        this._session.set(null);
      }
    });
  }

  /**
   * Calls the `login` mutation, stores the JWT, and sets the session signal.
   *
   * The WS client is replaced after a successful login so that the next
   * subscription connects with the fresh token in `connectionParams`. The
   * caller (the login page) is responsible for navigating on success and
   * displaying `result.errors` for bad credentials.
   *
   * @param input - Email and password from the login form.
   * @returns Observable of the raw mutation result; errors are in
   *   `result.errors` when `errorPolicy: 'all'` is active.
   */
  login(input: LoginMutationVariables['input']): Observable<FetchResult<LoginMutation>> {
    return this.apollo
      .mutate<LoginMutation, LoginMutationVariables>({
        mutation: LoginDocument,
        variables: { input },
        errorPolicy: 'all',
      })
      .pipe(
        tap((result) => {
          const payload = result.data?.login;
          if (payload?.token) {
            this.auth.setToken(payload.token);
            this._session.set(payload.user);
            // Reconnect the WS so the next subscription uses the new token.
            this.wsClientService.reconnect();
          }
        }),
      );
  }

  /**
   * Calls the `logout` mutation to blacklist the token server-side, then clears
   * local state unconditionally regardless of whether the server responded.
   *
   * Clearing state on error is intentional: a server that is down should not
   * prevent the user from leaving their session locally.
   *
   * @returns Observable that completes after local cleanup finishes.
   */
  logout(): Observable<void> {
    return this.apollo
      .mutate<LogoutMutation>({
        mutation: LogoutDocument,
        errorPolicy: 'all',
      })
      .pipe(
        tap(() => this.clearLocalSession()),
        catchError(() => {
          this.clearLocalSession();
          return of(null);
        }),
        map(() => void 0),
      );
  }

  /**
   * Validates the stored JWT against the API and loads the session user.
   *
   * Called by `APP_INITIALIZER` before the router processes the initial
   * navigation. If the token is expired the error link clears it and this method
   * completes cleanly; the user is redirected to `/login` by the guard.
   *
   * @returns Observable that completes once the session is resolved.
   */
  restoreSession(): Observable<void> {
    // Skip the round-trip if no token is stored.
    if (!this.auth.isAuthenticated()) {
      return of(void 0);
    }
    return this.apollo
      .query<MeQuery, MeQueryVariables>({
        query: MeDocument,
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
      })
      .pipe(
        tap((result) => {
          if (result.data?.me) {
            this._session.set(result.data.me);
          } else {
            // Token is valid but `me` returned null (e.g. user deleted).
            this.auth.clearToken();
          }
        }),
        catchError(() => {
          // Network failure: clear the token and let the user log in again.
          this.auth.clearToken();
          return of(void 0);
        }),
        map(() => void 0),
      );
  }

  /**
   * Clears the JWT, session signal, WS client, and Apollo cache.
   *
   * Extracted so both the `logout` tap and the catch handler follow the same
   * teardown path.
   */
  private clearLocalSession(): void {
    this.auth.clearToken();
    this._session.set(null);
    this.wsClientService.reconnect();
    // Evict all cached data so nothing leaks to the next session.
    void this.apollo.client.clearStore();
  }
}
