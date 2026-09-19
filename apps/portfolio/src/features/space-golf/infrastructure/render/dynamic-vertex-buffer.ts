import type { MeshData } from './mesh-writer';

/** Doubling means a frame that keeps growing costs a handful of allocations in all. */
const GROWTH_FACTOR = 2;

export interface IDynamicVertexBufferParams {
  readonly device: GPUDevice;
  readonly strideBytes: number;
  /** Room to start with: frames under this size never allocate again. */
  readonly initialVertices: number;
  /** `GPUBufferUsage` flags — passed in so the class can be driven without the WebGPU globals. */
  readonly usage: number;
}

/**
 * A per-frame vertex buffer that grows to whatever the frame needs.
 *
 * A fixed one had to decide what to do when a frame did not fit, and dropping
 * the overflow silently is the worst answer available: the overlay is written
 * back to front, so the cut always lands on whatever was drawn last — the bow
 * the player is pulling lost its string and its arrow the moment a bonus
 * shared the screen with it.
 */
export class DynamicVertexBuffer {
  private readonly device: GPUDevice;
  private readonly strideBytes: number;
  private readonly usage: number;
  private capacityVertices: number;
  private gpu: GPUBuffer;

  constructor({ device, strideBytes, initialVertices, usage }: IDynamicVertexBufferParams) {
    this.device = device;
    this.strideBytes = strideBytes;
    this.usage = usage;
    this.capacityVertices = initialVertices;
    this.gpu = this.allocate(initialVertices);
  }

  /** The buffer to bind. Read it every frame: growing replaces it. */
  get buffer(): GPUBuffer {
    return this.gpu;
  }

  /** Puts a frame's mesh in the buffer, growing first if it does not fit. Returns the vertices to draw. */
  write(data: MeshData): number {
    if (data.vertexCount === 0) {
      return 0;
    }

    if (data.vertexCount > this.capacityVertices) {
      this.growFor(data.vertexCount);
    }

    this.device.queue.writeBuffer(
      this.gpu,
      0,
      data.vertexData,
      0,
      data.vertexCount * this.strideBytes
    );
    return data.vertexCount;
  }

  destroy(): void {
    this.gpu.destroy();
  }

  private growFor(vertices: number): void {
    let capacity = this.capacityVertices;
    while (capacity < vertices) {
      capacity *= GROWTH_FACTOR;
    }
    this.gpu.destroy();
    this.capacityVertices = capacity;
    this.gpu = this.allocate(capacity);
  }

  private allocate(vertices: number): GPUBuffer {
    return this.device.createBuffer({ size: vertices * this.strideBytes, usage: this.usage });
  }
}
