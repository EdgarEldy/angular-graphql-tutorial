import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { FetchResult } from '@apollo/client/core';
import { Observable } from 'rxjs';
import {
  AssignRoleToUserDocument,
  type AssignRoleToUserMutation,
  type AssignRoleToUserMutationVariables,
  CreateUserDocument,
  type CreateUserMutation,
  type CreateUserMutationVariables,
  DeleteUserDocument,
  type DeleteUserMutation,
  type DeleteUserMutationVariables,
  GetUsersDocument,
  type GetUsersQuery,
  type GetUsersQueryVariables,
  LockUserDocument,
  type LockUserMutation,
  type LockUserMutationVariables,
  RemoveRoleFromUserDocument,
  type RemoveRoleFromUserMutation,
  type RemoveRoleFromUserMutationVariables,
  UnlockUserDocument,
  type UnlockUserMutation,
  type UnlockUserMutationVariables,
  UpdateUserDocument,
  type UpdateUserMutation,
  type UpdateUserMutationVariables,
} from '../../../core/graphql/generated/graphql';
import type { QueryRef } from 'apollo-angular';

/**
 * Feature service for the Users administration section.
 *
 * Wraps Apollo queries and mutations for user management. No UI logic lives
 * here (no snackbars, no navigation, no dialogs). All Apollo calls use
 * errorPolicy: 'all' so callers can inspect both data and errors, enabling
 * inline error display in dialogs without closing them on BAD_REQUEST.
 *
 * Role assignment mutations return the full updated User so the Apollo
 * InMemoryCache normalises the response and the user-list and manage-roles
 * dialog both reflect the change without a manual refetch.
 */
@Injectable({
  providedIn: 'root',
})
export class Users {
  // inject() replaces constructor injection in Angular 21
  private readonly apollo = inject(Apollo);

  /**
   * Creates a watchQuery for the paginated user list.
   *
   * Returns a QueryRef rather than an Observable so the caller (UserListPage)
   * can call .refetch() after delete operations. watchQuery keeps the subscription
   * alive and reacts to InMemoryCache updates triggered by mutations.
   *
   * @param page - 0-based page index.
   * @param size - Number of users per page.
   * @returns Apollo QueryRef for the paginated user list.
   */
  watchUsers(page: number, size: number): QueryRef<GetUsersQuery, GetUsersQueryVariables> {
    return this.apollo.watchQuery<GetUsersQuery, GetUsersQueryVariables>({
      query: GetUsersDocument,
      variables: { page, size },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `createUser` mutation.
   *
   * The returned User is normalised into the InMemoryCache so the list query
   * is not automatically updated (Apollo does not know where to insert the new
   * user in the paginated result). The caller must call refetch() after success.
   *
   * @param input - Create user form values.
   * @returns Observable of the raw mutation result.
   */
  createUser(
    input: CreateUserMutationVariables['input'],
  ): Observable<FetchResult<CreateUserMutation>> {
    return this.apollo.mutate<CreateUserMutation, CreateUserMutationVariables>({
      mutation: CreateUserDocument,
      variables: { input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `updateUser` mutation.
   *
   * The returned User is written into the cache by its __typename + id key,
   * updating every query that references this user without a manual refetch.
   *
   * @param id - ID of the user to update.
   * @param input - Updated field values.
   * @returns Observable of the raw mutation result.
   */
  updateUser(
    id: UpdateUserMutationVariables['id'],
    input: UpdateUserMutationVariables['input'],
  ): Observable<FetchResult<UpdateUserMutation>> {
    return this.apollo.mutate<UpdateUserMutation, UpdateUserMutationVariables>({
      mutation: UpdateUserDocument,
      variables: { id, input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `lockUser` mutation to set accountLocked = true.
   *
   * Returns the updated User so the cache is updated automatically. The UI
   * must prevent calling this on the current user's own account.
   *
   * @param id - ID of the user to lock.
   * @returns Observable of the raw mutation result.
   */
  lockUser(id: LockUserMutationVariables['id']): Observable<FetchResult<LockUserMutation>> {
    return this.apollo.mutate<LockUserMutation, LockUserMutationVariables>({
      mutation: LockUserDocument,
      variables: { id },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `unlockUser` mutation to set accountLocked = false.
   *
   * @param id - ID of the user to unlock.
   * @returns Observable of the raw mutation result.
   */
  unlockUser(
    id: UnlockUserMutationVariables['id'],
  ): Observable<FetchResult<UnlockUserMutation>> {
    return this.apollo.mutate<UnlockUserMutation, UnlockUserMutationVariables>({
      mutation: UnlockUserDocument,
      variables: { id },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `deleteUser` mutation.
   *
   * The return type is Boolean, so the cache is not automatically updated.
   * The caller must call refetch() or manually evict the user from the cache.
   * The UI must prevent calling this on the current user's own account.
   *
   * @param id - ID of the user to delete.
   * @returns Observable of the raw mutation result.
   */
  deleteUser(
    id: DeleteUserMutationVariables['id'],
  ): Observable<FetchResult<DeleteUserMutation>> {
    return this.apollo.mutate<DeleteUserMutation, DeleteUserMutationVariables>({
      mutation: DeleteUserDocument,
      variables: { id },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `assignRoleToUser` mutation.
   *
   * Returns the updated User (including all roles). Apollo writes this into
   * the cache, so the user-list chip list and manage-roles dialog both update
   * without an explicit refetch.
   *
   * @param userId - ID of the user.
   * @param roleId - ID of the role to assign.
   * @returns Observable of the raw mutation result.
   */
  assignRoleToUser(
    userId: AssignRoleToUserMutationVariables['userId'],
    roleId: AssignRoleToUserMutationVariables['roleId'],
  ): Observable<FetchResult<AssignRoleToUserMutation>> {
    return this.apollo.mutate<AssignRoleToUserMutation, AssignRoleToUserMutationVariables>({
      mutation: AssignRoleToUserDocument,
      variables: { userId, roleId },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `removeRoleFromUser` mutation.
   *
   * Returns the updated User so the cache is updated automatically.
   *
   * @param userId - ID of the user.
   * @param roleId - ID of the role to remove.
   * @returns Observable of the raw mutation result.
   */
  removeRoleFromUser(
    userId: RemoveRoleFromUserMutationVariables['userId'],
    roleId: RemoveRoleFromUserMutationVariables['roleId'],
  ): Observable<FetchResult<RemoveRoleFromUserMutation>> {
    return this.apollo.mutate<RemoveRoleFromUserMutation, RemoveRoleFromUserMutationVariables>({
      mutation: RemoveRoleFromUserDocument,
      variables: { userId, roleId },
      errorPolicy: 'all',
    });
  }
}
