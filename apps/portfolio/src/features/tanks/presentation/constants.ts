/** Whole utility classes, not numbers — Tailwind resolves class names at build time (§12.2). */
export const TOUCH_ZONE_IDLE_FILL_CLASS = 'fill-white/8';
export const TOUCH_ZONE_ACTIVE_FILL_CLASS = 'fill-white/25';
export const TOUCH_ZONE_STROKE_CLASS = 'stroke-white/15';
export const TOUCH_GLYPH_OPACITY_CLASS = 'opacity-40';
export const TOUCH_SURFACE_IDLE_CLASS = 'bg-white/8';
export const TOUCH_SURFACE_ACTIVE_CLASS = 'bg-white/25';
export const TOUCH_ZONE_TRANSITION_CLASS = 'transition-[fill] duration-[80ms]';
export const TOUCH_SURFACE_TRANSITION_CLASS = 'transition-colors duration-[80ms]';

/** Side ≈ 38 % of the shorter viewport dimension for the D-pad, ≈ 24 % for fire (§12.2). */
export const TOUCH_DPAD_SIZE_CLASS = 'size-[clamp(120px,38vmin,200px)]';
export const TOUCH_FIRE_SIZE_CLASS = 'size-[clamp(88px,24vmin,144px)]';

export const TOUCH_ANCHOR_BOTTOM_CLASS = 'bottom-[calc(1rem+env(safe-area-inset-bottom))]';
export const TOUCH_ANCHOR_RIGHT_CLASS = 'right-[calc(1rem+env(safe-area-inset-right))]';
export const TOUCH_ANCHOR_LEFT_CLASS = 'left-[calc(1rem+env(safe-area-inset-left))]';

export const TOUCH_DPAD_VIEWBOX_SIZE = 100;

export const HUD_ICON_SIZE_PX = 14;

/** 16 ticks each way (§11.5); `duration-*` only drives transitions, hence the arbitrary property. */
export const STAGE_CURTAIN_DURATION_MS = 270;
const STAGE_CURTAIN_DURATION_CLASS = '[animation-duration:270ms] [animation-fill-mode:both]';

export const STAGE_CURTAIN_TOP_CLOSE_CLASS = `animate-slide-out-top [animation-direction:reverse] ${STAGE_CURTAIN_DURATION_CLASS}`;
export const STAGE_CURTAIN_BOTTOM_CLOSE_CLASS = `animate-slide-out-bottom [animation-direction:reverse] ${STAGE_CURTAIN_DURATION_CLASS}`;
export const STAGE_CURTAIN_TOP_OPEN_CLASS = `animate-slide-out-top ${STAGE_CURTAIN_DURATION_CLASS}`;
export const STAGE_CURTAIN_BOTTOM_OPEN_CLASS = `animate-slide-out-bottom ${STAGE_CURTAIN_DURATION_CLASS}`;

/** "GAME OVER" climbs the field at 1 wu per tick for 128 ticks (≈ 2.13 s) before it settles. */
export const GAME_OVER_RISE_ANIMATION_CLASS = 'animate-slide-in-bottom [animation-duration:2130ms]';
