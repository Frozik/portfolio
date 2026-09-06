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
import type { TreeSpecies } from '../../domain/model/plot-objects';
import { TREE_SPECIES } from '../../domain/model/plot-objects';
import type { SceneCar } from '../../domain/terrain/place-cars';
import type { SceneFurniture } from '../../domain/terrain/place-furniture';
import type { SceneTree } from '../../domain/terrain/place-trees';
import commonShaderSource from '../shaders/common.wgsl?raw';
import objectsShaderSource from '../shaders/objects.wgsl?raw';
import shadowShaderSource from '../shaders/shadow.wgsl?raw';
import type { ShadowMap } from '../shadow-map';
import type { GpuMesh } from './gpu-mesh';
import { bindGpuMesh, releaseGpuMesh, uploadColoredMesh, uploadLitMesh } from './gpu-mesh';
import type { TemplateInstances } from './instanced-templates';
import {
  buildTreeInstanceData,
  buildTurnedInstanceData,
  InstancedTemplates,
  replaceInstances,
} from './instanced-templates';
import type { ObjectPipelines } from './object-pipelines';
import { createObjectPipelines } from './object-pipelines';
import type { ShadowCaster } from './shadow-caster';
import { loadTexturedCar } from './textured-car';

const objectsSource = commonShaderSource + shadowShaderSource + objectsShaderSource;

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
  private pipelines!: ObjectPipelines;
  private bindGroup!: GPUBindGroup;

  private houseMesh: GpuMesh | undefined;
  private houseGhostMesh: GpuMesh | undefined;
  private foundationsMesh: GpuMesh | undefined;
  private greenRoofMesh: GpuMesh | undefined;
  private terraceMesh: GpuMesh | undefined;
  private dirtPathMesh: GpuMesh | undefined;
  private asphaltPathMesh: GpuMesh | undefined;
  private blendPathMesh: GpuMesh | undefined;
  private readonly trees = new InstancedTemplates<TreeSpecies>();
  /** One sculpted template per catalogue row, instanced the way the cars are. */
  private readonly furniture = new InstancedTemplates<FurnitureCatalogId>();
  private carTemplate: GpuMesh | undefined;
  private carInstances: TemplateInstances | undefined;
  /** The loaded, textured car; until it arrives the sculpted template stands in. */
  private texturedCarMesh: GpuMesh | undefined;
  private assetTexture: GPUTexture | undefined;
  private assetBindGroup: GPUBindGroup | undefined;

  /** Objects handed over before the device came up, uploaded as soon as it does. */
  private pendingObjects: ObjectsInput | undefined;

  constructor(
    private readonly sceneUniformBuffer: GPUBuffer,
    private readonly msaaManager: MsaaTextureManager,
    private readonly depthManager: DepthTextureManager,
    private readonly shadowMap: ShadowMap,
    /** The bundled car asset failed to load or upload; the sculpted car keeps standing in. */
    private readonly onCarModelFailed: (error: unknown) => void
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

    const textureBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      ],
    });
    this.pipelines = createObjectPipelines(device, shaderModule, format, {
      scene: bindGroupLayout,
      shadow: this.shadowMap.bindGroupLayout,
      texture: textureBindGroupLayout,
    });
    void this.adoptTexturedCar(device, textureBindGroupLayout);

    for (const species of TREE_SPECIES) {
      this.trees.setTemplate(species, uploadColoredMesh(device, buildTreeTemplate(species)));
    }

    this.carTemplate = uploadColoredMesh(device, buildCarTemplate());

    for (const entry of FURNITURE_CATALOG) {
      this.furniture.setTemplate(
        entry.id,
        uploadColoredMesh(device, buildFurnitureTemplate(entry))
      );
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

    this.drawMesh(pass, this.pipelines.dirtPath, this.dirtPathMesh);
    this.drawMesh(pass, this.pipelines.asphaltPath, this.asphaltPathMesh);
    this.drawMesh(pass, this.pipelines.blendPath, this.blendPathMesh);
    this.drawMesh(pass, this.pipelines.foundation, this.foundationsMesh);
    this.drawMesh(pass, this.pipelines.house, this.houseMesh);
    this.drawMesh(pass, this.pipelines.greenRoof, this.greenRoofMesh);
    this.drawMesh(pass, this.pipelines.terrace, this.terraceMesh);
    this.trees.draw(pass, this.pipelines.tree);
    this.drawCars(pass, this.pipelines.car);
    // Ghost storeys blend over the solid scene, so they come after it.
    this.drawMesh(pass, this.pipelines.houseGhost, this.houseGhostMesh);
    // Furniture rides the cars' pipeline: the same position-and-turn instancing.
    this.furniture.draw(pass, this.pipelines.car);

    pass.end();
  }

  /** Everything standing on the ground, drawn into the shadow map from the sun. */
  drawShadow(pass: GPURenderPassEncoder): void {
    pass.setBindGroup(0, this.bindGroup);

    this.drawMesh(pass, this.pipelines.meshShadow, this.dirtPathMesh);
    this.drawMesh(pass, this.pipelines.meshShadow, this.asphaltPathMesh);
    this.drawMesh(pass, this.pipelines.meshShadow, this.blendPathMesh);
    this.drawMesh(pass, this.pipelines.meshShadow, this.foundationsMesh);
    this.drawMesh(pass, this.pipelines.meshShadow, this.houseMesh);
    // Ghosted storeys cast their full shadow: dimming a storey is a reading
    // aid for the editor, not a change to the building, and a house that
    // stopped shading its own yard the moment its ground floor was opened
    // would answer the sun study for a plan nobody drew.
    this.drawMesh(pass, this.pipelines.meshShadow, this.houseGhostMesh);
    this.drawMesh(pass, this.pipelines.meshShadow, this.greenRoofMesh);
    this.drawMesh(pass, this.pipelines.meshShadow, this.terraceMesh);
    this.furniture.draw(pass, this.pipelines.carShadow);
    this.trees.draw(pass, this.pipelines.treeShadow);
    this.drawCars(pass, this.pipelines.carShadow);
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

    this.trees.dispose();
    this.furniture.dispose();

    releaseGpuMesh(this.carTemplate);
    this.carInstances?.buffer.destroy();
    this.carTemplate = undefined;
    this.carInstances = undefined;

    releaseGpuMesh(this.texturedCarMesh);
    this.texturedCarMesh = undefined;
    this.assetTexture?.destroy();
    this.assetTexture = undefined;
    this.assetBindGroup = undefined;
    this.device = undefined;
    this.pendingObjects = undefined;
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

  private drawCars(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline): void {
    const instances = this.carInstances;

    if (isNil(instances) || instances.count === 0) {
      return;
    }

    // The loaded, textured asset takes over from the sculpted stand-in as soon
    // as it is ready; the shadow pass keeps its own pipeline either way.
    const isColorPass = pipeline === this.pipelines.car;
    const texturedReady =
      isColorPass && !isNil(this.texturedCarMesh) && !isNil(this.assetBindGroup);
    const template = texturedReady ? this.texturedCarMesh : this.carTemplate;

    if (isNil(template)) {
      return;
    }

    if (texturedReady && !isNil(this.assetBindGroup)) {
      pass.setPipeline(this.pipelines.texturedCar);
      pass.setBindGroup(2, this.assetBindGroup);
    } else {
      pass.setPipeline(pipeline);
    }

    bindGpuMesh(pass, template);
    pass.setVertexBuffer(template.vertexBuffers.length, instances.buffer);
    pass.drawIndexed(template.indexCount, instances.count);
  }

  /** Swaps the loaded, textured car in for the sculpted stand-in once it is uploaded. */
  private async adoptTexturedCar(
    device: GPUDevice,
    textureBindGroupLayout: GPUBindGroupLayout
  ): Promise<void> {
    try {
      const asset = await loadTexturedCar(device, textureBindGroupLayout);

      // The device may have been torn down while the asset was in flight.
      if (this.device !== device) {
        releaseGpuMesh(asset.mesh);
        asset.texture.destroy();

        return;
      }

      this.assetTexture = asset.texture;
      this.assetBindGroup = asset.bindGroup;
      this.texturedCarMesh = asset.mesh;
    } catch (error) {
      this.onCarModelFailed(error);
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
    for (const entry of FURNITURE_CATALOG) {
      const pieces = objects.furniture.filter(piece => piece.catalogId === entry.id);

      this.furniture.replace(device, entry.id, buildTurnedInstanceData(pieces), pieces.length);
    }
    this.dirtPathMesh = uploadLitMesh(device, objects.pathDrape.dirt);
    this.asphaltPathMesh = uploadLitMesh(device, objects.pathDrape.asphalt);
    this.blendPathMesh = uploadColoredMesh(device, objects.pathDrape.blend);
    for (const species of TREE_SPECIES) {
      const speciesTrees = objects.trees.filter(tree => tree.species === species);

      this.trees.replace(device, species, buildTreeInstanceData(speciesTrees), speciesTrees.length);
    }
    this.carInstances = replaceInstances(
      device,
      this.carInstances,
      buildTurnedInstanceData(objects.cars),
      objects.cars.length
    );
  }
}
