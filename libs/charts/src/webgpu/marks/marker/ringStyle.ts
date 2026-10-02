import type { IStyleProcessor } from '../../../core/series/style-processor';
import type { IRingStyleOptions } from '../../../marks/marker/style';
import { createRingStyle } from '../../../marks/marker/style';
import { marker } from './marker';

/** A hollow circle on every element, drawn on WebGPU (§5.3). */
export function ringStyle<TX>(options: IRingStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createRingStyle(marker, options);
}
