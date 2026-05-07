import {
  MAX_MID_PRICE_BLOCKS,
  MID_PRICE_SAMPLES_PER_BLOCK,
  MID_PRICE_TEXTURE_INITIAL_ROWS,
  MID_PRICE_TEXTURE_MAX_ROWS,
  MID_PRICE_TEXTURE_WIDTH,
} from '../constants';
import type { UnixTimeMs } from '../types';
import { BlockTextureSlotManager } from './block-texture-slot-manager';

const MID_PRICE_TEXTURE_FORMAT: GPUTextureFormat = 'rgba32float';
const MID_PRICE_TEXTURE_LABEL = 'mid-price.texture';

const MID_PRICE_SLOTS_PER_ROW = Math.floor(MID_PRICE_TEXTURE_WIDTH / MID_PRICE_SAMPLES_PER_BLOCK);
const MID_PRICE_INITIAL_SLOT_COUNT = MID_PRICE_TEXTURE_INITIAL_ROWS * MID_PRICE_SLOTS_PER_ROW;
const MID_PRICE_MAX_SLOT_COUNT = Math.min(
  MID_PRICE_TEXTURE_MAX_ROWS * MID_PRICE_SLOTS_PER_ROW,
  MAX_MID_PRICE_BLOCKS
);
const MID_PRICE_GROW_STEP = MID_PRICE_SLOTS_PER_ROW;

export interface ICreateMidPriceSlotManagerParams {
  readonly device: GPUDevice;
  readonly onEvict: (blockId: UnixTimeMs) => void;
}

/**
 * Build the mid-price texture-slot manager. Pins the format-specific
 * preset (`rgba32float`, `MID_PRICE_SAMPLES_PER_BLOCK`-wide slots,
 * packed `MID_PRICE_SLOTS_PER_ROW` per row) so callers stay decoupled
 * from the underlying generic class' configuration surface.
 */
export function createMidPriceSlotManager(
  params: ICreateMidPriceSlotManagerParams
): BlockTextureSlotManager<UnixTimeMs> {
  return new BlockTextureSlotManager<UnixTimeMs>({
    device: params.device,
    format: MID_PRICE_TEXTURE_FORMAT,
    slotWidthTexels: MID_PRICE_SAMPLES_PER_BLOCK,
    slotsPerRow: MID_PRICE_SLOTS_PER_ROW,
    initialSlotCount: MID_PRICE_INITIAL_SLOT_COUNT,
    maxSlotCount: MID_PRICE_MAX_SLOT_COUNT,
    growStep: MID_PRICE_GROW_STEP,
    onEvict: params.onEvict,
    label: MID_PRICE_TEXTURE_LABEL,
  });
}
