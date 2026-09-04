import type { IBlockEntry, IPlotArea } from '../../domain/types';
import type { ISeriesLayer, ISeriesLayerManager, ISeriesUniforms } from './types';

interface ISeriesLayerEntry {
  readonly layer: ISeriesLayer;
  readonly pipeline: GPURenderPipeline;
}

export class SeriesLayerManager implements ISeriesLayerManager {
  private readonly entries: ISeriesLayerEntry[] = [];

  addSeries(layer: ISeriesLayer, pipeline: GPURenderPipeline): void {
    this.entries.push({ layer, pipeline });
  }

  updateBindGroups(dataTextureView: GPUTextureView): void {
    for (const entry of this.entries) {
      entry.layer.updateBindGroup(dataTextureView);
    }
  }

  /** `blockSets[index]` belongs to the series added at `index`. */
  writeAllUniforms(
    blockSets: readonly (readonly IBlockEntry[])[],
    uniforms: ISeriesUniforms
  ): void {
    this.entries.forEach((entry, index) => {
      entry.layer.writeUniforms(blockSets[index] ?? [], uniforms);
    });
  }

  renderAll(pass: GPURenderPassEncoder, plotArea: IPlotArea): void {
    for (const entry of this.entries) {
      entry.layer.render(pass, entry.pipeline, plotArea);
    }
  }

  /** Every layer draws its block outlines with the shared debug pipeline over its own bind group. */
  renderDebug(
    pass: GPURenderPassEncoder,
    debugPipeline: GPURenderPipeline,
    plotArea: IPlotArea
  ): void {
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
