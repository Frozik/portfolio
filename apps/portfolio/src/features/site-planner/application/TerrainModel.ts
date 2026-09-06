import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { DEFAULT_SITE_LENGTH_METERS, DEFAULT_SITE_WIDTH_METERS } from '../domain/constants';
import type { BoundingBox } from '../domain/geometry/bounding-box';
import { computeMultiPolygonBounds } from '../domain/geometry/bounding-box';
import { evaluateComposition } from '../domain/geometry/evaluate-composition';
import { padDropOf } from '../domain/model/building';
import { buildHeightfield } from '../domain/terrain/build-heightfield';
import type { ContourPolyline } from '../domain/terrain/contour-types';
import { buildContours } from '../domain/terrain/contours';
import { computePadElevation } from '../domain/terrain/cut-fill';
import type { GradedPad } from '../domain/terrain/design-grade';
import { groundElevationAt } from '../domain/terrain/design-grade';
import type { Heightfield } from '../domain/terrain/heightfield';
import { buildPlotCoverage } from '../domain/terrain/plot-coverage';
import type { Meters } from '../domain/units';
import type { PlanEditorCore } from './editor-core';

/**
 * Extent the terrain is sampled over while the plot has no shapes at all — the
 * quick-start plot's own size, so a mark placed before the boundary is drawn
 * still lands on a grid that covers it.
 */
const FALLBACK_SITE_BOUNDS: BoundingBox = {
  minX: 0,
  minY: 0,
  maxX: DEFAULT_SITE_WIDTH_METERS,
  maxY: DEFAULT_SITE_LENGTH_METERS,
};

/**
 * The ground as the plan derives it: the interpolated survey, its contours,
 * and the levelled pads the buildings cut into it. Pure derivation over the
 * document's marks and buildings — it owns no state of its own, only cached
 * computeds over the core's observables.
 */
export class TerrainModel {
  private readonly core: PlanEditorCore;

  constructor(core: PlanEditorCore) {
    this.core = core;

    makeAutoObservable<TerrainModel, 'core'>(this, { core: false }, { autoBind: true });
  }

  /** Extent the terrain is sampled over: the plot's own bounding box. */
  get siteBounds(): BoundingBox {
    return computeMultiPolygonBounds(this.core.boundaryPolygons) ?? FALLBACK_SITE_BOUNDS;
  }

  /**
   * The interpolated terrain. It depends on the marks and on the plot alone, so
   * moving a tree or opening a panel leaves the cached grid untouched.
   */
  get heightfield(): Heightfield {
    return buildHeightfield({
      bounds: this.siteBounds,
      marks: this.core.elevationMarks,
      targetResolution: this.core.settings.heightfieldTargetResolution,
    });
  }

  get contours(): readonly ContourPolyline[] {
    return buildContours(this.heightfield, this.core.settings.contourIntervalMeters);
  }

  /** Which grid samples the plot covers — what the analyses are read over. */
  get plotCoverage(): Float32Array {
    return buildPlotCoverage(this.heightfield, this.core.boundaryPolygons);
  }

  /**
   * The levelled platforms the buildings stand on. Derived straight from the
   * compositions rather than from the building scenes, which would be circular:
   * the scenes need the graded ground to place what stands beside them.
   */
  get gradedPads(): readonly GradedPad[] {
    return this.core.buildings.flatMap(building => {
      const polygons = evaluateComposition(building.composition);

      if (polygons.length === 0) {
        return [];
      }

      const elevation = computePadElevation({
        field: this.heightfield,
        polygons,
        mode: building.padElevationMode,
        manualPadElevation: building.manualPadElevation,
        dropMeters: padDropOf(building),
      });

      return isNil(elevation) ? [] : [{ polygons, elevation }];
    });
  }

  /**
   * The ground as it will be once the pads are built — what anything standing
   * beside a house must be measured against (plan O-S8). The raw heightfield
   * is the survey before anyone built, and half a metre from the цоколь the
   * two differ by the whole cut.
   */
  get groundElevationAt(): (point: Vector2) => Meters {
    const pads = this.gradedPads;
    const field = this.heightfield;

    return point => groundElevationAt(field, pads, point);
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
