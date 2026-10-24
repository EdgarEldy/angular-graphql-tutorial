import { ApolloError } from '@apollo/client/core';
import { AppError, ErrorKind } from './app-error.model';

const classificationMap: Readonly<Record<string, ErrorKind>> = {
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHENTICATED',
} as const;

/**
 * Converts an ApolloError (GraphQL or network) into a typed AppError understood by the UI.
 *
 * Apollo can report two kinds of problems: GraphQL errors returned by the server inside the
 * `errors` array (classified via `extensions.classification`) and transport-level network
 * errors. This function checks network errors first because they short-circuit the GraphQL
 * error inspection -- a 401 response never carries a GraphQL body.
 *
 * @param error - The ApolloError thrown or forwarded by the Apollo link chain.
 * @returns A normalised AppError with a stable `kind` enum value the rest of the app reacts to.
 */
export function mapApolloError(error: ApolloError): AppError {
  if (error.networkError) {
    const status = (error.networkError as { status?: number }).status;
    if (status === 401) {
      return { kind: 'UNAUTHENTICATED', message: 'Your session has expired. Please log in again.' };
    }
    if (status === 403) {
      return { kind: 'FORBIDDEN', message: 'You do not have permission to perform this action.' };
    }
    return { kind: 'NETWORK', message: 'A network error occurred. Please check your connection and try again.' };
  }

  if (error.graphQLErrors && error.graphQLErrors.length > 0) {
    const first = error.graphQLErrors[0];
    const classification = first.extensions?.['classification'] as string | undefined;
    const kind: ErrorKind = classificationMap[classification ?? ''] ?? 'INTERNAL_ERROR';
    return { kind, message: first.message };
  }

  return { kind: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' };
}
