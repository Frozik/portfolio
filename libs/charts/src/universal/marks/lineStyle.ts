import type { IStyleProcessor } from '../../core/series/style-processor';
import type { ILineStyleOptions } from '../../marks/line/style';
import { createLineStyle } from '../../marks/line/style';
import { line } from './marks';

/** A line through the elements, on WebGPU where there is one and on the 2D canvas where there is not. */
export function lineStyle<TX>(options: ILineStyleOptions<TX> = {}): IStyleProcessor<TX> {
  return createLineStyle(line, options);
}
