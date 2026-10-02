import type { StructuredView } from 'webgpu-utils';

import type { IChunkRef } from './chunk-store';
import type { IInstanceRange } from './visible-slice';

const INITIAL_CHUNKS = 16;
const WORDS_PER_CHUNK = 2;

export interface ILayerUniforms {
  readonly mark: number;
  readonly shape: number;
  readonly outline: number;
  readonly params: readonly [number, number, number, number];
  readonly stepOverSpan: number;
}

/**
 * One draw call's worth of state: how to draw (uniforms) and where the data
 * lies (the chunk list). The chunk list knows nothing of the mark, so several
 * layers may draw the same chunks differently (§6.5).
 */
export class Layer {
  private readonly uniformBuffer: GPUBuffer;
  private chunkBuffer: GPUBuffer;
  private chunkWords: Uint32Array<ArrayBuffer>;
  private bindGroup: GPUBindGroup;

  constructor(
    private readonly device: GPUDevice,
    private readonly layout: GPUBindGroupLayout,
    private readonly uniformView: StructuredView
  ) {
    this.uniformBuffer = device.createBuffer({
      size: uniformView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.chunkWords = new Uint32Array(INITIAL_CHUNKS * WORDS_PER_CHUNK);
    this.chunkBuffer = this.createChunkBuffer();
    this.bindGroup = this.createBindGroup();
  }

  /** Writes the layer and returns how many elements its chunks hold. */
  write(uniforms: ILayerUniforms, chunks: readonly IChunkRef[]): number {
    if (chunks.length * WORDS_PER_CHUNK > this.chunkWords.length) {
      this.chunkBuffer.destroy();
      this.chunkWords = new Uint32Array(chunks.length * WORDS_PER_CHUNK * 2);
      this.chunkBuffer = this.createChunkBuffer();
      this.bindGroup = this.createBindGroup();
    }
    let elements = 0;
    chunks.forEach((chunk, index) => {
      elements += chunk.count;
      this.chunkWords[index * WORDS_PER_CHUNK] = chunk.texel;
      this.chunkWords[index * WORDS_PER_CHUNK + 1] = elements;
    });
    this.device.queue.writeBuffer(
      this.chunkBuffer,
      0,
      this.chunkWords,
      0,
      Math.max(chunks.length, 1) * WORDS_PER_CHUNK
    );
    this.uniformView.set({ ...uniforms, chunkCount: chunks.length });
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformView.arrayBuffer);
    return elements;
  }

  draw(pass: GPURenderPassEncoder, vertices: number, instances: IInstanceRange): void {
    pass.setBindGroup(1, this.bindGroup);
    pass.draw(vertices, instances.count, 0, instances.first);
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.chunkBuffer.destroy();
  }

  private createChunkBuffer(): GPUBuffer {
    return this.device.createBuffer({
      size: this.chunkWords.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  private createBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.layout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.chunkBuffer } },
      ],
    });
  }
}
