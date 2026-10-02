import type { IStyleProcessor } from '../../../core/series/style-processor';
import type { IMarkerStyleOptions } from '../../../marks/marker/style';
import { createMarkerStyle } from '../../../marks/marker/style';
import { marker } from './marker';

/** A figure on every element, drawn on the 2D canvas (§6.7). */
export function markerStyle<TX>(options: IMarkerStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createMarkerStyle(marker, options);
}
