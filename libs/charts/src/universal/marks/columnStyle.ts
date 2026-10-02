import type { IStyleProcessor } from '../../core/series/style-processor';
import type { IColumnStyleOptions } from '../../marks/column/style';
import { createColumnStyle } from '../../marks/column/style';
import { column } from './marks';

/** A column per element from a baseline to its value, on WebGPU where there is one and on the 2D canvas where there is not. */
export function columnStyle<TX>(options: IColumnStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createColumnStyle(column, options);
}
