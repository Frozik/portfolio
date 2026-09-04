import type { IRenderFrameInput } from '../../domain/render-frame-types';

/** Per-frame context the renderer builds once and hands to every layer. */
export interface ILayerFrameContext {
  readonly frameInput: IRenderFrameInput;
  readonly canvasWidthPx: number;
  readonly canvasHeightPx: number;
  /** Price-area size in device pixels: canvas minus the Y-axis panel and the volume panel. */
  readonly plotWidthPx: number;
  readonly plotHeightPx: number;
  readonly devicePixelRatio: number;
  /** Candles are visible this frame; the heatmap fades so they stay readable. */
  readonly dimHeatmap: boolean;
  /** `performance.now()` snapshot taken once at frame start. */
  readonly nowMs: number;
}

/**
 * One visual layer of the chart. The renderer drives the three phases in
 * layer order once per frame: derive frame state from the context, upload
 * GPU buffers, then append draw calls to the shared render pass.
 */
export interface IRenderLayer {
  computeFrameState(context: ILayerFrameContext): void;
  writeGpuResources(): void;
  recordDrawCalls(pass: GPURenderPassEncoder): void;
  dispose(): void;
}
