import { action, makeObservable, observable } from 'mobx';
import type * as Y from 'yjs';

/**
 * Bridges a Yjs shared type (Y.Map/Y.Array/etc.) to a MobX reactive box.
 * Rebuilds an immutable plain-JS snapshot on every deep-observe event.
 * Consumers read `snapshot` as a normal observable; React re-renders on
 * structural changes via identity (@observable.ref).
 */
export class YjsObservableBox<TSnapshot> {
  snapshot: TSnapshot;
  private readonly disposeObserver: () => void;

  constructor(
    target: Y.AbstractType<unknown>,
    private readonly toSnapshot: () => TSnapshot
  ) {
    makeObservable(this, {
      snapshot: observable.ref,
      updateSnapshot: action,
    });
    this.snapshot = toSnapshot();
    const handler = (): void => this.updateSnapshot();
    target.observeDeep(handler);
    this.disposeObserver = () => target.unobserveDeep(handler);
  }

  updateSnapshot(): void {
    this.snapshot = this.toSnapshot();
  }

  dispose(): void {
    this.disposeObserver();
  }
}
