import { isNil } from 'lodash-es';

import { editedBuildingId } from '../../domain/model/editor-mode';
import type { PlanBuilding } from '../../domain/plan-draw/draw-house';
import type { PlanContent, PlanEditorChrome } from '../../domain/plan-draw/draw-plan';
import type { BuildingScene, SitePlannerStore } from '../SitePlannerStore';

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
    ? scene.storeys.find(storeyScene => storeyScene.storey.id === store.activeStoreyId)
    : undefined;
  const displayed = active ?? scene.storeys[0];
  const below =
    isEdited && !isNil(active) && active.level > 0 && store.isReferenceStoreyVisible
      ? scene.storeys[active.level - 1]
      : undefined;

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
    furniture: displayed?.furniture ?? [],
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
    buildings: store.buildingScenes.map(scene => readPlanBuilding(store, scene)),
    setbackRings: store.setbackRings,
    contours: store.contours,
    analysisRaster: store.analysisRaster,
    flowField: store.flowField,
    elevationMarks: store.elevationMarks,
    trees: store.trees,
    cars: store.cars,
    pathRibbons: store.pathRibbons,
    utilityRoutes: store.utilityRoutes,
    gridStepMeters: store.settings.gridStepMeters,
    northOffsetDegrees: store.settings.location.northOffsetDegrees,
    visibleLayers: store.visibleLayers,
  };
}

/** What the editor is acting on right now; an exported sheet asks for none of it. */
export function readPlanChrome(store: SitePlannerStore): PlanEditorChrome {
  return {
    pathDraft: store.draftPathPreview,
    utilityDraft: store.draftUtilityPreview,
    selectedUtilityRoute: store.selectedUtilityRoute,
    selectedShape: store.selectedShape,
    selectedMarkId: store.selectedMark?.id,
    selectedTreeId: store.selectedTree?.id,
    selectedCar: store.selectedCar,
    selectedBuildingId: store.selectedBuilding?.id,
    selectedPath: store.selectedPath,
    pathHandleHighlight: store.pathHandleHighlight,
    selectedPathPointIndex: store.selectedPathPointIndex,
    hoveredPathSegmentIndex: store.hoveredPathSegmentIndex,
    editFocus: store.editorMode.kind === 'edit' ? store.editorMode.target : undefined,
    selectedWall: store.selectedWall,
    wallDraftPoints: store.draftWallPoints,
    selectedOpeningId: store.selectedOpening?.id,
    selectedFurniture: store.selectedFurniture,
    selectedDeviceId: store.selectedDevice?.id,
    pendingConnectDeviceId: store.pendingConnectDeviceId,
    hoveredRoomIndex: store.hoveredRoomIndex,
    draftShape: store.draftShape,
    draftMark: store.draftMark,
    measurePoints: store.measurePoints,
    gestureSkeletonShapes: store.gestureSkeletonShapes,
    keyPointSnap: store.activeKeyPointSnap,
  };
}
