import type { IStyleProcessor } from '../../../core/series/style-processor';
import { createStairsStyle } from '../../../marks/line/stairs-style';
import type { ILineStyleOptions } from '../../../marks/line/style';
import { line } from './line';

/** A line that holds each value until the next point, drawn on the 2D canvas (§6.7). */
export function stairsStyle<TX>(options: ILineStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createStairsStyle(line, options);
}
