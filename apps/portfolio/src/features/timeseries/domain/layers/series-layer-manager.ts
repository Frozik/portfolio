import type { IDataPart, IPlotArea, ISeriesLayer } from '../types';

interface SeriesLayerEntry {
  readonly layer: ISeriesLayer;
  readonly pipeline: GPURenderPipeline;
  readonly partKey: string;
}

export class SeriesLayerManager {
  private readonly entries: SeriesLayerEntry[] = [];

  addSeries(layer: ISeriesLayer, pipeline: GPURenderPipeline, partKey: string): void {
    this.entries.push({ layer, pipeline, partKey });
  }

  initAll(device: GPUDevice, bindGroupLayout: GPUBindGroupLayout): void {
    for (const entry of this.entries) {
      entry.layer.init(device, bindGroupLayout);
    }
  }

  updateBindGroups(dataTextureView: GPUTextureView): void {
    for (const entry of this.entries) {
      entry.layer.updateBindGroup(dataTextureView);
    }
  }

  writeAllUniforms(
    parts: Readonly<Record<string, IDataPart>>,
    canvasWidth: number,
    canvasHeight: number,
    viewTimeStart: number,
    viewTimeEnd: number,
    viewValueMin: number,
    viewValueMax: number
  ): void {
    for (const entry of this.entries) {
      const part = parts[entry.partKey];
      entry.layer.writeUniforms(
        part,
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

  dispose(): void {
    for (const entry of this.entries) {
      entry.layer.dispose();
    }
  }
}
