import { bootstrapOfflinePack } from './bootstrapOfflinePack';
import type { IOfflinePackPort } from './offlinePackPort';

function fakePort(): { port: IOfflinePackPort; requests: string[] } {
  const requests: string[] = [];
  return {
    requests,
    port: {
      requestWarm: () => {
        requests.push('warm');
      },
      requestStatus: () => {
        requests.push('status');
      },
      subscribe: () => () => undefined,
    },
  };
}

function pretendDisplayMode(standalone: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: standalone && query === '(display-mode: standalone)',
        media: query,
      }) as MediaQueryList
  );
}

describe('bootstrapOfflinePack', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leaves a browser tab alone — it only asks for the status', () => {
    pretendDisplayMode(false);
    const { port, requests } = fakePort();
    bootstrapOfflinePack(port);
    expect(requests).toEqual(['status']);
  });

  it('downloads the pack when launched as the installed app', () => {
    pretendDisplayMode(true);
    const { port, requests } = fakePort();
    bootstrapOfflinePack(port);
    expect(requests).toEqual(['status', 'warm']);
  });

  it('starts downloading the moment the visitor installs the app from the tab', () => {
    pretendDisplayMode(false);
    const { port, requests } = fakePort();
    const store = bootstrapOfflinePack(port);
    window.dispatchEvent(new Event('appinstalled'));
    expect(requests).toEqual(['status', 'warm']);
    expect(store.automatic).toBe(true);
  });
});
