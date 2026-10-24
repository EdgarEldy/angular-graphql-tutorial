import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PermissionListPage } from './permission-list.page';

describe('PermissionListPage', () => {
  let component: PermissionListPage;
  let fixture: ComponentFixture<PermissionListPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionListPage],
    }).compileComponents();

    fixture = TestBed.createComponent(PermissionListPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
