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
  const render = createFxRender(kind);
  let accent: TAccentAlpha = buildAccentFn(readAccentRgb());
  let hovered = false;
  let animationTime = 0;

  return {
    /** Effects draw in backing-store pixels, so the context stays at identity. */
    onResize(): void {
      accent = buildAccentFn(readAccentRgb());
    },

    draw(frame: IAmbientCanvasFrame): void {
      const { ctx } = frame;
      if (ctx.canvas.width === 0 || ctx.canvas.height === 0) {
        return;
      }
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      // Hover changes the pace, not the phase: time is integrated so nothing jumps.
      const deltaTime = (frame.deltaMs / MS_PER_SECOND) * (hovered ? HOVERED_SPEED : IDLE_SPEED);
      animationTime += deltaTime;
      render({
        ctx,
        width: ctx.canvas.width,
        height: ctx.canvas.height,
        time: animationTime,
        deltaTime,
        accent,
        devicePixelRatio: frame.dpr,
      });
    },

    setHovered(next: boolean): void {
      hovered = next;
    },
  };
}
