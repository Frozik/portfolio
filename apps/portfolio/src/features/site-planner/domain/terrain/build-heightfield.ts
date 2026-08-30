import { isNil } from 'lodash-es';

import type { BoundingBox } from '../geometry/bounding-box';
import type { Meters } from '../units';
import type { ElevationSample } from './elevation-sample';
import type { Heightfield } from './heightfield';
import { createHeightfieldForBounds } from './heightfield';
import type { ElevationSurface } from './thin-plate-spline';
import { fitThinPlateSpline } from './thin-plate-spline';

/** An empty plot is flat at the site datum. */
const DATUM_ELEVATION_METERS: Meters = 0;

/**
 * Marks nearer to each other than this are one surveyed point — the same peg
 * read twice, or two pegs no survey could tell apart — and are merged, their
 * elevations averaged. A centimetre is the accuracy the feature works to, and
 * merging at it keeps two all-but-identical rows out of the spline's matrix,
 * where they would make it singular.
 */
const MERGE_RADIUS_METERS: Meters = 0.01;

const MERGE_RADIUS_SQUARED = MERGE_RADIUS_METERS * MERGE_RADIUS_METERS;

/**
 * The surveyed terrain, sampled onto the grid: a thin-plate spline through every
 * mark, evaluated at every node. The surface passes through the marks exactly,
 * carries a plane exactly where the marks describe one, and stays smooth in
 * between — no facets to round off afterwards, and no hull to fall out of.
 *
 * Marks that share a line, or too few of them to bend a sheet at all, leave the
 * spline undetermined; those cases run the profile along that line instead. The
 * grid is checked for finiteness as it is written, so a spline that a pathological
 * layout has made ill-conditioned falls back to the same profile rather than
 * handing a NaN to the contours, the cut and fill, or the 3D stage.
 */
export function buildHeightfield({
  bounds,
  marks,
  targetResolution,
}: {
  readonly bounds: BoundingBox;
  readonly marks: readonly ElevationSample[];
  readonly targetResolution: number;
}): Heightfield {
  const field = createHeightfieldForBounds(bounds, targetResolution);
  const samples = mergeCoincidentMarks(marks);

  if (samples.length === 0) {
    field.heights.fill(DATUM_ELEVATION_METERS);

    return field;
  }

  if (samples.length === 1) {
    field.heights.fill(samples[0].elevation);

    return field;
  }

  const spline = fitThinPlateSpline(samples);

  if (!isNil(spline) && fillFromSurface(field, spline)) {
    return field;
  }

  fillFromSurface(field, createLineProfile(samples));

  return field;
}

/**
 * The distinct surveyed points, in the order they were surveyed in, each holding
 * the mean of the elevations read at it. Marks with a coordinate or an elevation
 * that is not finite are dropped here, which is what lets every surface below
 * assume its inputs are numbers.
 */
function mergeCoincidentMarks(marks: readonly ElevationSample[]): readonly ElevationSample[] {
  const groups: { x: Meters; y: Meters; elevationSum: Meters; readCount: number }[] = [];

  for (const mark of marks) {
    const { x, y } = mark.position;

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(mark.elevation)) {
      continue;
    }

    const group = groups.find(candidate => {
      const offsetX = candidate.x - x;
      const offsetY = candidate.y - y;

      return offsetX * offsetX + offsetY * offsetY <= MERGE_RADIUS_SQUARED;
    });

    if (isNil(group)) {
      groups.push({ x, y, elevationSum: mark.elevation, readCount: 1 });

      continue;
    }

    group.elevationSum += mark.elevation;
    group.readCount += 1;
  }

  return groups.map(group => ({
    position: { x: group.x, y: group.y },
    elevation: group.elevationSum / group.readCount,
  }));
}

/**
 * The surface for marks that share a line: every plan point is projected onto
 * that line and takes the elevation interpolated between the two marks it falls
 * between, held level beyond the outermost ones.
 *
 * A row of levelling shots along a fence describes a ridge and says nothing about
 * the ground either side of it, so running the profile out sideways is the only
 * honest reading of it — and the one the terrain has always given.
 */
function createLineProfile(samples: readonly ElevationSample[]): ElevationSurface {
  const origin = samples[0].position;
  let directionX = 0;
  let directionY = 0;
  let baselineLengthSquared = 0;

  for (const sample of samples) {
    const offsetX = sample.position.x - origin.x;
    const offsetY = sample.position.y - origin.y;
    const lengthSquared = offsetX * offsetX + offsetY * offsetY;

    if (lengthSquared > baselineLengthSquared) {
      baselineLengthSquared = lengthSquared;
      directionX = offsetX;
      directionY = offsetY;
    }
  }

  const baselineLength = Math.sqrt(baselineLengthSquared);

  directionX /= baselineLength;
  directionY /= baselineLength;

  const profile = samples
    .map(sample => ({
      station:
        (sample.position.x - origin.x) * directionX + (sample.position.y - origin.y) * directionY,
      elevation: sample.elevation,
    }))
    .sort((left, right) => left.station - right.station);
  const stations = Float64Array.from(profile, entry => entry.station);
  const elevations = Float64Array.from(profile, entry => entry.elevation);
  const lastIndex = stations.length - 1;

  return (x, y) => {
    const station = (x - origin.x) * directionX + (y - origin.y) * directionY;

    if (station <= stations[0]) {
      return elevations[0];
    }

    if (station >= stations[lastIndex]) {
      return elevations[lastIndex];
    }

    let upper = 1;

    while (upper < lastIndex && stations[upper] < station) {
      upper += 1;
    }

    const span = stations[upper] - stations[upper - 1];
    const fraction = span > 0 ? (station - stations[upper - 1]) / span : 0;

    return elevations[upper - 1] + (elevations[upper] - elevations[upper - 1]) * fraction;
  };
}

/**
 * Samples `surface` at every grid node. `false` as soon as a node comes out
 * non-finite — the grid is then left half written for the caller to overwrite
 * with a surface that cannot fail.
 */
function fillFromSurface(field: Heightfield, surface: ElevationSurface): boolean {
  const { resolution, originMeters, cellSizeMeters, heights } = field;

  for (let row = 0; row < resolution; row += 1) {
    const y = originMeters.y + row * cellSizeMeters;

    for (let column = 0; column < resolution; column += 1) {
      const elevation = surface(originMeters.x + column * cellSizeMeters, y);

      if (!Number.isFinite(elevation)) {
        return false;
      }

      heights[row * resolution + column] = elevation;
    }
  }

  return true;
}
