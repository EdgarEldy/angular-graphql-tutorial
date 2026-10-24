import { inject } from '@angular/core';
import { HttpLink } from 'apollo-angular/http';
import { ApolloClientOptions, ApolloError, InMemoryCache, split } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Auth } from '../auth/auth';
import { mapApolloError } from './error-mapper';

export function apolloOptionsFactory(): ApolloClientOptions<unknown> {
  const httpLink = inject(HttpLink);
  const auth = inject(Auth);
  const router = inject(Router);

  const http = httpLink.create({ uri: environment.apiUrl });

  const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
    const apolloError = new ApolloError({ graphQLErrors, networkError: networkError ?? undefined });
    const appError = mapApolloError(apolloError);
    if (appError.kind === 'UNAUTHENTICATED') {
      auth.clearToken();
      const returnUrl = router.url;
      router.navigate(['/login'], { queryParams: { returnUrl } });
    }
    return forward(operation);
  });

  const wsLink = new GraphQLWsLink(
    createClient({
      url: environment.wsUrl,
      connectionParams: () => {
        const token = auth.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  );

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
    },
    wsLink,
    errorLink.concat(http),
  );

  return {
    link: splitLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
      },
      query: {
        errorPolicy: 'all',
      },
    },
  };
}
