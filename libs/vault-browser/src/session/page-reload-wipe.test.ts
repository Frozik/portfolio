import { PAGE_RELOAD_WIPE } from './page-reload-wipe';

describe('the web wipe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('reloads the page and leaves the next one a note of why, once', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    PAGE_RELOAD_WIPE.wipe({ vaultKey: 'v1', reason: 'quick-unlock-failed' });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(PAGE_RELOAD_WIPE.takeNote('v2')).toBeNull();
    PAGE_RELOAD_WIPE.wipe({ vaultKey: 'v1', reason: 'quick-unlock-failed' });
    expect(PAGE_RELOAD_WIPE.takeNote('v1')).toBe('quick-unlock-failed');
    expect(PAGE_RELOAD_WIPE.takeNote('v1')).toBeNull();
  });

  it('reloads even when the tab keeps no site data', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    vi.stubGlobal('sessionStorage', {
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });

    PAGE_RELOAD_WIPE.wipe({ vaultKey: 'v1', reason: 'manual' });

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
