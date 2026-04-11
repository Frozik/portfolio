import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import { BlockDescriptorBuffer } from '../block-descriptor-buffer';
import { TEXTURE_WIDTH } from '../constants';
import commonShaderSource from '../shaders/common.wgsl?raw';
import type { SlotAllocator } from '../slot-allocator';
import type { IBlockEntry, IPlotArea, ISeriesLayer } from '../types';

const DEBUG_LINE_VERTICES = 6;

export class SeriesLayer implements ISeriesLayer {
  private device!: GPUDevice;
  private bindGroupLayout!: GPUBindGroupLayout;
  private uniformBuffer!: GPUBuffer;
  private uniformView!: StructuredView;
  private descriptorBuffer!: BlockDescriptorBuffer;
  private currentBindGroup: GPUBindGroup | null = null;
  private currentInstanceCount = 0;
  private currentBlockCount = 0;

  constructor(
    private readonly verticesPerInstance: number,
    private readonly needsStitching: boolean
  ) {}

  init(gpuDevice: GPUDevice, layout: GPUBindGroupLayout, slotAllocator: SlotAllocator): void {
    this.device = gpuDevice;
    this.bindGroupLayout = layout;

    const definitions = makeShaderDataDefinitions(commonShaderSource);
    this.uniformView = makeStructuredView(definitions.uniforms.U);

    this.uniformBuffer = this.device.createBuffer({
      size: this.uniformView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.descriptorBuffer = new BlockDescriptorBuffer(gpuDevice, slotAllocator);
  }

  updateBindGroup(dataTextureView: GPUTextureView): void {
    this.currentBindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: dataTextureView },
        { binding: 2, resource: { buffer: this.descriptorBuffer.getBuffer() } },
      ],
    });
  }

  writeUniforms(
    blocks: ReadonlyArray<IBlockEntry>,
    canvasWidth: number,
    canvasHeight: number,
    viewTimeStart: number,
    viewTimeEnd: number,
    viewValueMin: number,
    viewValueMax: number
  ): void {
    if (blocks.length === 0) {
      this.currentInstanceCount = 0;
      this.currentBlockCount = 0;
      return;
    }

    this.currentBlockCount = blocks.length;

    const { totalInstances, globalBaseTime, globalBaseValue } =
      this.descriptorBuffer.writeDescriptors(blocks, this.needsStitching);

    this.currentInstanceCount = totalInstances;

    this.uniformView.set({
      viewport: [canvasWidth, canvasHeight],
      timeRangeMin: viewTimeStart - globalBaseTime,
      timeRangeMax: viewTimeEnd - globalBaseTime,
      valueRangeMin: viewValueMin - globalBaseValue,
      valueRangeMax: viewValueMax - globalBaseValue,
      textureWidth: TEXTURE_WIDTH,
      lineWidth: Math.max(1, window.devicePixelRatio),
      blockCount: blocks.length,
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

  renderDebug(
    pass: GPURenderPassEncoder,
    debugPipeline: GPURenderPipeline,
    plotArea: IPlotArea
  ): void {
    if (this.currentBindGroup === null || this.currentBlockCount <= 0) {
      return;
    }

    pass.setScissorRect(plotArea.x, plotArea.y, plotArea.width, plotArea.height);
    pass.setPipeline(debugPipeline);
    pass.setBindGroup(0, this.currentBindGroup);
    pass.draw(DEBUG_LINE_VERTICES, this.currentBlockCount, 0, 0);
  }

  get instanceCount(): number {
    return this.currentInstanceCount;
  }

  get bindGroup(): GPUBindGroup | null {
    return this.currentBindGroup;
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.descriptorBuffer.dispose();
    this.currentBindGroup = null;
  }
}
