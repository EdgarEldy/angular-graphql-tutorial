import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ApolloTestingModule } from 'apollo-angular/testing';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // ApolloTestingModule satisfies Apollo injection in AuthService.
      // RouterModule.forRoot([]) satisfies RouterLink in the template.
      imports: [HomePage, ApolloTestingModule, RouterModule.forRoot([]), NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render four KPI cards', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.kpi-card');
    expect(cards.length).toBe(4);
  });

  it('should render six quick-access tiles', () => {
    fixture.detectChanges();
    const tiles = fixture.nativeElement.querySelectorAll('.tile');
    expect(tiles.length).toBe(6);
  });

  it('should show -- placeholder when no user is signed in', () => {
    fixture.detectChanges();
    // authService.currentUser() is null in tests (no login call) so displayName() returns 'there'
    const title: HTMLElement = fixture.nativeElement.querySelector('.dash-title');
    expect(title.textContent).toContain('there');
  });
});
