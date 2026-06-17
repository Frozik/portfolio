import type { IBlockEntry, IPlotArea } from '../../domain/types';
import type { SlotAllocator } from '../slot-allocator';

export interface ISeriesLayer {
  init(gpuDevice: GPUDevice, layout: GPUBindGroupLayout, slotAllocator: SlotAllocator): void;
  updateBindGroup(dataTextureView: GPUTextureView): void;
  writeUniforms(
    blocks: ReadonlyArray<IBlockEntry>,
    canvasWidth: number,
    canvasHeight: number,
    viewTimeStart: number,
    viewTimeEnd: number,
    viewValueMin: number,
    viewValueMax: number
  ): void;
  render(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, plotArea: IPlotArea): void;
  renderDebug(
    pass: GPURenderPassEncoder,
    debugPipeline: GPURenderPipeline,
    plotArea: IPlotArea
  ): void;
  readonly instanceCount: number;
  readonly bindGroup: GPUBindGroup | null;
  dispose(): void;
}

export interface ISeriesLayerManager {
  renderAll(pass: GPURenderPassEncoder, plotArea: IPlotArea): void;
  renderDebug(
    pass: GPURenderPassEncoder,
    debugPipeline: GPURenderPipeline,
    plotArea: IPlotArea
  ): void;
  dispose(): void;
}
