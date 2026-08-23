import { random } from 'lodash-es';

import { MAX_WIND } from '../../domain/constants';

/**
 * [§12.2] The wind the player is about to fight, made audible while they aim: filtered noise whose
 * brightness and loudness track the round's wind magnitude. It replaces the tanks engine hum in
 * this feature's stack — a turn-based game has no engine, but it does have weather.
 */
export interface IWindAmbience {
  /** Signed wind in the manual's units; zero silences the loop without stopping it. */
  setWind(windUnits: number): void;
  setActive(isActive: boolean): void;
  dispose(): void;
}

const CALM_CUTOFF_HZ = 260;
const GALE_CUTOFF_HZ = 1100;
const CALM_GAIN = 0.012;
const GALE_GAIN = 0.075;
const SILENT_GAIN = 0;
/** Slow enough to feel like weather rather than a switch. */
const RAMP_SECONDS = 0.4;
const NOISE_BUFFER_SECONDS = 2;
const NOISE_CHANNEL_COUNT = 1;
const FILTER_Q = 0.7;
const NOISE_MIN_SAMPLE = -1;
const NOISE_MAX_SAMPLE = 1;
const RANDOM_IS_FLOATING = true;
/** One-pole smoothing weights: the closer to 1, the more of a rumble and the less of a hiss. */
const NOISE_SMOOTHING = 0.97;
const NOISE_EXCITATION = 1 - NOISE_SMOOTHING;

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const sampleCount = Math.floor(context.sampleRate * NOISE_BUFFER_SECONDS);
  const buffer = context.createBuffer(NOISE_CHANNEL_COUNT, sampleCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let previousSample = 0;

  for (let index = 0; index < sampleCount; index++) {
    // A one-pole smoothing of white noise: cheaper than a second filter node and it gives the
    // loop the low rumble that makes it read as wind instead of as radio static.
    previousSample =
      previousSample * NOISE_SMOOTHING +
      random(NOISE_MIN_SAMPLE, NOISE_MAX_SAMPLE, RANDOM_IS_FLOATING) * NOISE_EXCITATION;
    samples[index] = previousSample;
  }

  return buffer;
}

/**
 * Creates the looping ambience, already running but silent. The buffer source is started once and
 * never restarted — WebAudio sources are single-use, and gating the gain is click-free.
 */
export function createWindAmbience(context: AudioContext, destination: AudioNode): IWindAmbience {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  let isActive = false;
  let windMagnitude = 0;
  let isDisposed = false;

  source.buffer = createNoiseBuffer(context);
  source.loop = true;
  filter.type = 'bandpass';
  filter.Q.setValueAtTime(FILTER_Q, context.currentTime);
  filter.frequency.setValueAtTime(CALM_CUTOFF_HZ, context.currentTime);
  gain.gain.setValueAtTime(SILENT_GAIN, context.currentTime);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start();

  function apply(): void {
    if (isDisposed) {
      return;
    }

    const now = context.currentTime;
    const strength = Math.min(1, windMagnitude / MAX_WIND);

    filter.frequency.linearRampToValueAtTime(
      CALM_CUTOFF_HZ + (GALE_CUTOFF_HZ - CALM_CUTOFF_HZ) * strength,
      now + RAMP_SECONDS
    );
    gain.gain.linearRampToValueAtTime(
      isActive ? CALM_GAIN + (GALE_GAIN - CALM_GAIN) * strength : SILENT_GAIN,
      now + RAMP_SECONDS
    );
  }

  return {
    setWind(windUnits: number): void {
      windMagnitude = Math.abs(windUnits);
      apply();
    },

    setActive(nextIsActive: boolean): void {
      isActive = nextIsActive;
      apply();
    },

    dispose(): void {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      source.stop();
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    },
  };
}
