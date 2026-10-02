import type { IChartExtension } from '../../../core/kernel/extension';
import { withPaint } from '../../../core/kernel/with-paint';
import type { IDebugBlocksSlice } from '../../../extensions/debug-blocks/core';
import { debugBlocksCore } from '../../../extensions/debug-blocks/core';
import { elementsPerSlot } from '../../texel-encoding';
import { debugBlocksOnWebGpu } from './contribution';

/** A yellow line where each chunk of the data texture begins, over the series (§7.1). */
export function debugBlocks<TX>(): IChartExtension<TX, 'debugBlocks', IDebugBlocksSlice<TX>> {
  return withPaint(debugBlocksCore<TX>({ blockSize: elementsPerSlot }), slice => [
    debugBlocksOnWebGpu(slice),
  ]);
}
