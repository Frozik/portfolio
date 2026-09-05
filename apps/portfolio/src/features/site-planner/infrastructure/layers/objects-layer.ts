import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { DepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import { buildCarTemplate } from '../../domain/geometry/car-mesh';
import { buildFurnitureTemplate } from '../../domain/geometry/furniture-mesh';
import type {
  LitMesh,
  PathDrapeGeometry,
  RoofOverlayGeometry,
} from '../../domain/geometry/lit-mesh';
import { buildTreeTemplate } from '../../domain/geometry/tree-mesh';
import type { FurnitureCatalogId } from '../../domain/model/furniture';
import { FURNITURE_CATALOG } from '../../domain/model/furniture';
import type { TreeSpecies } from '../../domain/model/site-plan';
import { TREE_SPECIES } from '../../domain/model/site-plan';
import type { SceneCar } from '../../domain/terrain/place-cars';
import type { SceneFurniture } from '../../domain/terrain/place-furniture';
import type { SceneTree } from '../../domain/terrain/place-trees';
import type { WorldPoint } from '../../domain/view/world-frame';
import carTextureUrl from '../assets/car-colormap.png?url';
import carModelUrl from '../assets/car-suv.glb?url';
import { fitCarMesh } from '../gltf/fit-car-mesh';
import { parseGlb } from '../gltf/parse-glb';
import { DEPTH_FORMAT, MSAA_SAMPLE_COUNT } from '../render-constants';
import commonShaderSource from '../shaders/common.wgsl?raw';
import objectsShaderSource from '../shaders/objects.wgsl?raw';
import shadowShaderSource from '../shaders/shadow.wgsl?raw';
import type { ShadowMap } from '../shadow-map';
import { SHADOW_FORMAT } from '../shadow-map';
import type { GpuMesh } from './gpu-mesh';
import {
  bindGpuMesh,
  createIndexBuffer,
  createVertexBuffer,
  releaseGpuMesh,
  uploadColoredMesh,
  uploadLitMesh,
} from './gpu-mesh';
import type { ShadowCaster } from './shadow-caster';

const objectsSource = commonShaderSource + shadowShaderSource + objectsShaderSource;

const FLOAT32_BYTES = 4;
const WORLD_FLOATS_PER_VERTEX = 3;
const VERTEX_STRIDE = WORLD_FLOATS_PER_VERTEX * FLOAT32_BYTES;
/** A tree instance: where its trunk stands, then its crown radius and its height. */
const TREE_INSTANCE_FLOATS = 5;
/** A car instance: where it stands, then the turn of its nose off plan east. */
const CAR_INSTANCE_FLOATS = 4;
/** Both layouts put the world position first, so the second attribute starts here. */
const INSTANCE_TRANSFORM_OFFSET = WORLD_FLOATS_PER_VERTEX * FLOAT32_BYTES;

/** Where a planted tree stands and how big it grew; one per instance. */
const TREE_INSTANCE_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: TREE_INSTANCE_FLOATS * FLOAT32_BYTES,
  stepMode: 'instance',
  attributes: [
    { shaderLocation: 3, offset: 0, format: 'float32x3' },
    { shaderLocation: 4, offset: INSTANCE_TRANSFORM_OFFSET, format: 'float32x2' },
  ],
};

/** Where a parked car stands and which way it faces; one per instance. */
const CAR_INSTANCE_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: CAR_INSTANCE_FLOATS * FLOAT32_BYTES,
  stepMode: 'instance',
  attributes: [
    { shaderLocation: 3, offset: 0, format: 'float32x3' },
    { shaderLocation: 4, offset: INSTANCE_TRANSFORM_OFFSET, format: 'float32' },
  ],
};

/** What stands on the ground, as the layer takes it. */
interface ObjectsInput {
  readonly house: LitMesh | undefined;
  /**
   * The storeys the editor is not aimed at, drawn faintly . Empty
   * outside the building editor, where the whole house is solid.
   */
  readonly houseGhost: LitMesh | undefined;
  readonly foundations: LitMesh | undefined;
  readonly roofOverlays: RoofOverlayGeometry;
  readonly furniture: readonly SceneFurniture[];
  readonly trees: readonly SceneTree[];
  readonly cars: readonly SceneCar[];
  readonly pathDrape: PathDrapeGeometry;
}

/** The instances drawn from one template, grown as the planting does. */
interface TemplateInstances {
  readonly buffer: GPUBuffer;
  readonly count: number;
}

/**
 * Everything standing on the terrain: the house extruded from its footprint, the
 * paths draped over the ground, and the trees.
 *
 * The house and the paths arrive as finished world-space triangles — the
 * extrusion and the drape have already placed them, which is what keeps the pad
 * elevation and the lie of the paving properties of the plan rather than of the
 * renderer. The trees are the exception, and deliberately: every tree of a
 * species is one low-polygon template at a different size, so the template is
 * uploaded once and each tree is an instance of five numbers.
 *
 * Last layer of the frame, and so the one that closes it: it draws against the
 * depth the ground pass left behind and resolves the shared multisampled target
 * onto the canvas — which its pass does even with nothing to draw.
 */
export class ObjectsLayer implements RenderLayer, ShadowCaster {
  private device: GPUDevice | undefined;
  private format!: GPUTextureFormat;
  private housePipeline!: GPURenderPipeline;
  private houseGhostPipeline!: GPURenderPipeline;
  private foundationPipeline!: GPURenderPipeline;
  private greenRoofPipeline!: GPURenderPipeline;
  private terracePipeline!: GPURenderPipeline;
  private dirtPathPipeline!: GPURenderPipeline;
  private asphaltPathPipeline!: GPURenderPipeline;
  private blendPathPipeline!: GPURenderPipeline;
  private treePipeline!: GPURenderPipeline;
  private carPipeline!: GPURenderPipeline;
  private meshShadowPipeline!: GPURenderPipeline;
  private treeShadowPipeline!: GPURenderPipeline;
  private carShadowPipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;

  private houseMesh: GpuMesh | undefined;
  private houseGhostMesh: GpuMesh | undefined;
  private foundationsMesh: GpuMesh | undefined;
  private greenRoofMesh: GpuMesh | undefined;
  private terraceMesh: GpuMesh | undefined;
  private dirtPathMesh: GpuMesh | undefined;
  private asphaltPathMesh: GpuMesh | undefined;
  private blendPathMesh: GpuMesh | undefined;
  private readonly treeTemplates = new Map<TreeSpecies, GpuMesh>();
  private readonly treeInstances = new Map<TreeSpecies, TemplateInstances>();
  /** One sculpted template per catalogue row, instanced the way the cars are. */
  private readonly furnitureTemplates = new Map<FurnitureCatalogId, GpuMesh>();
  private readonly furnitureInstances = new Map<FurnitureCatalogId, TemplateInstances>();
  private carTemplate: GpuMesh | undefined;
  private carInstances: TemplateInstances | undefined;
  /** The loaded, textured car; until it arrives the sculpted template stands in. */
  private texturedCarPipeline: GPURenderPipeline | undefined;
  private texturedCarMesh: GpuMesh | undefined;
  private assetTexture: GPUTexture | undefined;
  private assetBindGroup: GPUBindGroup | undefined;

  /** Objects handed over before the device came up, uploaded as soon as it does. */
  private pendingObjects: ObjectsInput | undefined;

  constructor(
    private readonly sceneUniformBuffer: GPUBuffer,
    private readonly msaaManager: MsaaTextureManager,
    private readonly depthManager: DepthTextureManager,
    private readonly shadowMap: ShadowMap
  ) {}

  init({ device, format }: GpuContext): void {
    this.device = device;
    this.format = format;

    const shaderModule = device.createShaderModule({ code: objectsSource });
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.sceneUniformBuffer } }],
    });

    // The camera passes read the shadow map through group 1; the shadow pass
    // writes it, and so must be built without it — a texture cannot be an
    // attachment and a bound resource of the same pass.
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout, this.shadowMap.bindGroupLayout],
    });
    const shadowLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    this.housePipeline = this.createLitPipeline(device, shaderModule, layout, 'fsObject');
    this.houseGhostPipeline = this.createLitPipeline(
      device,
      shaderModule,
      layout,
      'fsGhostObject',
      {
        isGhost: true,
      }
    );
    this.foundationPipeline = this.createLitPipeline(device, shaderModule, layout, 'fsFoundation');
    this.greenRoofPipeline = this.createLitPipeline(device, shaderModule, layout, 'fsGreenRoof');
    this.terracePipeline = this.createLitPipeline(device, shaderModule, layout, 'fsTerrace');
    this.dirtPathPipeline = this.createLitPipeline(device, shaderModule, layout, 'fsPathDirt');
    this.asphaltPathPipeline = this.createLitPipeline(
      device,
      shaderModule,
      layout,
      'fsPathAsphalt'
    );
    // The seam blends arrive painted per vertex, so their pipeline reads a
    // colour buffer and shades through the same fsColored the trees use.
    this.blendPathPipeline = this.createLitPipeline(device, shaderModule, layout, 'fsColored', {
      vertexEntryPoint: 'vsColoredMesh',
      buffers: [positionLayout(0), positionLayout(1), positionLayout(2)],
    });
    this.treePipeline = this.createInstancedPipeline(device, shaderModule, layout, {
      vertexEntryPoint: 'vsTree',
      instanceLayout: TREE_INSTANCE_LAYOUT,
    });
    this.carPipeline = this.createInstancedPipeline(device, shaderModule, layout, {
      vertexEntryPoint: 'vsCar',
      instanceLayout: CAR_INSTANCE_LAYOUT,
    });

    const textureBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      ],
    });
    const texturedLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout, this.shadowMap.bindGroupLayout, textureBindGroupLayout],
    });

    this.texturedCarPipeline = device.createRenderPipeline({
      layout: texturedLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vsTexturedCar',
        buffers: [positionLayout(0), positionLayout(1), uvLayout(2), CAR_INSTANCE_LAYOUT],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fsTextured',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
    void this.loadTexturedCar(device, textureBindGroupLayout);
    this.meshShadowPipeline = device.createRenderPipeline({
      layout: shadowLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vsObjectShadow',
        buffers: [positionLayout(0)],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: SHADOW_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });
    this.treeShadowPipeline = this.createInstancedShadowPipeline(
      device,
      shaderModule,
      shadowLayout,
      {
        vertexEntryPoint: 'vsTreeShadow',
        instanceLayout: TREE_INSTANCE_LAYOUT,
      }
    );
    this.carShadowPipeline = this.createInstancedShadowPipeline(
      device,
      shaderModule,
      shadowLayout,
      { vertexEntryPoint: 'vsCarShadow', instanceLayout: CAR_INSTANCE_LAYOUT }
    );

    for (const species of TREE_SPECIES) {
      const template = uploadColoredMesh(device, buildTreeTemplate(species));

      if (!isNil(template)) {
        this.treeTemplates.set(species, template);
      }
    }

    this.carTemplate = uploadColoredMesh(device, buildCarTemplate());

    for (const entry of FURNITURE_CATALOG) {
      const furnitureTemplate = uploadColoredMesh(device, buildFurnitureTemplate(entry));

      if (!isNil(furnitureTemplate)) {
        this.furnitureTemplates.set(entry.id, furnitureTemplate);
      }
    }

    this.uploadPendingObjects();
  }

  /** Replaces everything standing on the ground with what the plan says now. */
  applyObjects(objects: ObjectsInput): void {
    this.pendingObjects = objects;
    this.uploadPendingObjects();
  }

  update(): void {}

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void {
    const device = this.device;

    if (isNil(device)) {
      return;
    }

    const msaaView = this.msaaManager.ensureView(
      device,
      this.format,
      state.canvasWidth,
      state.canvasHeight
    );

    if (isNil(msaaView)) {
      return;
    }

    // The pass runs even with an empty plot: it is what resolves everything the
    // layers before it painted onto the canvas.
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaView,
          resolveTarget: canvasView,
          loadOp: 'load',
          storeOp: 'discard',
        },
      ],
      depthStencilAttachment: {
        view: this.depthManager.ensureView(device, state.canvasWidth, state.canvasHeight),
        depthLoadOp: 'load',
        depthStoreOp: 'discard',
      },
    });

    pass.setBindGroup(0, this.bindGroup);
    pass.setBindGroup(1, this.shadowMap.bindGroup);

    this.drawMesh(pass, this.dirtPathPipeline, this.dirtPathMesh);
    this.drawMesh(pass, this.asphaltPathPipeline, this.asphaltPathMesh);
    this.drawMesh(pass, this.blendPathPipeline, this.blendPathMesh);
    this.drawMesh(pass, this.foundationPipeline, this.foundationsMesh);
    this.drawMesh(pass, this.housePipeline, this.houseMesh);
    this.drawMesh(pass, this.greenRoofPipeline, this.greenRoofMesh);
    this.drawMesh(pass, this.terracePipeline, this.terraceMesh);
    this.drawTrees(pass, this.treePipeline);
    this.drawCars(pass, this.carPipeline);
    // Ghost storeys blend over the solid scene, so they come after it.
    this.drawMesh(pass, this.houseGhostPipeline, this.houseGhostMesh);
    // Furniture rides the cars' pipeline: the same position-and-turn instancing.
    this.drawFurniture(pass, this.carPipeline);

    pass.end();
  }

  /** Everything standing on the ground, drawn into the shadow map from the sun. */
  drawShadow(pass: GPURenderPassEncoder): void {
    pass.setBindGroup(0, this.bindGroup);

    this.drawMesh(pass, this.meshShadowPipeline, this.dirtPathMesh);
    this.drawMesh(pass, this.meshShadowPipeline, this.asphaltPathMesh);
    this.drawMesh(pass, this.meshShadowPipeline, this.blendPathMesh);
    this.drawMesh(pass, this.meshShadowPipeline, this.foundationsMesh);
    this.drawMesh(pass, this.meshShadowPipeline, this.houseMesh);
    // Ghosted storeys cast their full shadow: dimming a storey is a reading
    // aid for the editor, not a change to the building, and a house that
    // stopped shading its own yard the moment its ground floor was opened
    // would answer the sun study for a plan nobody drew.
    this.drawMesh(pass, this.meshShadowPipeline, this.houseGhostMesh);
    this.drawMesh(pass, this.meshShadowPipeline, this.greenRoofMesh);
    this.drawMesh(pass, this.meshShadowPipeline, this.terraceMesh);
    this.drawFurniture(pass, this.carShadowPipeline);
    this.drawTrees(pass, this.treeShadowPipeline);
    this.drawCars(pass, this.carShadowPipeline);
  }

  dispose(): void {
    releaseGpuMesh(this.houseMesh);
    releaseGpuMesh(this.houseGhostMesh);
    releaseGpuMesh(this.foundationsMesh);
    releaseGpuMesh(this.greenRoofMesh);
    releaseGpuMesh(this.terraceMesh);
    releaseGpuMesh(this.dirtPathMesh);
    releaseGpuMesh(this.asphaltPathMesh);
    releaseGpuMesh(this.blendPathMesh);
    this.houseMesh = undefined;
    this.houseGhostMesh = undefined;
    this.foundationsMesh = undefined;
    this.greenRoofMesh = undefined;
    this.terraceMesh = undefined;
    this.dirtPathMesh = undefined;
    this.asphaltPathMesh = undefined;
    this.blendPathMesh = undefined;

    for (const template of this.treeTemplates.values()) {
      releaseGpuMesh(template);
    }

    for (const instances of this.treeInstances.values()) {
      instances.buffer.destroy();
    }

    releaseGpuMesh(this.carTemplate);
    this.carInstances?.buffer.destroy();
    this.carTemplate = undefined;
    this.carInstances = undefined;

    this.treeTemplates.clear();
    this.treeInstances.clear();

    for (const instances of this.furnitureInstances.values()) {
      instances.buffer.destroy();
    }

    this.furnitureTemplates.clear();
    this.furnitureInstances.clear();
    releaseGpuMesh(this.texturedCarMesh);
    this.texturedCarMesh = undefined;
    this.assetTexture?.destroy();
    this.assetTexture = undefined;
    this.assetBindGroup = undefined;
    this.device = undefined;
    this.pendingObjects = undefined;
  }

  private createLitPipeline(
    device: GPUDevice,
    shaderModule: GPUShaderModule,
    layout: GPUPipelineLayout,
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
                format: this.format,
                blend: {
                  color: {
                    srcFactor: 'src-alpha',
                    dstFactor: 'one-minus-src-alpha',
                    operation: 'add',
                  },
                  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                },
              }
            : { format: this.format },
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
  private createInstancedPipeline(
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
        buffers: [positionLayout(0), positionLayout(1), positionLayout(2), instanceLayout],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fsColored',
        targets: [{ format: this.format }],
      },
      // A crown is a closed volume, but the templates are thin enough at the
      // apex that culling would blink facets away as the camera turns.
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
  }

  /** The same instancing as the sun sees it: positions and nothing else. */
  private createInstancedShadowPipeline(
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

  private drawMesh(
    pass: GPURenderPassEncoder,
    pipeline: GPURenderPipeline,
    mesh: GpuMesh | undefined
  ): void {
    if (isNil(mesh)) {
      return;
    }

    pass.setPipeline(pipeline);
    bindGpuMesh(pass, mesh);
    pass.drawIndexed(mesh.indexCount);
  }

  private drawTrees(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline): void {
    let hasSetPipeline = false;

    for (const [species, instances] of this.treeInstances) {
      const template = this.treeTemplates.get(species);

      if (isNil(template) || instances.count === 0) {
        continue;
      }

      if (!hasSetPipeline) {
        pass.setPipeline(pipeline);
        hasSetPipeline = true;
      }

      bindGpuMesh(pass, template);
      pass.setVertexBuffer(template.vertexBuffers.length, instances.buffer);
      pass.drawIndexed(template.indexCount, instances.count);
    }
  }

  private drawCars(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline): void {
    const instances = this.carInstances;

    if (isNil(instances) || instances.count === 0) {
      return;
    }

    // The loaded, textured asset takes over from the sculpted stand-in as soon
    // as it is ready; the shadow pass keeps its own pipeline either way.
    const isColorPass = pipeline === this.carPipeline;
    const texturedReady =
      isColorPass &&
      !isNil(this.texturedCarPipeline) &&
      !isNil(this.texturedCarMesh) &&
      !isNil(this.assetBindGroup);
    const template = texturedReady ? this.texturedCarMesh : this.carTemplate;

    if (isNil(template)) {
      return;
    }

    if (texturedReady && !isNil(this.texturedCarPipeline) && !isNil(this.assetBindGroup)) {
      pass.setPipeline(this.texturedCarPipeline);
      pass.setBindGroup(2, this.assetBindGroup);
    } else {
      pass.setPipeline(pipeline);
    }

    bindGpuMesh(pass, template);
    pass.setVertexBuffer(template.vertexBuffers.length, instances.buffer);
    pass.drawIndexed(template.indexCount, instances.count);
  }

  /**
   * Fetches the bundled CC0 car asset (Kenney car kit) and its palette, and
   * swaps it in once uploaded. Failures leave the sculpted car in place —
   * the asset is bundled, so the fetch only fails in truly broken setups.
   */
  private async loadTexturedCar(
    device: GPUDevice,
    textureBindGroupLayout: GPUBindGroupLayout
  ): Promise<void> {
    try {
      const [modelBuffer, imageBlob] = await Promise.all([
        fetch(carModelUrl).then(response => response.arrayBuffer()),
        fetch(carTextureUrl).then(response => response.blob()),
      ]);
      const mesh = fitCarMesh(parseGlb(modelBuffer));
      const image = await createImageBitmap(imageBlob);

      // The device may have been torn down while the asset was in flight.
      if (this.device !== device) {
        return;
      }

      const texture = device.createTexture({
        size: [image.width, image.height],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });

      device.queue.copyExternalImageToTexture({ source: image }, { texture }, [
        image.width,
        image.height,
      ]);

      this.assetTexture = texture;
      this.assetBindGroup = device.createBindGroup({
        layout: textureBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
          },
          { binding: 1, resource: texture.createView() },
        ],
      });
      this.texturedCarMesh = {
        vertexBuffers: [
          createVertexBuffer(device, mesh.positions),
          createVertexBuffer(device, mesh.normals),
          createVertexBuffer(device, mesh.uvs),
        ],
        indexBuffer: createIndexBuffer(device, mesh.indices),
        indexCount: mesh.indices.length,
      };
    } catch {
      // The sculpted template keeps standing in.
    }
  }

  private uploadPendingObjects(): void {
    const device = this.device;
    const objects = this.pendingObjects;

    if (isNil(device) || isNil(objects)) {
      return;
    }

    this.pendingObjects = undefined;

    releaseGpuMesh(this.houseMesh);
    releaseGpuMesh(this.houseGhostMesh);
    releaseGpuMesh(this.foundationsMesh);
    releaseGpuMesh(this.greenRoofMesh);
    releaseGpuMesh(this.terraceMesh);
    releaseGpuMesh(this.dirtPathMesh);
    releaseGpuMesh(this.asphaltPathMesh);
    releaseGpuMesh(this.blendPathMesh);
    this.houseMesh = uploadLitMesh(device, objects.house);
    this.houseGhostMesh = uploadLitMesh(device, objects.houseGhost);
    this.foundationsMesh = uploadLitMesh(device, objects.foundations);
    this.greenRoofMesh = uploadLitMesh(device, objects.roofOverlays.green);
    this.terraceMesh = uploadLitMesh(device, objects.roofOverlays.terrace);
    this.uploadFurnitureInstances(device, objects.furniture);
    this.dirtPathMesh = uploadLitMesh(device, objects.pathDrape.dirt);
    this.asphaltPathMesh = uploadLitMesh(device, objects.pathDrape.asphalt);
    this.blendPathMesh = uploadColoredMesh(device, objects.pathDrape.blend);
    this.uploadTreeInstances(device, objects.trees);
    this.carInstances = replaceInstances(
      device,
      this.carInstances,
      buildTurnedInstanceData(objects.cars),
      objects.cars.length
    );
  }

  /** One instance buffer per catalogue row, each replaced whole. */
  private uploadFurnitureInstances(device: GPUDevice, furniture: readonly SceneFurniture[]): void {
    for (const entry of FURNITURE_CATALOG) {
      const pieces = furniture.filter(piece => piece.catalogId === entry.id);
      const instances = replaceInstances(
        device,
        this.furnitureInstances.get(entry.id),
        buildTurnedInstanceData(pieces),
        pieces.length
      );

      if (isNil(instances)) {
        this.furnitureInstances.delete(entry.id);
      } else {
        this.furnitureInstances.set(entry.id, instances);
      }
    }
  }

  private drawFurniture(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline): void {
    let hasSetPipeline = false;

    for (const [catalogId, template] of this.furnitureTemplates) {
      const instances = this.furnitureInstances.get(catalogId);

      if (isNil(instances) || instances.count === 0) {
        continue;
      }

      if (!hasSetPipeline) {
        pass.setPipeline(pipeline);
        hasSetPipeline = true;
      }

      bindGpuMesh(pass, template);
      pass.setVertexBuffer(template.vertexBuffers.length, instances.buffer);
      pass.drawIndexed(template.indexCount, instances.count);
    }
  }

  /** One instance buffer per species, each replaced whole. */
  private uploadTreeInstances(device: GPUDevice, trees: readonly SceneTree[]): void {
    for (const species of TREE_SPECIES) {
      const speciesTrees = trees.filter(tree => tree.species === species);
      const instances = replaceInstances(
        device,
        this.treeInstances.get(species),
        buildTreeInstanceData(speciesTrees),
        speciesTrees.length
      );

      if (isNil(instances)) {
        this.treeInstances.delete(species);
      } else {
        this.treeInstances.set(species, instances);
      }
    }
  }
}

/**
 * Puts the instance data of one template into the buffer that held the previous
 * batch. The buffer is reused while it is large enough, so planting a tree next
 * to an existing one costs a write and no allocation; a batch that has emptied
 * gives its buffer back.
 */
function replaceInstances(
  device: GPUDevice,
  existing: TemplateInstances | undefined,
  data: Float32Array,
  count: number
): TemplateInstances | undefined {
  if (count === 0) {
    existing?.buffer.destroy();

    return undefined;
  }

  const canReuseBuffer = !isNil(existing) && existing.buffer.size >= data.byteLength;

  if (!canReuseBuffer) {
    existing?.buffer.destroy();

    return { buffer: createVertexBuffer(device, data), count };
  }

  device.queue.writeBuffer(existing.buffer, 0, data);

  return { buffer: existing.buffer, count };
}

const UV_FLOATS_PER_VERTEX = 2;

/** Texture coordinates: two floats per vertex where positions carry three. */
function uvLayout(shaderLocation: number): GPUVertexBufferLayout {
  return {
    arrayStride: UV_FLOATS_PER_VERTEX * FLOAT32_BYTES,
    attributes: [{ shaderLocation, offset: 0, format: 'float32x2' }],
  };
}

function positionLayout(shaderLocation: number): GPUVertexBufferLayout {
  return {
    arrayStride: VERTEX_STRIDE,
    attributes: [{ shaderLocation, offset: 0, format: 'float32x3' }],
  };
}

function buildTreeInstanceData(trees: readonly SceneTree[]): Float32Array {
  const data = new Float32Array(trees.length * TREE_INSTANCE_FLOATS);

  trees.forEach((tree, index) => {
    const offset = index * TREE_INSTANCE_FLOATS;
    const [x, y, z] = tree.position;

    data[offset] = x;
    data[offset + 1] = y;
    data[offset + 2] = z;
    data[offset + 3] = tree.crownRadius;
    data[offset + 4] = tree.height;
  });

  return data;
}

/** Cars and furniture share the layout: where it stands and how it is turned. */
function buildTurnedInstanceData(
  objects: readonly { readonly position: WorldPoint; readonly rotationDegrees: number }[]
): Float32Array {
  const data = new Float32Array(objects.length * CAR_INSTANCE_FLOATS);

  objects.forEach((object, index) => {
    const offset = index * CAR_INSTANCE_FLOATS;
    const [x, y, z] = object.position;

    data[offset] = x;
    data[offset + 1] = y;
    data[offset + 2] = z;
    data[offset + 3] = object.rotationDegrees;
  });

  return data;
}
