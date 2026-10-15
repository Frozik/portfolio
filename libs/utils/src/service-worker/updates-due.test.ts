import { whenUpdatesAreDue } from './updates-due';

const INTERVAL_MS = 60_000;

/** happy-dom's `PageTransitionEvent` drops `persisted`. */
function pageShow(persisted: boolean): Event {
  return Object.assign(new Event('pageshow'), { persisted });
}

describe('when updates are due', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('checks on the timer while online, and stops when asked', () => {
    vi.useFakeTimers();
    const check = vi.fn();
    const stop = whenUpdatesAreDue(check, INTERVAL_MS);

    vi.advanceTimersByTime(INTERVAL_MS * 2);
    stop();
    vi.advanceTimersByTime(INTERVAL_MS);

    expect(check).toHaveBeenCalledTimes(2);
  });

  it('checks when the page comes back into view or out of the back/forward cache', () => {
    const check = vi.fn();
    const stop = whenUpdatesAreDue(check, INTERVAL_MS);

    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(pageShow(true));
    window.dispatchEvent(pageShow(false));
    stop();

    expect(check).toHaveBeenCalledTimes(2);
  });

  it('does not ask the network while offline', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false });
    const check = vi.fn();
    const stop = whenUpdatesAreDue(check, INTERVAL_MS);

    document.dispatchEvent(new Event('visibilitychange'));
    stop();

    expect(check).not.toHaveBeenCalled();
  });
});
