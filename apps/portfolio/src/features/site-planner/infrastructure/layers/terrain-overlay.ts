import { isNil } from 'lodash-es';
import type { StructuredView } from 'webgpu-utils';
import { makeStructuredView } from 'webgpu-utils';

import type { AnalysisRaster } from '../../domain/terrain/analysis-raster';
import type { Meters } from '../../domain/units';
import type { OverlayResources } from './overlay-texture';
import { createOverlayTexture } from './overlay-texture';
import { createUniformBuffer } from './uniform-buffer';

const OVERLAY_CHANNELS_PER_TEXEL = 4;
/** Denominator floor of the overlay lookup, for a raster of no extent at all. */
const MIN_OVERLAY_SPAN: Meters = 0.001;
/** Half a texel: the raster's first texel is centred on the first grid sample. */
const HALF_TEXEL = 0.5;

/**
 * What the ground samples while no analysis is on: one fully transparent texel.
 * A binding cannot simply be left out, and a texture that shows nothing is a
 * shorter answer than a second pipeline without one.
 */
const PLACEHOLDER_OVERLAY_SIZE = 1;

/**
 * The analysis colouring the ground: the raster's texture, sized by the
 * raster, and the uniform that says where on the plan it lies. The placement
 * is carried in metres rather than assumed to match the grid: the terrain and
 * the overlay reach the layer through reactions of their own, and neither may
 * be read against a stale copy of the other.
 */
export class TerrainOverlay {
  private uniformView!: StructuredView;
  private uniformBufferHandle!: GPUBuffer;
  private samplerHandle!: GPUSampler;
  private placeholder!: OverlayResources;
  private resources: OverlayResources | undefined;
  /**
   * The overlay handed over before the device came up — or the fact that it was
   * switched off then, which is why the flag is carried apart from the raster.
   */
  private pending: AnalysisRaster | undefined;
  private hasPending = false;

  init(device: GPUDevice, uniformDefinition: Parameters<typeof makeStructuredView>[0]): void {
    this.uniformView = makeStructuredView(uniformDefinition);
    this.uniformBufferHandle = createUniformBuffer(device, this.uniformView);
    // Nearest, matching the plan's own `imageSmoothingEnabled = false`: one
    // texel is one grid sample, and only an identical rule leaves the two views
    // agreeing texel for texel.
    this.samplerHandle = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
    this.placeholder = createOverlayTexture(
      device,
      PLACEHOLDER_OVERLAY_SIZE,
      PLACEHOLDER_OVERLAY_SIZE
    );
    // Written before anything is drawn: an untouched uniform would leave the
    // lookup dividing the plan by a span of zero, and a NaN reaching the mix
    // would take the ground with it.
    this.writeUniform(device, undefined);
  }

  get view(): GPUTextureView {
    return (this.resources ?? this.placeholder).view;
  }

  get uniformBuffer(): GPUBuffer {
    return this.uniformBufferHandle;
  }

  get sampler(): GPUSampler {
    return this.samplerHandle;
  }

  /** Colours the ground with an analysis, or takes the colour off it. */
  apply(raster: AnalysisRaster | undefined): void {
    this.pending = raster;
    this.hasPending = true;
  }

  /** Uploads what was applied; true when the bound texture changed and the bind group is stale. */
  upload(device: GPUDevice): boolean {
    if (!this.hasPending) {
      return false;
    }

    this.hasPending = false;

    const raster = this.pending;

    this.pending = undefined;

    if (isNil(raster)) {
      const hadResources = !isNil(this.resources);

      this.releaseResources();
      this.writeUniform(device, undefined);

      return hadResources;
    }

    const { widthTexels, heightTexels, pixels } = raster;
    const isResized = this.ensureResources(device, widthTexels, heightTexels);

    device.queue.writeTexture(
      { texture: (this.resources ?? this.placeholder).texture },
      pixels,
      { bytesPerRow: widthTexels * OVERLAY_CHANNELS_PER_TEXEL, rowsPerImage: heightTexels },
      { width: widthTexels, height: heightTexels }
    );
    this.writeUniform(device, raster);

    return isResized;
  }

  dispose(): void {
    this.releaseResources();
    this.placeholder.texture.destroy();
    this.uniformBufferHandle.destroy();
    this.pending = undefined;
    this.hasPending = false;
  }

  /** The texture sized by the raster; a new one only when the raster resizes. */
  private ensureResources(device: GPUDevice, widthTexels: number, heightTexels: number): boolean {
    const existing = this.resources;

    if (
      !isNil(existing) &&
      existing.widthTexels === widthTexels &&
      existing.heightTexels === heightTexels
    ) {
      return false;
    }

    this.releaseResources();
    this.resources = createOverlayTexture(device, widthTexels, heightTexels);

    return true;
  }

  private writeUniform(device: GPUDevice, raster: AnalysisRaster | undefined): void {
    if (isNil(raster)) {
      this.uniformView.set({ minPosition: [0, 0], span: [1, 1], enabled: 0 });
    } else {
      const { originMeters, cellSizeMeters, widthTexels, heightTexels } = raster;

      this.uniformView.set({
        minPosition: [
          originMeters.x - cellSizeMeters * HALF_TEXEL,
          originMeters.y - cellSizeMeters * HALF_TEXEL,
        ],
        span: [
          Math.max(widthTexels * cellSizeMeters, MIN_OVERLAY_SPAN),
          Math.max(heightTexels * cellSizeMeters, MIN_OVERLAY_SPAN),
        ],
        enabled: 1,
      });
    }

    device.queue.writeBuffer(this.uniformBufferHandle, 0, this.uniformView.arrayBuffer);
  }

  private releaseResources(): void {
    this.resources?.texture.destroy();
    this.resources = undefined;
  }
}
