import { createLocalThemeStore } from './local-theme-store';

const KEY = 'test:theme';

describe('the web theme store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('keeps the choice in this origin', () => {
    const store = createLocalThemeStore(KEY);

    expect(store.write('dark')).toBe(true);
    expect(createLocalThemeStore(KEY).read()).toBe('dark');
  });

  it('follows the system when nothing or nonsense was stored', () => {
    localStorage.setItem(KEY, 'purple');

    expect(createLocalThemeStore(KEY).read()).toBe('system');
  });

  it('works without site data: reads the system, says a write was not kept', () => {
    const blocked = (): never => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    const store = createLocalThemeStore(KEY);

    expect(store.read()).toBe('system');
    expect(store.write('light')).toBe(false);
  });
});
