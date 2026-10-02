import type { IStyleProcessor } from '../../core/series/style-processor';
import { createStairsStyle } from '../../marks/line/stairs-style';
import type { ILineStyleOptions } from '../../marks/line/style';
import { line } from './marks';

/** A line that holds each value until the next point, on WebGPU where there is one and on the 2D canvas where there is not. */
export function stairsStyle<TX>(options: ILineStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createStairsStyle(line, options);
}
