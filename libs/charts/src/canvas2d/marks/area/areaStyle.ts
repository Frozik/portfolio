import type { IStyleProcessor } from '../../../core/series/style-processor';
import type { IAreaStyleOptions } from '../../../marks/area/style';
import { createAreaStyle } from '../../../marks/area/style';
import { line } from '../line/line';
import { area } from './area';

/** A band from the line to its baseline, with an optional line along its edge, drawn on the 2D canvas (§6.7). */
export function areaStyle<TX>(options: IAreaStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createAreaStyle({ area, line }, options);
}
