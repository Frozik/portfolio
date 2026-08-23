import type { ISynthVoicePlayer, SoundPatch } from '@frozik/utils/audio/synth';
import { createSynthVoicePlayer } from '@frozik/utils/audio/synth';
import { isNil, noop } from 'lodash-es';

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

/**
 * The thin shell over the shared synth (§12.2): it owns the `AudioContext`, the master gain and
 * the wind ambience, and does nothing at all until a user gesture unlocks it — events fired before
 * that are dropped rather than queued, because a burst of stale explosions arriving the moment the
 * player taps Start would be worse than the silence.
 */
export function createScorchedSoundEngine(): IScorchedSoundEngine {
  let context: AudioContext | undefined;
  let masterGain: GainNode | undefined;
  let voicePlayer: ISynthVoicePlayer | undefined;
  let wind: IWindAmbience | undefined;
  let isMuted = false;
  let windUnits = 0;
  let isWindAudible = false;

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
        wind = createWindAmbience(context, masterGain);
        wind.setWind(windUnits);
        wind.setActive(isWindAudible);
      }

      if (context.state === 'suspended') {
        context.resume().catch(noop);
      }
    },

    play(sfxId: ScorchedSfxId): void {
      playPatch(SCORCHED_SFX_PATCHES[sfxId]);
    },

    playAll(sfxIds: readonly ScorchedSfxId[]): void {
      for (const sfxId of sfxIds) {
        playPatch(SCORCHED_SFX_PATCHES[sfxId]);
      }
    },

    playWhistle(speedRatio: number): void {
      playPatch(createWhistlePatch(speedRatio));
    },

    playJingle(jingleId: ScorchedJingleId): void {
      playPatch(toScorchedJinglePatch(SCORCHED_JINGLES[jingleId]));
    },

    setWind(nextWindUnits: number): void {
      windUnits = nextWindUnits;
      wind?.setWind(nextWindUnits);
    },

    setWindAudible(isAudible: boolean): void {
      isWindAudible = isAudible;
      wind?.setActive(isAudible);
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
      wind?.dispose();
      wind = undefined;
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
