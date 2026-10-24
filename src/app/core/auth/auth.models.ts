export const AUTH_TOKEN_KEY = 'auth_token';

export interface AuthPayload {
  token: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    enabled: boolean;
    accountLocked: boolean;
    roles: { id: string; roleName: string }[];
  };
}
