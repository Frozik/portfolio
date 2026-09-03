import { isNil } from 'lodash-es';

import { computeMultiPolygonBounds } from '../../domain/geometry/bounding-box';
import { pointOnOutline } from '../../domain/geometry/building-outline';
import { evaluateComposition } from '../../domain/geometry/evaluate-composition';
import type { Building } from '../../domain/model/site-plan';
import { entriesOf, foundationOf, pitchedRoofOf } from '../../domain/model/site-plan';
import type { Meters } from '../../domain/units';
import type { PlanLayerKind } from '../../domain/view/plan-layers';
import type { PlanViewport } from '../../domain/view/plan-viewport';
import type { BuildingScene } from '../building-scene';
import { deriveDuctRuns } from '../duct-scenes';
import { derivePitchedRoofScene } from '../roof-scenes';
import { deriveStoreyScenes } from '../storey-scenes';
import type { PlanContent } from './plan-draw/draw-plan';
import { planBuildingOf } from './read-plan-content';

const PREVIEW_MARGIN_METERS = 1.5;
const PREVIEW_GROUND: Meters = 0;
const NO_LAYERS: ReadonlySet<PlanLayerKind> = new Set();

/**
 * A stock house rendered the way the plan itself renders it: the template's
 * building resolved on flat ground, mapped by the SAME `planBuildingOf` the
 * editor uses, so the preview can never drift from what placing it produces.
 */
export function buildTemplatePreview(
  building: Building,
  widthPx: number,
  heightPx: number
): { readonly content: PlanContent; readonly viewport: PlanViewport } | undefined {
  const polygons = evaluateComposition(building.composition);
  const bounds = computeMultiPolygonBounds(polygons);

  if (isNil(bounds)) {
    return undefined;
  }

  const storeys = deriveStoreyScenes(building, polygons, PREVIEW_GROUND, () => PREVIEW_GROUND);
  const pitchedRoof = derivePitchedRoofScene(pitchedRoofOf(building), storeys);
  const scene: BuildingScene = {
    building,
    polygons,
    padElevation: undefined,
    cutFill: undefined,
    foundation: foundationOf(building),
    foundationVolumeCubicMeters: undefined,
    entryPoints: entriesOf(building).flatMap(entry => {
      const position = entry.floorPosition ?? pointOnOutline(polygons, entry.outlineOffsetMeters);

      return isNil(position)
        ? []
        : [
            {
              id: entry.id,
              system: entry.system,
              position,
              isThroughFloor: !isNil(entry.floorPosition),
            },
          ];
    }),
    storeys,
    pitchedRoof,
    ducts: deriveDuctRuns(storeys, pitchedRoof),
  };

  const widthMeters = bounds.maxX - bounds.minX + 2 * PREVIEW_MARGIN_METERS;
  const heightMeters = bounds.maxY - bounds.minY + 2 * PREVIEW_MARGIN_METERS;
  const pixelsPerMeter = Math.min(widthPx / widthMeters, heightPx / heightMeters);
  const viewport: PlanViewport = {
    centerMeters: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    },
    pixelsPerMeter,
    widthPx,
    heightPx,
  };

  return {
    viewport,
    content: {
      boundaryPolygons: [],
      buildings: [planBuildingOf(scene, { isEdited: true, active: storeys[0], below: undefined })],
      setbackRings: [],
      contours: [],
      analysisRaster: undefined,
      flowField: undefined,
      elevationMarks: [],
      trees: [],
      cars: [],
      pathRibbons: [],
      utilityRoutes: [],
      gridStepMeters: 1,
      northOffsetDegrees: 0,
      visibleLayers: NO_LAYERS,
    },
  };
}
