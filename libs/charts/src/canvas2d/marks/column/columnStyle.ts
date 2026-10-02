import type { IStyleProcessor } from '../../../core/series/style-processor';
import type { IColumnStyleOptions } from '../../../marks/column/style';
import { createColumnStyle } from '../../../marks/column/style';
import { column } from './column';

/** A column per element from a baseline to its value, drawn on the 2D canvas (§6.7). */
export function columnStyle<TX>(options: IColumnStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createColumnStyle(column, options);
}
