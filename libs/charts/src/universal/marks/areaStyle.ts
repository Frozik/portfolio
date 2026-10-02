import type { IStyleProcessor } from '../../core/series/style-processor';
import type { IAreaStyleOptions } from '../../marks/area/style';
import { createAreaStyle } from '../../marks/area/style';
import { area, line } from './marks';

/** A band from the line to its baseline, with an optional line along its edge, on WebGPU where there is one and on the 2D canvas where there is not. */
export function areaStyle<TX>(options: IAreaStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createAreaStyle({ area, line }, options);
}
