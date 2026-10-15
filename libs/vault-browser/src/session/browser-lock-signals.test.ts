import { BROWSER_LOCK_SIGNALS } from './browser-lock-signals';

describe('the page as a source of lock signals', () => {
  it('reports activity, unloading, a return from the back/forward cache and the network', () => {
    const heard: string[] = [];
    const stops = [
      BROWSER_LOCK_SIGNALS.onActivity(() => heard.push('activity')),
      BROWSER_LOCK_SIGNALS.onUnloading(() => heard.push('unloading')),
      BROWSER_LOCK_SIGNALS.onResumedFromSuspend(() => heard.push('resumed')),
      BROWSER_LOCK_SIGNALS.onOnline(() => heard.push('online')),
    ];

    window.dispatchEvent(new Event('keydown'));
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    window.dispatchEvent(new Event('online'));
    stops.forEach(stop => stop());
    window.dispatchEvent(new Event('keydown'));

    expect(heard).toEqual(['activity', 'unloading', 'resumed', 'online']);
  });

  it('reports the page hidden and shown again', () => {
    const concealed: boolean[] = [];
    const stop = BROWSER_LOCK_SIGNALS.onConcealed(value => concealed.push(value));
    const visibility = vi.spyOn(document, 'visibilityState', 'get');

    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    const hiddenNow = BROWSER_LOCK_SIGNALS.isConcealed();
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    stop();
    visibility.mockRestore();

    expect(concealed).toEqual([true, false]);
    expect(hiddenNow).toBe(true);
  });
});
