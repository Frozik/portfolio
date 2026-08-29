/** Water swaps phase every 32 ticks — a full shimmer cycle is 64 (§11.5). */
export const ANIMATION_TICKS_PER_FRAME = 32;

/** Tracks advance by distance, not time — the original toggles frames per unit moved (§11.5). */
export const TRACK_ADVANCE_DISTANCE_WU = 1;

/** Seven 8-tick steps ping-pong the four star frames across the domain's spawn window (§11.5). */
export const SPAWN_TWINKLE_FRAME_TICKS = 8;

/** The shield ring alternates its two frames every other tick — a 4-tick period. */
export const SHIELD_FRAME_TICKS = 2;

/** A dropped power-up blinks 8 ticks on, 8 ticks off. */
export const POWER_UP_BLINK_TICKS = 8;

/** Power-up carriers toggle between their own palette and the flash one every 8 ticks. */
export const CARRIER_FLASH_TICKS = 8;

/** Bullet clangs are tank-sized; a tank or eagle going up is authored at 32 × 32 wu. */
export const SMALL_EXPLOSION_SIZE_WU = 16;
export const LARGE_EXPLOSION_SIZE_WU = 32;
/** A tile larger than the tank so the invulnerability ring surrounds the hull. */
export const SHIELD_SIZE_WU = 24;

export const MAX_ACTIVE_EFFECTS = 24;

/** A kill's reward flashes for 12 ticks; a bonus pickup's 500 lingers for 50 (§11.5). */
export const SCORE_POPUP_KILL_TICKS = 12;
export const SCORE_POPUP_PICKUP_TICKS = 50;
export const MAX_ACTIVE_SCORE_POPUPS = 6;
/** Numerals are drawn 3 × 5 wu with a one-unit gap, so a digit cell is four units wide. */
export const SCORE_POPUP_DIGIT_ADVANCE_WU = 4;

export const MAX_SPRITE_INSTANCES = 64;
export const MAX_OVERLAY_SPRITE_INSTANCES = 48;
