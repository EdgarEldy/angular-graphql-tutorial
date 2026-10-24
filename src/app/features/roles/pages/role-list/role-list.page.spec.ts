import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoleListPage } from './role-list.page';

describe('RoleListPage', () => {
  let component: RoleListPage;
  let fixture: ComponentFixture<RoleListPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoleListPage],
    }).compileComponents();

    fixture = TestBed.createComponent(RoleListPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
