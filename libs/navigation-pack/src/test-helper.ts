import type { RoadClass } from './format';
import { ACCESS_BIT, ROAD_CLASS } from './format';
import type { RoutingGraph } from './graph';
import { GraphBuilder } from './graph-builder';

export const ALL_ACCESS =
  ACCESS_BIT.carForward |
  ACCESS_BIT.carBackward |
  ACCESS_BIT.footForward |
  ACCESS_BIT.footBackward |
  ACCESS_BIT.bikeForward |
  ACCESS_BIT.bikeBackward;

/** Access of a street motor traffic may only drive forward on. */
export const CAR_ONEWAY_ACCESS = ALL_ACCESS & ~ACCESS_BIT.carBackward;

export interface GridEdgeSpec {
  readonly from: number;
  readonly to: number;
  readonly access?: number;
  readonly roadClass?: RoadClass;
  readonly name?: string;
}

/**
 * A 3 × 2 block of streets, 100 m apart, near the equator so degrees and
 * metres relate simply:
 *
 *   3 — 4 — 5
 *   |   |   |
 *   0 — 1 — 2
 */
export const GRID_STEP_DEGREES = 0.0009;

export function buildGrid(edgeSpecs: readonly GridEdgeSpec[]): {
  readonly graph: RoutingGraph;
  readonly builder: GraphBuilder;
} {
  const builder = new GraphBuilder();
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 3; column++) {
      builder.addNode(column * GRID_STEP_DEGREES, row * GRID_STEP_DEGREES);
    }
  }
  for (const spec of edgeSpecs) {
    builder.addEdge({
      from: spec.from,
      to: spec.to,
      access: spec.access ?? ALL_ACCESS,
      roadClass: spec.roadClass ?? ROAD_CLASS.residential,
      flags: 0,
      name: spec.name ?? '',
      shape: [],
    });
  }
  return { graph: builder.build(), builder };
}

export const GRID_STREETS: readonly GridEdgeSpec[] = [
  { from: 0, to: 1, name: 'Bottom' },
  { from: 1, to: 2, name: 'Bottom' },
  { from: 3, to: 4, name: 'Top' },
  { from: 4, to: 5, name: 'Top' },
  { from: 0, to: 3, name: 'Left' },
  { from: 1, to: 4, name: 'Middle' },
  { from: 2, to: 5, name: 'Right' },
];
