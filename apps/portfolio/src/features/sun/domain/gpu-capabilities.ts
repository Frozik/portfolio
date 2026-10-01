/** What the WebGPU adapter says of itself and of what it can do. */
export interface GpuCapabilities {
  readonly vendor: string;
  readonly architecture: string;
  readonly device: string;
  readonly description: string;
  /** A software adapter — no hardware acceleration; unknown where the browser does not say. */
  readonly isFallback: boolean | undefined;
  readonly canvasFormat: string;
  readonly features: readonly string[];
  readonly limits: readonly GpuLimit[];
}

export interface GpuLimit {
  readonly name: string;
  readonly value: number;
}

/** What WebGL says of the card: browsers that mask the WebGPU adapter still name it here. */
export interface WebGlInfo {
  readonly renderer: string;
  readonly vendor: string;
  /** WebGL itself runs without hardware acceleration; unknown when the browser gave no context to ask. */
  readonly isSoftware: boolean | undefined;
  readonly maxTextureSize: number;
}

type GpuFailureReason = 'no-api' | 'insecure-context' | 'no-adapter' | 'no-device' | 'device-lost';

/** Why there is no WebGPU to draw with, as far down the bring-up as it got. */
export interface GpuFailure {
  readonly reason: GpuFailureReason;
  /** What the browser said, when it said anything. */
  readonly detail: string | undefined;
}

export type GpuStatus =
  | { readonly kind: 'pending' }
  | { readonly kind: 'ready'; readonly capabilities: GpuCapabilities }
  | { readonly kind: 'unavailable'; readonly failure: GpuFailure };

export const GPU_PENDING: GpuStatus = { kind: 'pending' };

/** Every optional feature of the WebGPU specification: an adapter lacking one is told apart from a feature nobody knows. */
const SPEC_FEATURES: readonly string[] = [
  'core-features-and-limits',
  'depth-clip-control',
  'depth32float-stencil8',
  'texture-compression-bc',
  'texture-compression-bc-sliced-3d',
  'texture-compression-etc2',
  'texture-compression-astc',
  'texture-compression-astc-sliced-3d',
  'timestamp-query',
  'indirect-first-instance',
  'shader-f16',
  'rg11b10ufloat-renderable',
  'bgra8unorm-storage',
  'float32-filterable',
  'float32-blendable',
  'clip-distances',
  'dual-source-blending',
  'subgroups',
  'texture-formats-tier1',
  'texture-formats-tier2',
  'primitive-index',
  'texture-component-swizzle',
];

/** The limits a renderer runs into first, in the order they are shown; the full list goes into the copied report. */
const KEY_LIMITS: readonly string[] = [
  'maxTextureDimension2D',
  'maxTextureArrayLayers',
  'maxBufferSize',
  'maxUniformBufferBindingSize',
  'maxStorageBufferBindingSize',
  'maxVertexBuffers',
  'maxVertexAttributes',
  'maxBindGroups',
  'maxSampledTexturesPerShaderStage',
  'maxStorageBuffersPerShaderStage',
  'maxColorAttachments',
  'maxComputeInvocationsPerWorkgroup',
];

export interface FeatureSupport {
  readonly name: string;
  readonly isSupported: boolean;
}

/** The specification's features with whether the adapter has each, then whatever else the adapter offers. */
export function featureSupportOf(capabilities: GpuCapabilities): readonly FeatureSupport[] {
  const offered = new Set(capabilities.features);
  const beyondSpec = capabilities.features.filter(name => !SPEC_FEATURES.includes(name)).sort();
  return [
    ...SPEC_FEATURES.map(name => ({ name, isSupported: offered.has(name) })),
    ...beyondSpec.map(name => ({ name, isSupported: true })),
  ];
}

export function keyLimitsOf(capabilities: GpuCapabilities): readonly GpuLimit[] {
  return KEY_LIMITS.flatMap(name => capabilities.limits.filter(limit => limit.name === name));
}

export type Acceleration = 'hardware' | 'software' | 'unknown';

/** Whether drawing is hardware accelerated: the WebGPU adapter's word first, WebGL's where it has none. */
export function accelerationOf(gpu: GpuStatus, webgl: WebGlInfo | undefined): Acceleration {
  const isSoftware = gpu.kind === 'ready' ? gpu.capabilities.isFallback : undefined;
  switch (isSoftware ?? webgl?.isSoftware) {
    case true:
      return 'software';
    case false:
      return 'hardware';
    default:
      return 'unknown';
  }
}
