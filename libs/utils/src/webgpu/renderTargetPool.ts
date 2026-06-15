// WebGPU GPUTextureUsage flags by their numeric spec values — referenced by
// name here instead of raw hex, but not via the `GPUTextureUsage` global since
// that isn't defined in the happy-dom test environment this module is imported
// under.
const TEXTURE_USAGE_RENDER_ATTACHMENT = 0x10;
const TEXTURE_USAGE_COPY_SRC = 0x01;
const RENDER_TARGET_USAGE = TEXTURE_USAGE_RENDER_ATTACHMENT | TEXTURE_USAGE_COPY_SRC;

/**
 * Pool of reusable GPUTexture instances used as intermediate render targets.
 *
 * In Approach D rendering, each chart renders into a plain GPUTexture (via MSAA resolve),
 * then copies it to the OffscreenCanvas texture within the same command encoder.
 * This guarantees GPU execution order and eliminates the iOS Safari race condition
 * where transferToImageBitmap() could capture stale pixels.
 *
 * When all targets share the same dimensions, the pool typically holds a single
 * texture that is reused across all acquire/release cycles each frame.
 */
export class RenderTargetPool {
  private readonly available: GPUTexture[] = [];

  acquire(device: GPUDevice, width: number, height: number, format: GPUTextureFormat): GPUTexture {
    const existingIndex = this.available.findIndex(
      texture => texture.width === width && texture.height === height
    );

    if (existingIndex !== -1) {
      const [texture] = this.available.splice(existingIndex, 1);
      return texture;
    }

    return device.createTexture({
      size: [width, height],
      format,
      usage: RENDER_TARGET_USAGE,
    });
  }

  release(texture: GPUTexture): void {
    this.available.push(texture);
  }

  dispose(): void {
    for (const texture of this.available) {
      texture.destroy();
    }
    this.available.length = 0;
  }
}
