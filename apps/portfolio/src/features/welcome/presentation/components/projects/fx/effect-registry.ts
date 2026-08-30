/**
 * Registry of the canvas effects behind project-card FX overlays.
 * Ported from `redesign/scripts/project-fx.js`. Each effect lives in its own
 * `./effects/*` module and receives the current draw context; stateful effects
 * additionally get their own typed state bag (shapes drift, typing
 * progression, …), created once per card by the factory below. Drawing
 * functions must not allocate per-frame when avoidable; all tuning numbers are
 * intentionally inline to preserve the visual fidelity of the ported design
 * reference.
 */

import { drawAR } from './effects/draw-ar';
import { drawArtillery } from './effects/draw-artillery';
import { drawContours } from './effects/draw-contours';
import { drawCrosshair } from './effects/draw-crosshair';
import { drawCursor } from './effects/draw-cursor';
import { drawFlare } from './effects/draw-flare';
import { drawNeural } from './effects/draw-neural';
import { drawPeers } from './effects/draw-peers';
import { drawRotate } from './effects/draw-rotate';
import { createShapesState, drawShapes } from './effects/draw-shapes';
import { drawTanks } from './effects/draw-tanks';
import { drawTicker } from './effects/draw-ticker';
import { createTypingState, drawTyping } from './effects/draw-typing';
import type { IFxDrawContext, TFxDraw, TFxEffectFactory, TFxRender, TProjectFxKind } from './types';

function createStatelessFxEffect(render: TFxRender): TFxEffectFactory {
  return () => render;
}

function createStatefulFxEffect<TState>(
  createState: () => TState,
  draw: TFxDraw<TState>
): TFxEffectFactory {
  return () => {
    const state = createState();
    return (context: IFxDrawContext) => draw(context, state);
  };
}

const FX_EFFECTS: Record<TProjectFxKind, TFxEffectFactory> = {
  neural: createStatelessFxEffect(drawNeural),
  flare: createStatelessFxEffect(drawFlare),
  shapes: createStatefulFxEffect(createShapesState, drawShapes),
  crosshair: createStatelessFxEffect(drawCrosshair),
  ticker: createStatelessFxEffect(drawTicker),
  cursor: createStatelessFxEffect(drawCursor),
  rotate: createStatelessFxEffect(drawRotate),
  peers: createStatelessFxEffect(drawPeers),
  typing: createStatefulFxEffect(createTypingState, drawTyping),
  ar: createStatelessFxEffect(drawAR),
  tanks: createStatelessFxEffect(drawTanks),
  artillery: createStatelessFxEffect(drawArtillery),
  contours: createStatelessFxEffect(drawContours),
};

export function createFxRender(kind: TProjectFxKind): TFxRender {
  return FX_EFFECTS[kind]();
}
