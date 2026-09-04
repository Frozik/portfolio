import type { IBlockEntry, IPlotArea } from '../../domain/types';

export interface ISeriesUniforms {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly viewTimeStart: number;
  readonly viewTimeEnd: number;
  readonly viewValueMin: number;
  readonly viewValueMax: number;
}

export interface ISeriesLayer {
  updateBindGroup(dataTextureView: GPUTextureView): void;
  writeUniforms(blocks: readonly IBlockEntry[], uniforms: ISeriesUniforms): void;
  render(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, plotArea: IPlotArea): void;
  renderDebug(
    pass: GPURenderPassEncoder,
    debugPipeline: GPURenderPipeline,
    plotArea: IPlotArea
  ): void;
  readonly instanceCount: number;
  dispose(): void;
}

export interface ISeriesLayerManager {
  updateBindGroups(dataTextureView: GPUTextureView): void;
  writeAllUniforms(blockSets: readonly (readonly IBlockEntry[])[], uniforms: ISeriesUniforms): void;
  renderAll(pass: GPURenderPassEncoder, plotArea: IPlotArea): void;
  renderDebug(
    pass: GPURenderPassEncoder,
    debugPipeline: GPURenderPipeline,
    plotArea: IPlotArea
  ): void;
  dispose(): void;
}
