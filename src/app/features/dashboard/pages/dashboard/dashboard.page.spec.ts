import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  let component: DashboardPage;
  let fixture: ComponentFixture<DashboardPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      // RouterLink in the template requires the router to be available
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPage);
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

  it('should render four quick-access tiles', () => {
    fixture.detectChanges();
    const tiles = fixture.nativeElement.querySelectorAll('.tile');
    expect(tiles.length).toBe(4);
  });
});
