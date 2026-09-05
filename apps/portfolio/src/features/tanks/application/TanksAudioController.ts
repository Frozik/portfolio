import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { reaction } from 'mobx';

import type { IVisibilitySource } from '../domain/ports/visibility-source';
import type { PlayerInputs, WorldEvent } from '../domain/types';
import type { EngineHumState } from '../infrastructure/audio/engine-hum';
import { mapWorldEventsToSfx } from '../infrastructure/audio/sfx-mapping';
import type { ITanksSoundEngine } from '../infrastructure/audio/sound-engine';
import { createTanksSoundEngine } from '../infrastructure/audio/sound-engine';
import { createDocumentVisibilitySource } from '../infrastructure/document-visibility-source';
import type { TanksGameStatus, TanksStore } from './TanksStore';

/**
 * MobX reactions run synchronously inside the triggering user gesture, which is what lets
 * `unlock()` satisfy the browsers' autoplay policies.
 */
export class TanksAudioController {
  private readonly store: TanksStore;
  private readonly engine: ITanksSoundEngine;
  private readonly disposers: VoidFunction[] = [];

  constructor(
    store: TanksStore,
    engine: ITanksSoundEngine = createTanksSoundEngine(),
    visibilitySource: IVisibilitySource = createDocumentVisibilitySource()
  ) {
    this.store = store;
    this.engine = engine;
    this.engine.setMuted(store.isMuted);

    this.disposers.push(
      reaction(
        () => store.isMuted,
        isMuted => {
          this.engine.unlock();
          this.engine.setMuted(isMuted);
        }
      ),
      reaction(
        () => store.gameStatus,
        (status, previousStatus) => {
          this.handleStatusChange(status, previousStatus);
        }
      ),
      visibilitySource.onHidden(this.suspendWhileHidden)
    );
  }

  unlock(): void {
    this.engine.unlock();
  }

  onTick(inputs: PlayerInputs, events: readonly WorldEvent[]): void {
    this.engine.playAll(mapWorldEventsToSfx(events));
    this.engine.setEngineHum(this.resolveEngineHumState(inputs));
  }

  dispose(): void {
    for (const dispose of this.disposers) {
      dispose();
    }
    this.disposers.length = 0;
    this.engine.dispose();
  }

  private handleStatusChange(
    status: TanksGameStatus,
    previousStatus: TanksGameStatus | undefined
  ): void {
    switch (status) {
      case 'stage-intro':
        this.engine.unlock();
        this.engine.setEngineHum('off');
        this.engine.playJingle('stage-start');
        break;
      case 'paused':
        // Suspending the context here would swallow the blip; it only suspends when the tab hides.
        this.engine.setEngineHum('off');
        this.engine.play('pause-blip');
        break;
      case 'playing':
        if (previousStatus === 'paused') {
          this.engine.resume();
        }
        break;
      case 'stage-clear':
        this.engine.setEngineHum('off');
        this.engine.play('score-tick');
        break;
      case 'game-over':
        this.engine.setEngineHum('off');
        this.engine.playJingle('game-over');
        break;
      case 'menu':
        this.engine.setEngineHum('off');
        break;
      default:
        assertNever(status);
    }
  }

  private readonly suspendWhileHidden = (): void => {
    this.engine.setEngineHum('off');
    this.engine.suspend();
  };

  private resolveEngineHumState(inputs: PlayerInputs): EngineHumState {
    if (!this.store.isPlaying) {
      return 'off';
    }

    return isNil(inputs.direction) ? 'idle' : 'moving';
  }
}
