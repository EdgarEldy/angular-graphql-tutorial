import { ApolloError } from '@apollo/client/core';
import { mapApolloError } from './error-mapper';

function makeGraphQLError(classification: string, message = 'error message'): ApolloError {
  return new ApolloError({
    graphQLErrors: [
      {
        message,
        extensions: { classification },
        locations: undefined,
        path: undefined,
        nodes: undefined,
        source: undefined,
        positions: undefined,
        originalError: undefined,
        name: 'GraphQLError',
      },
    ],
  });
}

function makeNetworkError(status?: number): ApolloError {
  const networkError: Error & { status?: number } = new Error('network');
  if (status !== undefined) {
    networkError.status = status;
  }
  return new ApolloError({ networkError });
}

describe('mapApolloError', () => {
  describe('GraphQL errors', () => {
    it('maps NOT_FOUND classification to NOT_FOUND kind', () => {
      const result = mapApolloError(makeGraphQLError('NOT_FOUND', 'Resource not found'));
      expect(result.kind).toBe('NOT_FOUND');
      expect(result.message).toBe('Resource not found');
    });

    it('maps BAD_REQUEST classification to BAD_REQUEST kind', () => {
      const result = mapApolloError(makeGraphQLError('BAD_REQUEST', 'Validation failed'));
      expect(result.kind).toBe('BAD_REQUEST');
      expect(result.message).toBe('Validation failed');
    });

    it('maps FORBIDDEN classification to FORBIDDEN kind', () => {
      const result = mapApolloError(makeGraphQLError('FORBIDDEN'));
      expect(result.kind).toBe('FORBIDDEN');
    });

    it('maps UNAUTHORIZED classification to UNAUTHENTICATED kind', () => {
      const result = mapApolloError(makeGraphQLError('UNAUTHORIZED'));
      expect(result.kind).toBe('UNAUTHENTICATED');
    });

    it('maps unknown classification to INTERNAL_ERROR kind', () => {
      const result = mapApolloError(makeGraphQLError('SOME_UNKNOWN'));
      expect(result.kind).toBe('INTERNAL_ERROR');
    });

    it('uses the message from the first GraphQL error', () => {
      const result = mapApolloError(makeGraphQLError('NOT_FOUND', 'Category not found'));
      expect(result.message).toBe('Category not found');
    });
  });

  describe('network errors', () => {
    it('maps a 401 network error to UNAUTHENTICATED', () => {
      const result = mapApolloError(makeNetworkError(401));
      expect(result.kind).toBe('UNAUTHENTICATED');
    });

    it('maps a 403 network error to FORBIDDEN', () => {
      const result = mapApolloError(makeNetworkError(403));
      expect(result.kind).toBe('FORBIDDEN');
    });

    it('maps a network error without status to NETWORK', () => {
      const result = mapApolloError(makeNetworkError());
      expect(result.kind).toBe('NETWORK');
    });

    it('maps a 500 network error to NETWORK', () => {
      const result = mapApolloError(makeNetworkError(500));
      expect(result.kind).toBe('NETWORK');
    });
  });

  describe('empty error', () => {
    it('returns INTERNAL_ERROR when there are no graphql errors and no network error', () => {
      const result = mapApolloError(new ApolloError({}));
      expect(result.kind).toBe('INTERNAL_ERROR');
    });
  });
});
