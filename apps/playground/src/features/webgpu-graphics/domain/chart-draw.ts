import { assert } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { mat4 } from 'wgpu-matrix';

import {
  BACKGROUND_B,
  BACKGROUND_G,
  BACKGROUND_R,
  BORDER_MARGIN,
  BORDER_SEGMENT_COUNT,
  COMPOSITE_UNIFORM_SIZE,
  FULLSCREEN_TRIANGLE_VERTEX_COUNT,
  HALF,
  MAX_SHAPE_BUFFER_COUNT,
  MS_PER_SECOND,
  MSAA_SAMPLE_COUNT,
  OFFSCREEN_FORMAT,
  SHAPE_INSTANCE_BYTES,
  SHAPE_VERTICES_PER_INSTANCE,
  SIN_PEN_MAX,
  SIN_PEN_MIN,
  SIN_SEGMENTS_DIVISOR,
  SIN_Y_LAYER_OPACITY,
  UNIFORM_BUFFER_SIZE,
  VERTICES_PER_INSTANCE,
} from './chart-constants';
import { createChartPipelines } from './chart-pipelines';
import {
  computeShapeCount,
  createShapeDataBuffer,
  getShapeLifetime,
  initializeShapes,
  randomInRange,
  resizeShapes,
  spawnShape,
  writeShapeToBuffer,
} from './chart-shapes';
import { createChartTextureManager } from './chart-textures';

export function runCharter(canvas: HTMLCanvasElement): VoidFunction {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  void initCharter(canvas).then(cleanup => {
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

async function initCharter(canvas: HTMLCanvasElement): Promise<VoidFunction> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');
  const device = await adapter.requestDevice();

  const maybeCtx = canvas.getContext('webgpu');
  assert(!isNil(maybeCtx), 'Failed to get WebGPU canvas context');
  const ctx: GPUCanvasContext = maybeCtx;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });

  const uniformBuf = device.createBuffer({
    size: UNIFORM_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const pipelines = createChartPipelines(device, format, OFFSCREEN_FORMAT, MSAA_SAMPLE_COUNT);

  const compositeUniformBuf = device.createBuffer({
    size: COMPOSITE_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  {
    const data = new Float32Array([SIN_Y_LAYER_OPACITY, 0, 0, 0]);
    device.queue.writeBuffer(compositeUniformBuf, 0, data);
  }

  const shapesStorageBuf = device.createBuffer({
    size: MAX_SHAPE_BUFFER_COUNT * SHAPE_INSTANCE_BYTES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const shapesBindGroup = device.createBindGroup({
    layout: pipelines.shapesBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuf } },
      { binding: 1, resource: { buffer: shapesStorageBuf } },
    ],
  });

  const shapeDataBuffer = createShapeDataBuffer(MAX_SHAPE_BUFFER_COUNT);

  const bindGroup = device.createBindGroup({
    layout: pipelines.bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuf },
      },
    ],
  });

  const textureManager = createChartTextureManager(
    device,
    format,
    OFFSCREEN_FORMAT,
    MSAA_SAMPLE_COUNT
  );

  let canvasWidth = 0;
  let canvasHeight = 0;
  let currentDpr = Math.max(1, window.devicePixelRatio);

  function updateCanvasSize(): void {
    currentDpr = Math.max(1, window.devicePixelRatio);
    const w = Math.floor(canvas.clientWidth * currentDpr);
    const h = Math.floor(canvas.clientHeight * currentDpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    canvasWidth = w;
    canvasHeight = h;
  }

  updateCanvasSize();
  const initialShapeCount = computeShapeCount(canvasWidth, canvasHeight, currentDpr);
  const shapes = initializeShapes(initialShapeCount);

  function computeSinXSegmentCount(): number {
    return Math.trunc(canvasWidth / SIN_PEN_MAX / SIN_SEGMENTS_DIVISOR) * SIN_SEGMENTS_DIVISOR + 1;
  }

  function computeSinYSegmentCount(): number {
    return Math.trunc(canvasHeight / SIN_PEN_MAX / SIN_SEGMENTS_DIVISOR) * SIN_SEGMENTS_DIVISOR + 1;
  }

  function writeUniforms(time: number): void {
    const halfW = canvasWidth * HALF;
    const halfH = canvasHeight * HALF;

    const mvp = mat4.ortho(-halfW, halfW, -halfH, halfH, -1, 1);

    const sinCount = computeSinXSegmentCount();
    const sinYCount = computeSinYSegmentCount();

    const data = new ArrayBuffer(UNIFORM_BUFFER_SIZE);
    const f32 = new Float32Array(data);
    const u32 = new Uint32Array(data);

    // mat4x4 mvp at offset 0 (16 floats)
    f32.set(mvp as Float32Array, 0);

    // viewport at offset 16 (2 floats)
    const VIEWPORT_OFFSET = 16;
    f32[VIEWPORT_OFFSET] = canvasWidth;
    f32[VIEWPORT_OFFSET + 1] = canvasHeight;

    // time at offset 18
    const TIME_OFFSET = 18;
    f32[TIME_OFFSET] = time;

    // sinCount at offset 19 (u32)
    const SIN_COUNT_OFFSET = 19;
    u32[SIN_COUNT_OFFSET] = sinCount;

    // sinPenMin at offset 20
    const SIN_PEN_MIN_OFFSET = 20;
    f32[SIN_PEN_MIN_OFFSET] = SIN_PEN_MIN;

    // sinPenMax at offset 21
    const SIN_PEN_MAX_OFFSET = 21;
    f32[SIN_PEN_MAX_OFFSET] = SIN_PEN_MAX;

    // borderMargin at offset 22
    const BORDER_MARGIN_OFFSET = 22;
    f32[BORDER_MARGIN_OFFSET] = BORDER_MARGIN;

    // borderOffset at offset 23 (u32) - where border instances start
    const BORDER_OFFSET_OFFSET = 23;
    u32[BORDER_OFFSET_OFFSET] = sinCount;

    // sinYCount at offset 24 (u32)
    const SIN_Y_COUNT_OFFSET = 24;
    u32[SIN_Y_COUNT_OFFSET] = sinYCount;

    device.queue.writeBuffer(uniformBuf, 0, data);
  }

  updateCanvasSize();

  const resizeObserver = new ResizeObserver(() => {
    updateCanvasSize();
  });
  resizeObserver.observe(canvas);

  let animationFrameId = 0;
  let disposed = false;
  const startTime = performance.now();

  function frame(): void {
    if (disposed) {
      return;
    }

    updateCanvasSize();

    const time = (performance.now() - startTime) / MS_PER_SECOND;
    const sinXCount = computeSinXSegmentCount();
    const sinYCount = computeSinYSegmentCount();

    writeUniforms(time);

    const mainInstances = sinXCount + BORDER_SEGMENT_COUNT;

    const msaaView = textureManager.ensureMsaaTexture(canvasWidth, canvasHeight);
    const offscreen = textureManager.ensureOffscreenTextures(
      canvasWidth,
      canvasHeight,
      pipelines.compositeBindGroupLayout,
      pipelines.compositeSampler,
      compositeUniformBuf
    );

    if (isNil(msaaView) || isNil(offscreen)) {
      animationFrameId = requestAnimationFrame(frame);
      return;
    }

    const canvasTexView = ctx.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();

    // Pass 1: Main MSAA pass -- border + sin-X
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: msaaView,
            resolveTarget: canvasTexView,
            loadOp: 'clear',
            clearValue: {
              r: BACKGROUND_R,
              g: BACKGROUND_G,
              b: BACKGROUND_B,
              a: 1,
            },
            storeOp: 'discard',
          },
        ],
      });

      pass.setPipeline(pipelines.mainPipeline);
      pass.setBindGroup(0, bindGroup);

      if (mainInstances > 0) {
        pass.draw(VERTICES_PER_INSTANCE, mainInstances, 0, 0);
      }

      pass.end();
    }

    // Pass 2: Offscreen MSAA pass -- sin-Y into transparent offscreen
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: offscreen.offscreenMsaaView,
            resolveTarget: offscreen.offscreenResolveView,
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            storeOp: 'discard',
          },
        ],
      });

      pass.setPipeline(pipelines.sinYPipeline);
      pass.setBindGroup(0, bindGroup);

      if (sinYCount > 0) {
        pass.draw(VERTICES_PER_INSTANCE, sinYCount, 0, 0);
      }

      pass.end();
    }

    // Pass 3: Composite offscreen over main canvas with layer opacity
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: canvasTexView,
            loadOp: 'load',
            storeOp: 'store',
          },
        ],
      });

      pass.setPipeline(pipelines.compositePipeline);
      pass.setBindGroup(0, offscreen.compositeBindGroup);
      pass.draw(FULLSCREEN_TRIANGLE_VERTEX_COUNT, 1, 0, 0);

      pass.end();
    }

    // Pass 4: Animated shapes -- update lifecycle and render
    {
      const halfW = canvasWidth * HALF;
      const halfH = canvasHeight * HALF;
      const FLOATS_PER_SHAPE = SHAPE_INSTANCE_BYTES / Float32Array.BYTES_PER_ELEMENT;

      const currentShapeCount = computeShapeCount(canvasWidth, canvasHeight, currentDpr);
      if (currentShapeCount !== shapes.length) {
        resizeShapes(shapes, currentShapeCount, time, halfW, halfH);
      }

      for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i];
        const elapsed = time - shape.spawnTime;
        const lifetime = getShapeLifetime(shape);

        if (elapsed > lifetime) {
          const newShape = spawnShape(time);
          newShape.x = randomInRange(-halfW + newShape.halfSize, halfW - newShape.halfSize);
          newShape.y = randomInRange(-halfH + newShape.halfSize, halfH - newShape.halfSize);
          shapes[i] = newShape;
        }

        writeShapeToBuffer(shapes[i], shapeDataBuffer, i * FLOATS_PER_SHAPE);
      }

      device.queue.writeBuffer(
        shapesStorageBuf,
        0,
        shapeDataBuffer.buffer,
        0,
        shapes.length * SHAPE_INSTANCE_BYTES
      );

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: canvasTexView,
            loadOp: 'load',
            storeOp: 'store',
          },
        ],
      });

      pass.setPipeline(pipelines.shapesPipeline);
      pass.setBindGroup(0, shapesBindGroup);
      pass.draw(SHAPE_VERTICES_PER_INSTANCE, shapes.length, 0, 0);
      pass.end();
    }

    device.queue.submit([encoder.finish()]);

    animationFrameId = requestAnimationFrame(frame);
  }

  animationFrameId = requestAnimationFrame(frame);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrameId);
    resizeObserver.disconnect();
    textureManager.destroy();
    uniformBuf.destroy();
    compositeUniformBuf.destroy();
    shapesStorageBuf.destroy();
    device.destroy();
  };
}
