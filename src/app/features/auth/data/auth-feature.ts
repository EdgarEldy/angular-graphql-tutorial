import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import {
  ActivateAccountDocument,
  type ActivateAccountMutation,
  type ActivateAccountMutationVariables,
  RegisterDocument,
  type RegisterMutation,
  type RegisterMutationVariables,
  RequestPasswordResetDocument,
  type RequestPasswordResetMutation,
  type RequestPasswordResetMutationVariables,
  ResetPasswordDocument,
  type ResetPasswordMutation,
  type ResetPasswordMutationVariables,
} from '../../../core/graphql/generated/graphql';

/**
 * Feature service for authentication operations that do not require a
 * live session: registration, account activation, and password reset.
 *
 * Login and logout live in AuthService (core/auth/auth.service.ts) because
 * they must update the session signal and coordinate the WS client.
 * Keeping the public-flow mutations here avoids bloating AuthService and
 * separates the session-management concern from the onboarding flow.
 *
 * Rule: components never inject Apollo directly -- they call this service.
 * Rule: this service never contains UI logic (no snackbars, no navigation).
 */
@Injectable({
  providedIn: 'root',
})
export class AuthFeature {
  // inject() replaces constructor injection in Angular 21
  private readonly apollo = inject(Apollo);

  /**
   * Calls the `register` mutation to create a new, disabled user account.
   *
   * The account is disabled until `activateAccount` succeeds with the token
   * sent to the user's email address. The caller (RegisterPage) must inform
   * the user of this requirement rather than auto-logging them in.
   *
   * errorPolicy: 'all' lets the caller inspect both data and errors so it
   * can show a BAD_REQUEST message (e.g. email already taken) inline.
   *
   * @param input - Registration form values: firstName, lastName, email, password.
   * @returns Observable of the raw mutation result; errors in result.error (Apollo v4).
   */
  register(
    input: RegisterMutationVariables['input'],
  ): Observable<Apollo.MutateResult<RegisterMutation>> {
    return this.apollo.mutate<RegisterMutation, RegisterMutationVariables>({
      mutation: RegisterDocument,
      variables: { input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `activateAccount` mutation with the token from the query string.
   *
   * The token is emailed to the user after registration and expires on the
   * backend. A BAD_REQUEST error means the token is invalid or expired.
   *
   * @param token - The activation token from the URL query parameter.
   * @returns Observable of the raw mutation result.
   */
  activateAccount(
    token: ActivateAccountMutationVariables['token'],
  ): Observable<Apollo.MutateResult<ActivateAccountMutation>> {
    return this.apollo.mutate<ActivateAccountMutation, ActivateAccountMutationVariables>({
      mutation: ActivateAccountDocument,
      variables: { token },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `requestPasswordReset` mutation with the user's email address.
   *
   * The backend always returns true regardless of whether the email exists.
   * The UI must show the same neutral confirmation message in both cases so
   * that it does not leak which email addresses are registered.
   *
   * @param email - The email address entered in the forgot-password form.
   * @returns Observable of the raw mutation result.
   */
  requestPasswordReset(
    email: RequestPasswordResetMutationVariables['email'],
  ): Observable<Apollo.MutateResult<RequestPasswordResetMutation>> {
    return this.apollo.mutate<
      RequestPasswordResetMutation,
      RequestPasswordResetMutationVariables
    >({
      mutation: RequestPasswordResetDocument,
      variables: { email },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `resetPassword` mutation with the token and new password.
   *
   * The token comes from the URL query parameter. A BAD_REQUEST error means
   * the token is invalid or expired; the UI shows that message inline and
   * keeps the form open.
   *
   * @param token - The reset token from the URL query parameter.
   * @param newPassword - The new password entered by the user.
   * @returns Observable of the raw mutation result.
   */
  resetPassword(
    token: ResetPasswordMutationVariables['token'],
    newPassword: ResetPasswordMutationVariables['newPassword'],
  ): Observable<Apollo.MutateResult<ResetPasswordMutation>> {
    return this.apollo.mutate<ResetPasswordMutation, ResetPasswordMutationVariables>({
      mutation: ResetPasswordDocument,
      variables: { token, newPassword },
      errorPolicy: 'all',
    });
  }
}
