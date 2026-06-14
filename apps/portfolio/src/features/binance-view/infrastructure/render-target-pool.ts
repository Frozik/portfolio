// Copied as-is from apps/portfolio/src/features/timeseries/domain/render-target-pool.ts
// GPUTextureUsage.RENDER_ATTACHMENT = 0x10, COPY_SRC = 0x01
const RENDER_TARGET_USAGE = 0x10 | 0x01;

/**
 * Pool of reusable GPUTexture instances used as intermediate render targets.
 *
 * Approach D: each frame we render into a plain GPUTexture (via MSAA
 * resolve) and `copyTextureToTexture` it onto the offscreen canvas
 * texture inside the same command encoder. This guarantees GPU
 * execution order and eliminates the iOS Safari race where
 * `transferToImageBitmap()` could capture stale pixels.
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
