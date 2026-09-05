const VERTEX_BUFFER_USAGE = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;

/** A growable vertex buffer: reallocated only when a larger upload arrives. */
export class InstanceBuffer {
  private buffer: GPUBuffer;

  constructor(
    private readonly device: GPUDevice,
    initialSize: number
  ) {
    this.buffer = device.createBuffer({ size: initialSize, usage: VERTEX_BUFFER_USAGE });
  }

  get handle(): GPUBuffer {
    return this.buffer;
  }

  write(data: Float32Array): void {
    if (data.byteLength > this.buffer.size) {
      this.buffer.destroy();
      this.buffer = this.device.createBuffer({ size: data.byteLength, usage: VERTEX_BUFFER_USAGE });
    }
    this.device.queue.writeBuffer(this.buffer, 0, data);
  }

  dispose(): void {
    this.buffer.destroy();
  }
}
