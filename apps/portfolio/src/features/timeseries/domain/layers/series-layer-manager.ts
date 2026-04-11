import type { SlotAllocator } from '../slot-allocator';
import type { IBlockEntry, IPlotArea, ISeriesLayer, ISeriesLayerManager } from '../types';

interface ISeriesLayerEntry {
  readonly layer: ISeriesLayer;
  readonly pipeline: GPURenderPipeline;
}

export class SeriesLayerManager implements ISeriesLayerManager {
  private readonly entries: ISeriesLayerEntry[] = [];

  addSeries(layer: ISeriesLayer, pipeline: GPURenderPipeline): void {
    this.entries.push({ layer, pipeline });
  }

  initAll(
    device: GPUDevice,
    bindGroupLayout: GPUBindGroupLayout,
    slotAllocator: SlotAllocator
  ): void {
    for (const entry of this.entries) {
      entry.layer.init(device, bindGroupLayout, slotAllocator);
    }
  }

  updateBindGroups(dataTextureView: GPUTextureView): void {
    for (const entry of this.entries) {
      entry.layer.updateBindGroup(dataTextureView);
    }
  }

  writeAllUniforms(
    blockSets: ReadonlyArray<ReadonlyArray<IBlockEntry>>,
    canvasWidth: number,
    canvasHeight: number,
    viewTimeStart: number,
    viewTimeEnd: number,
    viewValueMin: number,
    viewValueMax: number
  ): void {
    for (let index = 0; index < this.entries.length; index++) {
      const entry = this.entries[index];
      const blocks = blockSets[index] ?? [];

      entry.layer.writeUniforms(
        blocks,
        canvasWidth,
        canvasHeight,
        viewTimeStart,
        viewTimeEnd,
        viewValueMin,
        viewValueMax
      );
    }
  }

  renderAll(pass: GPURenderPassEncoder, plotArea: IPlotArea): void {
    for (const entry of this.entries) {
      entry.layer.render(pass, entry.pipeline, plotArea);
    }
  }

  renderDebug(
    pass: GPURenderPassEncoder,
    debugPipeline: GPURenderPipeline,
    plotArea: IPlotArea
  ): void {
    // Draw debug lines using each layer's bind group (which has the block descriptors)
    for (const entry of this.entries) {
      entry.layer.renderDebug(pass, debugPipeline, plotArea);
    }
  }

  dispose(): void {
    for (const entry of this.entries) {
      entry.layer.dispose();
    }
  }
}
