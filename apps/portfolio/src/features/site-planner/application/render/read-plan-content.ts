import { isNil } from 'lodash-es';

import { subtractPolygons } from '../../domain/geometry/polygon-booleans';
import type { MultiPolygon } from '../../domain/geometry/polygon-types';
import { slabPolygon } from '../../domain/geometry/slab-geometry';
import { editedBuildingId } from '../../domain/model/editor-mode';
import type { BuildingScene } from '../building-scene';
import type { SitePlannerStore } from '../SitePlannerStore';
import type { StoreyScene } from '../storey-scenes';
import type { PlanBuilding } from './plan-draw/draw-house';
import type { PlanContent, PlanEditorChrome } from './plan-draw/draw-plan';

/**
 * One building as the plan shows it: the storey the editor is aimed at while
 * this building is open — with the storey below ghosting through as the
 * reference display — and the ground storey otherwise, upper footprints
 * outlined over it. Roof zones come from every storey: a terrace is visible
 * whichever floor is on screen.
 */
function readPlanBuilding(store: SitePlannerStore, scene: BuildingScene): PlanBuilding {
  const isEdited = editedBuildingId(store.editorMode) === scene.building.id;
  const active = isEdited
    ? scene.storeys.find(storeyScene => storeyScene.storey.id === store.building.activeStoreyId)
    : undefined;
  const below =
    isEdited && !isNil(active) && active.level > 0 && store.building.isReferenceStoreyVisible
      ? scene.storeys[active.level - 1]
      : undefined;

  return planBuildingOf(scene, { isEdited, active, below });
}

/**
 * The pure half of the mapping: one resolved building scene as the sheet
 * draws it. Shared by the live editor path above and the stock-house preview,
 * which assembles a scene of its own with no store anywhere near.
 */
export function planBuildingOf(
  scene: BuildingScene,
  {
    isEdited,
    active,
    below,
  }: {
    readonly isEdited: boolean;
    readonly active: StoreyScene | undefined;
    readonly below: StoreyScene | undefined;
  }
): PlanBuilding {
  const displayed = active ?? scene.storeys[0];

  return {
    id: scene.building.id,
    name: scene.building.name,
    polygons: scene.polygons,
    padElevation: scene.padElevation,
    entries: scene.entryPoints,
    walls: displayed?.wallShapes ?? [],
    openings: displayed?.openingShapes ?? [],
    rooms: displayed?.rooms ?? [],
    referenceWalls: below?.wallShapes ?? [],
    upperFootprints: scene.storeys
      .filter(storeyScene => storeyScene.level > 0)
      .flatMap(storeyScene => storeyScene.footprint),
    roofZones: scene.storeys.flatMap(storeyScene =>
      storeyScene.roofZones.filter(zone => zone.cover !== 'membrane')
    ),
    // While a storey is open, its own overhang is the one that matters; with
    // no editor open the house is looked at whole, so every storey's overhang
    // is floor and is drawn as such — otherwise a room over a carport reads as
    // a hole in the plan from the one view that shows the whole building.
    overhangFloor: isNil(displayed)
      ? overhangsOf(scene.storeys)
      : overhangAgainst(displayed, below),
    // The roof belongs to the top storey, so it is drawn while that storey is
    // the one on screen — and always in view mode, where the house is looked
    // at whole and its roof is the first thing seen from above.
    pitchedRoof:
      isNil(scene.pitchedRoof) || (isEdited && active?.level !== scene.storeys.length - 1)
        ? undefined
        : {
            outline: scene.pitchedRoof.plan,
            creases: scene.pitchedRoof.creases,
            slopeArrows: scene.pitchedRoof.slopeArrows,
          },
    fireplaces: (displayed?.fireplaces ?? []).map(fireplaceScene => ({
      id: fireplaceScene.fireplace.id,
      footprint: fireplaceScene.footprint,
      firePoint: fireplaceScene.fireplace.position,
      fluePosition: fireplaceScene.fluePosition,
    })),
    ducts: (displayed?.ducts ?? []).map(section => ({
      id: section.duct.id,
      kind: section.duct.kind,
      footprint: section.footprint,
      isPassingThrough: !section.startsHere,
    })),
    slabs: (displayed?.slabs ?? []).map(slab => ({
      id: slab.id,
      footprint: slabPolygon(slab),
    })),
    supports: (displayed?.supports ?? []).map(supportScene => ({
      id: supportScene.post.id,
      footprint: supportScene.footprint,
      isFreeStanding: supportScene.isFreeStanding,
    })),
    furniture: displayed?.furniture ?? [],
    // A stair belongs to the storey it stands on, so the plan of the storey
    // ABOVE shows the opening it left rather than the stair itself.
    stairs: (displayed?.stairs ?? []).map(stairScene => ({
      id: stairScene.stair.id,
      stepPolygons: stairScene.steps.map(step => step.polygon),
      footprint: stairScene.footprint,
      fromPoint: stairScene.stair.position,
      exitPoint: stairScene.exitPoint,
      riserCount: stairScene.run.riserCount,
      cutout: stairScene.cutout,
      isComfortable: stairScene.isComfortable,
      rotationGrip: stairScene.rotationGrip,
    })),
    devices: displayed?.devices ?? [],
    wires: displayed?.wires ?? [],
  };
}

/**
 * The plan as a sheet shows it, read from the store in one pass. Both consumers
 * — the live editor and the PNG export — take exactly this, which is what keeps
 * an exported plan a copy of the one on screen rather than a second rendering
 * with its own rules.
 */
export function readPlanContent(store: SitePlannerStore): PlanContent {
  return {
    boundaryPolygons: store.boundaryPolygons,
    buildings: store.scene.buildingScenes.map(scene => readPlanBuilding(store, scene)),
    setbackRings: store.setbackRings,
    contours: store.terrain.contours,
    analysisRaster: store.scene.analysisRaster,
    flowField: store.scene.flowField,
    elevationMarks: store.elevationMarks,
    trees: store.trees,
    cars: store.cars,
    pathRibbons: store.pathRibbons,
    utilityRoutes: store.utilityRoutes,
    gridStepMeters: store.settings.gridStepMeters,
    northOffsetDegrees: store.settings.location.northOffsetDegrees,
    visibleLayers: store.view.visibleLayers,
  };
}

/** One storey's floor where it reaches past the one below it. */
function overhangAgainst(storey: StoreyScene, below: StoreyScene | undefined): MultiPolygon {
  return isNil(below) ? [] : subtractPolygons(storey.footprint, below.footprint);
}

/** Every storey's overhang at once — what the whole house shows from above. */
function overhangsOf(storeys: readonly StoreyScene[]): MultiPolygon {
  return storeys.flatMap((storey, level) => overhangAgainst(storey, storeys[level - 1]));
}

/** What the editor is acting on right now; an exported sheet asks for none of it. */
export function readPlanChrome(store: SitePlannerStore): PlanEditorChrome {
  return {
    pathDraft: store.siteObjects.draftPathPreview,
    utilityDraft: store.utilities.draftUtilityPreview,
    selectedUtilityRoute: store.utilities.selectedUtilityRoute,
    selectedShape: store.composition.selectedShape,
    selectedMarkId: store.siteObjects.selectedMark?.id,
    selectedTreeId: store.siteObjects.selectedTree?.id,
    selectedCar: store.siteObjects.selectedCar,
    selectedBuildingId: store.building.selectedBuilding?.id,
    selectedPath: store.siteObjects.selectedPath,
    pathHandleHighlight: store.pathHandleHighlight,
    selectedPathPointIndex: store.selectedPathPointIndex,
    hoveredPathSegmentIndex: store.hoveredPathSegmentIndex,
    editFocus: store.editorMode.kind === 'edit' ? store.editorMode.target : undefined,
    selectedWall: store.walls.selectedWall,
    selectedWallJunction: isNil(store.walls.selectedJunction)
      ? undefined
      : { position: store.walls.selectedJunction, edges: store.walls.selectedJunctionEdges },
    wallDraftPoints: store.walls.draftWallPoints,
    wallDraftCursor: store.walls.draftWallCursor,
    wallDraftReadout: store.walls.draftWallReadout,
    selectedOpeningId: store.walls.selectedOpening?.id,
    selectedFurniture: store.storeyObjects.selectedFurniture,
    selectedDeviceId: store.storeyObjects.selectedDevice?.id,
    selectedStairId: store.selection?.kind === 'stair' ? store.selection.stairId : undefined,
    selectedSupportId: store.selection?.kind === 'support' ? store.selection.supportId : undefined,
    selectedSlabId: store.selection?.kind === 'slab' ? store.selection.slabId : undefined,
    selectedFireplaceId:
      store.selection?.kind === 'fireplace' ? store.selection.fireplaceId : undefined,
    selectedDuctId: store.selection?.kind === 'duct' ? store.selection.ductId : undefined,
    selectedEntryId: store.utilities.selectedUtilityEntry?.entry.id,
    selectedStairGrip: store.storeyObjects.selectedStairScene?.rotationGrip,
    pendingConnectDeviceId: store.storeyObjects.pendingConnectDeviceId,
    hoveredRoomIndex: store.building.hoveredRoomIndex,
    draftShape: store.draftShape,
    draftMark: store.draftMark,
    measurePoints: store.measurePoints,
    gestureSkeletonShapes: store.composition.gestureSkeletonShapes,
    keyPointSnap: store.activeKeyPointSnap,
  };
}
