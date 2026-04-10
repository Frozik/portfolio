import { assert } from '@frozik/utils';
import { isNil } from 'lodash-es';

import { renderAxes, renderGrid } from './chart-axes';
import { ChartInputController } from './chart-input';
import {
  AXIS_MARGIN_BOTTOM,
  AXIS_MARGIN_LEFT,
  AXIS_MARGIN_RIGHT,
  AXIS_MARGIN_TOP,
  FLOATS_PER_POINT,
  FULL_YEAR_SECONDS,
  GLOBAL_EPOCH_OFFSET,
  TEXTURE_INITIAL_ROWS,
  TEXTURE_MAX_ROWS,
  TEXTURE_WIDTH,
  VERTICES_PER_CANDLESTICK,
  VERTICES_PER_SEGMENT,
  ZOOM_LERP_SPEED,
  ZOOM_SNAP_THRESHOLD,
} from './constants';
import { generateTimeseriesData } from './data-generator';
import { encodePoints } from './delta-encoding';
import { EFpsLevel, FpsController } from './fps-controller';
import { SeriesLayer } from './layers/series-layer';
import { SeriesLayerManager } from './layers/series-layer-manager';
import { createSpatialIndex, insertPart, queryVisibleParts } from './spatial-index';
import type { IChartViewport, IDataPart, IPlotArea, ITimeseriesChart } from './types';
import { autoScaleY, scaleFromTimeRange, visibleYRange } from './viewport';

const INITIAL_VALUE_MIN = 0;
const INITIAL_VALUE_MAX = 200;
const MIN_POINTS_FOR_LINES = 2;

export class TimeseriesChartState implements ITimeseriesChart {
  readonly targetCanvas: HTMLCanvasElement;
  readonly target2dContext: CanvasRenderingContext2D;
  readonly gridSvg: SVGSVGElement;
  readonly axesSvg: SVGSVGElement;
  readonly seriesManager: SeriesLayerManager;
  readonly fpsController: FpsController;

  private readonly viewport: IChartViewport;
  private readonly dataMinTime: number;
  private readonly dataMaxTime: number;

  private readonly spatialIndex1 = createSpatialIndex();
  private readonly spatialIndex2 = createSpatialIndex();
  private nextTextureRow = 0;

  private textureRows: number;
  private dataTexture: GPUTexture;

  private readonly inputController: ChartInputController;
  private readonly resizeObserver: ResizeObserver;
  private readonly device: GPUDevice;
  private readonly seed: string;

  private canvasWidth = 0;
  private canvasHeight = 0;

  // Memoization: skip SVG re-render when viewport + size unchanged
  private lastOverlayTimeStart = Number.NaN;
  private lastOverlayTimeEnd = Number.NaN;
  private lastOverlayValueMin = Number.NaN;
  private lastOverlayValueMax = Number.NaN;
  private lastOverlayWidth = 0;
  private lastOverlayHeight = 0;

  constructor(
    device: GPUDevice,
    bindGroupLayout: GPUBindGroupLayout,
    linePipeline: GPURenderPipeline,
    candlestickPipeline: GPURenderPipeline,
    targetCanvas: HTMLCanvasElement,
    gridSvg: SVGSVGElement,
    axesSvg: SVGSVGElement,
    initialTimeStart: number,
    initialTimeEnd: number,
    seed: string
  ) {
    this.device = device;
    this.seed = seed;
    this.targetCanvas = targetCanvas;
    this.gridSvg = gridSvg;
    this.axesSvg = axesSvg;

    const ctx = targetCanvas.getContext('2d');
    assert(!isNil(ctx), 'Failed to get 2D canvas context');
    this.target2dContext = ctx;

    this.dataMinTime = GLOBAL_EPOCH_OFFSET;
    this.dataMaxTime = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS;

    this.viewport = {
      viewTimeStart: initialTimeStart,
      viewTimeEnd: initialTimeEnd,
      targetTimeStart: initialTimeStart,
      targetTimeEnd: initialTimeEnd,
      viewValueMin: INITIAL_VALUE_MIN,
      viewValueMax: INITIAL_VALUE_MAX,
    };

    // Create per-chart data texture
    this.textureRows = TEXTURE_INITIAL_ROWS;
    this.dataTexture = device.createTexture({
      size: [TEXTURE_WIDTH, this.textureRows],
      format: 'rgba32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });

    // Initialize per-chart series layers
    const lineLayer = new SeriesLayer(VERTICES_PER_SEGMENT);
    const candlestickLayer = new SeriesLayer(VERTICES_PER_CANDLESTICK);

    this.seriesManager = new SeriesLayerManager();
    this.seriesManager.addSeries(lineLayer, linePipeline, 'line');
    this.seriesManager.addSeries(candlestickLayer, candlestickPipeline, 'rhombus');
    this.seriesManager.initAll(device, bindGroupLayout);
    this.seriesManager.updateBindGroups(this.dataTexture.createView());

    this.fpsController = new FpsController();

    this.inputController = new ChartInputController(
      this.viewport,
      targetCanvas,
      this.dataMinTime,
      this.dataMaxTime,
      this.fpsController
    );
    this.inputController.attach();

    this.updateCanvasSize();

    this.resizeObserver = new ResizeObserver(() => {
      this.updateCanvasSize();
      this.fpsController.raise(EFpsLevel.Resize);
      this.renderOverlay();
    });
    this.resizeObserver.observe(targetCanvas);
  }

  get width(): number {
    return this.canvasWidth;
  }

  get height(): number {
    return this.canvasHeight;
  }

  update(): void {
    this.updateCanvasSize();

    // Animate zoom: lerp current viewport toward target
    const dStart = this.viewport.targetTimeStart - this.viewport.viewTimeStart;
    const dEnd = this.viewport.targetTimeEnd - this.viewport.viewTimeEnd;
    const currentRange = this.viewport.viewTimeEnd - this.viewport.viewTimeStart;
    const threshold = currentRange * ZOOM_SNAP_THRESHOLD;

    if (Math.abs(dStart) > threshold || Math.abs(dEnd) > threshold) {
      this.viewport.viewTimeStart += dStart * ZOOM_LERP_SPEED;
      this.viewport.viewTimeEnd += dEnd * ZOOM_LERP_SPEED;
      this.fpsController.raise(EFpsLevel.ZoomAnimation);
    } else {
      this.viewport.viewTimeStart = this.viewport.targetTimeStart;
      this.viewport.viewTimeEnd = this.viewport.targetTimeEnd;
    }
  }

  prepareDrawCommands(): IPlotArea | null {
    const parts = this.ensureDataForViewport();

    if (
      isNil(parts) ||
      parts.line.pointCount < MIN_POINTS_FOR_LINES ||
      parts.rhombus.pointCount < MIN_POINTS_FOR_LINES
    ) {
      return null;
    }

    this.seriesManager.writeAllUniforms(
      parts,
      this.canvasWidth,
      this.canvasHeight,
      this.viewport.viewTimeStart,
      this.viewport.viewTimeEnd,
      this.viewport.viewValueMin,
      this.viewport.viewValueMax
    );

    const dpr = Math.max(1, window.devicePixelRatio);
    const plotX = Math.floor(AXIS_MARGIN_LEFT * dpr);
    const plotY = Math.floor(AXIS_MARGIN_TOP * dpr);
    const plotWidth = Math.max(
      0,
      this.canvasWidth - Math.floor((AXIS_MARGIN_LEFT + AXIS_MARGIN_RIGHT) * dpr)
    );
    const plotHeight = Math.max(
      0,
      this.canvasHeight - Math.floor((AXIS_MARGIN_TOP + AXIS_MARGIN_BOTTOM) * dpr)
    );

    return { x: plotX, y: plotY, width: plotWidth, height: plotHeight };
  }

  renderOverlay(): void {
    const w = this.targetCanvas.clientWidth;
    const h = this.targetCanvas.clientHeight;
    const { viewTimeStart, viewTimeEnd, viewValueMin, viewValueMax } = this.viewport;

    if (
      viewTimeStart === this.lastOverlayTimeStart &&
      viewTimeEnd === this.lastOverlayTimeEnd &&
      viewValueMin === this.lastOverlayValueMin &&
      viewValueMax === this.lastOverlayValueMax &&
      w === this.lastOverlayWidth &&
      h === this.lastOverlayHeight
    ) {
      return;
    }

    this.lastOverlayTimeStart = viewTimeStart;
    this.lastOverlayTimeEnd = viewTimeEnd;
    this.lastOverlayValueMin = viewValueMin;
    this.lastOverlayValueMax = viewValueMax;
    this.lastOverlayWidth = w;
    this.lastOverlayHeight = h;

    renderGrid(this.gridSvg, this.viewport, w, h);
    renderAxes(this.axesSvg, this.viewport, w, h);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.inputController.detach();
    this.fpsController.dispose();
    this.seriesManager.dispose();
    this.dataTexture.destroy();
  }

  private rebuildLayerBindGroups(): void {
    this.seriesManager.updateBindGroups(this.dataTexture.createView());
  }

  private growTextureIfNeeded(requiredRows: number): boolean {
    if (requiredRows <= this.textureRows) {
      return true;
    }

    let newRows = this.textureRows;
    while (newRows < requiredRows) {
      newRows *= 2;
    }
    newRows = Math.min(newRows, TEXTURE_MAX_ROWS);

    if (requiredRows > newRows) {
      return false;
    }

    const newTexture = this.device.createTexture({
      size: [TEXTURE_WIDTH, newRows],
      format: 'rgba32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });

    const encoder = this.device.createCommandEncoder();
    encoder.copyTextureToTexture(
      { texture: this.dataTexture, origin: [0, 0, 0] },
      { texture: newTexture, origin: [0, 0, 0] },
      [TEXTURE_WIDTH, this.nextTextureRow, 1]
    );
    this.device.queue.submit([encoder.finish()]);

    this.dataTexture.destroy();
    this.dataTexture = newTexture;
    this.textureRows = newRows;

    this.rebuildLayerBindGroups();

    return true;
  }

  private ensureSeriesData(
    index: ReturnType<typeof createSpatialIndex>,
    seriesSeed: string
  ): IDataPart | null {
    const scale = scaleFromTimeRange(this.viewport.viewTimeStart, this.viewport.viewTimeEnd);
    const existing = queryVisibleParts(
      index,
      scale,
      this.viewport.viewTimeStart,
      this.viewport.viewTimeEnd
    );

    const covering = existing.find(
      item =>
        item.part.timeStart <= this.viewport.viewTimeStart &&
        item.part.timeEnd >= this.viewport.viewTimeEnd
    );

    if (covering !== undefined) {
      return covering.part;
    }

    const viewDuration = this.viewport.viewTimeEnd - this.viewport.viewTimeStart;
    const genStart = Math.max(this.dataMinTime, this.viewport.viewTimeStart - viewDuration);
    const genEnd = Math.min(this.dataMaxTime, this.viewport.viewTimeEnd + viewDuration);
    const points = generateTimeseriesData(genStart, genEnd, scale, seriesSeed);

    if (points.length === 0) {
      return null;
    }

    const baseTime = points[0].time;
    const baseValue = points[0].value;
    const encoded = encodePoints(points, baseTime, baseValue);

    const rowStart = this.nextTextureRow;
    const rowsNeeded = Math.ceil(points.length / TEXTURE_WIDTH);

    if (!this.growTextureIfNeeded(rowStart + rowsNeeded)) {
      return null;
    }

    for (let row = 0; row < rowsNeeded; row++) {
      const pointsInRow = Math.min(TEXTURE_WIDTH, points.length - row * TEXTURE_WIDTH);
      const srcOffset = row * TEXTURE_WIDTH * FLOATS_PER_POINT;
      const rowData = encoded.subarray(srcOffset, srcOffset + pointsInRow * FLOATS_PER_POINT);

      this.device.queue.writeTexture(
        { texture: this.dataTexture, origin: [0, rowStart + row, 0] },
        rowData,
        {
          bytesPerRow: TEXTURE_WIDTH * FLOATS_PER_POINT * Float32Array.BYTES_PER_ELEMENT,
          rowsPerImage: 1,
        },
        [pointsInRow, 1, 1]
      );
    }

    const pointTimes = new Float64Array(points.length);
    const pointValues = new Float64Array(points.length);
    let minVal = Number.POSITIVE_INFINITY;
    let maxVal = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < points.length; i++) {
      pointTimes[i] = points[i].time;
      pointValues[i] = points[i].value;
      if (points[i].value < minVal) {
        minVal = points[i].value;
      }
      if (points[i].value > maxVal) {
        maxVal = points[i].value;
      }
    }

    const part: IDataPart = {
      scale,
      timeStart: genStart,
      timeEnd: genEnd,
      baseTime,
      baseValue,
      textureRowStart: rowStart,
      pointCount: points.length,
      valueMin: minVal,
      valueMax: maxVal,
      pointTimes,
      pointValues,
    };

    insertPart(index, part);
    this.nextTextureRow += rowsNeeded;

    return part;
  }

  private ensureDataForViewport(): { line: IDataPart; rhombus: IDataPart } | null {
    const linePart = this.ensureSeriesData(this.spatialIndex1, this.seed);
    const rhombusPart = this.ensureSeriesData(this.spatialIndex2, `${this.seed}-series-2`);

    if (isNil(linePart) || isNil(rhombusPart)) {
      return null;
    }

    const range1 = visibleYRange(
      linePart.pointTimes,
      linePart.pointValues,
      this.viewport.viewTimeStart,
      this.viewport.viewTimeEnd
    );
    const range2 = visibleYRange(
      rhombusPart.pointTimes,
      rhombusPart.pointValues,
      this.viewport.viewTimeStart,
      this.viewport.viewTimeEnd
    );

    let globalMin = Number.POSITIVE_INFINITY;
    let globalMax = Number.NEGATIVE_INFINITY;

    if (range1 !== undefined) {
      globalMin = Math.min(globalMin, range1[0]);
      globalMax = Math.max(globalMax, range1[1]);
    }
    if (range2 !== undefined) {
      globalMin = Math.min(globalMin, range2[0]);
      globalMax = Math.max(globalMax, range2[1]);
    }

    if (globalMin < globalMax) {
      const [yMin, yMax] = autoScaleY(globalMin, globalMax);
      this.viewport.viewValueMin = yMin;
      this.viewport.viewValueMax = yMax;
    }

    return { line: linePart, rhombus: rhombusPart };
  }

  /** Sync canvas pixel dimensions to CSS size. Returns true if canvas was resized. */
  syncCanvasSize(): boolean {
    const dpr = Math.max(1, window.devicePixelRatio);
    const width = Math.floor(this.targetCanvas.clientWidth * dpr);
    const height = Math.floor(this.targetCanvas.clientHeight * dpr);

    this.canvasWidth = width;
    this.canvasHeight = height;

    if (this.targetCanvas.width !== width || this.targetCanvas.height !== height) {
      this.targetCanvas.width = width;
      this.targetCanvas.height = height;
      return true;
    }

    return false;
  }

  private updateCanvasSize(): void {
    const dpr = Math.max(1, window.devicePixelRatio);
    const newWidth = Math.floor(this.targetCanvas.clientWidth * dpr);
    const newHeight = Math.floor(this.targetCanvas.clientHeight * dpr);

    const oldWidth = this.canvasWidth;

    this.canvasWidth = newWidth;
    this.canvasHeight = newHeight;

    // Spring effect on time axis: adjust current viewport so data appears at the
    // same pixel positions as before the resize. The existing zoom lerp will
    // animate from this "stretched" viewport to the correct target.
    if (oldWidth > 0 && newWidth !== oldWidth) {
      const timeRange = this.viewport.viewTimeEnd - this.viewport.viewTimeStart;
      const springTimeRange = timeRange * (newWidth / oldWidth);
      const timeCenter = (this.viewport.viewTimeStart + this.viewport.viewTimeEnd) / 2;

      this.viewport.viewTimeStart = timeCenter - springTimeRange / 2;
      this.viewport.viewTimeEnd = timeCenter + springTimeRange / 2;
    }
  }
}
