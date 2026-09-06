import type { Vector2 } from '@frozik/utils/math/vector2';
import { makeAutoObservable, observableRef } from 'mobx';

import type { PlanModifiers } from '../domain/view/plan-input';
import { NO_MODIFIERS } from '../domain/view/plan-input';
import type { PlanLayerKind } from '../domain/view/plan-layers';
import { ALL_PLAN_LAYERS, togglePlanLayer } from '../domain/view/plan-layers';
import type { PlanViewport } from '../domain/view/plan-viewport';
import { createPlanViewport, DEFAULT_PIXELS_PER_METER } from '../domain/view/plan-viewport';

const PERCENT_SCALE = 100;

/**
 * How the plan is being looked at: the 2D viewport, the 3D camera's heading,
 * the layers drawn and the pointer's place over the canvas. A way of looking at
 * the plan rather than part of it, so none of it reaches the snapshot, storage
 * or the undo stack.
 */
export class ViewportModel {
  /**
   * Mirror of the render session's viewport. The session owns it; the model
   * publishes it so the overlays React draws over the canvas — the inline
   * elevation field — can follow a pan or a zoom.
   */
  viewport: PlanViewport = createPlanViewport(0, 0);
  /**
   * Mirror of the 3D camera's orbit angle, in degrees (`orbit-camera.ts`). The
   * camera owns it; the session publishes it on the frames the view moved, so
   * the compass React draws over the canvas can turn with the camera without a
   * render loop of its own.
   */
  cameraYawDegrees = 0;
  /** Which layers the plan is drawn with; the 3D view keeps its own contents. */
  visibleLayers: ReadonlySet<PlanLayerKind> = ALL_PLAN_LAYERS;
  /** Pointer position in plan metres, for the status-bar readout. */
  cursorPlanPoint: Vector2 | undefined = undefined;
  /**
   * Modifiers held at the last pointer move. The draft previews read them so
   * the segment on screen is the segment a click would commit — Shift locking
   * it square is only honest if the preview is locked too.
   */
  cursorModifiers: PlanModifiers = NO_MODIFIERS;

  constructor() {
    makeAutoObservable(
      this,
      { viewport: observableRef, visibleLayers: observableRef, cursorPlanPoint: observableRef },
      { autoBind: true }
    );
  }

  /** 100 % is the zoom a freshly opened plan starts at. */
  get zoomPercent(): number {
    return Math.round((this.viewport.pixelsPerMeter / DEFAULT_PIXELS_PER_METER) * PERCENT_SCALE);
  }

  setViewport(viewport: PlanViewport): void {
    this.viewport = viewport;
  }

  /** Brings a point of the plan to the middle of the view — «take me there». */
  centreOn(point: Vector2): void {
    this.viewport = { ...this.viewport, centerMeters: point };
  }

  setCameraYawDegrees(cameraYawDegrees: number): void {
    this.cameraYawDegrees = cameraYawDegrees;
  }

  toggleLayerVisibility(layer: PlanLayerKind): void {
    this.visibleLayers = togglePlanLayer(this.visibleLayers, layer);
  }

  setCursorPlanPoint(cursorPlanPoint: Vector2 | undefined): void {
    this.cursorPlanPoint = cursorPlanPoint;
  }

  setCursorModifiers(cursorModifiers: PlanModifiers): void {
    this.cursorModifiers = cursorModifiers;
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
