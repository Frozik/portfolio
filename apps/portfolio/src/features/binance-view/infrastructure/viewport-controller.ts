import { clamp } from 'lodash-es';

import type { BlockSpatialIndex } from '../domain/block-store/block-spatial-index';
import type { IHeatmapBlockIndexItem } from '../domain/block-store/create-heatmap-block-index';
import {
  DEFAULT_PRICE_MAX,
  DEFAULT_PRICE_MIN,
  FPS_FOLLOW_DRIFT,
  FPS_INTERACTION,
  FUTURE_PADDING_MS,
  INITIAL_VISIBLE_LEVELS,
  MAX_VISIBLE_LEVELS,
  MIN_VISIBLE_LEVELS,
  PIXELS_PER_MILLISECOND,
  VIEW_LERP_SPEED,
  VIEW_SNAP_THRESHOLD_MS,
  ZOOM_LERP_SPEED,
  ZOOM_SNAP_THRESHOLD_LEVELS,
} from '../domain/constants';
import type { DataController } from '../domain/data-controller';
import { getMidPrice } from '../domain/get-mid-price';
import type { IMagnitudeRange } from '../domain/magnitude-range';
import { INITIAL_MAGNITUDE_RANGE, updateMagnitudeRange } from '../domain/magnitude-range';
import { lerp, plotWidthCssPx } from '../domain/math';
import type { IHeatmapViewport, IOrderbookSnapshot, UnixTimeMs } from '../domain/types';
import type { IViewportClampInput } from '../domain/viewport';
import {
  clampTargetEnd,
  createInitialViewport,
  engageFollow,
  stepViewport,
  viewTimeStartMs,
} from '../domain/viewport';
import type { TaskManager } from './task-manager';
import { ViewportInputController } from './viewport-input-controller';

const DEFAULT_MID_PRICE_INTERVAL_MS = 500;

export interface IViewportControllerParams {
  readonly canvas: HTMLCanvasElement;
  readonly taskManager: TaskManager;
  readonly pageOpenTimeMs: UnixTimeMs;
  readonly priceStep: number;
  readonly getRegistry: () => BlockSpatialIndex<IHeatmapBlockIndexItem>;
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

/**
 * Single owner of the heatmap viewport: time-pan, Y-zoom,
 * follow-mode, and inertia for all of the above.
 *
 * Input events are accumulated by {@link ViewportInputController} (no
 * viewport mutation inside handlers) — `tick()` drains the queue once
 * per RAF and applies everything through the same lerp pipeline. This
 * keeps the animation smooth regardless of whether the browser fires
 * pointermove at 60 or 240 Hz, and puts inertia (pan + zoom) in a
 * single place.
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
  private readonly getRegistry: () => BlockSpatialIndex<IHeatmapBlockIndexItem>;
  private readonly input: ViewportInputController;

  private readonly priceStep: number;
  private midPrice: number | undefined = undefined;
  private targetMidPrice: number | undefined = undefined;
  private lastDisplayMs: UnixTimeMs | undefined = undefined;
  private magnitudeRange: IMagnitudeRange | undefined = undefined;

  private visibleLevels = INITIAL_VISIBLE_LEVELS;
  private targetVisibleLevels = INITIAL_VISIBLE_LEVELS;

  private readonly midPriceUnsubscribe: (() => void) | undefined;
  private readonly midPriceSource: DataController | undefined;
  private midPriceToken = 0;
  /** Snapshot at the right edge, refreshed by the driver task rather than per frame. */
  private lastResolvedSnapshot: IOrderbookSnapshot | undefined = undefined;
  /**
   * Sticky "stay at the live edge" intent. Deriving follow mode from the
   * viewport geometry alone broke in background tabs: RAF stops stepping
   * while snapshots keep arriving, the gap outgrows the follow epsilon and
   * the chart woke up stuck in the past. Only an explicit backward pan
   * drops the pin; `tick` re-arms it once the user pushes to the right clamp.
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

    this.input = new ViewportInputController({
      canvas: this.canvas,
      taskManager: this.taskManager,
      viewport: this.viewport,
      onPanStart: this.handlePanStart,
    });
    this.input.attach();

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

  /** Run one animation step. Called from the renderer's RAF tick. */
  tick(): void {
    this.applyPendingZoom();
    this.updateVisibleLevelsLerp();
    this.updateViewportPriceBounds();

    const clampInput = this.buildClampInput();

    if (this.input.isPanning) {
      const pendingDeltaPx = this.input.consumePendingDeltaPx();
      if (pendingDeltaPx !== 0) {
        const deltaMs = -pendingDeltaPx / PIXELS_PER_MILLISECOND;
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

    stepViewport({
      viewport: this.viewport,
      input: clampInput,
      isInteracting: this.input.isPanning,
    });

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

    // In follow mode the chart slides under a stationary cursor, so the crosshair
    // labels need interaction FPS even without `pointermove`.
    if (this.input.getCursorCss() !== undefined) {
      this.taskManager.raise(FPS_INTERACTION);
    }
  }

  /** Advances the live edge, folds the flush into the magnitude range and re-engages follow mode. */
  onFlushArrived(params: {
    readonly lastDisplayMs: UnixTimeMs;
    readonly latestMagnitudeMin: number;
    readonly latestMagnitudeMax: number;
  }): boolean {
    this.lastDisplayMs = params.lastDisplayMs;
    this.magnitudeRange = updateMagnitudeRange(
      this.magnitudeRange,
      params.latestMagnitudeMin,
      params.latestMagnitudeMax
    );

    if (this.followPinned) {
      engageFollow(this.viewport, params.lastDisplayMs, this.buildClampInput());
      this.taskManager.raise(FPS_FOLLOW_DRIFT);
    }
    return this.followPinned;
  }

  /** The first call snaps the visible mid; later calls only move the target `tick()` lerps toward. */
  setTargetMidPrice(mid: number): void {
    this.targetMidPrice = mid;
    if (this.midPrice === undefined) {
      this.midPrice = mid;
    }
  }

  getMagnitudeRange(): IMagnitudeRange {
    return this.magnitudeRange ?? INITIAL_MAGNITUDE_RANGE;
  }

  viewTimeStartMsForPlotWidth(plotWidthPx: number): UnixTimeMs {
    return viewTimeStartMs(this.viewport, plotWidthPx);
  }

  dispose(): void {
    this.midPriceUnsubscribe?.();
    this.midPriceToken++;
    this.lastResolvedSnapshot = undefined;
    this.input.detach();
  }

  /**
   * Cursor position in CSS pixels relative to the canvas origin, or
   * `undefined` while the pointer is outside the canvas.
   */
  getCursorCss(): { readonly x: number; readonly y: number } | undefined {
    return this.input.getCursorCss();
  }

  /**
   * Suppress / resume crosshair cursor tracking. Toggled by the
   * presentation layer when a click-pinned popup opens / closes so
   * the crosshair doesn't follow a stationary mouse over other
   * trade buckets while the user is reading the pinned popup.
   */
  setCursorSuppressed(value: boolean): void {
    this.input.setCursorSuppressed(value);
  }

  /**
   * Latest snapshot resolved at the right edge of the viewport, or
   * `undefined` before the first driver tick completes. Consumed by
   * the axis overlay to render volume bars in the price panel.
   */
  getLastResolvedSnapshot(): IOrderbookSnapshot | undefined {
    return this.lastResolvedSnapshot;
  }

  /** Driver task: pulls the mid-price at the right edge; a token discards stale async reads. */
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

  /** A pan starts from where the user grabbed the chart and drops the follow pin. */
  private readonly handlePanStart = (): void => {
    this.viewport.targetViewTimeEndMs = this.viewport.viewTimeEndMs;
    this.followPinned = false;
  };

  private applyPendingZoom(): void {
    const pendingZoomFactor = this.input.consumePendingZoomFactor();
    if (pendingZoomFactor === 1) {
      return;
    }
    const next = this.targetVisibleLevels * pendingZoomFactor;
    this.targetVisibleLevels = clamp(next, MIN_VISIBLE_LEVELS, MAX_VISIBLE_LEVELS);
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
}
