export type ErrorKind =
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'UNAUTHENTICATED'
  | 'INTERNAL_ERROR'
  | 'NETWORK';

export interface AppError {
  kind: ErrorKind;
  message: string;
  fieldErrors?: Record<string, string[]>;
}
