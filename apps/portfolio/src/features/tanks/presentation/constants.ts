import { JOYSTICK_REACH_RADIUS_PX } from './floating-joystick';

/** Whole utility classes, not numbers — Tailwind resolves class names at build time. */
export const TOUCH_ZONE_IDLE_FILL_CLASS = 'fill-white/8';
export const TOUCH_ZONE_ACTIVE_FILL_CLASS = 'fill-white/25';
export const TOUCH_ZONE_STROKE_CLASS = 'stroke-white/15';
export const TOUCH_GLYPH_OPACITY_CLASS = 'opacity-40';
export const TOUCH_GLYPH_ACTIVE_OPACITY_CLASS = 'opacity-90';
/** A control at rest only marks the side it lives on; it stands up wherever the finger lands. */
export const TOUCH_HINT_OPACITY_CLASS = 'opacity-50';
export const TOUCH_ZONE_TRANSITION_CLASS = 'transition-[fill] duration-[80ms]';

export const JOYSTICK_KNOB_RADIUS_PX = 16;
/**
 * Wider than a thumb, so what lights up shows around it. The stick's ring ends where the knob's
 * edge does; the thumb's travel stays shorter, because reversing costs that travel twice over.
 */
export const TOUCH_RING_RADIUS_PX = JOYSTICK_REACH_RADIUS_PX + JOYSTICK_KNOB_RADIUS_PX;
const TOUCH_GLYPH_STROKE_ALLOWANCE_PX = 2;
const TOUCH_GLYPH_HALF_SIZE_PX = TOUCH_RING_RADIUS_PX + TOUCH_GLYPH_STROKE_ALLOWANCE_PX;
/** One box for both controls: anchored by the same insets, their centres mirror each other. */
export const TOUCH_GLYPH_SIZE_PX = TOUCH_GLYPH_HALF_SIZE_PX * 2;
export const TOUCH_GLYPH_VIEWBOX = `${-TOUCH_GLYPH_HALF_SIZE_PX} ${-TOUCH_GLYPH_HALF_SIZE_PX} ${TOUCH_GLYPH_SIZE_PX} ${TOUCH_GLYPH_SIZE_PX}`;

export const TOUCH_ANCHOR_BOTTOM_CLASS = 'bottom-[calc(1rem+env(safe-area-inset-bottom))]';
export const TOUCH_ANCHOR_RIGHT_CLASS = 'right-[calc(1rem+env(safe-area-inset-right))]';
export const TOUCH_ANCHOR_LEFT_CLASS = 'left-[calc(1rem+env(safe-area-inset-left))]';

export const HUD_ICON_SIZE_PX = 14;

/** 16 ticks each way; `duration-*` only drives transitions, hence the arbitrary property. */
export const STAGE_CURTAIN_DURATION_MS = 270;
const STAGE_CURTAIN_DURATION_CLASS = '[animation-duration:270ms] [animation-fill-mode:both]';

export const STAGE_CURTAIN_TOP_CLOSE_CLASS = `animate-slide-out-top [animation-direction:reverse] ${STAGE_CURTAIN_DURATION_CLASS}`;
export const STAGE_CURTAIN_BOTTOM_CLOSE_CLASS = `animate-slide-out-bottom [animation-direction:reverse] ${STAGE_CURTAIN_DURATION_CLASS}`;
export const STAGE_CURTAIN_TOP_OPEN_CLASS = `animate-slide-out-top ${STAGE_CURTAIN_DURATION_CLASS}`;
export const STAGE_CURTAIN_BOTTOM_OPEN_CLASS = `animate-slide-out-bottom ${STAGE_CURTAIN_DURATION_CLASS}`;

/** "GAME OVER" climbs the field at 1 wu per tick for 128 ticks (≈ 2.13 s) before it settles. */
export const GAME_OVER_RISE_ANIMATION_CLASS = 'animate-slide-in-bottom [animation-duration:2130ms]';
