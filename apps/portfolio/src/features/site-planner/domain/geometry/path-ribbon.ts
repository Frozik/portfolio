import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { PathId, PathSurface, SitePath } from '../model/site-plan';
import { pathSurfaceAt } from '../model/site-plan';
import { buildButtRibbon, buildVariableWidthRibbon } from './offset-polygon';
import { intersectPolygons, subtractPolygons } from './polygon-booleans';
import type { MultiPolygon } from './polygon-types';
import { pointAlongPolyline, polylineLength, subPolyline } from './wall-geometry';

/** One stretch of a ribbon paved the same way: consecutive segments, one colour. */
interface PathRibbonPiece {
  readonly surface: PathSurface;
  readonly polygons: MultiPolygon;
}

/**
 * The strip where one paving fades into the next: a stretch of the ribbon
 * around the seam, painted as a gradient from the surface behind it to the
 * surface ahead. `start` and `end` are the centreline points its butt edges
 * cross — the gradient's axis, in plan coordinates.
 */
interface PathSeamBlend {
  readonly polygons: MultiPolygon;
  readonly fromSurface: PathSurface;
  readonly toSurface: PathSurface;
  readonly start: Vector2;
  readonly end: Vector2;
}

/** The walkable polygon of one path, kept next to the path it was widened from. */
export interface PathRibbon {
  readonly id: PathId;
  readonly polygons: MultiPolygon;
  /**
   * The ribbon cut into runs of one surface each, for painting. A uniformly
   * paved path has a single piece sharing `polygons`; a mixed one carves the
   * seam-blend strips out of every piece and tiles the rest with no overlap,
   * which is what keeps two translucent fills from blending into wedges.
   */
  readonly pieces: readonly PathRibbonPiece[];
  /** The gradient strips between the pieces; empty on a uniform path. */
  readonly seamBlends: readonly PathSeamBlend[];
}

/**
 * How far the gradient reaches to each side of the seam, in ribbon widths.
 * Short enough that a narrow stretch between two seams still keeps some of
 * its own colour; long enough that the change reads as a fade, not a cut.
 */
const BLEND_HALF_LENGTH_WIDTHS = 0.75;
/**
 * The strip is cut a shade wider than the ribbon before being intersected
 * back to it, so its long sides can never leave hairline slivers uncovered.
 */
const BLEND_STRIP_WIDTH_MARGIN = 1.5;

/**
 * Widens every path into its ribbon, in plan order. The identity travels with
 * the geometry because both consumers need it: the plan paints the selected
 * ribbon differently, and a click on a ribbon has to name the path it selects.
 */
export function buildPathRibbons(paths: readonly SitePath[]): readonly PathRibbon[] {
  return paths.map(path => {
    const polygons = buildVariableWidthRibbon(path.points);
    const { pieces, seamBlends } = buildRibbonSurfaces(path, polygons);

    return { id: path.id, polygons, pieces, seamBlends };
  });
}

interface SurfaceRun {
  readonly surface: PathSurface;
  readonly start: number;
  end: number;
}

function buildRibbonSurfaces(
  path: SitePath,
  whole: MultiPolygon
): { readonly pieces: readonly PathRibbonPiece[]; readonly seamBlends: readonly PathSeamBlend[] } {
  const runs: SurfaceRun[] = [];

  for (let index = 0; index + 1 < path.points.length; index += 1) {
    const surface = pathSurfaceAt(path.points[index]);
    const lastRun = runs[runs.length - 1];

    if (!isNil(lastRun) && lastRun.surface === surface) {
      lastRun.end = index + 1;
    } else {
      runs.push({ surface, start: index, end: index + 1 });
    }
  }

  if (runs.length <= 1) {
    return {
      pieces: [{ surface: runs[0]?.surface ?? pathSurfaceAt(path.points[0]), polygons: whole }],
      seamBlends: [],
    };
  }

  // Each run's raw ribbon carries a full disc at both ends, so neighbours
  // overlap a disc's width at every seam. The run starting at the seam wins
  // the disc — the point carries that run's surface, so its cap must wear it
  // — which is why the claims accumulate from the LAST run backwards, each
  // earlier run cut around what its successors already own.
  let claimed: MultiPolygon = [];
  const reversed = [...runs].reverse().map(run => {
    const raw = buildVariableWidthRibbon(path.points.slice(run.start, run.end + 1));
    const polygons = subtractPolygons(raw, claimed);

    claimed = [...claimed, ...raw];

    return { surface: run.surface, polygons };
  });
  const seamBlends = buildSeamBlends(path, runs, whole);
  // The gradient strips repaint their stretch completely, so the flat pieces
  // step back out of them — translucent fills must never stack.
  const pieces = reversed.reverse().map(piece => ({
    ...piece,
    polygons: seamBlends.reduce(
      (polygons, blend) => subtractPolygons(polygons, blend.polygons),
      piece.polygons
    ),
  }));

  return { pieces, seamBlends };
}

/** One gradient strip per boundary between two runs of different paving. */
function buildSeamBlends(
  path: SitePath,
  runs: readonly SurfaceRun[],
  whole: MultiPolygon
): readonly PathSeamBlend[] {
  const positions = path.points.map(point => point.position);
  const blends: PathSeamBlend[] = [];

  for (let index = 0; index + 1 < runs.length; index += 1) {
    const seamPointIndex = runs[index + 1].start;
    const seamPoint = path.points[seamPointIndex];
    const seamOffset = polylineLength(positions.slice(0, seamPointIndex + 1));
    // The fade may not swallow a neighbouring segment whole — a short stretch
    // between two seams keeps a band of its own colour in the middle.
    const halfLength = Math.min(
      seamPoint.width * BLEND_HALF_LENGTH_WIDTHS,
      segmentLength(positions, seamPointIndex - 1) / 2,
      segmentLength(positions, seamPointIndex) / 2
    );

    if (halfLength <= 0) {
      continue;
    }

    const stripCenterline = subPolyline(
      positions,
      seamOffset - halfLength,
      seamOffset + halfLength
    );
    const strip = intersectPolygons(
      buildButtRibbon(stripCenterline, seamPoint.width * BLEND_STRIP_WIDTH_MARGIN),
      whole
    );

    if (strip.length === 0) {
      continue;
    }

    blends.push({
      polygons: strip,
      fromSurface: runs[index].surface,
      toSurface: runs[index + 1].surface,
      start: pointAlongPolyline(positions, seamOffset - halfLength),
      end: pointAlongPolyline(positions, seamOffset + halfLength),
    });
  }

  return blends;
}

function segmentLength(positions: readonly Vector2[], segmentIndex: number): number {
  const start = positions[segmentIndex];
  const end = positions[segmentIndex + 1];

  return isNil(start) || isNil(end) ? 0 : Math.hypot(end.x - start.x, end.y - start.y);
}
