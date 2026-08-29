import { createSoundEngine } from '@frozik/utils/audio/soundEngine';
import type { EngineHumState, IEngineHum } from './engine-hum';
import { createEngineHum } from './engine-hum';
import type { JingleId } from './jingles';
import { JINGLES, toJinglePatch } from './jingles';
import type { SfxId } from './sfx-recipes';
import { SFX_PATCHES } from './sfx-recipes';

export interface ITanksSoundEngine {
  /** Must be called from a user gesture — Firefox won't resume a context constructed elsewhere. */
  unlock(): void;
  play(sfxId: SfxId): void;
  playAll(sfxIds: readonly SfxId[]): void;
  playJingle(jingleId: JingleId): void;
  setEngineHum(state: EngineHumState): void;
  setMuted(isMuted: boolean): void;
  suspend(): void;
  resume(): void;
  dispose(): void;
}

/** Headroom for a big explosion layered over the hum and a jingle without clipping. */
const MASTER_GAIN = 0.6;

export function createTanksSoundEngine(): ITanksSoundEngine {
  let humState: EngineHumState = 'off';

  const engine = createSoundEngine<IEngineHum>({
    masterGain: MASTER_GAIN,
    createAmbience: (context, destination) => {
      const hum = createEngineHum(context, destination);

      hum.setState(humState);

      return hum;
    },
  });

  return {
    unlock: engine.unlock,

    play(sfxId: SfxId): void {
      engine.playPatch(SFX_PATCHES[sfxId]);
    },

    playAll(sfxIds: readonly SfxId[]): void {
      for (const sfxId of sfxIds) {
        engine.playPatch(SFX_PATCHES[sfxId]);
      }
    },

    playJingle(jingleId: JingleId): void {
      engine.playPatch(toJinglePatch(JINGLES[jingleId]));
    },

    setEngineHum(state: EngineHumState): void {
      humState = state;
      engine.getAmbience()?.setState(state);
    },

    setMuted: engine.setMuted,
    suspend: engine.suspend,
    resume: engine.resume,
    dispose: engine.dispose,
  };
}
