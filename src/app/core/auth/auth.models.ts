export const AUTH_TOKEN_KEY = 'auth_token';
// Stored separately so the interceptor can exchange it for a new access token
// when the access token expires, without touching the access token key.
export const AUTH_REFRESH_TOKEN_KEY = 'auth_refresh_token';
