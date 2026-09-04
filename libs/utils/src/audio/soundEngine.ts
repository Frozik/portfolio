import type { ISynthVoicePlayer, SoundPatch } from '@frozik/utils/audio/synth';
import { createSynthVoicePlayer } from '@frozik/utils/audio/synth';
import { isNil, noop } from 'lodash-es';
import { resolveAudioContextConstructor } from './audioContextConstructor';

/** A looping layer a feature hangs off the master bus — an engine hum, a wind bed, a drone. */
export interface IAmbienceLayer {
  dispose(): void;
}

export interface ISoundEngine<TAmbience extends IAmbienceLayer = IAmbienceLayer> {
  /**
   * Must be called from a user gesture: browsers refuse to start an `AudioContext` outside one,
   * and Firefox will not resume a context that was constructed anywhere else. Idempotent.
   */
  unlock(): void;
  playPatch(patch: SoundPatch): void;
  /** The ambience layer, or `undefined` until the unlocking gesture has built the context. */
  getAmbience(): TAmbience | undefined;
  setMuted(isMuted: boolean): void;
  suspend(): void;
  resume(): void;
  dispose(): void;
}

const MUTED_GAIN = 0;
/** Slow enough to avoid a click on the mute button, fast enough to feel instant. */
const MUTE_RAMP_SECONDS = 0.03;

/**
 * The shared shell every feature's sound engine is built on: it owns the `AudioContext`, the
 * master gain and the ambience layer, and does nothing at all until a user gesture unlocks it —
 * events fired before that are dropped rather than queued, because a burst of stale explosions
 * arriving the moment the player taps Start would be worse than the silence.
 */
export function createSoundEngine<TAmbience extends IAmbienceLayer = IAmbienceLayer>({
  masterGain: masterGainLevel,
  createAmbience,
}: {
  /** Peak level of the master bus: headroom for the loudest patch layered over the ambience. */
  readonly masterGain: number;
  /** Built once, by the unlocking gesture, and disposed with the engine. */
  readonly createAmbience?: (context: AudioContext, destination: AudioNode) => TAmbience;
}): ISoundEngine<TAmbience> {
  let context: AudioContext | undefined;
  let masterGain: GainNode | undefined;
  let voicePlayer: ISynthVoicePlayer | undefined;
  let ambience: TAmbience | undefined;
  let isMuted = false;

  function resolveGainLevel(): number {
    return isMuted ? MUTED_GAIN : masterGainLevel;
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
        masterGain.gain.setValueAtTime(resolveGainLevel(), context.currentTime);
        masterGain.connect(context.destination);
        voicePlayer = createSynthVoicePlayer(context, masterGain);
        ambience = createAmbience?.(context, masterGain);
      }

      if (context.state === 'suspended') {
        context.resume().catch(noop);
      }
    },

    playPatch(patch: SoundPatch): void {
      if (isNil(context) || isNil(voicePlayer) || context.state !== 'running') {
        return;
      }

      voicePlayer.play(patch, context.currentTime);
    },

    getAmbience(): TAmbience | undefined {
      return ambience;
    },

    setMuted(nextIsMuted: boolean): void {
      isMuted = nextIsMuted;

      if (isNil(context) || isNil(masterGain)) {
        return;
      }

      masterGain.gain.linearRampToValueAtTime(
        resolveGainLevel(),
        context.currentTime + MUTE_RAMP_SECONDS
      );
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
      ambience?.dispose();
      ambience = undefined;
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
