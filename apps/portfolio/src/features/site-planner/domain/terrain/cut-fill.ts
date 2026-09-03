import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import { computeMultiPolygonCentroid } from '../geometry/polygon-centroid';
import type { MultiPolygon } from '../geometry/polygon-types';
import type { PadElevationMode } from '../model/site-plan';
import type { Meters } from '../units';
import type { Heightfield } from './heightfield';
import { sampleHeight } from './heightfield';
import { buildPlotCoverage } from './plot-coverage';

/** A sample the footprint does not reach contributes nothing. */
const UNCOVERED = 0;

/** The terrain under a footprint, as each pad mode reads it. */
export interface FootprintElevations {
  /** Ground under the footprint's area-weighted centroid. */
  readonly centerElevation: Meters;
  /** Average of the grid samples the footprint covers. */
  readonly meanElevation: Meters;
  /** Lowest of those samples — also where the pad's apron has to reach down to. */
  readonly minElevation: Meters;
}

/**
 * How much soil levelling the footprint onto its pad moves. The two figures are
 * kept apart rather than netted off: on a slope they largely cancel, and a
 * balance of zero says nothing about the amount of work (the convention every
 * earthworks report follows).
 */
export interface CutFillReport {
  /** Soil taken away where the pad sits below the ground. */
  readonly cutVolumeCubicMeters: number;
  /** Soil brought in where the pad sits above it. */
  readonly fillVolumeCubicMeters: number;
}

/**
 * Samples the terrain under a footprint on the same grid the volumes are
 * measured over, so the pad and the report can never disagree about the ground.
 *
 * A footprint narrower than one cell can fall between the samples entirely; the
 * ground under its centroid then stands in for all three figures, which is the
 * only elevation that footprint has any evidence for.
 */
export function computeFootprintElevations(
  field: Heightfield,
  polygons: MultiPolygon
): FootprintElevations | undefined {
  const centroid = computeMultiPolygonCentroid(polygons);

  if (isNil(centroid)) {
    return undefined;
  }

  const centerElevation = sampleHeight(field, centroid.x, centroid.y);
  const coverage = buildPlotCoverage(field, polygons);

  let elevationSum = 0;
  let coveredSampleCount = 0;
  let minElevation = Number.POSITIVE_INFINITY;

  for (let index = 0; index < coverage.length; index += 1) {
    if (coverage[index] === UNCOVERED) {
      continue;
    }

    const elevation = field.heights[index];

    elevationSum += elevation;
    coveredSampleCount += 1;
    minElevation = Math.min(minElevation, elevation);
  }

  return coveredSampleCount === 0
    ? { centerElevation, meanElevation: centerElevation, minElevation: centerElevation }
    : {
        centerElevation,
        meanElevation: elevationSum / coveredSampleCount,
        minElevation,
      };
}

/**
 * The level the house stands on. Nothing without a footprint to level — the
 * plan has no house then, and no pad to speak of. The посадка (`dropMeters`)
 * sinks the terrain-derived datum — a manual elevation is an absolute number
 * the user typed and takes no drop.
 */
export function computePadElevation({
  field,
  polygons,
  mode,
  manualPadElevation,
  dropMeters = 0,
}: {
  readonly field: Heightfield;
  readonly polygons: MultiPolygon;
  readonly mode: PadElevationMode;
  readonly manualPadElevation: Meters | undefined;
  readonly dropMeters?: Meters;
}): Meters | undefined {
  if (mode === 'manual' && !isNil(manualPadElevation)) {
    return manualPadElevation;
  }

  const elevations = computeFootprintElevations(field, polygons);

  if (isNil(elevations)) {
    return undefined;
  }

  switch (mode) {
    case 'terrain-center':
    // A pad switched to manual before a number was typed into it starts level
    // with the ground under the centre, which is where a new footprint begins.
    case 'manual':
      return elevations.centerElevation - dropMeters;
    case 'terrain-mean':
      return elevations.meanElevation - dropMeters;
    case 'terrain-min':
      return elevations.minElevation - dropMeters;
    default:
      return assertNever(mode);
  }
}

/**
 * The earthworks of levelling the ground under `housePolygons` onto the pad:
 * the difference `padElevation − terrain` taken over every grid sample the
 * footprint covers, each weighted by the ground area one sample stands for.
 *
 * A pad below the ground means the ground has to come away — that is the cut;
 * a pad above it has to be built up — that is the fill.
 */
export function computeCutFill(
  field: Heightfield,
  housePolygons: MultiPolygon,
  padElevation: Meters
): CutFillReport {
  const coverage = buildPlotCoverage(field, housePolygons);
  const sampleAreaSquareMeters = field.cellSizeMeters * field.cellSizeMeters;

  let cutDepthSum = 0;
  let fillDepthSum = 0;

  for (let index = 0; index < coverage.length; index += 1) {
    if (coverage[index] === UNCOVERED) {
      continue;
    }

    const delta = padElevation - field.heights[index];

    if (delta < 0) {
      cutDepthSum -= delta;
    } else {
      fillDepthSum += delta;
    }
  }

  return {
    cutVolumeCubicMeters: cutDepthSum * sampleAreaSquareMeters,
    fillVolumeCubicMeters: fillDepthSum * sampleAreaSquareMeters,
  };
}
