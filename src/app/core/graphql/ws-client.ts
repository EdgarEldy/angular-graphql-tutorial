import { inject, Injectable } from '@angular/core';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import type { Client } from 'graphql-ws';
import { createClient } from 'graphql-ws';
import { environment } from '../../../environments/environment';
import { Auth } from '../auth/auth';

/**
 * Owns the graphql-ws {@link Client} lifecycle and exposes the Apollo
 * {@link GraphQLWsLink} that the split link in `apollo.config.ts` consumes.
 *
 * Apollo's GraphQLWsLink wraps a graphql-ws client that is created once at
 * startup. Authentication over WebSocket requires the JWT to be passed via
 * `connectionParams`, which is evaluated on every (re-)connection. When the
 * user logs in or out the active connection still carries the old credentials;
 * {@link reconnect} terminates it so that the next subscription triggers a
 * fresh handshake with updated `connectionParams`.
 *
 * `GraphQLWsLink` stores the client as a `public readonly` field. Replacing it
 * after {@link Client.terminate} requires a minimal type escape because Apollo
 * Client does not expose a `setClient` API. The cast is safe: TypeScript's
 * `readonly` is compile-time only and the field is a plain property with no
 * runtime write protection.
 */
@Injectable({
  providedIn: 'root',
})
export class WsClientService {
  private readonly auth = inject(Auth);

  private wsClient: Client = this.buildClient();

  /**
   * The GraphQL WebSocket link passed to the Apollo split link.
   * Consumed by `apolloOptionsFactory()`; components and feature services
   * never touch it directly.
   */
  readonly link = new GraphQLWsLink(this.wsClient);

  /**
   * Terminates the current WebSocket client and replaces it with a fresh one.
   *
   * Called by {@link AuthService} immediately after login and logout so that the
   * next subscription reconnects and re-runs `connectionParams` to pick up the
   * updated (or cleared) JWT.
   */
  reconnect(): void {
    this.wsClient.terminate();
    this.wsClient = this.buildClient();
    // Swap the inner reference on the already-created link.
    // `GraphQLWsLink.client` is `public readonly` on the TypeScript type but has
    // no runtime protection, so the cast is safe and avoids duplicating the link.
    (this.link as unknown as { client: Client }).client = this.wsClient;
  }

  /**
   * Creates a fresh graphql-ws client targeting the configured WebSocket URL.
   *
   * `connectionParams` is a function so it is evaluated on every connection,
   * picking up whichever token is current at that moment without further
   * intervention from the auth layer.
   *
   * @returns A configured graphql-ws {@link Client}.
   */
  private buildClient(): Client {
    return createClient({
      url: environment.wsUrl,
      connectionParams: () => {
        const token = this.auth.getToken();
        // Return {} rather than omitting connectionParams so the server always
        // receives a valid (possibly empty) payload.
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    });
  }
}
