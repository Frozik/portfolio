import { createSoundEngine } from '@frozik/utils/audio/soundEngine';

import type { ScorchedJingleId } from './jingles';
import { SCORCHED_JINGLES, toScorchedJinglePatch } from './jingles';
import type { ScorchedSfxId } from './sfx-recipes';
import { createWhistlePatch, SCORCHED_SFX_PATCHES } from './sfx-recipes';
import type { IWindAmbience } from './wind-ambience';
import { createWindAmbience } from './wind-ambience';

/** Everything the game can ask of its audio, with no WebAudio types leaking to the callers. */
export interface IScorchedSoundEngine {
  /**
   * Must be called from a user gesture: browsers refuse to start an `AudioContext` outside one,
   * and Firefox will not resume a context that was constructed anywhere else. Idempotent.
   */
  unlock(): void;
  play(sfxId: ScorchedSfxId): void;
  playAll(sfxIds: readonly ScorchedSfxId[]): void;
  /** The falling shell's whistle, pitched by how fast it is going: 0 is a lob, 1 is a screamer. */
  playWhistle(speedRatio: number): void;
  playJingle(jingleId: ScorchedJingleId): void;
  setWind(windUnits: number): void;
  setWindAudible(isAudible: boolean): void;
  setMuted(isMuted: boolean): void;
  suspend(): void;
  resume(): void;
  dispose(): void;
}

/** Headroom for a nuke layered over the wind and a jingle without clipping. */
const MASTER_GAIN = 0.6;

export function createScorchedSoundEngine(): IScorchedSoundEngine {
  let windUnits = 0;
  let isWindAudible = false;

  const engine = createSoundEngine<IWindAmbience>({
    masterGain: MASTER_GAIN,
    createAmbience: (context, destination) => {
      const wind = createWindAmbience(context, destination);

      wind.setWind(windUnits);
      wind.setActive(isWindAudible);

      return wind;
    },
  });

  return {
    unlock: engine.unlock,

    play(sfxId: ScorchedSfxId): void {
      engine.playPatch(SCORCHED_SFX_PATCHES[sfxId]);
    },

    playAll(sfxIds: readonly ScorchedSfxId[]): void {
      for (const sfxId of sfxIds) {
        engine.playPatch(SCORCHED_SFX_PATCHES[sfxId]);
      }
    },

    playWhistle(speedRatio: number): void {
      engine.playPatch(createWhistlePatch(speedRatio));
    },

    playJingle(jingleId: ScorchedJingleId): void {
      engine.playPatch(toScorchedJinglePatch(SCORCHED_JINGLES[jingleId]));
    },

    setWind(nextWindUnits: number): void {
      windUnits = nextWindUnits;
      engine.getAmbience()?.setWind(nextWindUnits);
    },

    setWindAudible(isAudible: boolean): void {
      isWindAudible = isAudible;
      engine.getAmbience()?.setActive(isAudible);
    },

    setMuted: engine.setMuted,
    suspend: engine.suspend,
    resume: engine.resume,
    dispose: engine.dispose,
  };
}
