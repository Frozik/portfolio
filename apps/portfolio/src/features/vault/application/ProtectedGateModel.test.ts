import { createFakeSessionClock } from './fake-session-clock.test-helper';
import { PROTECTED_WINDOW_MS, ProtectedGateModel } from './ProtectedGateModel';

describe('ProtectedGateModel', () => {
  it('keeps protected cards open for five minutes after the password, then closes them', () => {
    const time = createFakeSessionClock();
    const gate = new ProtectedGateModel(time.clock);

    gate.open();
    time.advance(PROTECTED_WINDOW_MS - 1);
    expect(gate.isOpen).toBe(true);

    time.advance(1);
    expect(gate.isOpen).toBe(false);
  });

  it('counts the window from the latest password entry', () => {
    const time = createFakeSessionClock();
    const gate = new ProtectedGateModel(time.clock);

    gate.open();
    time.advance(PROTECTED_WINDOW_MS / 2);
    gate.open();
    time.advance(PROTECTED_WINDOW_MS / 2);

    expect(gate.isOpen).toBe(true);
  });
});
