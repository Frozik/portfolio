import { describe, expect, it, vi } from 'vitest';

import { Store } from './store';

describe('Store', () => {
  it('notifies subscribers once per change and hands out the new snapshot', () => {
    const store = new Store({ phase: 'idle' });
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ phase: 'open' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ phase: 'open' });
  });

  it('stays silent when the same snapshot is set again', () => {
    const snapshot = { phase: 'idle' };
    const store = new Store(snapshot);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(snapshot);

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe, even from inside a notification', () => {
    const store = new Store(0);
    const second = vi.fn();
    const unsubscribeFirst = store.subscribe(() => unsubscribeSecond());
    const unsubscribeSecond = store.subscribe(second);

    store.update(value => value + 1);
    store.update(value => value + 1);

    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
  });
});
