import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ProfilePagePage } from './profile-page.page';
import { AuthService, SessionUser } from '../../../../core/auth/auth.service';

/** Minimal SessionUser shape used across tests. */
const mockUser: SessionUser = {
  __typename: 'User',
  id: '1',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  enabled: true,
  accountLocked: false,
  roles: [{ __typename: 'Role', id: '10', roleName: 'USER', permissions: [] }],
};

describe('ProfilePagePage', () => {
  let component: ProfilePagePage;
  let fixture: ComponentFixture<ProfilePagePage>;

  const userSignal = signal<SessionUser | null>(mockUser);

  const authServiceMock = {
    currentUser: userSignal.asReadonly(),
    updateSessionUser: vi.fn(),
    isAuthenticated: signal(true),
    isAdmin: signal(false),
  };

  const dialogMock = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ProfilePagePage, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: MatDialog, useValue: dialogMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the user name and email from the session signal', () => {
    const el = fixture.nativeElement as HTMLElement;
    // mat-card-title shows "firstName lastName"
    expect(el.textContent).toContain('Alice Smith');
    expect(el.textContent).toContain('alice@example.com');
  });

  it('should display the user role chip', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('USER');
  });

  it('should call dialog.open when openEditDialog is triggered', async () => {
    // Stub the lazy import path by making dialog.open return a closed ref
    const afterClosedSubject = of(undefined);
    dialogMock.open.mockReturnValue({ afterClosed: () => afterClosedSubject });

    // Import the dialog class so the lazy import resolves synchronously in tests
    const { UpdateProfileDialog } = await import(
      '../../dialogs/update-profile/update-profile.dialog'
    );

    component.openEditDialog();
    await fixture.whenStable();

    expect(dialogMock.open).toHaveBeenCalledWith(
      UpdateProfileDialog,
      expect.objectContaining({ data: expect.objectContaining({ email: 'alice@example.com' }) }),
    );
  });

  it('should call authService.updateSessionUser when dialog closes with an updated user', async () => {
    const updatedUser: SessionUser = { ...mockUser, firstName: 'Alicia' };
    const afterClosedSubject = of(updatedUser);
    dialogMock.open.mockReturnValue({ afterClosed: () => afterClosedSubject });

    component.openEditDialog();
    await fixture.whenStable();

    expect(authServiceMock.updateSessionUser).toHaveBeenCalledWith(updatedUser);
  });
});
