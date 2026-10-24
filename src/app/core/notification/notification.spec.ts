import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Notification } from './notification';

describe('Notification', () => {
  let service: Notification;
  let snackBarSpy: jasmine.SpyObj<MatSnackBar>;

  beforeEach(() => {
    snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: snackBarSpy }],
    });
    service = TestBed.inject(Notification);
  });

  it('opens a snackbar with a success panel class', () => {
    service.success('Operation successful');
    expect(snackBarSpy.open).toHaveBeenCalledWith(
      'Operation successful',
      'Close',
      jasmine.objectContaining({ panelClass: ['notification-success'] }),
    );
  });

  it('opens a snackbar with an error panel class and longer duration', () => {
    service.error('Something went wrong');
    const call = snackBarSpy.open.calls.mostRecent().args[2];
    expect(call?.['panelClass']).toEqual(['notification-error']);
    expect(call?.['duration']).toBeGreaterThan(4000);
  });

  it('opens a snackbar for info messages', () => {
    service.info('New order received');
    expect(snackBarSpy.open).toHaveBeenCalledWith('New order received', 'Dismiss', jasmine.anything());
  });
});
