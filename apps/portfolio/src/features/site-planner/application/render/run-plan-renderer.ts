import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { reaction } from 'mobx';

import { computeMultiPolygonBounds } from '../../domain/geometry/bounding-box';
import type { AnalysisRaster } from '../../domain/terrain/analysis-raster';
import type { PlanViewport } from '../../domain/view/plan-viewport';
import { createPlanViewport, fitToBounds, resizeViewport } from '../../domain/view/plan-viewport';
import type { SitePlannerStore } from '../SitePlannerStore';
import { attachPlanNavigation } from './attach-plan-navigation';
import type { PlanContent, PlanEditorChrome, PlanLabels } from './plan-draw/draw-plan';
import { drawPlan } from './plan-draw/draw-plan';
import { createRasterImage } from './plan-images';
import { readPlanChrome, readPlanContent } from './read-plan-content';

/** A 3x phone would otherwise triple the fill cost of a full-canvas repaint. */
const MAX_DEVICE_PIXEL_RATIO = 2;
/** Breathing room around the plot when the session first frames it. */
const FIT_PADDING_PX = 48;

export interface PlanRendererSession {
  getViewport(): PlanViewport;
  setViewport(viewport: PlanViewport): void;
  requestRedraw(): void;
  dispose(): void;
}

/** Everything a frame draws, read from the store in one reactive pass. */
interface PlanFrame {
  readonly content: PlanContent;
  readonly chrome: PlanEditorChrome;
}

/**
 * The 2D plan render session: owns the canvas, the viewport and the redraw
 * schedule. Store data reaches it through a single `reaction`, which snapshots
 * the frame and coalesces every change into one animation frame — nothing is
 * read from the store while painting.
 */
export function runPlanRenderer({
  canvas,
  store,
  labels,
}: {
  readonly canvas: HTMLCanvasElement;
  readonly store: SitePlannerStore;
  readonly labels: PlanLabels;
}): PlanRendererSession {
  const ctx = canvas.getContext('2d');

  assert(!isNil(ctx), 'The site plan canvas has no 2D context');

  let viewport = createPlanViewport(canvas.clientWidth, canvas.clientHeight);
  let frame: PlanFrame | undefined;
  let frameRequestId: number | undefined;
  let hasFramedBoundary = false;

  /**
   * The decoded backdrop, kept for as long as the plan points at the same data
   * URL. Decoding is asynchronous and the bitmap owns memory, so the session —
   * not the drawing step — holds it and closes it.
   */

  /**
   * The active analysis as a canvas the frame can stretch over the plan, kept
   * for as long as the store hands out the same raster. Painting the pixels is
   * done once per analysis rather than once per frame — a pan or a zoom only
   * ever re-stretches what is already drawn.
   */
  let overlayImage: OffscreenCanvas | undefined;
  let overlayRaster: AnalysisRaster | undefined;

  const paint = (): void => {
    frameRequestId = undefined;

    if (isNil(frame)) {
      return;
    }

    drawPlan(ctx, viewport, {
      content: frame.content,
      chrome: frame.chrome,
      images: { overlayImage },
      labels,
    });
  };

  const requestRedraw = (): void => {
    if (isNil(frameRequestId)) {
      frameRequestId = requestAnimationFrame(paint);
    }
  };

  /** Redraws the overlay canvas whenever the store hands out a different raster. */
  const syncOverlayImage = (raster: AnalysisRaster | undefined): void => {
    if (raster === overlayRaster) {
      return;
    }

    overlayRaster = raster;
    overlayImage = isNil(raster) ? undefined : createRasterImage(raster);
  };

  const cancelPendingRedraw = (): void => {
    if (!isNil(frameRequestId)) {
      cancelAnimationFrame(frameRequestId);
      frameRequestId = undefined;
    }
  };

  /**
   * The viewport lives here; the store keeps a mirror of it so the status bar
   * and the overlays drawn over the canvas can follow a pan or a zoom.
   */
  const publishViewport = (): void => store.view.setViewport(viewport);

  const frameBoundaryOnce = (): void => {
    if (hasFramedBoundary || isNil(frame) || viewport.widthPx <= 0 || viewport.heightPx <= 0) {
      return;
    }

    const bounds = computeMultiPolygonBounds(frame.content.boundaryPolygons);

    if (isNil(bounds)) {
      return;
    }

    viewport = fitToBounds(viewport, bounds, FIT_PADDING_PX);
    hasFramedBoundary = true;
    publishViewport();
  };

  const applySize = (force: boolean): void => {
    const nextRatio = Math.min(MAX_DEVICE_PIXEL_RATIO, window.devicePixelRatio || 1);
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const backingWidth = Math.round(cssWidth * nextRatio);
    const backingHeight = Math.round(cssHeight * nextRatio);
    const hasBackingChanged = backingWidth !== canvas.width || backingHeight !== canvas.height;

    // Assigning width/height clears the backing store even when the value does
    // not change, so no-op resizes are skipped. The first call must still run
    // (`force`): React strict-mode re-runs the effect over an already-sized
    // canvas, and an early return would leave the viewport at 0 x 0 forever.
    if (!hasBackingChanged && !force) {
      return;
    }

    if (hasBackingChanged) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }

    // The assignment above resets the 2D context state, so the scale that lets
    // every drawing module work in CSS pixels has to be re-applied here.
    ctx.setTransform(nextRatio, 0, 0, nextRatio, 0, 0);
    viewport = resizeViewport(viewport, cssWidth, cssHeight);
    frameBoundaryOnce();
    publishViewport();

    if (!hasBackingChanged) {
      requestRedraw();

      return;
    }

    // The backing store was just cleared, and ResizeObserver runs before paint:
    // repainting synchronously keeps a continuous resize from flashing blank on
    // every frame, which scheduling into the next animation frame would.
    cancelPendingRedraw();
    paint();
  };

  // reaction, not autorun: the effect runs untracked, so publishing the
  // viewport mirror back into the store is a legal action from here.
  const stopWatchingStore = reaction(
    () => ({ content: readPlanContent(store), chrome: readPlanChrome(store) }),
    nextFrame => {
      frame = nextFrame;
      syncOverlayImage(frame.content.analysisRaster);
      frameBoundaryOnce();
      requestRedraw();
    },
    { fireImmediately: true }
  );

  applySize(true);

  const resizeObserver = new ResizeObserver(() => applySize(false));

  resizeObserver.observe(canvas);

  // A ratio change alone (window dragged to another monitor, browser zoom) never
  // resizes the element, so ResizeObserver would leave the canvas blurry.
  let ratioQuery: MediaQueryList | undefined;

  function handleRatioChange(): void {
    applySize(false);
    watchRatio();
  }

  function watchRatio(): void {
    ratioQuery?.removeEventListener('change', handleRatioChange);
    ratioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    ratioQuery.addEventListener('change', handleRatioChange);
  }

  watchRatio();

  const setViewport = (next: PlanViewport): void => {
    viewport = next;
    publishViewport();
    requestRedraw();
  };

  const detachNavigation = attachPlanNavigation({
    canvas,
    getViewport: () => viewport,
    setViewport,
  });

  return {
    getViewport: () => viewport,
    setViewport,
    requestRedraw,
    dispose: () => {
      detachNavigation();
      stopWatchingStore();
      resizeObserver.disconnect();
      ratioQuery?.removeEventListener('change', handleRatioChange);
      cancelPendingRedraw();
      overlayImage = undefined;
      overlayRaster = undefined;
    },
  };
}
