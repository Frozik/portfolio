import { isNil } from 'lodash-es';

import type { IChartFrame } from '../core/frame/chart-frame';
import type { IPixelRect } from '../core/frame/pixel-rect';
import type { TColor } from '../core/series/color';
import { channelsOf } from '../core/series/color';
import { PREMULTIPLIED_BLEND } from './blend';
import type { IWebGpuPainter, IWebGpuPainterContext, TWebGpuPainterFactory } from './painter';
import rectsSource from './shaders/rects.wgsl?raw';

const SHARED_KEY = 'rects';
const FLOATS_PER_RECT = 4;
const UNIFORM_FLOATS = 8;
const COLOR_OFFSET = 4;
const VERTICES_PER_RECT = 6;
const INITIAL_CAPACITY = 64;

export interface IRectBatch {
  readonly rects: readonly IPixelRect[];
  readonly color: TColor;
  readonly opacity: number;
  /** Length of a dash and of the gap after it along the longer side, device pixels; nought draws solid. */
  readonly dashLength: number;
}

export interface IRectSource {
  batchOf(frame: IChartFrame<unknown>): IRectBatch;
  /** Whatever the batch depends on besides the frame; the batch is rebuilt when it changes. */
  revision?(): number;
}

interface IRectResources {
  readonly layout: GPUBindGroupLayout;
  readonly pipeline: GPURenderPipeline;
}

function createResources({ device, format, sampleCount }: IWebGpuPainterContext): IRectResources {
  const layout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    ],
  });
  const module = device.createShaderModule({ code: rectsSource });
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    vertex: { module, entryPoint: 'vertexMain' },
    fragment: {
      module,
      entryPoint: 'fragmentMain',
      targets: [{ format, blend: PREMULTIPLIED_BLEND }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: sampleCount },
  });
  return { layout, pipeline };
}

class RectPainter implements IWebGpuPainter {
  private readonly resources: IRectResources;
  private readonly uniforms = new Float32Array(UNIFORM_FLOATS);
  private readonly uniformBuffer: GPUBuffer;
  private rects = new Float32Array(INITIAL_CAPACITY * FLOATS_PER_RECT);
  private rectBuffer: GPUBuffer | undefined;
  private bindGroup: GPUBindGroup | undefined;
  private count = 0;
  private uploadedFrame: IChartFrame<unknown> | undefined;
  private uploadedRevision: number | undefined;

  constructor(
    private readonly context: IWebGpuPainterContext,
    private readonly source: IRectSource
  ) {
    this.resources = context.shared(SHARED_KEY, () => createResources(context));
    this.uniformBuffer = context.device.createBuffer({
      size: this.uniforms.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  prepare(frame: IChartFrame<unknown>): void {
    const revision = this.source.revision?.();
    if (frame === this.uploadedFrame && revision === this.uploadedRevision) {
      return;
    }
    this.uploadedFrame = frame;
    this.uploadedRevision = revision;

    const batch = this.source.batchOf(frame);
    this.count = batch.rects.length;
    if (this.count === 0) {
      return;
    }
    const { device } = this.context;
    const buffer = this.bufferFor(this.count);
    batch.rects.forEach((rect, index) => {
      this.rects.set([rect.left, rect.top, rect.width, rect.height], index * FLOATS_PER_RECT);
    });
    device.queue.writeBuffer(buffer, 0, this.rects, 0, this.count * FLOATS_PER_RECT);

    const { red, green, blue, alpha } = channelsOf(batch.color);
    const coverage = alpha * batch.opacity;
    this.uniforms.set([frame.size.width, frame.size.height, batch.dashLength]);
    this.uniforms.set([red * coverage, green * coverage, blue * coverage, coverage], COLOR_OFFSET);
    device.queue.writeBuffer(this.uniformBuffer, 0, this.uniforms);
  }

  draw(pass: GPURenderPassEncoder): void {
    if (this.count === 0 || isNil(this.bindGroup)) {
      return;
    }
    pass.setPipeline(this.resources.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(VERTICES_PER_RECT, this.count);
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.rectBuffer?.destroy();
  }

  private bufferFor(count: number): GPUBuffer {
    if (!isNil(this.rectBuffer) && count * FLOATS_PER_RECT <= this.rects.length) {
      return this.rectBuffer;
    }
    while (this.rects.length < count * FLOATS_PER_RECT) {
      this.rects = new Float32Array(this.rects.length * 2);
    }
    this.rectBuffer?.destroy();
    this.rectBuffer = this.context.device.createBuffer({
      size: this.rects.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = this.context.device.createBindGroup({
      layout: this.resources.layout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.rectBuffer } },
      ],
    });
    return this.rectBuffer;
  }
}

/** Flat rectangles in device pixels, solid or dashed: what the grid and the debug marks are made of. */
export function rectPainter(source: IRectSource): TWebGpuPainterFactory {
  return context => new RectPainter(context, source);
}
