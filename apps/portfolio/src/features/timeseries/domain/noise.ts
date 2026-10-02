import alea from 'alea';
import { createNoise2D } from 'simplex-noise';

const OCTAVES = 6;
const LACUNARITY = 2;
const GAIN = 0.5;
const BASE_FREQUENCY = 4;
const BASE_AMPLITUDE = 15;
const VALUE_CENTER = 100;
/** Keeps the octaves apart on the second axis of the noise, so they do not repeat each other. */
const OCTAVE_OFFSET = 1000;

export interface INoiseOptions {
  /** The same seed gives the same series. */
  readonly seed: string;
  /** The stretch of time the slowest wave of the noise spans, nanoseconds. */
  readonly period: bigint;
}

/** A value for every moment of time, in nanoseconds: smooth, endless, the same on every call. */
export type TNoise = (time: bigint) => number;

/**
 * Fractal noise over time: octaves of simplex noise, each twice as fast and
 * half as tall as the one before, so zooming in keeps finding detail while
 * the large shape stays where it was.
 */
export function createNoise({ seed, period }: INoiseOptions): TNoise {
  const noise2D = createNoise2D(alea(seed));
  const periodLength = Number(period);

  return time => {
    const position = Number(time) / periodLength;
    let value = 0;
    let amplitude = BASE_AMPLITUDE;
    let frequency = BASE_FREQUENCY;
    for (let octave = 0; octave < OCTAVES; octave += 1) {
      value += amplitude * noise2D(position * frequency, octave * OCTAVE_OFFSET);
      amplitude *= GAIN;
      frequency *= LACUNARITY;
    }
    return VALUE_CENTER + value;
  };
}
