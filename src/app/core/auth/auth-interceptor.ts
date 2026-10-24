import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from './auth';

/**
 * Functional HTTP interceptor that attaches a Bearer token to every outbound request.
 *
 * Angular 17+ functional interceptors replace class-based interceptors and do not need
 * to be declared in a module -- they are registered directly in provideHttpClient() via
 * withInterceptors(). inject() works here because the function is called inside the
 * Angular injection context created by the HttpClient pipeline.
 *
 * Requests are passed through unchanged when no token is present (unauthenticated routes
 * such as /login and /register must reach the backend without an Authorization header).
 *
 * @param req  - The outgoing HTTP request being intercepted.
 * @param next - The next handler in the interceptor chain; returns an Observable of the response.
 * @returns An Observable of the HTTP response, with the Authorization header added when authenticated.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(Auth).getToken();
  if (token === null) {
    return next(req);
  }
  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(authReq);
};
