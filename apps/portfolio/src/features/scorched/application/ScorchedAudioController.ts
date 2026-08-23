import { assertNever } from '@frozik/utils/assert/assertNever';
import { reaction } from 'mobx';

import { MAX_POWER, POWER_TO_SPEED_WU_PER_TICK } from '../domain/constants';
import type { WorldEvent } from '../domain/types';
import { mapScorchedEventsToSfx } from '../infrastructure/audio/sfx-mapping';
import type { IScorchedSoundEngine } from '../infrastructure/audio/sound-engine';
import { createScorchedSoundEngine } from '../infrastructure/audio/sound-engine';
import type { ScorchedGameStatus, ScorchedStore } from './ScorchedStore';

const NOT_DESCENDING = 0;
/**
 * The muzzle speed of a full-power shot (§15.2). A shell crossing its apex near this is a flat,
 * fast round and gets the top of the whistle's pitch range.
 */
const WHISTLE_REFERENCE_SPEED_WU_PER_TICK = MAX_POWER * POWER_TO_SPEED_WU_PER_TICK;

/**
 * Every audio side-effect of the game, kept out of the store (§12/§12.2): the store holds data,
 * this controller listens to it. Owned by `ScorchedGame` alongside the renderer.
 *
 * MobX reactions run synchronously as the triggering action commits, so a jingle fired by a status
 * transition — or the mute switch — still executes inside the user gesture (click, key, tap) that
 * caused it, which is exactly what lets `unlock()` satisfy the browsers' autoplay policies.
 */
export class ScorchedAudioController {
  private readonly store: ScorchedStore;
  private readonly engine: IScorchedSoundEngine;
  private readonly disposers: VoidFunction[] = [];
  private descentSpeedWuPerTick = 0;

  constructor(store: ScorchedStore, engine: IScorchedSoundEngine = createScorchedSoundEngine()) {
    this.store = store;
    this.engine = engine;
    this.engine.setMuted(store.isMuted);
    this.engine.setWind(store.windUnits);

    this.disposers.push(
      reaction(
        () => store.isMuted,
        isMuted => {
          this.engine.unlock();
          this.engine.setMuted(isMuted);
        }
      ),
      reaction(
        () => store.windUnits,
        windUnits => this.engine.setWind(windUnits)
      ),
      // [§12.2] The wind is only audible while somebody is deciding what to do about it.
      reaction(
        () => store.isAiming,
        isAiming => this.engine.setWindAudible(isAiming)
      ),
      reaction(
        () => store.status,
        status => this.handleStatusChange(status)
      ),
      reaction(
        () => store.roundNumber,
        () => this.playRoundStart()
      )
    );

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Browsers only let an `AudioContext` start from a user gesture, so every entry point a player
   * can reach with a click, a key or a tap primes the engine (§12.2). Idempotent and cheap.
   */
  unlock(): void {
    this.engine.unlock();
  }

  /**
   * One frame's audio. The whistle is a state rather than an event — no single tick is "the shell
   * started falling" — so the shell reports how fast it is coming down and the cue fires on the
   * transition, pitched by the speed it tipped over at (§16.4). A lobbed shot sighs, a flat
   * full-power one screams.
   */
  onFrame(events: readonly WorldEvent[], descentSpeedWuPerTick: number): void {
    this.engine.playAll(mapScorchedEventsToSfx(events));

    if (descentSpeedWuPerTick > NOT_DESCENDING && this.descentSpeedWuPerTick === NOT_DESCENDING) {
      this.engine.playWhistle(descentSpeedWuPerTick / WHISTLE_REFERENCE_SPEED_WU_PER_TICK);
    }

    this.descentSpeedWuPerTick = descentSpeedWuPerTick;
  }

  /** [§13] The shop's till, rung by the screen that spends the money. */
  playPurchase(): void {
    this.engine.unlock();
    this.engine.play('cash-register');
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    for (const dispose of this.disposers) {
      dispose();
    }
    this.disposers.length = 0;
    this.engine.dispose();
  }

  private playRoundStart(): void {
    if (this.store.status === 'playing' || this.store.status === 'handover') {
      this.engine.playJingle('round-start');
    }
  }

  private handleStatusChange(status: ScorchedGameStatus): void {
    switch (status) {
      case 'playing':
        this.engine.unlock();
        this.engine.resume();
        break;
      case 'handover':
      case 'shop':
        this.engine.setWindAudible(false);
        break;
      case 'round-over':
        this.engine.setWindAudible(false);
        this.engine.playJingle('round-won');
        break;
      case 'match-over':
        this.engine.setWindAudible(false);
        this.engine.playJingle('match-won');
        break;
      case 'setup':
        this.engine.setWindAudible(false);
        break;
      default:
        assertNever(status);
    }
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.engine.setWindAudible(false);
      this.engine.suspend();
    }
  };
}
