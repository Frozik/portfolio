import type { IStyleProcessor } from '../../../core/series/style-processor';
import { createStairsStyle } from '../../../marks/line/stairs-style';
import type { ILineStyleOptions } from '../../../marks/line/style';
import { line } from './line';

/** A stepped line, drawn on WebGPU (§5.3). */
export function stairsStyle<TX>(options: ILineStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createStairsStyle(line, options);
}
