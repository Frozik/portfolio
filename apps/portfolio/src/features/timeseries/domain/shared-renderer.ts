import { assert } from '@frozik/utils';
import { isNil } from 'lodash-es';

import {
  INITIAL_OFFSCREEN_HEIGHT,
  INITIAL_OFFSCREEN_WIDTH,
  MSAA_SAMPLE_COUNT,
  VERTICES_PER_CANDLESTICK,
  VERTICES_PER_SEGMENT,
} from './constants';
import timeseriesShaderSource from './shaders/timeseries.wgsl?raw';
import type { ISharedTimeseriesRenderer, ITimeseriesChart } from './types';

export async function createSharedRenderer(): Promise<ISharedTimeseriesRenderer> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');
  const device = await adapter.requestDevice();

  const offscreen = new OffscreenCanvas(INITIAL_OFFSCREEN_WIDTH, INITIAL_OFFSCREEN_HEIGHT);
  const ctx = offscreen.getContext('webgpu');
  assert(!isNil(ctx), 'Failed to get WebGPU context on OffscreenCanvas');

  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });

  const shaderModule = device.createShaderModule({ code: timeseriesShaderSource });

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

  const candlestickPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: shaderModule, entryPoint: 'vsCandlestick' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fsCandlestick',
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  return new SharedTimeseriesRenderer(
    device,
    format,
    bindGroupLayout,
    linePipeline,
    candlestickPipeline,
    offscreen,
    ctx
  );
}

class SharedTimeseriesRenderer implements ISharedTimeseriesRenderer {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly linePipeline: GPURenderPipeline;
  readonly candlestickPipeline: GPURenderPipeline;

  private readonly offscreen: OffscreenCanvas;
  private readonly ctx: GPUCanvasContext;
  private readonly charts = new Set<ITimeseriesChart>();

  private msaaTexture: GPUTexture | null = null;
  private msaaView: GPUTextureView | null = null;
  private msaaWidth = 0;
  private msaaHeight = 0;

  private animationFrameId = 0;
  private disposed = false;

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    bindGroupLayout: GPUBindGroupLayout,
    linePipeline: GPURenderPipeline,
    candlestickPipeline: GPURenderPipeline,
    offscreen: OffscreenCanvas,
    ctx: GPUCanvasContext
  ) {
    this.device = device;
    this.format = format;
    this.bindGroupLayout = bindGroupLayout;
    this.linePipeline = linePipeline;
    this.candlestickPipeline = candlestickPipeline;
    this.offscreen = offscreen;
    this.ctx = ctx;
  }

  registerChart(chart: ITimeseriesChart): VoidFunction {
    this.charts.add(chart);

    if (this.charts.size === 1) {
      this.startAnimationLoop();
    }

    return () => {
      this.charts.delete(chart);
      chart.dispose();

      if (this.charts.size === 0) {
        this.stopAnimationLoop();
      }
    };
  }

  destroy(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.stopAnimationLoop();

    for (const chart of this.charts) {
      chart.dispose();
    }
    this.charts.clear();

    this.msaaTexture?.destroy();
    this.msaaTexture = null;
    this.msaaView = null;

    this.device.destroy();
  }

  private startAnimationLoop(): void {
    if (this.disposed) {
      return;
    }

    const frame = (): void => {
      if (this.disposed) {
        return;
      }

      this.renderAllCharts();
      this.animationFrameId = requestAnimationFrame(frame);
    };

    this.animationFrameId = requestAnimationFrame(frame);
  }

  private stopAnimationLoop(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = 0;
  }

  private ensureMsaaTexture(): GPUTextureView | null {
    let maxW = 0;
    let maxH = 0;

    for (const chart of this.charts) {
      maxW = Math.max(maxW, chart.width);
      maxH = Math.max(maxH, chart.height);
    }

    if (maxW === this.msaaWidth && maxH === this.msaaHeight && !isNil(this.msaaView)) {
      return this.msaaView;
    }

    this.msaaTexture?.destroy();

    if (maxW === 0 || maxH === 0) {
      this.msaaTexture = null;
      this.msaaView = null;
      this.msaaWidth = 0;
      this.msaaHeight = 0;
      return null;
    }

    this.msaaTexture = this.device.createTexture({
      size: [maxW, maxH],
      format: this.format,
      sampleCount: MSAA_SAMPLE_COUNT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.msaaView = this.msaaTexture.createView();
    this.msaaWidth = maxW;
    this.msaaHeight = maxH;

    return this.msaaView;
  }

  private renderAllCharts(): void {
    for (const chart of this.charts) {
      chart.update();

      const { width, height } = chart;

      if (width === 0 || height === 0) {
        continue;
      }

      const drawCommands = chart.prepareDrawCommands();

      if (isNil(drawCommands)) {
        continue;
      }

      // Resize offscreen canvas to match chart dimensions
      if (this.offscreen.width !== width || this.offscreen.height !== height) {
        this.offscreen.width = width;
        this.offscreen.height = height;

        this.ctx.configure({
          device: this.device,
          format: this.format,
          alphaMode: 'premultiplied',
        });
      }

      const currentMsaaView = this.ensureMsaaTexture();

      if (isNil(currentMsaaView)) {
        continue;
      }

      const canvasTexView = this.ctx.getCurrentTexture().createView();
      const encoder = this.device.createCommandEncoder();

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
      pass.setPipeline(this.linePipeline);
      pass.setBindGroup(0, drawCommands.lineBindGroup);
      pass.draw(VERTICES_PER_SEGMENT, drawCommands.lineInstanceCount, 0, 0);

      // Draw series 2: candlesticks
      pass.setPipeline(this.candlestickPipeline);
      pass.setBindGroup(0, drawCommands.candlestickBindGroup);
      pass.draw(VERTICES_PER_CANDLESTICK, drawCommands.candlestickInstanceCount, 0, 0);

      pass.end();
      this.device.queue.submit([encoder.finish()]);

      // Blit to visible canvas — clear first to avoid drawing over stale frames
      const bitmap = this.offscreen.transferToImageBitmap();
      chart.target2dContext.clearRect(0, 0, width, height);
      chart.target2dContext.drawImage(bitmap, 0, 0);
      bitmap.close();

      chart.renderOverlay();
    }
  }
}
