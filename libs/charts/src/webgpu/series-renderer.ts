import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import type { StructuredView } from 'webgpu-utils';
import { makeStructuredView } from 'webgpu-utils';

import type { IChartFrame } from '../core/frame/chart-frame';
import { lowerBound, upperBound } from '../core/series/search';
import type { IMarkUse, IStyledRun } from '../core/series/style-processor';
import { ChunkStore } from './chunk-store';
import { DataTexture } from './data-texture';
import { Layer } from './layer';
import type { IWebGpuMarkPainter } from './painter';
import { isMarkPainter, WEBGPU_BACKEND } from './painter';
import type { SeriesPipeline } from './series-pipeline';
import type { TAxisKind } from './series-shader';
import { uniformLayouts } from './shader-data';
import { elementsPerSlot, splitPosition, splitValue } from './texel-encoding';
import type { IInstanceRange } from './visible-slice';
import { visibleSliceOf } from './visible-slice';

const NANOS_PER_SECOND = 1e9;
const SHAPE_CODE = { point: 0, candle: 1 } as const;

interface IPlannedDraw {
  readonly layer: Layer;
  readonly vertices: number;
  readonly instances: IInstanceRange;
}

export interface ISeriesRendererOptions {
  readonly device: GPUDevice;
  readonly pipeline: SeriesPipeline;
  readonly maxTextureRows: number | undefined;
}

/** Draws the series of one chart: keeps their chunks in its data texture and a layer per mark in use (§6.5). */
export class SeriesRenderer {
  private readonly device: GPUDevice;
  private readonly pipeline: SeriesPipeline;
  private readonly texture: DataTexture;
  private readonly chunks: ChunkStore;
  private readonly frameView: StructuredView;
  private readonly frameBuffer: GPUBuffer;
  private readonly layers: Layer[] = [];
  private readonly planned: IPlannedDraw[] = [];
  private frameBindGroup: GPUBindGroup | undefined;
  private boundGeneration = -1;
  private axis: TAxisKind = 'time';

  constructor(options: ISeriesRendererOptions) {
    this.device = options.device;
    this.pipeline = options.pipeline;
    this.texture = new DataTexture(options.device, {
      maxRows: options.maxTextureRows,
      onEvict: slot => this.chunks.evicted(slot),
    });
    this.chunks = new ChunkStore(this.texture);
    this.frameView = makeStructuredView(uniformLayouts().frame);
    this.frameBuffer = options.device.createBuffer({
      size: this.frameView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  /** Before the pass: uploads what is new, writes the uniforms, and decides what to draw. */
  prepare(frame: IChartFrame<unknown>): void {
    this.axis = typeof frame.x.start === 'bigint' ? 'time' : 'number';
    this.writeFrame(frame);
    this.planned.length = 0;
    const liveKeys = new Set<string>();
    for (const series of frame.series) {
      for (const styled of series.runs) {
        const key = `${series.id}:${styled.run.id}`;
        liveKeys.add(key);
        this.plan(frame, key, styled);
      }
    }
    this.chunks.retain(liveKeys);
  }

  draw(pass: GPURenderPassEncoder, frame: IChartFrame<unknown>): void {
    if (this.planned.length === 0) {
      return;
    }
    const { plot } = frame;
    pass.setScissorRect(plot.left, plot.top, plot.width, plot.height);
    pass.setPipeline(this.pipeline.pipelineFor(this.axis));
    pass.setBindGroup(0, this.frameGroup());
    for (const { layer, vertices, instances } of this.planned) {
      layer.draw(pass, vertices, instances);
    }
    pass.setScissorRect(0, 0, frame.size.width, frame.size.height);
  }

  dispose(): void {
    for (const layer of this.layers) {
      layer.dispose();
    }
    this.chunks.dispose();
    this.texture.dispose();
    this.frameBuffer.destroy();
  }

  private writeFrame(frame: IChartFrame<unknown>): void {
    const unitsPerSpan = this.axis === 'time' ? frame.xSpan / NANOS_PER_SECOND : frame.xSpan;
    this.frameView.set({
      canvas: [frame.size.width, frame.size.height],
      devicePixelRatio: frame.size.devicePixelRatio,
      invXSpan: 1 / unitsPerSpan,
      viewStart: splitPosition(frame.x.start),
      yMin: splitValue(frame.y.min),
      invYSpan: 1 / (frame.y.max - frame.y.min),
    });
    this.device.queue.writeBuffer(this.frameBuffer, 0, this.frameView.arrayBuffer);
  }

  private plan(frame: IChartFrame<unknown>, key: string, styled: IStyledRun<unknown>): void {
    const { run } = styled;
    // One element beyond each edge, so a line entering the view starts outside it.
    const from = Math.max(0, lowerBound(frame.domain, run.x, run.length, frame.x.start) - 1);
    const to = Math.min(run.length, upperBound(frame.domain, run.x, run.length, frame.x.end) + 1);
    if (to <= from) {
      return;
    }
    const chunks = this.chunks.resident(key, styled, from, to);
    if (chunks.length === 0) {
      return;
    }
    for (const use of styled.style.marks) {
      const painter = painterOf(use);
      const mark = this.pipeline.codeOf(painter);
      for (const spec of painter.layers({ frame, styled, use })) {
        const layer = this.nextLayer();
        const elements = layer.write(
          {
            mark,
            shape: SHAPE_CODE[run.shape],
            outline: spec.outline ? 1 : 0,
            params: spec.params,
            stepOverSpan: (run.step ?? 0) / frame.xSpan,
          },
          chunks
        );
        const visible = visibleSliceOf(run.shape, from, to, elementsPerSlot(run.shape), elements);
        const instances = painter.instances(visible, use);
        if (instances.count > 0) {
          this.planned.push({ layer, vertices: painter.verticesPerInstance, instances });
        }
      }
    }
  }

  private nextLayer(): Layer {
    const index = this.planned.length;
    this.layers[index] ??= new Layer(
      this.device,
      this.pipeline.layerLayout,
      makeStructuredView(uniformLayouts().layer)
    );
    return this.layers[index];
  }

  /** The texture is replaced when it grows, and a bind group made for the old one is stale. */
  private frameGroup(): GPUBindGroup {
    if (isNil(this.frameBindGroup) || this.boundGeneration !== this.texture.generation) {
      this.boundGeneration = this.texture.generation;
      this.frameBindGroup = this.device.createBindGroup({
        layout: this.pipeline.frameLayout,
        entries: [
          { binding: 0, resource: { buffer: this.frameBuffer } },
          { binding: 1, resource: this.texture.view },
        ],
      });
    }
    return this.frameBindGroup;
  }
}

function painterOf(use: IMarkUse): IWebGpuMarkPainter {
  const painter = use.mark.painters[WEBGPU_BACKEND];
  assert(
    isMarkPainter(painter),
    `the "${use.mark.id}" mark has no WebGPU painter: import its style from "@frozik/charts/webgpu"`
  );
  return painter;
}
