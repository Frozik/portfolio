import type { TOfflinePackStatus } from '../../sw/offline-pack-protocol';
import type { IOfflinePackPort } from './offlinePackPort';
import { OfflinePackStore } from './OfflinePackStore';

function fakePort() {
  const listeners = new Set<(status: TOfflinePackStatus) => void>();
  const requests: string[] = [];
  const port: IOfflinePackPort = {
    requestWarm: () => {
      requests.push('warm');
    },
    requestStatus: () => {
      requests.push('status');
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const emit = (status: TOfflinePackStatus): void => {
    for (const listener of listeners) {
      listener(status);
    }
  };
  return { port, requests, emit, listeners };
}

describe('OfflinePackStore', () => {
  it('asks the worker for the current status as soon as it is created', () => {
    const { port, requests } = fakePort();
    new OfflinePackStore(port, false);
    expect(requests).toEqual(['status']);
  });

  it('knows nothing until the worker answers, then mirrors every status it sends', () => {
    const { port, emit } = fakePort();
    const store = new OfflinePackStore(port, false);
    expect(store.status).toBeNull();

    emit({ state: 'downloading', cached: 3, total: 10 });
    expect(store.status).toEqual({ state: 'downloading', cached: 3, total: 10 });

    emit({ state: 'ready', total: 10 });
    expect(store.status).toEqual({ state: 'ready', total: 10 });
  });

  it('forwards a download request to the worker', () => {
    const { port, requests } = fakePort();
    new OfflinePackStore(port, false).download();
    expect(requests).toEqual(['status', 'warm']);
  });

  it('asks the worker again on refresh', () => {
    const { port, requests } = fakePort();
    new OfflinePackStore(port, false).refresh();
    expect(requests).toEqual(['status', 'status']);
  });

  it('stops listening to the worker once disposed', () => {
    const { port, listeners } = fakePort();
    const store = new OfflinePackStore(port, false);
    store.dispose();
    expect(listeners.size).toBe(0);
  });
});
