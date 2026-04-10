import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import { TEXTURE_WIDTH } from '../constants';
import commonShaderSource from '../shaders/common.wgsl?raw';
import type { IDataPart, IPlotArea, ISeriesLayer } from '../types';

export class SeriesLayer implements ISeriesLayer {
  private device!: GPUDevice;
  private bindGroupLayout!: GPUBindGroupLayout;
  private uniformBuffer!: GPUBuffer;
  private uniformView!: StructuredView;
  private currentBindGroup: GPUBindGroup | null = null;
  private currentInstanceCount = 0;

  constructor(private readonly verticesPerInstance: number) {}

  init(gpuDevice: GPUDevice, layout: GPUBindGroupLayout): void {
    this.device = gpuDevice;
    this.bindGroupLayout = layout;

    const definitions = makeShaderDataDefinitions(commonShaderSource);
    this.uniformView = makeStructuredView(definitions.uniforms.U);

    this.uniformBuffer = this.device.createBuffer({
      size: this.uniformView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  updateBindGroup(dataTextureView: GPUTextureView): void {
    this.currentBindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: dataTextureView },
      ],
    });
  }

  writeUniforms(
    part: IDataPart,
    canvasWidth: number,
    canvasHeight: number,
    viewTimeStart: number,
    viewTimeEnd: number,
    viewValueMin: number,
    viewValueMax: number
  ): void {
    this.currentInstanceCount = part.pointCount - 1;

    this.uniformView.set({
      viewport: [canvasWidth, canvasHeight],
      timeRangeMin: viewTimeStart - part.baseTime,
      timeRangeMax: viewTimeEnd - part.baseTime,
      valueRangeMin: viewValueMin - part.baseValue,
      valueRangeMax: viewValueMax - part.baseValue,
      pointCount: part.pointCount,
      textureWidth: TEXTURE_WIDTH,
      lineWidth: Math.max(1, window.devicePixelRatio),
      textureRow: part.textureRowStart,
      baseTime: part.baseTime,
      baseValue: part.baseValue,
    });

    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformView.arrayBuffer);
  }

  render(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, plotArea: IPlotArea): void {
    if (this.currentBindGroup === null || this.currentInstanceCount <= 0) {
      return;
    }

    pass.setScissorRect(plotArea.x, plotArea.y, plotArea.width, plotArea.height);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, this.currentBindGroup);
    pass.draw(this.verticesPerInstance, this.currentInstanceCount, 0, 0);
  }

  get instanceCount(): number {
    return this.currentInstanceCount;
  }

  get bindGroup(): GPUBindGroup | null {
    return this.currentBindGroup;
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.currentBindGroup = null;
  }
}
