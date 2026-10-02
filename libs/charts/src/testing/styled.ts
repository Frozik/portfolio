import { darkTheme } from '../core/frame/dark-theme';
import { columnsOf } from '../core/series/columns';
import type { TRun } from '../core/series/point-run';
import { runOf } from '../core/series/point-run';
import type { TBatch } from '../core/series/shape';
import type { IStyle, IStyleProcessor } from '../core/series/style-processor';

/** A batch as the run a style processor is handed. */
export function runOfBatch<TX>(batch: TBatch<TX>): TRun<TX> {
  return runOf<TX>(columnsOf(batch), { id: 1, revision: 0, step: undefined });
}

/** What a style processor makes of a batch, under the default theme. */
export function styled<TX>(processor: IStyleProcessor<TX>, batch: TBatch<TX>): IStyle {
  return processor.style(runOfBatch(batch), { theme: darkTheme });
}
