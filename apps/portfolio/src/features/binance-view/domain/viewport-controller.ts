import { clamp } from 'lodash-es';
import type { BlockRegistry } from './block-registry';
import {
  DEFAULT_PRICE_MAX,
  DEFAULT_PRICE_MIN,
  FPS_FOLLOW_DRIFT,
  FPS_INTERACTION,
  FUTURE_PADDING_MS,
  INITIAL_VISIBLE_LEVELS,
  MAGNITUDE_EMA_ALPHA,
  MAX_VISIBLE_LEVELS,
  MIN_VISIBLE_LEVELS,
  PIXELS_PER_MILLISECOND,
  VIEW_LERP_SPEED,
  VIEW_SNAP_THRESHOLD_MS,
  WHEEL_ZOOM_STEP,
  ZOOM_LERP_SPEED,
  ZOOM_SNAP_THRESHOLD_LEVELS,
} from './constants';
import type { DataController } from './data-controller';
import { getMidPrice } from './get-mid-price';

import { lerp, plotWidthCssPx } from './math';
import type { TaskManager } from './task-manager';
import type { IHeatmapViewport, IOrderbookSnapshot, UnixTimeMs } from './types';
import type { IViewportClampInput } from './viewport';
import {
  clampTargetEnd,
  createInitialViewport,
  engageFollow,
  isFollowing,
  stepViewport,
  viewTimeStartMs,
} from './viewport';

const DEFAULT_MID_PRICE_INTERVAL_MS = 500;

const MIN_DRAG_DISTANCE_PX = 2;

export interface IViewportControllerParams {
  readonly canvas: HTMLCanvasElement;
  readonly taskManager: TaskManager;
  readonly pageOpenTimeMs: UnixTimeMs;
  readonly priceStep: number;
  readonly getRegistry: () => BlockRegistry;
  /**
   * Optional snapshot source for auto-centering the Y axis on the
   * rightmost visible snapshot. When supplied, the controller
   * subscribes a periodic task that pulls the mid-price at
   * `viewport.viewTimeEndMs` and drives `setTargetMidPrice`. When
   * absent (e.g. in unit tests), the caller is expected to command
   * `setTargetMidPrice` manually.
   */
  readonly dataController?: DataController;
  readonly midPriceIntervalMs?: number;
}

interface IActivePointer {
  readonly id: number;
  clientX: number;
}

/**
 * Single owner of the heatmap viewport: time-pan, Y-zoom,
 * follow-mode, and inertia for all of the above.
 *
 * Input events are only accumulated here (no viewport mutation inside
 * handlers) — `tick()` drains the queue once per RAF and applies
 * everything through the same lerp pipeline. This keeps the animation
 * smooth regardless of whether the browser fires pointermove at 60 or
 * 240 Hz, and puts inertia (pan + zoom) in a single place.
 *
 * Y-axis layout is derived, not measured: `priceMin/Max = midPrice ±
 * (visibleLevels / 2) × priceStep`. The target mid-price is pushed in
 * from the outside via {@link setTargetMidPrice} (owned by
 * {@link PositionController}); the controller only lerps the visible
 * mid toward that target. Wheel and 2-finger pinch mutate
 * `targetVisibleLevels`; `tick()` lerps the effective `visibleLevels`
 * toward it.
 */
export class ViewportController {
  readonly viewport: IHeatmapViewport;

  private readonly canvas: HTMLCanvasElement;
  private readonly taskManager: TaskManager;
  private readonly pageOpenTimeMs: UnixTimeMs;
  private readonly getRegistry: () => BlockRegistry;

  private priceStep: number;
  private midPrice: number | undefined = undefined;
  private targetMidPrice: number | undefined = undefined;
  private lastDisplayMs: UnixTimeMs | undefined = undefined;
  private magnitudeMin = 0;
  private magnitudeMax = 1;
  private magnitudeInitialized = false;

  private visibleLevels = INITIAL_VISIBLE_LEVELS;
  private targetVisibleLevels = INITIAL_VISIBLE_LEVELS;
  private pendingZoomFactor = 1;

  private pointers: IActivePointer[] = [];
  private lastPointerX = 0;
  private pendingDragDistance = 0;
  private pendingDeltaPx = 0;
  private isActuallyPanning = false;
  private pinchInitialDistance: number | undefined = undefined;
  /**
   * Latest cursor position in CSS pixels relative to the canvas origin,
   * or `undefined` when the pointer is outside. Consumed by the
   * crosshair overlay in `axis-draw.ts` via {@link getCursorCss}.
   */
  private cursorCssPosition: { x: number; y: number } | undefined = undefined;

  private readonly midPriceUnsubscribe: (() => void) | undefined;
  private readonly midPriceSource: DataController | undefined;
  private midPriceToken = 0;
  /**
   * Latest snapshot the 2 Hz driver has resolved for
   * `viewport.viewTimeEndMs`. The Y-axis volume-bars overlay reads it
   * every frame to render per-level bid/ask volumes in the right-hand
   * price panel. Kept here instead of re-fetching per frame so we
   * don't spam `DataController.resolveSnapshotAt` / IDB; the 500 ms
   * cadence of the driver matches snapshot arrival from the stream.
   */
  private lastResolvedSnapshot: IOrderbookSnapshot | undefined = undefined;
  /**
   * Sticky "stay at the live edge" intent. Follow-mode used to be
   * derived purely from `isFollowing(viewport)` — which breaks when
   * the tab sits in the background: RAF is throttled so the viewport
   * stops stepping, but snapshots keep arriving through the WebSocket
   * and `lastDisplayMs` keeps advancing. After ~1 s the gap exceeds
   * `FOLLOW_EPSILON_MS`, `isFollowing` flips to `false`, `engageFollow`
   * stops firing, and when the tab wakes up the chart is stuck in
   * the past forever.
   *
   * The pinned flag records the *intent* separately from the
   * instantaneous geometry: once a user has scrolled all the way to
   * the live edge (or on initial load, when there is no history to
   * look at), we treat them as "wanting to track live data" and keep
   * jumping `targetViewTimeEndMs` to the newest flush. The only way
   * to drop the pin is an explicit pan backward — the pan handler
   * sets `followPinned = false`; the `tick` loop then re-engages it
   * the moment the user pans forward past the follow epsilon again.
   */
  private followPinned = true;

  constructor(params: IViewportControllerParams) {
    this.canvas = params.canvas;
    this.taskManager = params.taskManager;
    this.pageOpenTimeMs = params.pageOpenTimeMs;
    this.getRegistry = params.getRegistry;
    this.priceStep = params.priceStep;
    this.viewport = createInitialViewport(params.pageOpenTimeMs);
    this.viewport.priceMin = DEFAULT_PRICE_MIN;
    this.viewport.priceMax = DEFAULT_PRICE_MAX;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleWheel = this.handleWheel.bind(this);

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerLeave);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });

    if (params.dataController !== undefined) {
      this.midPriceSource = params.dataController;
      this.midPriceUnsubscribe = this.taskManager.subscribe(this.refreshTargetMidPrice, {
        minIntervalMs: params.midPriceIntervalMs ?? DEFAULT_MID_PRICE_INTERVAL_MS,
      });
    } else {
      this.midPriceSource = undefined;
      this.midPriceUnsubscribe = undefined;
    }
  }

  get isPanning(): boolean {
    return this.pointers.length === 1 && this.isActuallyPanning;
  }

  get isZooming(): boolean {
    return this.pointers.length >= 2;
  }

  get isFollowing(): boolean {
    return isFollowing(this.viewport, this.lastDisplayMs);
  }

  /** Run one animation step. Called from the renderer's RAF tick. */
  tick(): void {
    this.applyPendingZoom();
    this.updateVisibleLevelsLerp();
    this.updateViewportPriceBounds();

    const clampInput = this.buildClampInput();

    if (this.isPanning) {
      if (this.pendingDeltaPx !== 0) {
        const deltaMs = -this.pendingDeltaPx / PIXELS_PER_MILLISECOND;
        this.pendingDeltaPx = 0;
        this.viewport.targetViewTimeEndMs = clampTargetEnd(
          (this.viewport.targetViewTimeEndMs + deltaMs) as UnixTimeMs,
          clampInput
        );
        this.viewport.panVelocityMsPerFrame = deltaMs;
      } else {
        this.viewport.panVelocityMsPerFrame = 0;
      }
    }

    this.viewport.targetViewTimeEndMs = clampTargetEnd(
      this.viewport.targetViewTimeEndMs,
      clampInput
    );

    stepViewport({ viewport: this.viewport, input: clampInput, isInteracting: this.isPanning });

    // Re-arm follow-pin only when the user actually pushed the target
    // all the way to the right clamp — i.e. scrolled past the live
    // edge (or threw the chart that way with inertia). Using "target
    // is near live" as the trigger (`isFollowing`) was wrong: a tiny
    // backward pan that stops inside `FOLLOW_EPSILON_MS` would leave
    // the viewport close to the edge, then tick would re-pin on the
    // next frame, and the next flush would yank it forward again —
    // the exact "jumps forward, flag won't clear" behaviour.
    if (!this.followPinned && this.lastDisplayMs !== undefined) {
      const rightClamp = this.lastDisplayMs + FUTURE_PADDING_MS;
      if (this.viewport.targetViewTimeEndMs >= rightClamp - VIEW_SNAP_THRESHOLD_MS) {
        this.followPinned = true;
      }
    }

    if (
      Math.abs(this.viewport.viewTimeEndMs - this.viewport.targetViewTimeEndMs) >
      VIEW_SNAP_THRESHOLD_MS
    ) {
      this.taskManager.raise(FPS_FOLLOW_DRIFT);
    }

    // While the cursor is tracked, keep the renderer at interaction
    // FPS so the crosshair time / price labels update every frame.
    // In follow mode the chart slides under a stationary cursor —
    // `pointermove` never fires, so without this raise the RAF loop
    // would drop to idle FPS and the time readout under the cursor
    // would stutter behind the actual data position.
    if (this.cursorCssPosition !== undefined) {
      this.taskManager.raise(FPS_INTERACTION);
    }
  }

  /**
   * Called on every flush: advances `lastDisplayMs`, engages follow
   * if the viewport was at the live edge, and updates the magnitude
   * EMA used for heatmap color normalization. Mid-price is NOT set
   * here — {@link PositionController} drives it via
   * {@link setTargetMidPrice}, decoupling Y-axis centering from flush
   * cadence.
   */
  onFlushArrived(params: {
    readonly lastDisplayMs: UnixTimeMs;
    readonly latestMagnitudeMin: number;
    readonly latestMagnitudeMax: number;
  }): boolean {
    this.lastDisplayMs = params.lastDisplayMs;
    // Empty flushes (both magnitude bounds are 0 → no live levels in
    // the snapshot) mean the quantizer is filling a disconnect gap.
    // Skip magnitude updates so colors don't drift toward zero while
    // the chart keeps advancing.
    const isEmptyFlush = params.latestMagnitudeMin === 0 && params.latestMagnitudeMax === 0;
    if (!isEmptyFlush) {
      if (!this.magnitudeInitialized) {
        this.magnitudeMin = params.latestMagnitudeMin;
        this.magnitudeMax = params.latestMagnitudeMax;
        this.magnitudeInitialized = true;
      } else {
        this.magnitudeMin = lerp(this.magnitudeMin, params.latestMagnitudeMin, MAGNITUDE_EMA_ALPHA);
        this.magnitudeMax = lerp(this.magnitudeMax, params.latestMagnitudeMax, MAGNITUDE_EMA_ALPHA);
      }
    }

    // Use the sticky `followPinned` flag rather than the instantaneous
    // `isFollowing(viewport)` check: the latter lies while the tab is
    // backgrounded (RAF is throttled → `viewTimeEndMs` doesn't step →
    // the gap to `lastDisplayMs` outgrows `FOLLOW_EPSILON_MS` within
    // a second). Using the pinned intent survives arbitrarily long
    // periods of RAF starvation and immediately snaps the chart back
    // to live data on re-activation.
    if (this.followPinned) {
      engageFollow(this.viewport, params.lastDisplayMs, this.buildClampInput());
      this.taskManager.raise(FPS_FOLLOW_DRIFT);
    }
    return this.followPinned;
  }

  /**
   * Whether the viewport is currently pinned to the live edge. The
   * flag reflects user intent — `true` after page load, the
   * auto-follow re-engagement in `tick`, or a pan that brought the
   * view back inside the follow epsilon; `false` only after an
   * explicit backward pan. Consumed by overlays that want to show a
   * "jump to live" affordance when the chart is not tracking.
   */
  isFollowPinned(): boolean {
    return this.followPinned;
  }

  /**
   * Command the Y-axis to lerp toward `mid`. Called by the
   * {@link PositionController} — the first call snaps the visible mid
   * to avoid gliding away from the default, subsequent calls only
   * update the target and let `tick()` animate the transition.
   */
  setTargetMidPrice(mid: number): void {
    this.targetMidPrice = mid;
    if (this.midPrice === undefined) {
      this.midPrice = mid;
    }
  }

  getMagnitudeMin(): number {
    return this.magnitudeMin;
  }

  getMagnitudeMax(): number {
    return this.magnitudeMax;
  }

  setPriceStep(priceStep: number): void {
    this.priceStep = priceStep;
  }

  viewTimeStartMsForPlotWidth(plotWidthPx: number): UnixTimeMs {
    return viewTimeStartMs(this.viewport, plotWidthPx);
  }

  getLastDisplayMs(): UnixTimeMs | undefined {
    return this.lastDisplayMs;
  }

  getVisibleLevels(): number {
    return this.visibleLevels;
  }

  dispose(): void {
    this.midPriceUnsubscribe?.();
    this.midPriceToken++;
    this.lastResolvedSnapshot = undefined;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerLeave);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }

  /**
   * Cursor position in CSS pixels relative to the canvas origin, or
   * `undefined` while the pointer is outside the canvas. Used by the
   * crosshair overlay in `axis-draw.ts` — intentionally a snapshot read
   * (no MobX observable) since the renderer pulls it every frame anyway.
   */
  getCursorCss(): { readonly x: number; readonly y: number } | undefined {
    return this.cursorCssPosition;
  }

  /**
   * Periodic task body (driven by the shared TaskManager): pull the
   * mid-price at the right edge of the visible window from the data
   * controller and lerp the Y axis toward it. A monotonic token
   * discards stale async results so a slower IDB read can't overwrite
   * a fresher on-screen mid.
   */
  private readonly refreshTargetMidPrice = (): void => {
    const source = this.midPriceSource;
    if (source === undefined) {
      return;
    }
    const viewTimeEndMs = this.viewport.viewTimeEndMs as UnixTimeMs;
    const token = ++this.midPriceToken;
    void source.resolveSnapshotAt(viewTimeEndMs).then(snapshot => {
      if (token !== this.midPriceToken || snapshot === undefined) {
        return;
      }
      this.lastResolvedSnapshot = snapshot;
      const mid = getMidPrice(snapshot);
      if (mid === undefined) {
        return;
      }
      this.setTargetMidPrice(mid);
    });
  };

  /**
   * Latest snapshot resolved at the right edge of the viewport, or
   * `undefined` before the first driver tick completes. Consumed by
   * the axis overlay to render volume bars in the price panel.
   */
  getLastResolvedSnapshot(): IOrderbookSnapshot | undefined {
    return this.lastResolvedSnapshot;
  }

  private applyPendingZoom(): void {
    if (this.pendingZoomFactor === 1) {
      return;
    }
    const next = this.targetVisibleLevels * this.pendingZoomFactor;
    this.targetVisibleLevels = clamp(next, MIN_VISIBLE_LEVELS, MAX_VISIBLE_LEVELS);
    this.pendingZoomFactor = 1;
    this.taskManager.raise(FPS_INTERACTION);
  }

  private updateVisibleLevelsLerp(): void {
    const delta = this.targetVisibleLevels - this.visibleLevels;
    if (Math.abs(delta) < ZOOM_SNAP_THRESHOLD_LEVELS) {
      this.visibleLevels = this.targetVisibleLevels;
      return;
    }
    this.visibleLevels = lerp(this.visibleLevels, this.targetVisibleLevels, ZOOM_LERP_SPEED);
    this.taskManager.raise(FPS_FOLLOW_DRIFT);
  }

  private updateViewportPriceBounds(): void {
    if (this.midPrice === undefined) {
      return;
    }
    if (this.targetMidPrice !== undefined) {
      // Snap thresold = half a tick, so the lerp doesn't crawl forever
      // at sub-tick magnitudes (matches the viewTimeEnd lerp behaviour).
      const snapEpsilon = this.priceStep / 2;
      const delta = this.targetMidPrice - this.midPrice;
      if (Math.abs(delta) < snapEpsilon) {
        this.midPrice = this.targetMidPrice;
      } else {
        this.midPrice = lerp(this.midPrice, this.targetMidPrice, VIEW_LERP_SPEED);
        this.taskManager.raise(FPS_FOLLOW_DRIFT);
      }
    }
    const halfSpan = (this.visibleLevels / 2) * this.priceStep;
    this.viewport.priceMin = this.midPrice - halfSpan;
    this.viewport.priceMax = this.midPrice + halfSpan;
  }

  private buildClampInput(): IViewportClampInput {
    return {
      plotWidthCssPx: plotWidthCssPx(Math.max(1, this.canvas.clientWidth)),
      pageOpenTimeMs: this.pageOpenTimeMs,
      oldestBlockStartMs: this.getRegistry().oldestStartMs(),
      lastDisplaySnapshotTimeMs: this.lastDisplayMs,
    };
  }

  private handlePointerDown(event: PointerEvent): void {
    if (this.pointers.length >= 2) {
      return;
    }
    this.pointers.push({ id: event.pointerId, clientX: event.clientX });
    this.canvas.setPointerCapture(event.pointerId);

    if (this.pointers.length === 1) {
      this.lastPointerX = event.clientX;
      this.pendingDragDistance = 0;
      this.pendingDeltaPx = 0;
      this.isActuallyPanning = false;
    } else {
      // Second pointer: transition into pinch; cancel any pending pan inertia.
      this.isActuallyPanning = false;
      this.pendingDeltaPx = 0;
      this.viewport.panVelocityMsPerFrame = 0;
      this.pinchInitialDistance = this.distanceBetweenPointers();
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    // Track cursor for every move, not just drags — the crosshair
    // overlay (and any future hover affordance) needs the position
    // regardless of whether a button is held. Raising the FPS on each
    // move keeps the crosshair glide-smooth; it auto-decays back to
    // idle once the cursor stops.
    const canvasRect = this.canvas.getBoundingClientRect();
    this.cursorCssPosition = {
      x: event.clientX - canvasRect.left,
      y: event.clientY - canvasRect.top,
    };
    this.taskManager.raise(FPS_INTERACTION);

    const pointer = this.pointers.find(candidate => candidate.id === event.pointerId);
    if (pointer === undefined) {
      return;
    }
    pointer.clientX = event.clientX;

    if (this.pointers.length >= 2) {
      this.accumulatePinchZoom();
      return;
    }

    const deltaPx = event.clientX - this.lastPointerX;
    this.lastPointerX = event.clientX;

    this.pendingDragDistance += Math.abs(deltaPx);
    if (!this.isActuallyPanning && this.pendingDragDistance >= MIN_DRAG_DISTANCE_PX) {
      this.isActuallyPanning = true;
      // Break follow-mode: pin target to the current view and drop
      // the sticky follow intent. `tick` will re-arm the pin when the
      // user pans forward enough that the viewport sits inside the
      // follow epsilon again.
      this.viewport.targetViewTimeEndMs = this.viewport.viewTimeEndMs;
      this.followPinned = false;
    }

    if (this.isActuallyPanning) {
      this.pendingDeltaPx += deltaPx;
    }
  }

  private handlePointerLeave(event: PointerEvent): void {
    this.cursorCssPosition = undefined;
    this.handlePointerUp(event);
  }

  private handlePointerUp(event: PointerEvent): void {
    const beforeCount = this.pointers.length;
    this.pointers = this.pointers.filter(candidate => candidate.id !== event.pointerId);
    this.canvas.releasePointerCapture?.(event.pointerId);

    if (beforeCount >= 2 && this.pointers.length < 2) {
      this.pinchInitialDistance = undefined;
      // After pinch release, a lingering pointer shouldn't immediately
      // start panning — reset drag state so the user has to pass the
      // distance threshold again.
      this.pendingDragDistance = 0;
      if (this.pointers.length === 1) {
        this.lastPointerX = this.pointers[0].clientX;
      }
    }

    if (this.pointers.length === 0) {
      if (this.isActuallyPanning) {
        this.taskManager.raise(FPS_FOLLOW_DRIFT);
      }
      this.isActuallyPanning = false;
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const direction = normalizeWheelDirection(event);
    if (direction === 0) {
      return;
    }
    const factor = direction > 0 ? 1 + WHEEL_ZOOM_STEP : 1 / (1 + WHEEL_ZOOM_STEP);
    this.pendingZoomFactor *= factor;
  }

  private accumulatePinchZoom(): void {
    if (this.pointers.length < 2 || this.pinchInitialDistance === undefined) {
      return;
    }
    const currentDistance = this.distanceBetweenPointers();
    if (currentDistance === 0 || this.pinchInitialDistance === 0) {
      return;
    }
    const ratio = this.pinchInitialDistance / currentDistance;
    if (Math.abs(ratio - 1) < 1e-4) {
      return;
    }
    this.pendingZoomFactor *= ratio;
    this.pinchInitialDistance = currentDistance;
  }

  private distanceBetweenPointers(): number {
    if (this.pointers.length < 2) {
      return 0;
    }
    return Math.abs(this.pointers[0].clientX - this.pointers[1].clientX);
  }
}

function normalizeWheelDirection(event: WheelEvent): number {
  if (event.deltaY === 0) {
    return 0;
  }
  return Math.sign(event.deltaY);
}
