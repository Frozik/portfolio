/**
 * Accumulator for teardown functions (unsubscribes, timer cancellations,
 * resource `dispose()` calls) that must run together at the end of a scope.
 *
 * Teardown runs in LIFO order: the reverse of registration. That mirrors
 * construction order, so a subscription registered after the emitter it
 * listens to is always torn down before that emitter is disposed. Call sites
 * rely on this — register a resource's own teardown first, its subscriptions
 * after.
 *
 * The bag is reusable: `disposeAll` empties it and leaves it ready to collect
 * the next scope's teardown (e.g. a re-created peer connection). Anything
 * added after a `disposeAll` belongs to that next round.
 */
export class DisposableBag {
  private readonly disposers: VoidFunction[] = [];

  add(dispose: VoidFunction): void {
    this.disposers.push(dispose);
  }

  /** Run every registered teardown in LIFO order and empty the bag. */
  disposeAll(): void {
    // Detach before invoking so a teardown that re-enters `disposeAll` — or
    // registers a fresh handle — can never run the same disposer twice.
    const pending = this.disposers.splice(0);
    for (const dispose of pending.reverse()) {
      dispose();
    }
  }
}
