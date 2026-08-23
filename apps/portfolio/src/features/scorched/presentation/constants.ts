export const HUD_ICON_SIZE_PX = 16;
export const SHOP_ICON_SIZE_PX = 28;

/**
 * Touch-overlay opacities (§12.2), the same visual language as the tanks D-pad. They live here as
 * whole utility classes rather than raw numbers because Tailwind resolves them at build time — a
 * runtime number could never reach the generated stylesheet.
 */
export const TOUCH_SURFACE_IDLE_CLASS = 'bg-white/8';
export const TOUCH_SURFACE_ACTIVE_CLASS = 'bg-white/25';
export const TOUCH_GLYPH_OPACITY_CLASS = 'opacity-40';
export const TOUCH_SURFACE_TRANSITION_CLASS = 'transition-colors duration-[80ms]';

/** Both stepper columns and the fire button sit inside the safe-area insets. */
export const TOUCH_ANCHOR_BOTTOM_CLASS = 'bottom-[calc(1rem+env(safe-area-inset-bottom))]';
export const TOUCH_ANCHOR_RIGHT_CLASS = 'right-[calc(1rem+env(safe-area-inset-right))]';
export const TOUCH_ANCHOR_LEFT_CLASS = 'left-[calc(1rem+env(safe-area-inset-left))]';

/** [MANUAL §6] What an unlimited magazine — the free baby missile — counts down to. */
export const UNLIMITED_COUNT_LABEL = '∞';

export const TOUCH_STEPPER_SIZE_CLASS = 'size-[clamp(52px,13vmin,72px)]';
export const TOUCH_FIRE_SIZE_CLASS = 'size-[clamp(76px,20vmin,116px)]';

/** [§12.2] Press-and-hold on a stepper repeats like a text cursor. */
export const STEPPER_INITIAL_REPEAT_MS = 320;
export const STEPPER_REPEAT_INTERVAL_MS = 60;

/** [§13] Glass chrome shared by every full-screen overlay. */
export const OVERLAY_SURFACE_CLASS =
  'absolute inset-0 z-20 overflow-y-auto bg-black/70 backdrop-blur-md';
export const GLASS_PANEL_CLASS =
  'rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors duration-200';
