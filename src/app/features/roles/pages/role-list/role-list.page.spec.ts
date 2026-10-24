import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { RoleListPage } from './role-list.page';
import { Roles } from '../../data/roles';

/**
 * Smoke test for RoleListPage.
 *
 * The page subscribes to watchRoles().valueChanges in ngOnInit. The Roles
 * service is replaced with a mock that returns a QueryRef stub whose
 * valueChanges never emits, keeping the page in its loading state. This
 * avoids the need for a real Apollo client in the unit test.
 */
describe('RoleListPage', () => {
  let component: RoleListPage;
  let fixture: ComponentFixture<RoleListPage>;

  const rolesMock = {
    watchRoles: vi.fn().mockReturnValue({
      valueChanges: NEVER,
      refetch: vi.fn(),
    }),
    deleteRole: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [RoleListPage, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: Roles, useValue: rolesMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoleListPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts in loading state', () => {
    fixture.detectChanges();
    expect(component.loading()).toBe(true);
  });
});
