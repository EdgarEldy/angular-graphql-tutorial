import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import type { QueryRef } from 'apollo-angular';
import {
  AssignPermissionToRoleDocument,
  type AssignPermissionToRoleMutation,
  type AssignPermissionToRoleMutationVariables,
  CreatePermissionDocument,
  type CreatePermissionMutation,
  type CreatePermissionMutationVariables,
  CreateRoleDocument,
  type CreateRoleMutation,
  type CreateRoleMutationVariables,
  DeletePermissionDocument,
  type DeletePermissionMutation,
  type DeletePermissionMutationVariables,
  DeleteRoleDocument,
  type DeleteRoleMutation,
  type DeleteRoleMutationVariables,
  GetPermissionsDocument,
  type GetPermissionsQuery,
  GetRolesDocument,
  type GetRolesQuery,
  RemovePermissionFromRoleDocument,
  type RemovePermissionFromRoleMutation,
  type RemovePermissionFromRoleMutationVariables,
  UpdateRoleDocument,
  type UpdateRoleMutation,
  type UpdateRoleMutationVariables,
} from '../../../core/graphql/generated/graphql';

/**
 * Feature service for the Roles and Permissions administration section.
 *
 * Wraps Apollo for all role and permission operations. No UI logic lives here.
 * Components and dialogs inject this service and call typed methods.
 *
 * The service returns QueryRefs for list queries so callers can call refetch()
 * after mutations that affect pagination, and plain Observables for mutations.
 */
@Injectable({
  providedIn: 'root',
})
export class Roles {
  // inject() replaces constructor injection in Angular 21
  private readonly apollo = inject(Apollo);

  /**
   * Creates a watchQuery for the full role list (not paginated by the backend).
   *
   * @returns Apollo QueryRef for the roles query.
   */
  watchRoles(): QueryRef<GetRolesQuery> {
    return this.apollo.watchQuery<GetRolesQuery>({
      query: GetRolesDocument,
      errorPolicy: 'all',
    });
  }

  /**
   * Creates a watchQuery for the full permissions list.
   *
   * @returns Apollo QueryRef for the permissions query.
   */
  watchPermissions(): QueryRef<GetPermissionsQuery> {
    return this.apollo.watchQuery<GetPermissionsQuery>({
      query: GetPermissionsDocument,
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `createRole` mutation.
   *
   * @param input - Role form values.
   * @returns Observable of the raw mutation result.
   */
  createRole(
    input: CreateRoleMutationVariables['input'],
  ): Observable<Apollo.MutateResult<CreateRoleMutation>> {
    return this.apollo.mutate<CreateRoleMutation, CreateRoleMutationVariables>({
      mutation: CreateRoleDocument,
      variables: { input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `updateRole` mutation.
   *
   * The returned Role is normalised into the cache so all queries referencing
   * this role update automatically.
   *
   * @param id - ID of the role to update.
   * @param input - Updated field values.
   * @returns Observable of the raw mutation result.
   */
  updateRole(
    id: UpdateRoleMutationVariables['id'],
    input: UpdateRoleMutationVariables['input'],
  ): Observable<Apollo.MutateResult<UpdateRoleMutation>> {
    return this.apollo.mutate<UpdateRoleMutation, UpdateRoleMutationVariables>({
      mutation: UpdateRoleDocument,
      variables: { id, input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `deleteRole` mutation.
   *
   * @param id - ID of the role to delete.
   * @returns Observable of the raw mutation result.
   */
  deleteRole(
    id: DeleteRoleMutationVariables['id'],
  ): Observable<Apollo.MutateResult<DeleteRoleMutation>> {
    return this.apollo.mutate<DeleteRoleMutation, DeleteRoleMutationVariables>({
      mutation: DeleteRoleDocument,
      variables: { id },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `createPermission` mutation.
   *
   * @param input - Permission form values (resource, action).
   * @returns Observable of the raw mutation result.
   */
  createPermission(
    input: CreatePermissionMutationVariables['input'],
  ): Observable<Apollo.MutateResult<CreatePermissionMutation>> {
    return this.apollo.mutate<CreatePermissionMutation, CreatePermissionMutationVariables>({
      mutation: CreatePermissionDocument,
      variables: { input },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `deletePermission` mutation.
   *
   * @param id - ID of the permission to delete.
   * @returns Observable of the raw mutation result.
   */
  deletePermission(
    id: DeletePermissionMutationVariables['id'],
  ): Observable<Apollo.MutateResult<DeletePermissionMutation>> {
    return this.apollo.mutate<DeletePermissionMutation, DeletePermissionMutationVariables>({
      mutation: DeletePermissionDocument,
      variables: { id },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `assignPermissionToRole` mutation.
   *
   * Returns the updated Role so Apollo normalises the new permissions into the
   * cache and the role-list table and manage-permissions dialog update automatically.
   *
   * @param roleId - ID of the role.
   * @param permissionId - ID of the permission to assign.
   * @returns Observable of the raw mutation result.
   */
  assignPermissionToRole(
    roleId: AssignPermissionToRoleMutationVariables['roleId'],
    permissionId: AssignPermissionToRoleMutationVariables['permissionId'],
  ): Observable<Apollo.MutateResult<AssignPermissionToRoleMutation>> {
    return this.apollo.mutate<
      AssignPermissionToRoleMutation,
      AssignPermissionToRoleMutationVariables
    >({
      mutation: AssignPermissionToRoleDocument,
      variables: { roleId, permissionId },
      errorPolicy: 'all',
    });
  }

  /**
   * Calls the `removePermissionFromRole` mutation.
   *
   * Returns the updated Role so the cache is updated automatically.
   *
   * @param roleId - ID of the role.
   * @param permissionId - ID of the permission to remove.
   * @returns Observable of the raw mutation result.
   */
  removePermissionFromRole(
    roleId: RemovePermissionFromRoleMutationVariables['roleId'],
    permissionId: RemovePermissionFromRoleMutationVariables['permissionId'],
  ): Observable<Apollo.MutateResult<RemovePermissionFromRoleMutation>> {
    return this.apollo.mutate<
      RemovePermissionFromRoleMutation,
      RemovePermissionFromRoleMutationVariables
    >({
      mutation: RemovePermissionFromRoleDocument,
      variables: { roleId, permissionId },
      errorPolicy: 'all',
    });
  }
}
