import type { IStyleProcessor } from '../../../core/series/style-processor';
import type { ILineStyleOptions } from '../../../marks/line/style';
import { createLineStyle } from '../../../marks/line/style';
import { line } from './line';

/** A line through the elements, drawn on the 2D canvas: for charts without WebGPU (§6.7). */
export function lineStyle<TX>(options: ILineStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createLineStyle(line, options);
}
