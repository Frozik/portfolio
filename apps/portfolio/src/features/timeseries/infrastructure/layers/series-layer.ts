import { isNil } from 'lodash-es';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import { TEXTURE_WIDTH } from '../../domain/constants';
import type { IBlockEntry, IPlotArea } from '../../domain/types';
import { BlockDescriptorBuffer } from '../block-descriptor-buffer';
import commonShaderSource from '../shaders/common.wgsl?raw';
import type { SlotAllocator } from '../slot-allocator';
import type { ISeriesLayer, ISeriesUniforms } from './types';

const DEBUG_LINE_VERTICES = 6;

export class SeriesLayer implements ISeriesLayer {
  private readonly device: GPUDevice;
  private readonly bindGroupLayout: GPUBindGroupLayout;
  private readonly uniformBuffer: GPUBuffer;
  private readonly uniformView: StructuredView;
  private readonly descriptorBuffer: BlockDescriptorBuffer;
  private currentBindGroup: GPUBindGroup | undefined;
  private currentInstanceCount = 0;
  private currentBlockCount = 0;

  constructor(
    device: GPUDevice,
    bindGroupLayout: GPUBindGroupLayout,
    slotAllocator: SlotAllocator,
    private readonly verticesPerInstance: number,
    private readonly needsStitching: boolean
  ) {
    this.device = device;
    this.bindGroupLayout = bindGroupLayout;
    const definitions = makeShaderDataDefinitions(commonShaderSource);
    this.uniformView = makeStructuredView(definitions.uniforms.U);
    this.uniformBuffer = device.createBuffer({
      size: this.uniformView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.descriptorBuffer = new BlockDescriptorBuffer(device, slotAllocator);
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

  writeUniforms(blocks: readonly IBlockEntry[], uniforms: ISeriesUniforms): void {
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
      viewport: [uniforms.canvasWidth, uniforms.canvasHeight],
      timeRangeMin: uniforms.viewTimeStart - globalBaseTime,
      timeRangeMax: uniforms.viewTimeEnd - globalBaseTime,
      valueRangeMin: uniforms.viewValueMin - globalBaseValue,
      valueRangeMax: uniforms.viewValueMax - globalBaseValue,
      textureWidth: TEXTURE_WIDTH,
      lineWidth: Math.max(1, window.devicePixelRatio),
      blockCount: blocks.length,
    });

    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformView.arrayBuffer);
  }

  render(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, plotArea: IPlotArea): void {
    if (isNil(this.currentBindGroup) || this.currentInstanceCount <= 0) {
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
    if (isNil(this.currentBindGroup) || this.currentBlockCount <= 0) {
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

  dispose(): void {
    this.uniformBuffer.destroy();
    this.descriptorBuffer.dispose();
    this.currentBindGroup = undefined;
  }
}
