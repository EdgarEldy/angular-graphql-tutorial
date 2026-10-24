import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { Notification } from './notification';

describe('Notification', () => {
  let service: Notification;
  // Vitest mock object in place of a real MatSnackBar instance.
  const snackBarMock = { open: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: snackBarMock }],
    });
    service = TestBed.inject(Notification);
  });

  it('opens a snackbar with a success panel class', () => {
    service.success('Operation successful');
    expect(snackBarMock.open).toHaveBeenCalledWith(
      'Operation successful',
      'Close',
      expect.objectContaining({ panelClass: ['notification-success'] }),
    );
  });

  it('opens a snackbar with an error panel class and longer duration', () => {
    service.error('Something went wrong');
    const callArgs = snackBarMock.open.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(callArgs[2]?.['panelClass']).toEqual(['notification-error']);
    expect(callArgs[2]?.['duration']).toBeGreaterThan(4000);
  });

  it('opens a snackbar for info messages', () => {
    service.info('New order received');
    expect(snackBarMock.open).toHaveBeenCalledWith('New order received', 'Dismiss', expect.anything());
  });
});
