import { clamp } from 'lodash-es';

export function zNormalization(value: number, deviation: number): number {
  return clamp(value, -deviation, deviation) / deviation;
}
