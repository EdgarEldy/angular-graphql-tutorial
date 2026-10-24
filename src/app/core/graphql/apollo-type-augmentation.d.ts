// Apollo Client v4 requires explicit opt-in to use errorPolicy in defaultOptions.
// This module augmentation declares the policies we want to allow globally so TypeScript
// accepts { errorPolicy: 'all' } in ApolloClientOptions.defaultOptions without errors.
// See https://www.apollographql.com/docs/react/data/typescript#declaring-default-options-for-type-safety
declare module '@apollo/client/core/defaultOptions.js' {
  namespace DeclareDefaultOptions {
    interface WatchQuery {
      errorPolicy: 'all';
    }
    interface Query {
      errorPolicy: 'all';
    }
  }
}
