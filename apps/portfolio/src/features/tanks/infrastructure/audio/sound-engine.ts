import type { ISynthVoicePlayer, SoundPatch } from '@frozik/utils/audio/synth';
import { createSynthVoicePlayer } from '@frozik/utils/audio/synth';
import { isNil, noop } from 'lodash-es';
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
const MUTED_GAIN = 0;
/** Slow enough to avoid a click on the mute button, fast enough to feel instant. */
const MUTE_RAMP_SECONDS = 0.03;

function resolveAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/** Events before the unlocking gesture are dropped, not queued — stale explosions would burst on Start. */
export function createTanksSoundEngine(): ITanksSoundEngine {
  let context: AudioContext | undefined;
  let masterGain: GainNode | undefined;
  let voicePlayer: ISynthVoicePlayer | undefined;
  let engineHum: IEngineHum | undefined;
  let isMuted = false;
  let humState: EngineHumState = 'off';

  function applyMasterGain(): void {
    if (isNil(context) || isNil(masterGain)) {
      return;
    }

    masterGain.gain.linearRampToValueAtTime(
      isMuted ? MUTED_GAIN : MASTER_GAIN,
      context.currentTime + MUTE_RAMP_SECONDS
    );
  }

  function playPatch(patch: SoundPatch): void {
    if (isNil(context) || isNil(voicePlayer) || context.state !== 'running') {
      return;
    }

    voicePlayer.play(patch, context.currentTime);
  }

  return {
    unlock(): void {
      if (isNil(context)) {
        const AudioContextConstructor = resolveAudioContextConstructor();

        if (isNil(AudioContextConstructor)) {
          return;
        }

        context = new AudioContextConstructor();
        masterGain = context.createGain();
        masterGain.gain.setValueAtTime(isMuted ? MUTED_GAIN : MASTER_GAIN, context.currentTime);
        masterGain.connect(context.destination);
        voicePlayer = createSynthVoicePlayer(context, masterGain);
        engineHum = createEngineHum(context, masterGain);
        engineHum.setState(humState);
      }

      if (context.state === 'suspended') {
        context.resume().catch(noop);
      }
    },

    play(sfxId: SfxId): void {
      playPatch(SFX_PATCHES[sfxId]);
    },

    playAll(sfxIds: readonly SfxId[]): void {
      for (const sfxId of sfxIds) {
        playPatch(SFX_PATCHES[sfxId]);
      }
    },

    playJingle(jingleId: JingleId): void {
      playPatch(toJinglePatch(JINGLES[jingleId]));
    },

    setEngineHum(state: EngineHumState): void {
      humState = state;
      engineHum?.setState(state);
    },

    setMuted(nextIsMuted: boolean): void {
      isMuted = nextIsMuted;
      applyMasterGain();
    },

    suspend(): void {
      if (!isNil(context) && context.state === 'running') {
        context.suspend().catch(noop);
      }
    },

    resume(): void {
      if (!isNil(context) && context.state === 'suspended') {
        context.resume().catch(noop);
      }
    },

    dispose(): void {
      engineHum?.dispose();
      engineHum = undefined;
      voicePlayer?.dispose();
      voicePlayer = undefined;
      masterGain?.disconnect();
      masterGain = undefined;

      const closingContext = context;
      context = undefined;

      void closingContext?.close();
    },
  };
}
