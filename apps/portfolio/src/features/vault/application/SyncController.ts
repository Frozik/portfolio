import type { ISyncReplica } from '@frozik/vault/session/sync-effect-runner';
import { runSyncEffect } from '@frozik/vault/session/sync-effect-runner';
import type { TSyncEffect } from '@frozik/vault/sync/sync-effects';
import type { TSyncEvent } from '@frozik/vault/sync/sync-events';
import type { ISyncState, TSyncStop } from '@frozik/vault/sync/sync-state';
import { syncStep } from '@frozik/vault/sync/sync-step';
import { makeAutoObservable, observableRef } from 'mobx';

/**
 * The shell of one sync engine: steps it, runs every effect
 * under the session's signal and feeds the outcome back. The engine coalesces
 * by itself, so the local target is the session's one-write-in-flight writer.
 */
export class SyncController {
  state: ISyncState;

  private readonly controller = new AbortController();

  constructor(
    private readonly replica: ISyncReplica,
    initial: ISyncState,
    private readonly listeners: {
      readonly onEvent?: (event: TSyncEvent) => void;
      /** The engine stopped and waits for the user or the lifecycle. */
      readonly onStopped?: (stop: TSyncStop) => void;
    } = {}
  ) {
    this.state = initial;
    makeAutoObservable<SyncController, 'replica' | 'controller' | 'listeners'>(
      this,
      { state: observableRef, replica: false, controller: false, listeners: false },
      { autoBind: true }
    );
  }

  dispatch(event: TSyncEvent): void {
    if (this.controller.signal.aborted) {
      return;
    }
    const wasStopped = this.state.phase.kind === 'stopped';
    const next = syncStep(this.state, event);
    this.state = next.state;
    this.listeners.onEvent?.(event);
    if (!wasStopped && next.state.phase.kind === 'stopped') {
      this.listeners.onStopped?.(next.state.phase.reason);
    }
    next.effects.forEach(effect => void this.run(effect));
  }

  dispose(): void {
    this.controller.abort();
  }

  private async run(effect: TSyncEffect): Promise<void> {
    const event = await runSyncEffect(effect, this.replica, this.controller.signal);
    if (event !== null) {
      this.dispatch(event);
    }
  }
}
