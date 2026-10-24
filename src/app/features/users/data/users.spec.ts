import { TestBed } from '@angular/core/testing';
// ApolloTestingModule is the correct testing export from apollo-angular/testing.
// provideApolloTesting() does not exist in this package version -- the module
// must be listed under imports, not providers, because it is an NgModule that
// registers Apollo providers internally.
import { ApolloTestingModule } from 'apollo-angular/testing';
import { Users } from './users';

/**
 * Smoke test for the Users feature service.
 *
 * ApolloTestingModule supplies a lightweight Apollo client that intercepts all
 * operations without a real network -- suitable for verifying that the service
 * is correctly instantiated and its dependency-injection graph is complete.
 */
describe('Users', () => {
  let service: Users;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // ApolloTestingModule registers a mock Apollo client in the test injector
      imports: [ApolloTestingModule],
    });
    service = TestBed.inject(Users);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
