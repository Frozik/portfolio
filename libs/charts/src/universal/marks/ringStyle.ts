import type { IStyleProcessor } from '../../core/series/style-processor';
import type { IRingStyleOptions } from '../../marks/marker/style';
import { createRingStyle } from '../../marks/marker/style';
import { marker } from './marks';

/** A hollow circle on every element, on WebGPU where there is one and on the 2D canvas where there is not. */
export function ringStyle<TX>(options: IRingStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createRingStyle(marker, options);
}
