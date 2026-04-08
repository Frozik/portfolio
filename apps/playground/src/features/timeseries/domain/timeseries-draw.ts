import { assert } from '@frozik/utils';
import { isNil } from 'lodash-es';

import { computeXTicks, computeYTicks } from './axis-ticks';
import {
  AXIS_FONT_FAMILY,
  AXIS_FONT_SIZE,
  AXIS_LABEL_COLOR,
  AXIS_LINE_COLOR,
  AXIS_MARGIN_BOTTOM,
  AXIS_MARGIN_LEFT,
  AXIS_MARGIN_RIGHT,
  AXIS_MARGIN_TOP,
  FLOATS_PER_POINT,
  FULL_YEAR_SECONDS,
  GLOBAL_EPOCH_OFFSET,
  GRID_LINE_COLOR,
  MSAA_SAMPLE_COUNT,
  SERIES_2_VALUE_OFFSET,
  SVG_NS,
  TEXTURE_MAX_ROWS,
  TEXTURE_WIDTH,
  TICK_LENGTH,
  UNIFORM_BUFFER_SIZE,
  VERTICES_PER_RHOMBUS,
  VERTICES_PER_SEGMENT,
  ZOOM_FACTOR_MAX,
  ZOOM_FACTOR_MIN,
} from './constants';
import { generateTimeseriesData } from './data-generator';
import { encodePoints } from './delta-encoding';
import timeseriesShaderSource from './shaders/timeseries.wgsl?raw';
import { createSpatialIndex, insertPart, queryVisibleParts } from './spatial-index';
import type { IDataPart } from './types';
import {
  autoScaleY,
  clampViewport,
  panViewport,
  scaleFromTimeRange,
  visibleYRange,
  zoomViewport,
} from './viewport';

export function runTimeseries(
  canvas: HTMLCanvasElement,
  svgContainer: SVGSVGElement
): VoidFunction {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  void initTimeseries(canvas, svgContainer).then(cleanup => {
    if (destroyed) {
      cleanup();
    } else {
      gpuCleanup = cleanup;
    }
  });

  return () => {
    destroyed = true;
    gpuCleanup?.();
  };
}

async function initTimeseries(
  canvas: HTMLCanvasElement,
  svgContainer: SVGSVGElement
): Promise<VoidFunction> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');
  const device = await adapter.requestDevice();

  const maybeCtx = canvas.getContext('webgpu');
  assert(!isNil(maybeCtx), 'Failed to get WebGPU canvas context');
  const ctx: GPUCanvasContext = maybeCtx;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });

  // Create shader module
  const shaderModule = device.createShaderModule({ code: timeseriesShaderSource });

  // Bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        texture: { sampleType: 'unfilterable-float', viewDimension: '2d' },
      },
    ],
  });

  const alphaBlend: GPUBlendState = {
    color: {
      srcFactor: 'src-alpha',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
  };

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

  // Line pipeline
  const linePipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: shaderModule, entryPoint: 'vs' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs',
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  // Rhombus pipeline
  const rhombusPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: shaderModule, entryPoint: 'vsRhombus' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fsRhombus',
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  // Uniform buffers — one per series (different texture row / base offsets)
  const uniformBuf1 = device.createBuffer({
    size: UNIFORM_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const uniformBuf2 = device.createBuffer({
    size: UNIFORM_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Data texture (rgba32float)
  const dataTexture = device.createTexture({
    size: [TEXTURE_WIDTH, TEXTURE_MAX_ROWS],
    format: 'rgba32float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  const dataTextureView = dataTexture.createView();

  // Bind groups — one per series
  const bindGroup1 = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuf1 } },
      { binding: 1, resource: dataTextureView },
    ],
  });
  const bindGroup2 = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuf2 } },
      { binding: 1, resource: dataTextureView },
    ],
  });

  // MSAA texture
  let msaaTexture: GPUTexture | null = null;
  let msaaView: GPUTextureView | null = null;

  // Spatial indexes for data parts (one per series)
  const spatialIndex1 = createSpatialIndex();
  const spatialIndex2 = createSpatialIndex();
  let nextTextureRow = 0;

  // Viewport state
  const dataMinTime = GLOBAL_EPOCH_OFFSET;
  const dataMaxTime = GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS;
  let viewTimeStart = dataMinTime;
  let viewTimeEnd = dataMaxTime;
  let viewValueMin = 0;
  let viewValueMax = 200;

  let canvasWidth = 0;
  let canvasHeight = 0;

  /** Load or find data for a series in the given spatial index. valueOffset shifts the generated values. */
  function ensureSeriesData(
    index: ReturnType<typeof createSpatialIndex>,
    valueOffset: number
  ): IDataPart | null {
    const scale = scaleFromTimeRange(viewTimeStart, viewTimeEnd);
    const existing = queryVisibleParts(index, scale, viewTimeStart, viewTimeEnd);

    const covering = existing.find(
      item => item.part.timeStart <= viewTimeStart && item.part.timeEnd >= viewTimeEnd
    );

    if (covering !== undefined) {
      return covering.part;
    }

    const viewDuration = viewTimeEnd - viewTimeStart;
    const genStart = Math.max(dataMinTime, viewTimeStart - viewDuration);
    const genEnd = Math.min(dataMaxTime, viewTimeEnd + viewDuration);
    const points = generateTimeseriesData(genStart, genEnd, scale);

    if (points.length === 0) {
      return null;
    }

    // Apply value offset for second series
    if (valueOffset !== 0) {
      for (const p of points) {
        p.value += valueOffset;
      }
    }

    const baseTime = points[0].time;
    const baseValue = points[0].value;
    const encoded = encodePoints(points, baseTime, baseValue);

    const rowStart = nextTextureRow;
    const rowsNeeded = Math.ceil(points.length / TEXTURE_WIDTH);

    if (rowStart + rowsNeeded > TEXTURE_MAX_ROWS) {
      return null;
    }

    for (let row = 0; row < rowsNeeded; row++) {
      const pointsInRow = Math.min(TEXTURE_WIDTH, points.length - row * TEXTURE_WIDTH);
      const srcOffset = row * TEXTURE_WIDTH * FLOATS_PER_POINT;
      const rowData = encoded.subarray(srcOffset, srcOffset + pointsInRow * FLOATS_PER_POINT);

      device.queue.writeTexture(
        { texture: dataTexture, origin: [0, rowStart + row, 0] },
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
    nextTextureRow += rowsNeeded;

    return part;
  }

  /** Load both series and compute combined Y auto-scale. */
  function ensureDataForViewport(): { line: IDataPart; rhombus: IDataPart } | null {
    const linePart = ensureSeriesData(spatialIndex1, 0);
    const rhombusPart = ensureSeriesData(spatialIndex2, SERIES_2_VALUE_OFFSET);

    if (isNil(linePart) || isNil(rhombusPart)) {
      return null;
    }

    // Combined Y auto-scale from visible portions of both series
    const range1 = visibleYRange(
      linePart.pointTimes,
      linePart.pointValues,
      viewTimeStart,
      viewTimeEnd
    );
    const range2 = visibleYRange(
      rhombusPart.pointTimes,
      rhombusPart.pointValues,
      viewTimeStart,
      viewTimeEnd
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
      viewValueMin = yMin;
      viewValueMax = yMax;
    }

    return { line: linePart, rhombus: rhombusPart };
  }

  function updateCanvasSize(): void {
    const dpr = Math.max(1, window.devicePixelRatio);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    canvasWidth = w;
    canvasHeight = h;
  }

  function ensureMsaaTexture(): GPUTextureView | null {
    if (
      !isNil(msaaTexture) &&
      msaaTexture.width === canvasWidth &&
      msaaTexture.height === canvasHeight
    ) {
      return msaaView;
    }

    msaaTexture?.destroy();

    if (canvasWidth === 0 || canvasHeight === 0) {
      msaaTexture = null;
      msaaView = null;
      return null;
    }

    msaaTexture = device.createTexture({
      size: [canvasWidth, canvasHeight],
      format,
      sampleCount: MSAA_SAMPLE_COUNT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    msaaView = msaaTexture.createView();
    return msaaView;
  }

  function writeUniforms(part: IDataPart, buf: GPUBuffer): void {
    const data = new ArrayBuffer(UNIFORM_BUFFER_SIZE);
    const f32 = new Float32Array(data);
    const u32 = new Uint32Array(data);

    // viewport
    f32[0] = canvasWidth;
    f32[1] = canvasHeight;

    // time/value ranges (as deltas from base)
    f32[2] = viewTimeStart - part.baseTime;
    f32[3] = viewTimeEnd - part.baseTime;
    f32[4] = viewValueMin - part.baseValue;
    f32[5] = viewValueMax - part.baseValue;

    // pointCount
    u32[6] = part.pointCount;

    // textureWidth
    u32[7] = TEXTURE_WIDTH;

    // lineWidth carries DPR scale factor (per-point sizes are multiplied by this in shader)
    f32[8] = Math.max(1, window.devicePixelRatio);

    // textureRow
    u32[9] = part.textureRowStart;

    // baseTime, baseValue
    f32[10] = part.baseTime;
    f32[11] = part.baseValue;

    device.queue.writeBuffer(buf, 0, data);
  }

  // SVG axis rendering
  function clearSvg(): void {
    while (svgContainer.firstChild) {
      svgContainer.removeChild(svgContainer.firstChild);
    }
  }

  function renderAxes(): void {
    clearSvg();

    const svgWidth = canvas.clientWidth;
    const svgHeight = canvas.clientHeight;

    svgContainer.setAttribute('width', String(svgWidth));
    svgContainer.setAttribute('height', String(svgHeight));
    svgContainer.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

    const plotLeft = AXIS_MARGIN_LEFT;
    const plotRight = svgWidth - AXIS_MARGIN_RIGHT;
    const plotTop = AXIS_MARGIN_TOP;
    const plotBottom = svgHeight - AXIS_MARGIN_BOTTOM;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    if (plotWidth <= 0 || plotHeight <= 0) {
      return;
    }

    // Axis lines
    const axisPath = document.createElementNS(SVG_NS, 'path');
    axisPath.setAttribute(
      'd',
      `M ${plotLeft} ${plotTop} L ${plotLeft} ${plotBottom} L ${plotRight} ${plotBottom}`
    );
    axisPath.setAttribute('stroke', AXIS_LINE_COLOR);
    axisPath.setAttribute('fill', 'none');
    axisPath.setAttribute('stroke-width', '1');
    svgContainer.appendChild(axisPath);

    const timeRange = viewTimeEnd - viewTimeStart;
    const valueRange = viewValueMax - viewValueMin;

    // X-axis ticks
    const scale = scaleFromTimeRange(viewTimeStart, viewTimeEnd);
    const xTicks = computeXTicks(viewTimeStart, viewTimeEnd, scale, plotWidth);

    for (const tick of xTicks) {
      const normalized = (tick.position - viewTimeStart) / timeRange;
      const x = plotLeft + normalized * plotWidth;

      if (x < plotLeft || x > plotRight) {
        continue;
      }

      // Grid line
      const gridLine = document.createElementNS(SVG_NS, 'line');
      gridLine.setAttribute('x1', String(x));
      gridLine.setAttribute('y1', String(plotTop));
      gridLine.setAttribute('x2', String(x));
      gridLine.setAttribute('y2', String(plotBottom));
      gridLine.setAttribute('stroke', GRID_LINE_COLOR);
      gridLine.setAttribute('stroke-width', '0.5');
      svgContainer.appendChild(gridLine);

      // Tick mark
      const tickLine = document.createElementNS(SVG_NS, 'line');
      tickLine.setAttribute('x1', String(x));
      tickLine.setAttribute('y1', String(plotBottom));
      tickLine.setAttribute('x2', String(x));
      tickLine.setAttribute('y2', String(plotBottom + TICK_LENGTH));
      tickLine.setAttribute('stroke', AXIS_LINE_COLOR);
      tickLine.setAttribute('stroke-width', '1');
      svgContainer.appendChild(tickLine);

      // Label
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(plotBottom + TICK_LENGTH + AXIS_FONT_SIZE + 2));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', AXIS_LABEL_COLOR);
      label.setAttribute('font-size', String(AXIS_FONT_SIZE));
      label.setAttribute('font-family', AXIS_FONT_FAMILY);
      label.textContent = tick.label;
      svgContainer.appendChild(label);
    }

    // Y-axis ticks
    const yTicks = computeYTicks(viewValueMin, viewValueMax, plotHeight);

    for (const tick of yTicks) {
      const normalized = (tick.position - viewValueMin) / valueRange;
      const y = plotBottom - normalized * plotHeight;

      if (y < plotTop || y > plotBottom) {
        continue;
      }

      // Grid line
      const gridLine = document.createElementNS(SVG_NS, 'line');
      gridLine.setAttribute('x1', String(plotLeft));
      gridLine.setAttribute('y1', String(y));
      gridLine.setAttribute('x2', String(plotRight));
      gridLine.setAttribute('y2', String(y));
      gridLine.setAttribute('stroke', GRID_LINE_COLOR);
      gridLine.setAttribute('stroke-width', '0.5');
      svgContainer.appendChild(gridLine);

      // Tick mark
      const tickLine = document.createElementNS(SVG_NS, 'line');
      tickLine.setAttribute('x1', String(plotLeft - TICK_LENGTH));
      tickLine.setAttribute('y1', String(y));
      tickLine.setAttribute('x2', String(plotLeft));
      tickLine.setAttribute('y2', String(y));
      tickLine.setAttribute('stroke', AXIS_LINE_COLOR);
      tickLine.setAttribute('stroke-width', '1');
      svgContainer.appendChild(tickLine);

      // Label
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', String(plotLeft - TICK_LENGTH - 4));
      label.setAttribute('y', String(y + AXIS_FONT_SIZE / 3));
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', AXIS_LABEL_COLOR);
      label.setAttribute('font-size', String(AXIS_FONT_SIZE));
      label.setAttribute('font-family', AXIS_FONT_FAMILY);
      label.textContent = tick.label;
      svgContainer.appendChild(label);
    }
  }

  // Input handling
  let isDragging = false;
  let lastMouseX = 0;

  function handleMouseDown(e: MouseEvent): void {
    isDragging = true;
    lastMouseX = e.clientX;
    canvas.style.cursor = 'grabbing';
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!isDragging) {
      return;
    }

    const dx = e.clientX - lastMouseX;
    lastMouseX = e.clientX;

    const [newStart, newEnd] = clampViewport(
      ...panViewport(viewTimeStart, viewTimeEnd, dx, canvas.clientWidth),
      dataMinTime,
      dataMaxTime
    );
    viewTimeStart = newStart;
    viewTimeEnd = newEnd;
  }

  function handleMouseUp(): void {
    isDragging = false;
    canvas.style.cursor = 'grab';
  }

  function handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const centerNormalized = (e.clientX - rect.left) / rect.width;
    const factor = e.deltaY > 0 ? ZOOM_FACTOR_MAX : ZOOM_FACTOR_MIN;

    const [newStart, newEnd] = clampViewport(
      ...zoomViewport(viewTimeStart, viewTimeEnd, factor, centerNormalized),
      dataMinTime,
      dataMaxTime
    );
    viewTimeStart = newStart;
    viewTimeEnd = newEnd;
  }

  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseUp);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.style.cursor = 'grab';

  // Touch support — single finger pan, two-finger pinch-to-zoom
  let lastTouchX = 0;
  let isTouching = false;
  let lastPinchDistance = 0;

  function getTouchDistance(e: TouchEvent): number {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchCenter(e: TouchEvent): number {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    return (cx - rect.left) / rect.width;
  }

  function handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      isTouching = true;
      lastTouchX = e.touches[0].clientX;
    } else if (e.touches.length === 2) {
      isTouching = false;
      lastPinchDistance = getTouchDistance(e);
    }
  }

  function handleTouchMove(e: TouchEvent): void {
    e.preventDefault();

    if (e.touches.length === 2) {
      const currentDistance = getTouchDistance(e);
      const scale = lastPinchDistance / currentDistance;
      const centerNormalized = getTouchCenter(e);

      const [newStart, newEnd] = clampViewport(
        ...zoomViewport(viewTimeStart, viewTimeEnd, scale, centerNormalized),
        dataMinTime,
        dataMaxTime
      );
      viewTimeStart = newStart;
      viewTimeEnd = newEnd;
      lastPinchDistance = currentDistance;
      return;
    }

    if (!isTouching || e.touches.length !== 1) {
      return;
    }

    const dx = e.touches[0].clientX - lastTouchX;
    lastTouchX = e.touches[0].clientX;

    const [newStart, newEnd] = clampViewport(
      ...panViewport(viewTimeStart, viewTimeEnd, dx, canvas.clientWidth),
      dataMinTime,
      dataMaxTime
    );
    viewTimeStart = newStart;
    viewTimeEnd = newEnd;
  }

  function handleTouchEnd(e: TouchEvent): void {
    if (e.touches.length === 0) {
      isTouching = false;
    } else if (e.touches.length === 1) {
      isTouching = true;
      lastTouchX = e.touches[0].clientX;
    }
  }

  canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd);

  updateCanvasSize();

  const resizeObserver = new ResizeObserver(() => {
    updateCanvasSize();
  });
  resizeObserver.observe(canvas);

  let animationFrameId = 0;
  let disposed = false;

  function frame(): void {
    if (disposed) {
      return;
    }

    updateCanvasSize();

    const parts = ensureDataForViewport();

    if (isNil(parts) || parts.line.pointCount < 2) {
      animationFrameId = requestAnimationFrame(frame);
      return;
    }

    const currentMsaaView = ensureMsaaTexture();

    if (isNil(currentMsaaView)) {
      animationFrameId = requestAnimationFrame(frame);
      return;
    }

    const canvasTexView = ctx.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentMsaaView,
          resolveTarget: canvasTexView,
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'discard',
        },
      ],
    });

    // Draw series 1: lines
    writeUniforms(parts.line, uniformBuf1);
    pass.setPipeline(linePipeline);
    pass.setBindGroup(0, bindGroup1);
    pass.draw(VERTICES_PER_SEGMENT, parts.line.pointCount - 1, 0, 0);

    // Draw series 2: rhombuses
    writeUniforms(parts.rhombus, uniformBuf2);
    pass.setPipeline(rhombusPipeline);
    pass.setBindGroup(0, bindGroup2);
    pass.draw(VERTICES_PER_RHOMBUS, parts.rhombus.pointCount, 0, 0);

    pass.end();

    device.queue.submit([encoder.finish()]);

    renderAxes();

    animationFrameId = requestAnimationFrame(frame);
  }

  animationFrameId = requestAnimationFrame(frame);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrameId);
    resizeObserver.disconnect();

    canvas.removeEventListener('mousedown', handleMouseDown);
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('mouseup', handleMouseUp);
    canvas.removeEventListener('mouseleave', handleMouseUp);
    canvas.removeEventListener('wheel', handleWheel);
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchmove', handleTouchMove);
    canvas.removeEventListener('touchend', handleTouchEnd);

    msaaTexture?.destroy();
    dataTexture.destroy();
    uniformBuf1.destroy();
    uniformBuf2.destroy();
    device.destroy();
  };
}
