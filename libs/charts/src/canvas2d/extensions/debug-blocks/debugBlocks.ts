import type { IChartExtension } from '../../../core/kernel/extension';
import { withPaint } from '../../../core/kernel/with-paint';
import type { IDebugBlocksSlice } from '../../../extensions/debug-blocks/core';
import { debugBlocksCore } from '../../../extensions/debug-blocks/core';
import { debugBlocksOnCanvas } from './contribution';

/** A yellow line where each run of data begins: the 2D canvas cuts the data no finer. */
export function debugBlocks<TX>(): IChartExtension<TX, 'debugBlocks', IDebugBlocksSlice<TX>> {
  return withPaint(debugBlocksCore<TX>(), slice => [debugBlocksOnCanvas(slice)]);
}
