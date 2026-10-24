import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { PermissionListPage } from './permission-list.page';
import { Roles } from '../../data/roles';

/**
 * Smoke test for PermissionListPage.
 *
 * The page subscribes to watchPermissions().valueChanges in ngOnInit. The
 * Roles service is replaced with a mock whose valueChanges never emits,
 * keeping the page in loading state. No real Apollo client is needed.
 */
describe('PermissionListPage', () => {
  let component: PermissionListPage;
  let fixture: ComponentFixture<PermissionListPage>;

  const rolesMock = {
    watchPermissions: vi.fn().mockReturnValue({
      valueChanges: NEVER,
      refetch: vi.fn(),
    }),
    deletePermission: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [PermissionListPage, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: Roles, useValue: rolesMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PermissionListPage);
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
