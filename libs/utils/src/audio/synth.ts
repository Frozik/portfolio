import { random } from 'lodash-es';

/**
 * A hand-rolled, fully typed WebAudio voice (§12.3). The parameter model is inspired by the
 * tiny 8-bit synth libraries, but written out as named fields rather than a positional argument
 * array — the candidates ship no TypeScript types, and a recipe you can read is worth more here
 * than a kilobyte saved.
 */
export type SynthWaveform = 'square' | 'triangle' | 'noise';

export type PitchSlide = 'linear' | 'exponential';

/**
 * Where the voice starts and where it lands. For `noise` the same numbers steer a low-pass
 * cutoff instead of an oscillator, which is what turns one noise source into both a crumbling
 * brick (cutoff falling) and a skid (cutoff rising).
 */
export interface IPitchEnvelope {
  readonly startHz: number;
  /** Glide target; omitted holds `startHz` for the whole voice. */
  readonly endHz?: number;
  readonly slide?: PitchSlide;
}

export interface IGainEnvelope {
  /** Loudness at the end of the attack, relative to the master gain. */
  readonly peak: number;
  readonly attackSeconds: number;
  readonly decaySeconds: number;
}

export interface ISoundRecipe {
  readonly waveform: SynthWaveform;
  readonly pitch: IPitchEnvelope;
  readonly gain: IGainEnvelope;
}

export interface ISoundLayer {
  readonly recipe: ISoundRecipe;
  /** Offset from the trigger — stacks voices into chords, arpeggios and two-hit stingers. */
  readonly delaySeconds?: number;
}

/** One playable sound: a handful of layered voices sharing a trigger instant. */
export type SoundPatch = readonly ISoundLayer[];

export interface ISynthVoicePlayer {
  play(patch: SoundPatch, startTimeSeconds: number): void;
  dispose(): void;
}

/** Exponential ramps cannot reach zero, so the decay lands here and is then cut. */
const SILENCE_GAIN = 0.0001;
const NO_DELAY_SECONDS = 0;
/** One second of white noise, looped by nothing — every noise voice is shorter than this. */
const NOISE_BUFFER_SECONDS = 1;
const NOISE_CHANNEL_COUNT = 1;
const NOISE_MIN_SAMPLE = -1;
const NOISE_MAX_SAMPLE = 1;
const RANDOM_IS_FLOATING = true;

export function getRecipeDurationSeconds(recipe: ISoundRecipe): number {
  return recipe.gain.attackSeconds + recipe.gain.decaySeconds;
}

export function getPatchDurationSeconds(patch: SoundPatch): number {
  return patch.reduce(
    (longest, layer) =>
      Math.max(
        longest,
        (layer.delaySeconds ?? NO_DELAY_SECONDS) + getRecipeDurationSeconds(layer.recipe)
      ),
    NO_DELAY_SECONDS
  );
}

function createNoiseBuffer(context: BaseAudioContext): AudioBuffer {
  const sampleCount = Math.floor(context.sampleRate * NOISE_BUFFER_SECONDS);
  const buffer = context.createBuffer(NOISE_CHANNEL_COUNT, sampleCount, context.sampleRate);
  const samples = buffer.getChannelData(0);

  for (let index = 0; index < sampleCount; index++) {
    samples[index] = random(NOISE_MIN_SAMPLE, NOISE_MAX_SAMPLE, RANDOM_IS_FLOATING);
  }

  return buffer;
}

function scheduleFrequency(
  parameter: AudioParam,
  pitch: IPitchEnvelope,
  startTimeSeconds: number,
  endTimeSeconds: number
): void {
  parameter.setValueAtTime(pitch.startHz, startTimeSeconds);

  if (pitch.endHz === undefined) {
    return;
  }

  if (pitch.slide === 'linear') {
    parameter.linearRampToValueAtTime(pitch.endHz, endTimeSeconds);

    return;
  }

  parameter.exponentialRampToValueAtTime(Math.max(pitch.endHz, SILENCE_GAIN), endTimeSeconds);
}

function scheduleGain(
  parameter: AudioParam,
  envelope: IGainEnvelope,
  startTimeSeconds: number
): void {
  const peakTimeSeconds = startTimeSeconds + envelope.attackSeconds;
  const endTimeSeconds = peakTimeSeconds + envelope.decaySeconds;

  parameter.setValueAtTime(0, startTimeSeconds);
  parameter.linearRampToValueAtTime(envelope.peak, peakTimeSeconds);
  parameter.exponentialRampToValueAtTime(SILENCE_GAIN, endTimeSeconds);
  parameter.setValueAtTime(0, endTimeSeconds);
}

/**
 * Renders recipes into WebAudio graphs. One player owns the shared noise buffer for the whole
 * feature, so a burst of explosions costs one buffer allocation, not one per bang.
 */
export function createSynthVoicePlayer(
  context: AudioContext,
  destination: AudioNode
): ISynthVoicePlayer {
  let noiseBuffer: AudioBuffer | undefined;
  let isDisposed = false;

  function getNoiseBuffer(): AudioBuffer {
    noiseBuffer = noiseBuffer ?? createNoiseBuffer(context);

    return noiseBuffer;
  }

  function playLayer(layer: ISoundLayer, triggerTimeSeconds: number): void {
    const { recipe } = layer;
    const startTimeSeconds = triggerTimeSeconds + (layer.delaySeconds ?? NO_DELAY_SECONDS);
    const endTimeSeconds = startTimeSeconds + getRecipeDurationSeconds(recipe);
    const gainNode = context.createGain();

    scheduleGain(gainNode.gain, recipe.gain, startTimeSeconds);
    gainNode.connect(destination);

    if (recipe.waveform === 'noise') {
      const noiseSource = context.createBufferSource();
      const filter = context.createBiquadFilter();

      noiseSource.buffer = getNoiseBuffer();
      filter.type = 'lowpass';
      scheduleFrequency(filter.frequency, recipe.pitch, startTimeSeconds, endTimeSeconds);

      noiseSource.connect(filter);
      filter.connect(gainNode);
      noiseSource.start(startTimeSeconds);
      noiseSource.stop(endTimeSeconds);
      noiseSource.onended = () => {
        noiseSource.disconnect();
        filter.disconnect();
        gainNode.disconnect();
      };

      return;
    }

    const oscillator = context.createOscillator();

    oscillator.type = recipe.waveform;
    scheduleFrequency(oscillator.frequency, recipe.pitch, startTimeSeconds, endTimeSeconds);

    oscillator.connect(gainNode);
    oscillator.start(startTimeSeconds);
    oscillator.stop(endTimeSeconds);
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  }

  return {
    play(patch: SoundPatch, startTimeSeconds: number): void {
      if (isDisposed) {
        return;
      }

      for (const layer of patch) {
        playLayer(layer, startTimeSeconds);
      }
    },

    dispose(): void {
      isDisposed = true;
      noiseBuffer = undefined;
    },
  };
}
