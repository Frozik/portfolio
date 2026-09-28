import { isNil } from 'lodash-es';

interface IMsaaCacheEntry {
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
}

/**
 * Multisampled colour attachments for one device drawing into canvases of
 * different sizes. A multisampled attachment must match its resolve target
 * exactly, so targets of one size share a texture and every other size gets
 * its own; `sweepUnused` drops the sizes nobody draws at any more.
 */
export class MsaaTextureCache {
  private readonly entries = new Map<string, IMsaaCacheEntry>();
  private readonly usedKeys = new Set<string>();

  constructor(
    private readonly device: GPUDevice,
    private readonly format: GPUTextureFormat,
    private readonly sampleCount: number
  ) {}

  acquireView(width: number, height: number): GPUTextureView {
    const key = `${width}x${height}`;
    this.usedKeys.add(key);

    const existing = this.entries.get(key);
    if (!isNil(existing)) {
      return existing.view;
    }

    const texture = this.device.createTexture({
      size: [width, height],
      format: this.format,
      sampleCount: this.sampleCount,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const view = texture.createView();
    this.entries.set(key, { texture, view });
    return view;
  }

  /** Destroys every texture that was not acquired since the previous sweep. */
  sweepUnused(): void {
    for (const [key, entry] of this.entries) {
      if (!this.usedKeys.has(key)) {
        entry.texture.destroy();
        this.entries.delete(key);
      }
    }
    this.usedKeys.clear();
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      entry.texture.destroy();
    }
    this.entries.clear();
    this.usedKeys.clear();
  }
}
