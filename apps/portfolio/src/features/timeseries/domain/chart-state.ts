import { assert } from '@frozik/utils';
import { isNil } from 'lodash-es';

import { renderAxes } from './chart-axes';
import { ChartInputController } from './chart-input';
import {
  FLOATS_PER_POINT,
  FULL_YEAR_SECONDS,
  GLOBAL_EPOCH_OFFSET,
  SERIES_2_VALUE_OFFSET,
  TEXTURE_INITIAL_ROWS,
  TEXTURE_MAX_ROWS,
  TEXTURE_WIDTH,
  UNIFORM_BUFFER_SIZE,
  ZOOM_LERP_SPEED,
  ZOOM_SNAP_THRESHOLD,
} from './constants';
import { generateTimeseriesData } from './data-generator';
import { encodePoints } from './delta-encoding';
import { createSpatialIndex, insertPart, queryVisibleParts } from './spatial-index';
import type { IChartViewport, IDataPart, IDrawCommands, ITimeseriesChart } from './types';
import { autoScaleY, scaleFromTimeRange, visibleYRange } from './viewport';

const INITIAL_VALUE_MIN = 0;
const INITIAL_VALUE_MAX = 200;
const MIN_POINTS_FOR_LINES = 2;

export class TimeseriesChartState implements ITimeseriesChart {
  readonly targetCanvas: HTMLCanvasElement;
  readonly target2dContext: CanvasRenderingContext2D;
  readonly svgContainer: SVGSVGElement;

  private readonly viewport: IChartViewport;
  private readonly dataMinTime: number;
  private readonly dataMaxTime: number;

  private readonly spatialIndex1 = createSpatialIndex();
  private readonly spatialIndex2 = createSpatialIndex();
  private nextTextureRow = 0;

  private readonly uniformBuf1: GPUBuffer;
  private readonly uniformBuf2: GPUBuffer;
  private textureRows: number;
  private dataTexture: GPUTexture;
  private bindGroup1: GPUBindGroup;
  private bindGroup2: GPUBindGroup;

  private readonly inputController: ChartInputController;
  private readonly resizeObserver: ResizeObserver;

  private canvasWidth = 0;
  private canvasHeight = 0;

  constructor(
    private readonly device: GPUDevice,
    private readonly bindGroupLayout: GPUBindGroupLayout,
    targetCanvas: HTMLCanvasElement,
    svgContainer: SVGSVGElement,
    initialTimeStart: number,
    initialTimeEnd: number
  ) {
    this.targetCanvas = targetCanvas;
    this.svgContainer = svgContainer;

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

    // Create per-chart GPU resources
    this.uniformBuf1 = device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.uniformBuf2 = device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.textureRows = TEXTURE_INITIAL_ROWS;
    this.dataTexture = device.createTexture({
      size: [TEXTURE_WIDTH, this.textureRows],
      format: 'rgba32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });

    this.bindGroup1 = this.createBindGroup(this.uniformBuf1);
    this.bindGroup2 = this.createBindGroup(this.uniformBuf2);

    this.inputController = new ChartInputController(
      this.viewport,
      targetCanvas,
      this.dataMinTime,
      this.dataMaxTime
    );
    this.inputController.attach();

    this.updateCanvasSize();

    this.resizeObserver = new ResizeObserver(() => {
      this.updateCanvasSize();
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

    if (Math.abs(dStart) > ZOOM_SNAP_THRESHOLD || Math.abs(dEnd) > ZOOM_SNAP_THRESHOLD) {
      this.viewport.viewTimeStart += dStart * ZOOM_LERP_SPEED;
      this.viewport.viewTimeEnd += dEnd * ZOOM_LERP_SPEED;
    } else {
      this.viewport.viewTimeStart = this.viewport.targetTimeStart;
      this.viewport.viewTimeEnd = this.viewport.targetTimeEnd;
    }
  }

  prepareDrawCommands(): IDrawCommands | null {
    const parts = this.ensureDataForViewport();

    if (
      isNil(parts) ||
      parts.line.pointCount < MIN_POINTS_FOR_LINES ||
      parts.rhombus.pointCount < MIN_POINTS_FOR_LINES
    ) {
      return null;
    }

    this.writeUniforms(parts.line, this.uniformBuf1);
    this.writeUniforms(parts.rhombus, this.uniformBuf2);

    return {
      lineBindGroup: this.bindGroup1,
      lineInstanceCount: parts.line.pointCount - 1,
      candlestickBindGroup: this.bindGroup2,
      candlestickInstanceCount: parts.rhombus.pointCount - 1,
    };
  }

  renderOverlay(): void {
    renderAxes(
      this.svgContainer,
      this.viewport,
      this.targetCanvas.clientWidth,
      this.targetCanvas.clientHeight
    );
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.inputController.detach();
    this.dataTexture.destroy();
    this.uniformBuf1.destroy();
    this.uniformBuf2.destroy();
  }

  private createBindGroup(uniformBuffer: GPUBuffer): GPUBindGroup {
    const view = this.dataTexture.createView();
    return this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: view },
      ],
    });
  }

  private rebuildBindGroups(): void {
    this.bindGroup1 = this.createBindGroup(this.uniformBuf1);
    this.bindGroup2 = this.createBindGroup(this.uniformBuf2);
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

    this.rebuildBindGroups();

    return true;
  }

  private ensureSeriesData(
    index: ReturnType<typeof createSpatialIndex>,
    valueOffset: number
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
    const points = generateTimeseriesData(genStart, genEnd, scale);

    if (points.length === 0) {
      return null;
    }

    if (valueOffset !== 0) {
      for (const p of points) {
        p.value += valueOffset;
      }
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
    const linePart = this.ensureSeriesData(this.spatialIndex1, 0);
    const rhombusPart = this.ensureSeriesData(this.spatialIndex2, SERIES_2_VALUE_OFFSET);

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

  private writeUniforms(part: IDataPart, buf: GPUBuffer): void {
    const data = new ArrayBuffer(UNIFORM_BUFFER_SIZE);
    const f32 = new Float32Array(data);
    const u32 = new Uint32Array(data);

    // viewport
    f32[0] = this.canvasWidth;
    f32[1] = this.canvasHeight;

    // time/value ranges (as deltas from base)
    f32[2] = this.viewport.viewTimeStart - part.baseTime;
    f32[3] = this.viewport.viewTimeEnd - part.baseTime;
    f32[4] = this.viewport.viewValueMin - part.baseValue;
    f32[5] = this.viewport.viewValueMax - part.baseValue;

    // pointCount
    u32[6] = part.pointCount;

    // textureWidth
    u32[7] = TEXTURE_WIDTH;

    // lineWidth carries DPR scale factor
    f32[8] = Math.max(1, window.devicePixelRatio);

    // textureRow
    u32[9] = part.textureRowStart;

    // baseTime, baseValue
    f32[10] = part.baseTime;
    f32[11] = part.baseValue;

    this.device.queue.writeBuffer(buf, 0, data);
  }

  private updateCanvasSize(): void {
    const dpr = Math.max(1, window.devicePixelRatio);
    const w = Math.floor(this.targetCanvas.clientWidth * dpr);
    const h = Math.floor(this.targetCanvas.clientHeight * dpr);

    if (this.targetCanvas.width !== w || this.targetCanvas.height !== h) {
      this.targetCanvas.width = w;
      this.targetCanvas.height = h;
    }

    this.canvasWidth = w;
    this.canvasHeight = h;
  }
}
