import { debugBlocksOnCanvas } from '../../canvas2d/extensions/debug-blocks/contribution';
import type { IChartExtension } from '../../core/kernel/extension';
import { withPaint } from '../../core/kernel/with-paint';
import type { IDebugBlocksSlice } from '../../extensions/debug-blocks/core';
import { debugBlocksCore } from '../../extensions/debug-blocks/core';
import { debugBlocksOnWebGpu } from '../../webgpu/extensions/debug-blocks/contribution';
import { elementsPerSlot } from '../../webgpu/texel-encoding';

/**
 * A yellow line where each chunk of the data texture begins. The 2D canvas
 * has no chunks; there the lines stand where WebGPU would have cut (§7.1).
 */
export function debugBlocks<TX>(): IChartExtension<TX, 'debugBlocks', IDebugBlocksSlice<TX>> {
  return withPaint(debugBlocksCore<TX>({ blockSize: elementsPerSlot }), slice => [
    debugBlocksOnWebGpu(slice),
    debugBlocksOnCanvas(slice),
  ]);
}
