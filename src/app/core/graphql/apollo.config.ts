import { inject } from '@angular/core';
import { HttpLink } from 'apollo-angular/http';
import { ApolloClient, InMemoryCache, split } from '@apollo/client/core';
import { ErrorLink } from '@apollo/client/link/error';
import { getMainDefinition } from '@apollo/client/utilities';
import { Router } from '@angular/router';
import { Auth } from '../auth/auth';
import { mapError } from './error-mapper';
import { WsClientService } from './ws-client';
import { environment } from '../../../environments/environment';

/**
 * Factory function that builds the ApolloClient configuration for the application.
 *
 * Apollo needs two transport links: HttpLink handles queries and mutations through the
 * Angular HttpClient pipeline (which applies the auth interceptor automatically), while
 * GraphQLWsLink handles subscriptions over a persistent WebSocket connection where the
 * JWT must be sent explicitly via connectionParams because HTTP interceptors do not apply
 * to WebSocket frames.
 *
 * An ErrorLink sits before HttpLink so that UNAUTHENTICATED errors from any query or
 * mutation redirect the user to /login before the response reaches the component. The
 * split() utility inspects each operation's OperationDefinition kind at runtime to route
 * it to the correct transport.
 *
 * In Apollo Client v4, the error callback receives a single typed `error` argument rather
 * than the old { graphQLErrors, networkError } destructuring. Use CombinedGraphQLErrors.is()
 * and ServerError.is() to narrow the type before reading fields.
 *
 * This function is called inside Angular's injection context (provideApollo accepts a
 * factory function), so inject() works for HttpLink, Auth, and Router.
 *
 * @returns A fully configured ApolloClient.Options object consumed by provideApollo().
 */
export function apolloOptionsFactory(): ApolloClient.Options {
  const httpLink = inject(HttpLink);
  const auth = inject(Auth);
  const router = inject(Router);
  // WsClientService owns the graphql-ws client lifecycle; reconnect() is
  // called by AuthService after login/logout to swap the inner client.
  const wsClientService = inject(WsClientService);

  // Apollo Angular's HttpLink uses Angular's HttpClient under the hood, so the
  // authInterceptor automatically attaches the Bearer token to every HTTP request.
  const http = httpLink.create({ uri: environment.apiUrl });

  // ErrorLink intercepts errors from the link chain before they reach components.
  // Apollo v4 passes a single `error` argument; mapError() normalises it to AppError.
  const errorLink = new ErrorLink(({ error, operation, forward }) => {
    const appError = mapError(error);
    if (appError.kind === 'UNAUTHENTICATED') {
      // Clear the stale token and redirect; the return URL allows the user to continue
      // where they left off after logging in again.
      auth.clearToken();
      const returnUrl = router.url;
      router.navigate(['/login'], { queryParams: { returnUrl } });
    }
    return forward(operation);
  });

  // split() routes operations by kind: subscription -> WebSocket, everything else -> HTTP.
  // The error link sits on the HTTP side only; WebSocket errors are handled by graphql-ws
  // (retries, keep-alive) and by the WsClientService reconnect on auth changes.
  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
    },
    wsClientService.link,
    errorLink.concat(http),
  );

  return {
    link: splitLink,
    cache: new InMemoryCache(),
    // Apollo Client v4 requires explicit DeclareDefaultOptions module augmentation to use
    // errorPolicy in defaultOptions. Rather than augmenting the internals, we pass
    // errorPolicy: 'all' per-operation in the services where partial data is useful.
  };
}
