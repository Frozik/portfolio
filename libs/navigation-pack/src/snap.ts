import CheapRuler from 'cheap-ruler';
import Flatbush from 'flatbush';

import type { Profile } from './format';
import { toDegrees } from './geo';
import type { RoutingGraph } from './graph';
import { backwardBit, forwardBit } from './profiles';

const CANDIDATE_EDGES = 24;

/** Bounding boxes of every edge's geometry, for nearest-edge queries. */
export function buildEdgeIndex(graph: RoutingGraph): Flatbush {
  const index = new Flatbush(Math.max(1, graph.edgeCount));
  if (graph.edgeCount === 0) {
    index.add(0, 0, 0, 0);
  }
  for (let edge = 0; edge < graph.edgeCount; edge++) {
    let minLon = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLon = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    for (
      let point = graph.edgeGeometryStart[edge];
      point < graph.edgeGeometryStart[edge + 1];
      point++
    ) {
      const lon = toDegrees(graph.geometryLon[point]);
      const lat = toDegrees(graph.geometryLat[point]);
      minLon = Math.min(minLon, lon);
      minLat = Math.min(minLat, lat);
      maxLon = Math.max(maxLon, lon);
      maxLat = Math.max(maxLat, lat);
    }
    index.add(minLon, minLat, maxLon, maxLat);
  }
  index.finish();
  return index;
}

export interface SnappedPoint {
  readonly edge: number;
  /** Fraction of the edge's length from its `from` node. */
  readonly fraction: number;
  readonly lon: number;
  readonly lat: number;
  readonly distanceMetres: number;
}

function edgeUsableBy(graph: RoutingGraph, edge: number, profile: Profile): boolean {
  return (graph.edgeAccess[edge] & (forwardBit(profile) | backwardBit(profile))) !== 0;
}

/** The closest point on the closest edge the profile may use; `undefined` when nothing is near. */
export function snapToEdge(
  graph: RoutingGraph,
  index: Flatbush,
  lon: number,
  lat: number,
  profile: Profile,
  maxDistanceMetres: number
): SnappedPoint | undefined {
  const ruler = new CheapRuler(lat, 'meters');
  const maxDistanceDegrees = maxDistanceMetres / 111_000;
  const candidates = index.neighbors(lon, lat, CANDIDATE_EDGES, maxDistanceDegrees, edge =>
    edgeUsableBy(graph, edge, profile)
  );
  let best: SnappedPoint | undefined;
  for (const edge of candidates) {
    const line: [number, number][] = [];
    for (
      let point = graph.edgeGeometryStart[edge];
      point < graph.edgeGeometryStart[edge + 1];
      point++
    ) {
      line.push([toDegrees(graph.geometryLon[point]), toDegrees(graph.geometryLat[point])]);
    }
    const projected = ruler.pointOnLine(line, [lon, lat]);
    const distance = ruler.distance(projected.point, [lon, lat]);
    if (distance > maxDistanceMetres || (best !== undefined && distance >= best.distanceMetres)) {
      continue;
    }
    const total = ruler.lineDistance(line);
    const along =
      ruler.lineDistance(line.slice(0, projected.index + 1)) +
      ruler.distance(line[projected.index], projected.point);
    best = {
      edge,
      fraction: total === 0 ? 0 : Math.min(1, Math.max(0, along / total)),
      lon: projected.point[0],
      lat: projected.point[1],
      distanceMetres: distance,
    };
  }
  return best;
}
