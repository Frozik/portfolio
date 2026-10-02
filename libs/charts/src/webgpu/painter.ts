import { isNil } from 'lodash-es';

import type { IChartFrame } from '../core/frame/chart-frame';
import type { IMarkUse, IStyledRun } from '../core/series/style-processor';
import type { IInstanceRange, IVisibleSlice } from './visible-slice';

export const WEBGPU_BACKEND = 'webgpu';

/** One draw of a styled run by a mark: most marks need one, a line with an outline two. */
export interface IMarkLayer {
  /** Mark parameters as the shader reads them from the layer uniforms. */
  readonly params: readonly [number, number, number, number];
  /** Draws the outline of the mark instead of the mark itself. */
  readonly outline: boolean;
}

export interface IMarkLayerContext {
  readonly frame: IChartFrame<unknown>;
  readonly styled: IStyledRun<unknown>;
  readonly use: IMarkUse;
}

/** What draws a mark on WebGPU: its vertex function and how its layers are parameterised (§6.6). */
export interface IWebGpuMarkPainter {
  readonly markId: string;
  /** WGSL defining `vertexFunction(vertex: u32, instance: u32) -> VertexOutput`. */
  readonly source: string;
  readonly vertexFunction: string;
  readonly verticesPerInstance: number;
  layers(context: IMarkLayerContext): readonly IMarkLayer[];
  /** The instances that draw what is on screen: one per element, per point, or per pair of points. */
  instances(visible: IVisibleSlice, use: IMarkUse): IInstanceRange;
}

export function isMarkPainter(candidate: unknown): candidate is IWebGpuMarkPainter {
  return typeof candidate === 'object' && !isNil(candidate) && 'vertexFunction' in candidate;
}

/** What an extension draws inside a chart's render pass. */
export interface IWebGpuPainter {
  /** Before the pass: uploads whatever the frame changed. */
  prepare(frame: IChartFrame<unknown>): void;
  draw(pass: GPURenderPassEncoder, frame: IChartFrame<unknown>): void;
  dispose(): void;
}

export interface IWebGpuPainterContext {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly sampleCount: number;
  /** One instance per key for the whole backend: pipelines and layouts every chart shares. */
  shared<TResource>(key: string, create: () => TResource): TResource;
}

export type TWebGpuPainterFactory = (context: IWebGpuPainterContext) => IWebGpuPainter;

export function isPainterFactory(candidate: unknown): candidate is TWebGpuPainterFactory {
  return typeof candidate === 'function';
}
