import { TestBed } from '@angular/core/testing';
import { ApolloTestingModule, ApolloTestingController } from 'apollo-angular/testing';
import { AuthService } from './auth.service';
import { Auth } from './auth';
import { WsClientService } from '../graphql/ws-client';

/**
 * A minimal user shape covering all fields selected by both LoginMutation and MeQuery.
 * Permissions are included because SessionUser is derived from MeQuery['me'] which
 * selects the full role-permission tree.
 */
const mockUser = {
  __typename: 'User' as const,
  id: '1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  enabled: true,
  accountLocked: false,
  roles: [
    {
      __typename: 'Role' as const,
      id: '10',
      roleName: 'ADMIN',
      permissions: [
        {
          __typename: 'Permission' as const,
          id: '100',
          resource: 'USER',
          action: 'READ',
        },
      ],
    },
  ],
};

describe('AuthService', () => {
  let service: AuthService;
  let auth: Auth;
  let controller: ApolloTestingController;

  // WsClientService creates a real graphql-ws client on construction; mock it
  // to avoid WebSocket connections in unit tests.
  const wsClientServiceMock = {
    reconnect: vi.fn(),
    link: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [ApolloTestingModule],
      providers: [
        AuthService,
        // WsClientService is replaced so reconnect() can be tracked via vi.fn()
        { provide: WsClientService, useValue: wsClientServiceMock },
      ],
    });

    service = TestBed.inject(AuthService);
    auth = TestBed.inject(Auth);
    controller = TestBed.inject(ApolloTestingController);
  });

  afterEach(() => {
    // verify() throws if any Apollo operation was started but not flushed
    controller.verify();
    localStorage.clear();
  });

  it('login() sets session signal and calls reconnect on success', async () => {
    // Apollo Client v4 processes link responses via Promise microtasks.
    // We await a Promise that resolves when the observable next() fires,
    // ensuring tap() side-effects have run before assertions execute.
    const loginDone = new Promise<void>((resolve) => {
      service.login({ email: 'john@example.com', password: 'secret' })
        .subscribe({ next: () => resolve() });
    });

    const op = controller.expectOne('Login');
    op.flush({
      data: {
        login: {
          __typename: 'AuthPayload',
          token: 'jwt-token',
          user: mockUser,
        },
      },
    });

    await loginDone;

    expect(service.currentUser()?.id).toBe('1');
    expect(service.isAuthenticated()).toBe(true);
    expect(wsClientServiceMock.reconnect).toHaveBeenCalledOnce();
  });

  it('login() does not set session when login returns no token', async () => {
    // With errorPolicy:'all', a response without a token still reaches the tap
    // operator. The guard `if (payload?.token)` prevents the session from being set.
    const loginDone = new Promise<void>((resolve) => {
      service.login({ email: 'wrong@example.com', password: 'bad' })
        .subscribe({ next: () => resolve(), error: () => resolve() });
    });

    const op = controller.expectOne('Login');
    // Flush with errors -- data is absent so payload?.token is falsy
    op.flush({ errors: [{ message: 'Invalid credentials' }] });

    await loginDone;

    expect(service.currentUser()).toBeNull();
    expect(wsClientServiceMock.reconnect).not.toHaveBeenCalled();
  });

  it('logout() calls clearToken and reconnect regardless of server response', async () => {
    // Pre-populate a token so clearToken has visible effect
    auth.setToken('existing-token');

    const logoutDone = new Promise<void>((resolve) => {
      service.logout().subscribe({ next: () => resolve(), error: () => resolve() });
    });

    const op = controller.expectOne('Logout');
    op.flush({ data: { logout: true } });

    await logoutDone;

    // clearLocalSession() clears the Auth token and calls WS reconnect
    expect(auth.isAuthenticated()).toBe(false);
    expect(wsClientServiceMock.reconnect).toHaveBeenCalledOnce();
  });

  it('restoreSession() returns early when no token is stored', () => {
    // Auth.isAuthenticated() is false (empty localStorage) -- the service
    // returns of(void 0) without making any Apollo request.
    let completed = false;

    service.restoreSession().subscribe({ complete: () => { completed = true; } });

    // Observable completes synchronously (of() is synchronous)
    expect(completed).toBe(true);
    // afterEach controller.verify() will confirm no operation was started
  });

  it('restoreSession() sets session from me query result', async () => {
    // Place a token in localStorage so Auth.isAuthenticated() returns true
    auth.setToken('stored-token');

    const restoreDone = new Promise<void>((resolve) => {
      service.restoreSession()
        .subscribe({ complete: () => resolve(), error: () => resolve() });
    });

    const op = controller.expectOne('Me');
    op.flush({ data: { me: mockUser } });

    await restoreDone;

    expect(service.currentUser()?.id).toBe('1');
    expect(service.isAdmin()).toBe(true); // mockUser has ADMIN role
  });
});
