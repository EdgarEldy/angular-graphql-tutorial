import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Subject, NEVER } from 'rxjs';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UserListPage } from './user-list.page';
import { Users } from '../../data/users';
import { AuthService } from '../../../../core/auth/auth.service';
import { Notification } from '../../../../core/notification/notification';

/** Minimal user shape needed to populate the table template. */
const mockUser = {
  __typename: 'User' as const,
  id: '1',
  firstName: 'Alice',
  lastName: 'Admin',
  email: 'alice@example.com',
  enabled: true,
  accountLocked: false,
  roles: [{ __typename: 'Role' as const, id: '10', roleName: 'ADMIN' }],
};

describe('UserListPage', () => {
  let component: UserListPage;
  let fixture: ComponentFixture<UserListPage>;

  // Subject typed broadly -- the component only reads .loading, .error, and .data
  const valueChangesSubject = new Subject<object>();

  const usersMock = {
    watchUsers: vi.fn().mockReturnValue({
      valueChanges: valueChangesSubject.asObservable(),
      refetch: vi.fn().mockResolvedValue({}),
    }),
    lockUser: vi.fn(),
    unlockUser: vi.fn(),
    deleteUser: vi.fn(),
  };

  // currentUser() is used by the isSelf() guard on row action buttons
  const authServiceMock = {
    currentUser: signal<{ id: string } | null>(null),
  };

  const dialogMock = {
    open: vi.fn().mockReturnValue({ afterClosed: () => NEVER }),
  };

  const notificationMock = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [UserListPage, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: Users, useValue: usersMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: Notification, useValue: notificationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserListPage);
    component = fixture.componentInstance;
    // Do NOT call detectChanges here -- individual tests need control over when
    // ngOnInit runs and what state is active at assertion time.
  });

  it('shows loading state initially', () => {
    // First detectChanges triggers ngOnInit which sets up the subscription but
    // valueChangesSubject has not emitted yet, so loading() stays true.
    fixture.detectChanges();

    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-loading')).toBeTruthy();
  });

  it('shows user rows when data loads', () => {
    fixture.detectChanges(); // ngOnInit subscribes

    valueChangesSubject.next({
      loading: false,
      data: {
        users: {
          content: [mockUser],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 10,
        },
      },
    });

    // Signal changes require an explicit detectChanges to flush the view update
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.users().length).toBe(1);
    expect(component.users()[0].id).toBe('1');
    // Loading spinner must be gone
    expect(fixture.nativeElement.querySelector('app-loading')).toBeFalsy();
  });

  it('shows error banner when the query fails', () => {
    fixture.detectChanges();

    valueChangesSubject.next({
      loading: false,
      error: new Error('Network failure'),
    });

    fixture.detectChanges();

    expect(component.error()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-error-banner')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-loading')).toBeFalsy();
  });
});
