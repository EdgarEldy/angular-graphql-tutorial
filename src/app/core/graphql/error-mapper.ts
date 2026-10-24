import { ApolloError } from '@apollo/client/core';
import { AppError, ErrorKind } from './app-error.model';

const classificationMap: Readonly<Record<string, ErrorKind>> = {
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHENTICATED',
} as const;

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
