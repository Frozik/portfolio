import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import { PREMULTIPLIED_BLEND } from './blend';
import type { IWebGpuMarkPainter } from './painter';
import type { TAxisKind } from './series-shader';
import { seriesShaderSource } from './series-shader';

/**
 * The one pipeline that draws every series of every chart on a backend: its
 * shader is assembled from the marks seen so far and rebuilt when a new mark
 * appears. A mark's code is its place in the list, so codes never change (§6.3).
 */
export class SeriesPipeline {
  readonly frameLayout: GPUBindGroupLayout;
  readonly layerLayout: GPUBindGroupLayout;
  private readonly painters: IWebGpuMarkPainter[] = [];
  private readonly pipelines = new Map<string, GPURenderPipeline>();

  constructor(
    private readonly device: GPUDevice,
    private readonly format: GPUTextureFormat,
    private readonly sampleCount: number
  ) {
    this.frameLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        { binding: 1, visibility: GPUShaderStage.VERTEX, texture: { sampleType: 'uint' } },
      ],
    });
    this.layerLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
  }

  /** The number the shader knows the mark by. */
  codeOf(painter: IWebGpuMarkPainter): number {
    const known = this.painters.findIndex(each => each.markId === painter.markId);
    if (known >= 0) {
      assert(
        this.painters[known] === painter,
        `two different painters draw the "${painter.markId}" mark`
      );
      return known;
    }
    this.painters.push(painter);
    return this.painters.length - 1;
  }

  pipelineFor(axis: TAxisKind): GPURenderPipeline {
    const key = `${axis}:${this.painters.length}`;
    const existing = this.pipelines.get(key);
    if (!isNil(existing)) {
      return existing;
    }
    const module = this.device.createShaderModule({
      code: seriesShaderSource(this.painters, axis),
    });
    const pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.frameLayout, this.layerLayout],
      }),
      vertex: { module, entryPoint: 'vertexMain' },
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{ format: this.format, blend: PREMULTIPLIED_BLEND }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: this.sampleCount },
    });
    this.pipelines.set(key, pipeline);
    return pipeline;
  }
}
