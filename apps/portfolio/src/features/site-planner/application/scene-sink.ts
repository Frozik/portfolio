import type { LitMesh, PathDrapeGeometry, RoofOverlayGeometry } from '../domain/geometry/lit-mesh';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import type { Sunlight } from '../domain/sun/sun-direction';
import type { AnalysisRaster } from '../domain/terrain/analysis-raster';
import type { Heightfield } from '../domain/terrain/heightfield';
import type { SceneCar } from '../domain/terrain/place-cars';
import type { SceneFurniture } from '../domain/terrain/place-furniture';
import type { SceneTree } from '../domain/terrain/place-trees';

/** Everything the ground of the scene is built from. */
export interface SceneTerrain {
  /** The sampled elevations; the grid the 3D view displaces is this same field. */
  readonly field: Heightfield;
  /**
   * The plot in plan metres. The grid spans the plot's bounding box, so the
   * rings are what tells the ground where it ends — and they carry the outline
   * draped over the terrain along it.
   */
  readonly boundaryPolygons: MultiPolygon;
  /**
   * How much of the plot covers each grid sample, in the field's own row-major
   * order. Carried rather than derived here: the plan's analyses are read over
   * this very array, and scanning the rings a second time for the 3D view would
   * cost a full grid pass on every edit for an identical answer.
   */
  readonly coverage: Float32Array;
}

/** Everything standing on the terrain, as the 3D view takes it. */
export interface SceneObjects {
  /** The extruded footprint; nothing while the plan has no house. */
  readonly house: LitMesh | undefined;
  /** Storeys the building editor is not aimed at, drawn faintly. */
  readonly houseGhost: LitMesh | undefined;
  /** The concrete solids the buildings stand on; nothing without a footprint. */
  readonly foundations: LitMesh | undefined;
  /** The green and terrace covers over the exposed ceilings. */
  readonly roofOverlays: RoofOverlayGeometry;
  /** One per placed piece, its template named by the catalogue row. */
  readonly furniture: readonly SceneFurniture[];
  /** One per planted tree, already standing on the ground it grows from. */
  readonly trees: readonly SceneTree[];
  /** One per parked car, already standing on the ground it is parked on. */
  readonly cars: readonly SceneCar[];
  /**
   * Every path ribbon draped over the terrain as one mesh. Draped here rather
   * than in the renderer: the ground the ribbons follow is the plan's, and the
   * sink stays a hand-off of finished data instead of a second place that has to
   * be told about the terrain — and told about it in the right order.
   */
  readonly pathDrape: PathDrapeGeometry;
}

/**
 * What the 3D view accepts from the store. The store pushes derived data at a
 * sink instead of reaching into the renderer, so the plan stays the only source
 * of truth and the GPU side can be replaced — or absent, on a machine without
 * WebGPU — without the application layer noticing.
 *
 */
export interface SceneSink {
  applyTerrain(terrain: SceneTerrain): void;
  applyObjects(objects: SceneObjects): void;
  /**
   * The analysis coloured over the ground, or nothing once the overlay is
   * switched off. The raster arrives finished: the 3D view uploads the very
   * pixels the plan paints, so a colour means the same thing in both views.
   */
  applyOverlay(raster: AnalysisRaster | undefined): void;
  /**
   * Where the sun stands and how strongly it shines — the direction points
   * *towards* it, and the shadow map is rebuilt along that same direction.
   */
  applySun(sunlight: Sunlight): void;
}
