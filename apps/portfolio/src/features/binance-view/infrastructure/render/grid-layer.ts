import type { IGridRect } from '../../domain/grid-lines';
import { computeGridRects } from '../../domain/grid-lines';

import type { IGridLayerResources } from './grid-buffers';
import {
  createGridBindGroup,
  createGridResources,
  GRID_VERTEX_COUNT_PER_INSTANCE,
  writeGridRects,
  writeGridUniforms,
} from './grid-buffers';
import type { ILayerFrameContext, IRenderLayer } from './layer';

export interface IGridLayerParams {
  readonly device: GPUDevice;
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly pipeline: GPURenderPipeline;
}

/** Upper bound on time ticks plus price rows a viewport can show. */
const MAX_GRID_RECTS = 2048;

interface IGridFrameState {
  readonly rects: readonly IGridRect[];
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

/** Background grid, drawn first so heatmap cells cover it wherever they exist. */
export class GridLayer implements IRenderLayer {
  private readonly device: GPUDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly resources: IGridLayerResources;
  private readonly bindGroup: GPUBindGroup;

  private frameState: IGridFrameState | undefined = undefined;
  private instanceCount = 0;

  constructor(params: IGridLayerParams) {
    this.device = params.device;
    this.pipeline = params.pipeline;
    this.resources = createGridResources(params.device, MAX_GRID_RECTS);
    this.bindGroup = createGridBindGroup(params.device, params.bindGroupLayout, this.resources);
  }

  computeFrameState(context: ILayerFrameContext): void {
    const { frameInput, devicePixelRatio } = context;
    const cssRects = computeGridRects({
      plotWidthCss: context.plotWidthPx / devicePixelRatio,
      plotHeightCss: context.plotHeightPx / devicePixelRatio,
      viewTimeStartMs: frameInput.viewTimeStartMs,
      viewTimeEndMs: frameInput.viewTimeEndMs,
      priceMin: frameInput.priceMin,
      priceMax: frameInput.priceMax,
      priceStep: frameInput.priceStep,
    });
    this.frameState = {
      rects: cssRects.slice(0, MAX_GRID_RECTS).map(rect => ({
        left: rect.left * devicePixelRatio,
        top: rect.top * devicePixelRatio,
        width: rect.width * devicePixelRatio,
        height: rect.height * devicePixelRatio,
      })),
      canvasWidth: context.canvasWidthPx,
      canvasHeight: context.canvasHeightPx,
    };
  }

  writeGpuResources(): void {
    const frameState = this.frameState;
    if (frameState === undefined) {
      this.instanceCount = 0;
      return;
    }
    writeGridUniforms(
      this.device,
      this.resources.uniformsBuffer,
      frameState.canvasWidth,
      frameState.canvasHeight
    );
    this.instanceCount = writeGridRects(this.device, this.resources.rectsBuffer, frameState.rects);
  }

  recordDrawCalls(pass: GPURenderPassEncoder): void {
    if (this.instanceCount === 0) {
      return;
    }
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(GRID_VERTEX_COUNT_PER_INSTANCE, this.instanceCount, 0, 0);
  }

  dispose(): void {
    this.resources.uniformsBuffer.destroy();
    this.resources.rectsBuffer.destroy();
  }
}
