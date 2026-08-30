import type { MultiPolygon, Ring } from '../geometry/polygon-types';
import type { Meters } from '../units';
import type { Heightfield } from './heightfield';

/** An edge of a boundary ring, as the scanline needs it. */
interface CoverageEdge {
  readonly startX: Meters;
  readonly startY: Meters;
  readonly endX: Meters;
  readonly endY: Meters;
}

/** Where a scanline crosses an edge, and which way that edge runs through it. */
interface Crossing {
  readonly x: Meters;
  readonly direction: number;
}

const INSIDE = 1;

/**
 * How far either side of a row of samples it is scanned, in cells. Small enough
 * that no boundary passing between the two scans could have been meant to cut
 * the row, wide enough to survive the rounding of metre coordinates.
 */
const SCAN_OFFSET_IN_CELLS = 1e-4;

/**
 * Which grid samples the plot actually covers: 1 inside its boundary, 0 outside.
 *
 * The terrain grid spans the plot's bounding box, but a plot built by cutting
 * and joining shapes fills only part of that box. Interpolating the terrain
 * needs the whole grid, so the coverage is carried as data per sample: the
 * analyses read it to leave the surroundings blank, and the 3D view reads it to
 * drop them.
 *
 * Row by row, the boundary edges crossing that row are sorted along it and the
 * spans with a non-zero winding number are filled — the same non-zero rule the
 * boolean fold produced the rings under, so holes punch through and islands
 * nested inside them fill again.
 *
 * Each row is scanned just below and just above its samples, and the two
 * results are taken together. A boundary running exactly along a row — the
 * quick-start plot's north edge lands on one — is claimed by the half-open
 * crossing rule on one side only, and a single scan would leave a dim seam of
 * "outside" along an edge that is anything but.
 */
export function buildPlotCoverage(field: Heightfield, polygons: MultiPolygon): Float32Array {
  const { resolution, originMeters, cellSizeMeters } = field;
  const coverage = new Float32Array(resolution * resolution);
  const edges = collectEdges(polygons);

  if (edges.length === 0) {
    return coverage;
  }

  const scanOffset = cellSizeMeters * SCAN_OFFSET_IN_CELLS;

  for (let row = 0; row < resolution; row += 1) {
    const y = originMeters.y + row * cellSizeMeters;

    fillRow(coverage, field, edges, row, y - scanOffset);
    fillRow(coverage, field, edges, row, y + scanOffset);
  }

  return coverage;
}

function fillRow(
  coverage: Float32Array,
  field: Heightfield,
  edges: readonly CoverageEdge[],
  row: number,
  scanY: Meters
): void {
  const { resolution, originMeters, cellSizeMeters } = field;
  const crossings = collectCrossings(edges, scanY);

  if (crossings.length === 0) {
    return;
  }

  crossings.sort(compareByX);

  const lastColumn = resolution - 1;
  let winding = 0;

  for (let index = 0; index < crossings.length - 1; index += 1) {
    winding += crossings[index].direction;

    if (winding === 0) {
      continue;
    }

    const firstSpanColumn = Math.max(
      0,
      Math.ceil((crossings[index].x - originMeters.x) / cellSizeMeters)
    );
    const lastSpanColumn = Math.min(
      lastColumn,
      Math.floor((crossings[index + 1].x - originMeters.x) / cellSizeMeters)
    );

    for (let column = firstSpanColumn; column <= lastSpanColumn; column += 1) {
      coverage[row * resolution + column] = INSIDE;
    }
  }
}

function collectEdges(polygons: MultiPolygon): CoverageEdge[] {
  const edges: CoverageEdge[] = [];

  for (const polygon of polygons) {
    appendRingEdges(edges, polygon.outer);

    for (const hole of polygon.holes) {
      appendRingEdges(edges, hole);
    }
  }

  return edges;
}

function appendRingEdges(edges: CoverageEdge[], ring: Ring): void {
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];

    edges.push({ startX: start.x, startY: start.y, endX: end.x, endY: end.y });
  }
}

/**
 * Half-open rule on the scanline (`<=` on both ends): a vertex sitting exactly
 * on the row is counted by one of its two edges, never by both and never by
 * neither, which is what keeps the winding number from drifting along a row.
 */
function collectCrossings(edges: readonly CoverageEdge[], y: Meters): Crossing[] {
  const crossings: Crossing[] = [];

  for (const edge of edges) {
    const isStartBelow = edge.startY <= y;
    const isEndBelow = edge.endY <= y;

    if (isStartBelow === isEndBelow) {
      continue;
    }

    const ratio = (y - edge.startY) / (edge.endY - edge.startY);

    crossings.push({
      x: edge.startX + (edge.endX - edge.startX) * ratio,
      direction: isStartBelow ? 1 : -1,
    });
  }

  return crossings;
}

function compareByX(first: Crossing, second: Crossing): number {
  return first.x - second.x;
}
