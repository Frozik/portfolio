import { TEXELS_PER_CANDLE } from '../../domain/candle-encoding';
import {
  CANDLE_TEXTURE_ROWS,
  CANDLE_TEXTURE_WIDTH,
  CANDLES_PER_BLOCK,
} from '../../domain/constants';
import type { UnixTimeMs } from '../../domain/types';
import { BlockTextureSlotManager } from './block-texture-slot-manager';

const CANDLE_TEXTURE_FORMAT: GPUTextureFormat = 'rgba32float';
const CANDLE_TEXTURE_LABEL = 'candles.texture';

export const CANDLE_SLOT_WIDTH_TEXELS = CANDLES_PER_BLOCK * TEXELS_PER_CANDLE;
const CANDLE_SLOTS_PER_ROW = Math.floor(CANDLE_TEXTURE_WIDTH / CANDLE_SLOT_WIDTH_TEXELS);
const CANDLE_SLOT_COUNT = CANDLE_TEXTURE_ROWS * CANDLE_SLOTS_PER_ROW;

export interface ICreateCandleSlotManagerParams {
  readonly device: GPUDevice;
  readonly onEvict: (blockId: UnixTimeMs) => void;
}

/** Fixed-size LRU texture for candle blocks; evicted blocks come back from IndexedDB on demand. */
export function createCandleSlotManager(
  params: ICreateCandleSlotManagerParams
): BlockTextureSlotManager<UnixTimeMs> {
  return new BlockTextureSlotManager<UnixTimeMs>({
    device: params.device,
    format: CANDLE_TEXTURE_FORMAT,
    slotWidthTexels: CANDLE_SLOT_WIDTH_TEXELS,
    slotsPerRow: CANDLE_SLOTS_PER_ROW,
    initialSlotCount: CANDLE_SLOT_COUNT,
    maxSlotCount: CANDLE_SLOT_COUNT,
    growStep: CANDLE_SLOTS_PER_ROW,
    onEvict: params.onEvict,
    label: CANDLE_TEXTURE_LABEL,
  });
}
