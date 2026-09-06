import { DEPTH_FORMAT, MSAA_SAMPLE_COUNT } from '../render-constants';
import { SHADOW_FORMAT } from '../shadow-map';
import {
  CAR_INSTANCE_LAYOUT,
  positionLayout,
  TREE_INSTANCE_LAYOUT,
  uvLayout,
} from './vertex-layouts';

/** A lit mesh in world space: the house, its foundations, the roof covers and the draped paths. */
function createLitPipeline(
  device: GPUDevice,
  shaderModule: GPUShaderModule,
  layout: GPUPipelineLayout,
  format: GPUTextureFormat,
  fragmentEntryPoint: string,
  {
    vertexEntryPoint = 'vsObject',
    buffers = [positionLayout(0), positionLayout(1)],
    isGhost = false,
  }: {
    readonly vertexEntryPoint?: string;
    readonly buffers?: readonly GPUVertexBufferLayout[];
    /** A ghosted storey blends over the scene and keeps the depth it finds. */
    readonly isGhost?: boolean;
  } = {}
): GPURenderPipeline {
  return device.createRenderPipeline({
    layout,
    vertex: {
      module: shaderModule,
      entryPoint: vertexEntryPoint,
      buffers: [...buffers],
    },
    fragment: {
      module: shaderModule,
      entryPoint: fragmentEntryPoint,
      targets: [
        isGhost
          ? {
              format: format,
              blend: {
                color: {
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              },
            }
          : { format: format },
      ],
    },
    // The lighting comes from the supplied normals rather than from the facing,
    // and the apron is a sheet with no inside to hide — so a camera dropped
    // below the pad sees the skirt instead of seeing through the house.
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: {
      format: DEPTH_FORMAT,
      depthWriteEnabled: !isGhost,
      depthCompare: 'less',
    },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });
}

/** One coloured template drawn once per instance: a species of tree, or the car. */
function createInstancedPipeline(
  device: GPUDevice,
  shaderModule: GPUShaderModule,
  layout: GPUPipelineLayout,
  format: GPUTextureFormat,
  {
    vertexEntryPoint,
    instanceLayout,
  }: {
    readonly vertexEntryPoint: string;
    readonly instanceLayout: GPUVertexBufferLayout;
  }
): GPURenderPipeline {
  return device.createRenderPipeline({
    layout,
    vertex: {
      module: shaderModule,
      entryPoint: vertexEntryPoint,
      buffers: [positionLayout(0), positionLayout(1), positionLayout(2), instanceLayout],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fsColored',
      targets: [{ format: format }],
    },
    // A crown is a closed volume, but the templates are thin enough at the
    // apex that culling would blink facets away as the camera turns.
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });
}

/** The same instancing as the sun sees it: positions and nothing else. */
function createInstancedShadowPipeline(
  device: GPUDevice,
  shaderModule: GPUShaderModule,
  layout: GPUPipelineLayout,
  {
    vertexEntryPoint,
    instanceLayout,
  }: {
    readonly vertexEntryPoint: string;
    readonly instanceLayout: GPUVertexBufferLayout;
  }
): GPURenderPipeline {
  return device.createRenderPipeline({
    layout,
    vertex: {
      module: shaderModule,
      entryPoint: vertexEntryPoint,
      // The normals and the colours of the template sit in the slots between,
      // and the shadow map has no use for either.
      buffers: [positionLayout(0), null, null, instanceLayout],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: SHADOW_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
  });
}

export interface ObjectPipelines {
  readonly house: GPURenderPipeline;
  readonly houseGhost: GPURenderPipeline;
  readonly foundation: GPURenderPipeline;
  readonly greenRoof: GPURenderPipeline;
  readonly terrace: GPURenderPipeline;
  readonly dirtPath: GPURenderPipeline;
  readonly asphaltPath: GPURenderPipeline;
  readonly blendPath: GPURenderPipeline;
  readonly tree: GPURenderPipeline;
  readonly car: GPURenderPipeline;
  readonly texturedCar: GPURenderPipeline;
  readonly meshShadow: GPURenderPipeline;
  readonly treeShadow: GPURenderPipeline;
  readonly carShadow: GPURenderPipeline;
}

export interface ObjectBindGroupLayouts {
  readonly scene: GPUBindGroupLayout;
  readonly shadow: GPUBindGroupLayout;
  readonly texture: GPUBindGroupLayout;
}

/** Every way something standing on the ground is drawn: lit, instanced, textured, and into the shadow map. */
export function createObjectPipelines(
  device: GPUDevice,
  shaderModule: GPUShaderModule,
  format: GPUTextureFormat,
  bindGroupLayouts: ObjectBindGroupLayouts
): ObjectPipelines {
  // The camera passes read the shadow map through group 1; the shadow pass
  // writes it, and so must be built without it — a texture cannot be an
  // attachment and a bound resource of the same pass.
  const layout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayouts.scene, bindGroupLayouts.shadow],
  });
  const shadowLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayouts.scene] });

  const house = createLitPipeline(device, shaderModule, layout, format, 'fsObject');
  const houseGhost = createLitPipeline(device, shaderModule, layout, format, 'fsGhostObject', {
    isGhost: true,
  });
  const foundation = createLitPipeline(device, shaderModule, layout, format, 'fsFoundation');
  const greenRoof = createLitPipeline(device, shaderModule, layout, format, 'fsGreenRoof');
  const terrace = createLitPipeline(device, shaderModule, layout, format, 'fsTerrace');
  const dirtPath = createLitPipeline(device, shaderModule, layout, format, 'fsPathDirt');
  const asphaltPath = createLitPipeline(device, shaderModule, layout, format, 'fsPathAsphalt');
  // The seam blends arrive painted per vertex, so their pipeline reads a
  // colour buffer and shades through the same fsColored the trees use.
  const blendPath = createLitPipeline(device, shaderModule, layout, format, 'fsColored', {
    vertexEntryPoint: 'vsColoredMesh',
    buffers: [positionLayout(0), positionLayout(1), positionLayout(2)],
  });
  const tree = createInstancedPipeline(device, shaderModule, layout, format, {
    vertexEntryPoint: 'vsTree',
    instanceLayout: TREE_INSTANCE_LAYOUT,
  });
  const car = createInstancedPipeline(device, shaderModule, layout, format, {
    vertexEntryPoint: 'vsCar',
    instanceLayout: CAR_INSTANCE_LAYOUT,
  });

  const texturedLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayouts.scene, bindGroupLayouts.shadow, bindGroupLayouts.texture],
  });

  const texturedCar = device.createRenderPipeline({
    layout: texturedLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vsTexturedCar',
      buffers: [positionLayout(0), positionLayout(1), uvLayout(2), CAR_INSTANCE_LAYOUT],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fsTextured',
      targets: [{ format: format }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });
  const meshShadow = device.createRenderPipeline({
    layout: shadowLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vsObjectShadow',
      buffers: [positionLayout(0)],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: SHADOW_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
  });
  const treeShadow = createInstancedShadowPipeline(device, shaderModule, shadowLayout, {
    vertexEntryPoint: 'vsTreeShadow',
    instanceLayout: TREE_INSTANCE_LAYOUT,
  });
  const carShadow = createInstancedShadowPipeline(device, shaderModule, shadowLayout, {
    vertexEntryPoint: 'vsCarShadow',
    instanceLayout: CAR_INSTANCE_LAYOUT,
  });

  return {
    house,
    houseGhost,
    foundation,
    greenRoof,
    terrace,
    dirtPath,
    asphaltPath,
    blendPath,
    tree,
    car,
    texturedCar,
    meshShadow,
    treeShadow,
    carShadow,
  };
}
