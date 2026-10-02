import type { IStyleProcessor } from '../../core/series/style-processor';
import type { IMarkerStyleOptions } from '../../marks/marker/style';
import { createMarkerStyle } from '../../marks/marker/style';
import { marker } from './marks';

/** A figure on every element, on WebGPU where there is one and on the 2D canvas where there is not. */
export function markerStyle<TX>(options: IMarkerStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createMarkerStyle(marker, options);
}
