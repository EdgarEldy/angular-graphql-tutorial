import { TestBed } from '@angular/core/testing';
// ApolloTestingModule provides a mock Apollo client so the service's Apollo
// dependency resolves without a real HTTP/WebSocket connection in unit tests.
import { ApolloTestingModule } from 'apollo-angular/testing';
import { AuthFeature } from './auth-feature';

/**
 * Smoke test for the AuthFeature service.
 *
 * ApolloTestingModule intercepts all GraphQL operations and allows the service
 * to be instantiated without a live backend. The test verifies only that
 * the dependency-injection graph is wired correctly.
 */
describe('AuthFeature', () => {
  let service: AuthFeature;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // ApolloTestingModule registers a mock Apollo client in the test injector
      imports: [ApolloTestingModule],
    });
    service = TestBed.inject(AuthFeature);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
