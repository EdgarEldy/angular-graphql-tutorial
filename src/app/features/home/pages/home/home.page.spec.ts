import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // RouterModule.forRoot([]) is required because HomePage imports RouterLink
      imports: [HomePage, RouterModule.forRoot([]), NoopAnimationsModule],
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
});
