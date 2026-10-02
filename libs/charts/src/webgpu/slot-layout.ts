/** Texels in one slot: one chunk of a run lives in one slot (§6.4). */
export const SLOT_TEXELS = 256;
export const TEXTURE_WIDTH = 2048;
export const CHANNELS_PER_TEXEL = 4;
export const SLOTS_PER_ROW = TEXTURE_WIDTH / SLOT_TEXELS;
