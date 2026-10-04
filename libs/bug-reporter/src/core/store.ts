export type TUnsubscribe = () => void;

export interface IReadableStore<TState> {
  getSnapshot(): TState;
  subscribe(listener: () => void): TUnsubscribe;
}

/**
 * The smallest store a view can subscribe to: one immutable snapshot and a
 * change notification, which is exactly the contract React's
 * `useSyncExternalStore` and any other framework adapter needs.
 */
export class Store<TState> implements IReadableStore<TState> {
  private state: TState;
  private readonly listeners = new Set<() => void>();

  constructor(initial: TState) {
    this.state = initial;
  }

  getSnapshot(): TState {
    return this.state;
  }

  subscribe(listener: () => void): TUnsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  set(next: TState): void {
    if (Object.is(next, this.state)) {
      return;
    }
    this.state = next;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  update(change: (previous: TState) => TState): void {
    this.set(change(this.state));
  }
}
