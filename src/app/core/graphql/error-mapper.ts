import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { AppError, ErrorKind } from './app-error.model';

// Apollo Client v4 replaced the monolithic ApolloError with narrowed error classes:
// CombinedGraphQLErrors for server-side errors[] and ServerError for HTTP-level failures.
const classificationMap: Readonly<Record<string, ErrorKind>> = {
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHENTICATED',
} as const;

/**
 * Converts an Apollo v4 error (from the ErrorLink callback) into a typed AppError
 * that the rest of the application can react to without knowing Apollo internals.
 *
 * Apollo Client v4 delivers three kinds of errors to the error link:
 * - `CombinedGraphQLErrors`: the server executed the operation and returned one or more
 *   errors in the `errors[]` array. The classification comes from `extensions.classification`.
 * - `ServerError`: the server responded with a non-200 HTTP status code (e.g. 401 when
 *   the JWT has expired before the GraphQL engine runs). The status code is on `.statusCode`.
 * - A plain `Error`: a transport-level failure (DNS, timeout, CORS). No HTTP status.
 *
 * `ServerError` is checked before `CombinedGraphQLErrors` because a 401 HTTP response
 * never carries a GraphQL body, so the `errors[]` branch would not match.
 *
 * @param error - The error delivered by the Apollo ErrorLink callback.
 * @returns A normalised AppError with a stable `kind` enum value the rest of the app reacts to.
 */
export function mapError(error: Error): AppError {
  if (ServerError.is(error)) {
    if (error.statusCode === 401) {
      return { kind: 'UNAUTHENTICATED', message: 'Your session has expired. Please log in again.' };
    }
    if (error.statusCode === 403) {
      return { kind: 'FORBIDDEN', message: 'You do not have permission to perform this action.' };
    }
    return {
      kind: 'NETWORK',
      message: 'A network error occurred. Please check your connection and try again.',
    };
  }

  if (CombinedGraphQLErrors.is(error)) {
    const first = error.errors[0];
    const classification = first?.extensions?.['classification'] as string | undefined;
    const kind: ErrorKind = classificationMap[classification ?? ''] ?? 'INTERNAL_ERROR';
    return { kind, message: first?.message ?? 'An unexpected error occurred.' };
  }

  // Plain network error: connection refused, DNS failure, timeout, etc.
  return {
    kind: 'NETWORK',
    message: 'A network error occurred. Please check your connection and try again.',
  };
}
