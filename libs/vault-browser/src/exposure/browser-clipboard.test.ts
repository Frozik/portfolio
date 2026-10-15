import { BROWSER_CLIPBOARD, resumePendingClipboardClear } from './browser-clipboard';

function aPage(focused: boolean) {
  const writes: string[] = [];
  vi.spyOn(document, 'hasFocus').mockReturnValue(focused);
  vi.stubGlobal('navigator', {
    clipboard: {
      writeText: (text: string) => {
        writes.push(text);
        return Promise.resolve();
      },
    },
  });
  return writes;
}

describe('the web clipboard at a lock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('clears at once while the page has focus', () => {
    const writes = aPage(true);

    BROWSER_CLIPBOARD.clearNow();

    expect(writes).toEqual(['']);
    expect(resumePendingClipboardClear()()).toBeUndefined();
    expect(writes).toEqual(['']);
  });

  it('leaves the clearing to the reloaded page when the lock comes without focus', () => {
    const writes = aPage(false);

    BROWSER_CLIPBOARD.clearNow();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    resumePendingClipboardClear();

    expect(writes).toEqual(['']);
  });
});
