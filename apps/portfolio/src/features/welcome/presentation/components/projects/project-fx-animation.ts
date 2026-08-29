import type {
  IAmbientCanvasAnimation,
  IAmbientCanvasFrame,
} from '../../../../../shared/hooks/useAmbientCanvas';
import { createFxRender } from './fx/effect-registry';
import type { TAccentAlpha, TProjectFxKind } from './fx/types';
import { buildAccentFn, readAccentRgb } from './fx/utils';

/**
 * Per-card project FX overlay — runs one of the `fx/effects/*` draw functions
 * over the card canvas. Pure animation logic; the React shell lives in
 * `ProjectFx.tsx`. The effect `kind` is fixed for the card's life (resolved
 * once), while `hovered` toggles the playback speed and is mirrored from React
 * via {@link IProjectFxAnimation.setHovered}.
 */

const HOVERED_SPEED = 1;
const IDLE_SPEED = 0.45;
const MS_PER_SECOND = 1000;

/**
 * Superset of {@link IAmbientCanvasAnimation} that also accepts the React
 * `hovered` prop, driving the idle/hovered playback speed. It is assignable to
 * `IAmbientCanvasAnimation` (it has `draw` + `onResize`), so the shell hands it
 * straight to `useAmbientCanvas`.
 */
export interface IProjectFxAnimation extends IAmbientCanvasAnimation {
  readonly setHovered: (hovered: boolean) => void;
}

export function createProjectFxAnimation(kind: TProjectFxKind): IProjectFxAnimation {
  // The effect instance owns its state bag (shapes drift, typing progression, …),
  // which persists across frames; the card never changes `kind`, so it never
  // needs resetting.
  const render = createFxRender(kind);
  let accent: TAccentAlpha = buildAccentFn(readAccentRgb());
  let hovered = false;

  return {
    onResize(): void {
      // The effects draw in backing-store pixels (manual `* dpr`), so the context
      // stays at identity. The accent was read every frame — cache it here instead.
      accent = buildAccentFn(readAccentRgb());
    },

    draw(frame: IAmbientCanvasFrame): void {
      const { ctx } = frame;
      if (ctx.canvas.width === 0 || ctx.canvas.height === 0) {
        return;
      }
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      render({
        ctx,
        width: ctx.canvas.width,
        height: ctx.canvas.height,
        time: frame.elapsedMs / MS_PER_SECOND,
        speed: hovered ? HOVERED_SPEED : IDLE_SPEED,
        accent,
        dpr: frame.dpr,
      });
    },

    setHovered(next: boolean): void {
      hovered = next;
    },
  };
}
