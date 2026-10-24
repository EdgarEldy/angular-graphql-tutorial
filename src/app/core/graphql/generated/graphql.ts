export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  token?: Maybe<Scalars['String']['output']>;
  user: User;
};

export type Category = {
  __typename?: 'Category';
  categoryName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
};

export type CategoryInput = {
  categoryName: Scalars['String']['input'];
};

export type CategoryPage = {
  __typename?: 'CategoryPage';
  content: Array<Category>;
  page: Scalars['Int']['output'];
  size: Scalars['Int']['output'];
  totalElements: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export type CreateUserInput = {
  email: Scalars['String']['input'];
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type Customer = {
  __typename?: 'Customer';
  address: Scalars['String']['output'];
  email: Scalars['String']['output'];
  firstName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastName: Scalars['String']['output'];
  telephone: Scalars['String']['output'];
};

export type CustomerInput = {
  address: Scalars['String']['input'];
  email: Scalars['String']['input'];
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
  telephone: Scalars['String']['input'];
};

export type CustomerPage = {
  __typename?: 'CustomerPage';
  content: Array<Customer>;
  page: Scalars['Int']['output'];
  size: Scalars['Int']['output'];
  totalElements: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export type LoginInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  activateAccount: Scalars['Boolean']['output'];
  assignPermissionToRole: Role;
  assignRoleToUser: User;
  createCategory: Category;
  createCustomer: Customer;
  createOrder: Order;
  createPermission: Permission;
  createProduct: Product;
  createRole: Role;
  createUser: User;
  deleteCategory: Scalars['Boolean']['output'];
  deleteCustomer: Scalars['Boolean']['output'];
  deletePermission: Scalars['Boolean']['output'];
  deleteProduct: Scalars['Boolean']['output'];
  deleteRole: Scalars['Boolean']['output'];
  deleteUser: Scalars['Boolean']['output'];
  lockUser: User;
  login: AuthPayload;
  logout: Scalars['Boolean']['output'];
  register: AuthPayload;
  removePermissionFromRole: Role;
  removeRoleFromUser: User;
  requestPasswordReset: Scalars['Boolean']['output'];
  resetPassword: Scalars['Boolean']['output'];
  unlockUser: User;
  updateCategory: Category;
  updateCustomer: Customer;
  updateProduct: Product;
  updateRole: Role;
  updateUser: User;
};


export type MutationActivateAccountArgs = {
  token: Scalars['String']['input'];
};


export type MutationAssignPermissionToRoleArgs = {
  permissionId: Scalars['ID']['input'];
  roleId: Scalars['ID']['input'];
};


export type MutationAssignRoleToUserArgs = {
  roleId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationCreateCategoryArgs = {
  input: CategoryInput;
};


export type MutationCreateCustomerArgs = {
  input: CustomerInput;
};


export type MutationCreateOrderArgs = {
  input: OrderInput;
};


export type MutationCreatePermissionArgs = {
  input: PermissionInput;
};


export type MutationCreateProductArgs = {
  input: ProductInput;
};


export type MutationCreateRoleArgs = {
  input: RoleInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationDeleteCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCustomerArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePermissionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteProductArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteRoleArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationLockUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationLoginArgs = {
  input: LoginInput;
};


export type MutationRegisterArgs = {
  input: RegisterInput;
};


export type MutationRemovePermissionFromRoleArgs = {
  permissionId: Scalars['ID']['input'];
  roleId: Scalars['ID']['input'];
};


export type MutationRemoveRoleFromUserArgs = {
  roleId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationRequestPasswordResetArgs = {
  email: Scalars['String']['input'];
};


export type MutationResetPasswordArgs = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationUnlockUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateCategoryArgs = {
  id: Scalars['ID']['input'];
  input: CategoryInput;
};


export type MutationUpdateCustomerArgs = {
  id: Scalars['ID']['input'];
  input: CustomerInput;
};


export type MutationUpdateProductArgs = {
  id: Scalars['ID']['input'];
  input: ProductInput;
};


export type MutationUpdateRoleArgs = {
  id: Scalars['ID']['input'];
  input: RoleInput;
};


export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};

export type Order = {
  __typename?: 'Order';
  customer: Customer;
  id: Scalars['ID']['output'];
  product: Product;
  quantity: Scalars['Int']['output'];
  total: Scalars['Float']['output'];
};

export type OrderInput = {
  customerId: Scalars['ID']['input'];
  productId: Scalars['ID']['input'];
  quantity: Scalars['Int']['input'];
};

export type OrderPage = {
  __typename?: 'OrderPage';
  content: Array<Order>;
  page: Scalars['Int']['output'];
  size: Scalars['Int']['output'];
  totalElements: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export type Permission = {
  __typename?: 'Permission';
  action: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  resource: Scalars['String']['output'];
};

export type PermissionInput = {
  action: Scalars['String']['input'];
  resource: Scalars['String']['input'];
};

export type Product = {
  __typename?: 'Product';
  category: Category;
  id: Scalars['ID']['output'];
  productName: Scalars['String']['output'];
  unitPrice: Scalars['Float']['output'];
};

export type ProductInput = {
  categoryId: Scalars['ID']['input'];
  productName: Scalars['String']['input'];
  unitPrice: Scalars['Float']['input'];
};

export type ProductPage = {
  __typename?: 'ProductPage';
  content: Array<Product>;
  page: Scalars['Int']['output'];
  size: Scalars['Int']['output'];
  totalElements: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  categories: CategoryPage;
  category?: Maybe<Category>;
  customer?: Maybe<Customer>;
  customers: CustomerPage;
  me?: Maybe<User>;
  order?: Maybe<Order>;
  orders: OrderPage;
  permissions: Array<Permission>;
  product?: Maybe<Product>;
  products: ProductPage;
  role?: Maybe<Role>;
  roles: Array<Role>;
  user?: Maybe<User>;
  users: UserPage;
};


export type QueryCategoriesArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  size?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCustomerArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCustomersArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  size?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryOrderArgs = {
  id: Scalars['ID']['input'];
};


export type QueryOrdersArgs = {
  customerId?: InputMaybe<Scalars['ID']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  size?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryProductArgs = {
  id: Scalars['ID']['input'];
};


export type QueryProductsArgs = {
  categoryId?: InputMaybe<Scalars['ID']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  size?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryRoleArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUsersArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  size?: InputMaybe<Scalars['Int']['input']>;
};

export type RegisterInput = {
  email: Scalars['String']['input'];
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type Role = {
  __typename?: 'Role';
  id: Scalars['ID']['output'];
  permissions: Array<Permission>;
  roleName: Scalars['String']['output'];
};

export type RoleInput = {
  roleName: Scalars['String']['input'];
};

export type Subscription = {
  __typename?: 'Subscription';
  orderCreated: Order;
};

export type UpdateUserInput = {
  email: Scalars['String']['input'];
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
};

export type User = {
  __typename?: 'User';
  accountLocked: Scalars['Boolean']['output'];
  email: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  firstName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastName: Scalars['String']['output'];
  roles: Array<Role>;
};

export type UserPage = {
  __typename?: 'UserPage';
  content: Array<User>;
  page: Scalars['Int']['output'];
  size: Scalars['Int']['output'];
  totalElements: Scalars['Int']['output'];
  totalPages: Scalars['Int']['output'];
};
