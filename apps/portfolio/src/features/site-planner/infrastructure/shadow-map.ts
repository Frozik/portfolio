import type { Mat4 } from 'wgpu-matrix';
import { mat4 } from 'wgpu-matrix';
import type { Heightfield } from '../domain/terrain/heightfield';
import { computeElevationRange } from '../domain/terrain/heightfield';
import type { Meters } from '../domain/units';
import type { WorldPoint } from '../domain/view/world-frame';
import { planToWorld } from '../domain/view/world-frame';

/**
 * One shadow map, no cascades: a plot is tens of metres across, so 2048² texels
 * over its bounding box land at about three centimetres each — finer than the
 * feature's own accuracy target. Cascades solve a problem this scene does not
 * have.
 */
export const SHADOW_MAP_SIZE = 2048;

/** Comparison sampling needs a filterable depth format; this is the portable one. */
export const SHADOW_FORMAT: GPUTextureFormat = 'depth32float';

const HALF = 0.5;

/**
 * Head-room above the ground for whatever stands on it. The light's box is built
 * from the terrain, and a tree or a house rises out of it — losing the top of a
 * tree would lose the shadow it casts, so the box grows by the tallest thing the
 * catalogue can put on the plot.
 */
const OBJECT_HEIGHT_ALLOWANCE_METERS: Meters = 15;

/**
 * A sun straight overhead leaves `lookAt` without a usable up vector; past this
 * much of the direction being vertical, the box is oriented along plan south
 * instead — the choice is arbitrary and only decides how the square box is
 * turned, which nothing downstream can see.
 */
const VERTICAL_LIGHT_THRESHOLD = 0.999;
const DEFAULT_UP: WorldPoint = [0, 1, 0];
const FALLBACK_UP: WorldPoint = [0, 0, 1];

/** How the scene is seen from the sun. */
export interface ShadowProjection {
  /** World → light clip space, as the shadow pass rasterises it. */
  readonly lightViewProjection: Mat4;
  /**
   * Depth of the light's box in metres. The depth bias is authored in metres —
   * centimetres of ground, not a fraction of whatever box the plot happens to
   * need — and this is what converts it into the [0, 1] the shader compares in.
   */
  readonly depthRangeMeters: Meters;
  /**
   * World size of one shadow texel. The normal offset that keeps a surface from
   * shadowing itself is authored in texels — the error it corrects is exactly
   * how much ground one texel has to speak for — so the box's own scale is what
   * turns it back into metres.
   */
  readonly texelWorldSizeMeters: Meters;
}

/**
 * What the scene is lit by before a terrain has arrived: the identity transform
 * sends every metre of the plot far outside the light's clip volume, where the
 * lookup answers "nothing in the way" — the one honest answer for a map that has
 * had nothing rendered into it yet.
 */
export const EMPTY_SHADOW_PROJECTION: ShadowProjection = {
  lightViewProjection: mat4.identity(),
  depthRangeMeters: 1,
  // No box, hence no texel to offset a receiver against.
  texelWorldSizeMeters: 0,
};

/** The resources the shadow map is written to and read back from. */
export interface ShadowMap {
  /** Depth attachment of the shadow pass. */
  readonly depthView: GPUTextureView;
  /** Layout of group 1: the map and its comparison sampler, shared by every layer. */
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly bindGroup: GPUBindGroup;
  dispose(): void;
}

export function createShadowMap(device: GPUDevice): ShadowMap {
  const texture = device.createTexture({
    size: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE],
    format: SHADOW_FORMAT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'depth' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'comparison' },
      },
    ],
  });
  const sampler = device.createSampler({
    compare: 'less',
    magFilter: 'linear',
    minFilter: 'linear',
  });

  const depthView = texture.createView();

  return {
    depthView,
    bindGroupLayout,
    bindGroup: device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: depthView },
        { binding: 1, resource: sampler },
      ],
    }),

    dispose(): void {
      texture.destroy();
    },
  };
}

/**
 * The light's view of the plot: an orthographic box sitting over the terrain's
 * bounding sphere, looking down the sun direction. Orthographic because sunlight
 * is parallel, and sized to the plot rather than to the camera — the map is
 * re-rendered when the sun or the ground moves, not when the view does.
 */
export function computeShadowProjection({
  field,
  sunDirection,
}: {
  readonly field: Heightfield;
  /** Unit vector towards the sun. */
  readonly sunDirection: WorldPoint;
}): ShadowProjection {
  const extent: Meters = (field.resolution - 1) * field.cellSizeMeters;
  const { minElevation, maxElevation } = computeElevationRange(field);
  const center = planToWorld(
    {
      x: field.originMeters.x + extent * HALF,
      y: field.originMeters.y + extent * HALF,
    },
    (minElevation + maxElevation) * HALF
  );
  const radius =
    Math.hypot(extent, extent, maxElevation - minElevation) * HALF + OBJECT_HEIGHT_ALLOWANCE_METERS;
  const eyeDistance = radius * 2;
  const eye: WorldPoint = [
    center[0] + sunDirection[0] * eyeDistance,
    center[1] + sunDirection[1] * eyeDistance,
    center[2] + sunDirection[2] * eyeDistance,
  ];
  // The scene lies between one and three radii from that eye; the near plane
  // stays at zero so the box's depth is one plain number to bias against.
  const depthRangeMeters = eyeDistance + radius;
  const up = Math.abs(sunDirection[1]) > VERTICAL_LIGHT_THRESHOLD ? FALLBACK_UP : DEFAULT_UP;

  return {
    lightViewProjection: mat4.multiply(
      mat4.ortho(-radius, radius, -radius, radius, 0, depthRangeMeters),
      mat4.lookAt(eye, center, up)
    ),
    depthRangeMeters,
    texelWorldSizeMeters: (radius * 2) / SHADOW_MAP_SIZE,
  };
}
