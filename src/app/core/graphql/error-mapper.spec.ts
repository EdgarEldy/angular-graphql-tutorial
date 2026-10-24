import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { mapError } from './error-mapper';

// Apollo v4: build a CombinedGraphQLErrors wrapping one server-side GraphQL error.
function makeGraphQLError(classification: string, message = 'error message'): CombinedGraphQLErrors {
  const result = {
    errors: [
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
  };
  return new CombinedGraphQLErrors(result);
}

// Apollo v4: ServerError wraps a non-200 HTTP response and exposes .statusCode.
function makeServerError(status: number): ServerError {
  return new ServerError('Server responded with non-200 status', {
    response: { status } as Response,
    bodyText: '',
  });
}

describe('mapError', () => {
  describe('GraphQL errors (CombinedGraphQLErrors)', () => {
    it('maps NOT_FOUND classification to NOT_FOUND kind', () => {
      const result = mapError(makeGraphQLError('NOT_FOUND', 'Resource not found'));
      expect(result.kind).toBe('NOT_FOUND');
      expect(result.message).toBe('Resource not found');
    });

    it('maps BAD_REQUEST classification to BAD_REQUEST kind', () => {
      const result = mapError(makeGraphQLError('BAD_REQUEST', 'Validation failed'));
      expect(result.kind).toBe('BAD_REQUEST');
      expect(result.message).toBe('Validation failed');
    });

    it('maps FORBIDDEN classification to FORBIDDEN kind', () => {
      const result = mapError(makeGraphQLError('FORBIDDEN'));
      expect(result.kind).toBe('FORBIDDEN');
    });

    it('maps UNAUTHORIZED classification to UNAUTHENTICATED kind', () => {
      const result = mapError(makeGraphQLError('UNAUTHORIZED'));
      expect(result.kind).toBe('UNAUTHENTICATED');
    });

    it('maps unknown classification to INTERNAL_ERROR kind', () => {
      const result = mapError(makeGraphQLError('SOME_UNKNOWN'));
      expect(result.kind).toBe('INTERNAL_ERROR');
    });

    it('uses the message from the first GraphQL error', () => {
      const result = mapError(makeGraphQLError('NOT_FOUND', 'Category not found'));
      expect(result.message).toBe('Category not found');
    });
  });

  describe('network errors (ServerError)', () => {
    it('maps a 401 server error to UNAUTHENTICATED', () => {
      const result = mapError(makeServerError(401));
      expect(result.kind).toBe('UNAUTHENTICATED');
    });

    it('maps a 403 server error to FORBIDDEN', () => {
      const result = mapError(makeServerError(403));
      expect(result.kind).toBe('FORBIDDEN');
    });

    it('maps a 500 server error to NETWORK', () => {
      const result = mapError(makeServerError(500));
      expect(result.kind).toBe('NETWORK');
    });
  });

  describe('plain network errors', () => {
    it('maps a plain Error to NETWORK kind', () => {
      const result = mapError(new Error('connection refused'));
      expect(result.kind).toBe('NETWORK');
    });
  });
});
