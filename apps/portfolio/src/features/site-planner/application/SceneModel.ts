import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { PATH_DRAPE_OFFSET_METERS } from '../domain/constants';
import { foundationVolumeCubicMeters, pointOnOutline } from '../domain/geometry/building-outline';
import { evaluateComposition } from '../domain/geometry/evaluate-composition';
import type { LitMesh, PathDrapeGeometry, RoofOverlayGeometry } from '../domain/geometry/lit-mesh';
import { subtractPolygons } from '../domain/geometry/polygon-booleans';
import { computeMultiPolygonCentroid } from '../domain/geometry/polygon-centroid';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import type { BuildingWarning } from '../domain/model/building-warnings';
import { collectBuildingWarnings } from '../domain/model/building-warnings';
import { editedBuildingId } from '../domain/model/editor-mode';
import type { Building, PathSurface } from '../domain/model/site-plan';
import { entriesOf, foundationOf, pitchedRoofOf } from '../domain/model/site-plan';
import type { AnalysisRaster } from '../domain/terrain/analysis-raster';
import { buildCutFillRaster, buildSlopeRaster } from '../domain/terrain/analysis-raster';
import type { CutFillReport } from '../domain/terrain/cut-fill';
import { computeCutFill, computePadElevation } from '../domain/terrain/cut-fill';
import {
  drapeBlendStrips,
  drapePolygons,
  PATH_SURFACE_DRAPE_COLORS,
} from '../domain/terrain/drape-polygons';
import type { SceneCar } from '../domain/terrain/place-cars';
import { placeCarsOnTerrain } from '../domain/terrain/place-cars';
import type { SceneFurniture } from '../domain/terrain/place-furniture';
import type { SceneTree } from '../domain/terrain/place-trees';
import { placeTreesOnTerrain } from '../domain/terrain/place-trees';
import type { BuildingScene } from './building-scene';
import type { DuctRun } from './duct-scenes';
import { deriveDuctRuns } from './duct-scenes';
import type { PlanEditorCore } from './editor-core';
import type { FlowField } from './render/plan-draw/draw-flow-arrows';
import type { GhostPass } from './render/scene-meshes';
import {
  buildBuildingMeshes,
  buildFoundationSolids,
  buildRoofOverlays,
  buildSceneFurniture,
} from './render/scene-meshes';
import type { PitchedRoofScene } from './roof-scenes';
import { derivePitchedRoofScene } from './roof-scenes';
import type { StoreyScene } from './storey-scenes';
import { deriveStoreyScenes, maxOverhangMeters } from './storey-scenes';
import type { TerrainModel } from './TerrainModel';

const NO_BUILDING_WARNINGS: readonly BuildingWarning[] = [];

/**
 * The storeys with the roof that crowns them. Free function rather than an
 * inline expression: the roof reads the TOP storey, which only exists once the
 * storeys are resolved, and naming that dependency keeps it visible.
 */
function withPitchedRoof(
  building: Building,
  storeys: readonly StoreyScene[]
): {
  readonly storeys: readonly StoreyScene[];
  readonly pitchedRoof: PitchedRoofScene | undefined;
  readonly ducts: readonly DuctRun[];
} {
  // The order is the dependency: the storeys carry the shafts, the top storey
  // carries the roof, and the roof is what says how high a shaft must come out.
  const pitchedRoof = derivePitchedRoofScene(pitchedRoofOf(building), storeys);

  return { storeys, pitchedRoof, ducts: deriveDuctRuns(storeys, pitchedRoof) };
}

/**
 * The plan resolved into the 3D scene: every building against the terrain,
 * the meshes the view draws, the analysis overlays and the advisory pass.
 * Pure derivation over the document and the terrain — no state of its own.
 */
export class SceneModel {
  private readonly core: PlanEditorCore;
  private readonly terrain: TerrainModel;

  constructor(core: PlanEditorCore, terrain: TerrainModel) {
    this.core = core;
    this.terrain = terrain;

    makeAutoObservable<SceneModel, 'core' | 'terrain'>(
      this,
      { core: false, terrain: false },
      { autoBind: true }
    );
  }

  /**
   * The active analysis, painted into pixels once. Both views take this very
   * raster — the plan draws it as an image, the 3D view uploads it as a texture
   * — so a colour can never mean one thing on the plan and another in 3D.
   */
  get analysisRaster(): AnalysisRaster | undefined {
    switch (this.core.overlayMode) {
      case 'none':
        return undefined;
      case 'slope':
        return buildSlopeRaster(this.terrain.heightfield, this.terrain.plotCoverage);
      case 'cut-fill': {
        const pads = this.buildingScenes.filter(scene => !isNil(scene.padElevation));

        // Nothing to level without a building: the earthworks are the cost of
        // its pad, and there is no pad until a footprint is drawn.
        return pads.length === 0
          ? undefined
          : buildCutFillRaster(
              this.terrain.heightfield,
              pads.map(scene => ({
                polygons: scene.polygons,
                padElevation: scene.padElevation ?? 0,
              }))
            );
      }
      default:
        return assertNever(this.core.overlayMode);
    }
  }

  /**
   * The ground the runoff arrows are drawn over. Only the slope overlay reads
   * runoff, so nothing is sampled for the arrows in any other mode.
   */
  get flowField(): FlowField | undefined {
    return this.core.overlayMode === 'slope'
      ? { field: this.terrain.heightfield, coverage: this.terrain.plotCoverage }
      : undefined;
  }

  /**
   * Every building resolved against the terrain: its footprint polygons, the
   * pad it is levelled onto and the earthworks of levelling it. One computed
   * for the lot, because everything downstream — the plan's labels, the panel,
   * the 3D meshes, the cut/fill overlay — walks the same list.
   *
   * A building is never deformed by the ground — it is levelled onto a pad,
   * and the ground is what gets cut and filled to meet it (`terrain/cut-fill.ts`).
   */
  get buildingScenes(): readonly BuildingScene[] {
    return this.core.buildings.map(building => {
      const polygons = evaluateComposition(building.composition);
      const padElevation =
        polygons.length === 0
          ? undefined
          : computePadElevation({
              field: this.terrain.heightfield,
              polygons,
              mode: building.padElevationMode,
              manualPadElevation: building.manualPadElevation,
            });

      const foundation = foundationOf(building);

      return {
        building,
        polygons,
        padElevation,
        cutFill: isNil(padElevation)
          ? undefined
          : computeCutFill(this.terrain.heightfield, polygons, padElevation),
        foundation,
        foundationVolumeCubicMeters:
          polygons.length === 0 ? undefined : foundationVolumeCubicMeters(foundation, polygons),
        entryPoints: entriesOf(building).flatMap(entry => {
          const position = pointOnOutline(polygons, entry.outlineOffsetMeters);

          return isNil(position) ? [] : [{ id: entry.id, system: entry.system, position }];
        }),
        ...withPitchedRoof(
          building,
          deriveStoreyScenes(building, polygons, padElevation, this.terrain.groundElevationAt)
        ),
      };
    });
  }

  /**
   * Every advisory the open building earns (§6.5): furniture and walls over a
   * stairwell, stairs outside the comfort bands, an unsupported overhang, a
   * storey too low to live on. One list, because to the person holding the
   * mouse they are all «something to look at here».
   */
  get buildingWarnings(): readonly BuildingWarning[] {
    const buildingId = editedBuildingId(this.core.editorMode);

    if (isNil(buildingId)) {
      return NO_BUILDING_WARNINGS;
    }

    const scene = this.buildingScenes.find(candidate => candidate.building.id === buildingId);

    if (isNil(scene)) {
      return NO_BUILDING_WARNINGS;
    }

    return collectBuildingWarnings(
      scene.storeys.map((storeyScene, level) => {
        const below = scene.storeys[level - 1];
        const overhang =
          isNil(below) || storeyScene.footprint.length === 0
            ? undefined
            : subtractPolygons(storeyScene.footprint, below.footprint);
        const overhangAt = isNil(overhang) ? undefined : computeMultiPolygonCentroid(overhang);

        return {
          storeyId: storeyScene.storey.id,
          heightMeters: storeyScene.storey.heightMeters,
          footprint: storeyScene.footprint,
          stairwell: storeyScene.stairCutouts,
          furniture: storeyScene.furniture.map(piece => ({
            id: piece.id,
            position: piece.position,
          })),
          walls: storeyScene.wallShapes.map(wall => ({ id: wall.id, body: wall.polygons })),
          stairs: storeyScene.stairs.map(stairScene => ({
            id: stairScene.stair.id,
            position: stairScene.stair.position,
            isComfortable: stairScene.isComfortable,
          })),
          supportPositions: storeyScene.supports.map(supportScene => supportScene.post.position),
          // The roof stands on the TOP storey, so that is the storey its
          // findings belong to and the one the panel travels to.
          roofPitchDegrees:
            level === scene.storeys.length - 1 ? scene.pitchedRoof?.roof.pitchDegrees : undefined,
          rooms: storeyScene.rooms.map(room => ({
            roomTypeId: room.roomTypeId,
            polygons: room.polygons,
            at: room.centroid,
          })),
          saunaStovePositions: storeyScene.fireplaces
            .filter(fireplaceScene => fireplaceScene.fireplace.kind === 'saunaStove')
            .map(fireplaceScene => fireplaceScene.fireplace.position),
          ventPositions: storeyScene.ducts
            .filter(section => section.duct.kind === 'vent')
            .map(section => section.duct.position),
          strandedDucts: scene.ducts
            .filter(run => run.isOutsideRoof && run.storeyId === storeyScene.storey.id)
            .map(run => ({ id: run.duct.id, at: run.duct.position })),
          footprintBelow: below?.footprint,
          overhang: overhang ?? [],
          overhangMeters: isNil(overhang) ? 0 : maxOverhangMeters(overhang, below.footprint),
          overhangAt,
        };
      })
    );
  }

  /** The earthworks of every building added up — what the overlay legend reports. */
  get totalCutFill(): CutFillReport | undefined {
    const reports = this.buildingScenes.flatMap(scene =>
      isNil(scene.cutFill) ? [] : [scene.cutFill]
    );

    if (reports.length === 0) {
      return undefined;
    }

    return {
      cutVolumeCubicMeters: reports.reduce((sum, report) => sum + report.cutVolumeCubicMeters, 0),
      fillVolumeCubicMeters: reports.reduce((sum, report) => sum + report.fillVolumeCubicMeters, 0),
    };
  }

  /**
   * The buildings as the 3D view draws them, one mesh: every storey's walls
   * extruded at its own level (openings cut, sills and lintels kept), the
   * whole footprint as the fallback for a building with no walls at all.
   */
  get buildingsGeometry(): LitMesh | undefined {
    return buildBuildingMeshes({
      scenes: this.buildingScenes,
      heightfield: this.terrain.heightfield,
      pass: this.ghostPass,
    });
  }

  /**
   * The storeys the editor is NOT aimed at while a building is open (§6.4):
   * the same geometry, handed to the blended pipeline so the active storey
   * reads through them. Nothing outside the building editor — a house being
   * looked at rather than edited is solid all the way up.
   */
  get buildingsGhostGeometry(): LitMesh | undefined {
    return this.core.editorSession?.kind === 'building'
      ? buildBuildingMeshes({
          scenes: this.buildingScenes,
          heightfield: this.terrain.heightfield,
          pass: { ...this.ghostPass, ghosted: true },
        })
      : undefined;
  }

  /** The pass that draws what is being edited, or everything when nothing is. */
  private get ghostPass(): GhostPass {
    const session = this.core.editorSession;

    return {
      ghosted: false,
      editedBuildingId: session?.kind === 'building' ? session.buildingId : undefined,
      activeStoreyId: this.core.activeStoreyId,
    };
  }

  /**
   * The green and terrace covers laid over the exposed ceilings, one thin
   * slab each — the plain membrane stays the roof the extrusion already has.
   */
  get roofOverlaysGeometry(): RoofOverlayGeometry {
    return buildRoofOverlays(this.buildingScenes);
  }

  /**
   * Every placed piece as a box at its storey's level plus its own elevation,
   * split by category so plumbing reads white against the wooden furniture.
   */
  /**
   * Every placed piece as a template instance for the 3D view — the storey's
   * floor plus the piece's own elevation baked into the world point, the plan
   * turn carried as-is (the car's convention, which the shader shares).
   */
  get sceneFurniture(): readonly SceneFurniture[] {
    return buildSceneFurniture(this.buildingScenes);
  }

  /**
   * The foundations as the 3D view pours them: one concrete solid per
   * building from below the pad up to the цоколь, its footprint a ledge
   * proud of the walls — the real detail that also keeps the two solids'
   * faces from fighting over the same pixels.
   */
  get foundationsGeometry(): LitMesh | undefined {
    return buildFoundationSolids({
      scenes: this.buildingScenes,
      heightfield: this.terrain.heightfield,
    });
  }

  /**
   * The trees as the 3D view stands them: on the interpolated terrain, so a
   * surveyed elevation moves the whole planting with the ground (A4).
   */
  get sceneTrees(): readonly SceneTree[] {
    return placeTreesOnTerrain(this.core.trees, this.terrain.heightfield);
  }

  /** The cars as the 3D view parks them: on the terrain, facing where the plan says. */
  get sceneCars(): readonly SceneCar[] {
    return placeCarsOnTerrain(this.core.cars, this.terrain.heightfield);
  }

  /** The paths as the 3D view lays them: their ribbons draped over the terrain. */
  get pathDrapeGeometry(): PathDrapeGeometry {
    const bySurface = (surface: PathSurface): MultiPolygon =>
      this.core.pathRibbons.flatMap(ribbon =>
        ribbon.pieces.filter(piece => piece.surface === surface).flatMap(piece => piece.polygons)
      );

    return {
      dirt: drapePolygons({
        polygons: bySurface('dirt'),
        field: this.terrain.heightfield,
        elevationOffset: PATH_DRAPE_OFFSET_METERS,
      }),
      asphalt: drapePolygons({
        polygons: bySurface('asphalt'),
        field: this.terrain.heightfield,
        elevationOffset: PATH_DRAPE_OFFSET_METERS,
      }),
      blend: drapeBlendStrips({
        strips: this.core.pathRibbons.flatMap(ribbon =>
          ribbon.seamBlends.map(blend => ({
            polygons: blend.polygons,
            fromColor: PATH_SURFACE_DRAPE_COLORS[blend.fromSurface],
            toColor: PATH_SURFACE_DRAPE_COLORS[blend.toSurface],
            start: blend.start,
            end: blend.end,
          }))
        ),
        field: this.terrain.heightfield,
        elevationOffset: PATH_DRAPE_OFFSET_METERS,
      }),
    };
  }
}
