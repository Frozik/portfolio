import { haversineMetres, toDegrees } from './geo';
import type { RoutingGraph } from './graph';

/** Points of an edge between two fractions of its length, in travel order. */
export function cutEdgeGeometry(
  graph: RoutingGraph,
  edge: number,
  fromFraction: number,
  toFraction: number,
  outLon: number[],
  outLat: number[]
): void {
  const start = graph.edgeGeometryStart[edge];
  const end = graph.edgeGeometryStart[edge + 1];
  const segmentLengths: number[] = [];
  let total = 0;
  for (let point = start + 1; point < end; point++) {
    const length = haversineMetres(
      toDegrees(graph.geometryLon[point - 1]),
      toDegrees(graph.geometryLat[point - 1]),
      toDegrees(graph.geometryLon[point]),
      toDegrees(graph.geometryLat[point])
    );
    segmentLengths.push(length);
    total += length;
  }
  const reverse = fromFraction > toFraction;
  const low = Math.min(fromFraction, toFraction) * total;
  const high = Math.max(fromFraction, toFraction) * total;
  const lon: number[] = [];
  const lat: number[] = [];
  const pointAt = (distance: number): [number, number] => {
    let walked = 0;
    for (let segment = 0; segment < segmentLengths.length; segment++) {
      const length = segmentLengths[segment];
      if (walked + length >= distance || segment === segmentLengths.length - 1) {
        const ratio = length === 0 ? 0 : Math.min(1, Math.max(0, (distance - walked) / length));
        const a = start + segment;
        return [
          toDegrees(
            graph.geometryLon[a] + (graph.geometryLon[a + 1] - graph.geometryLon[a]) * ratio
          ),
          toDegrees(
            graph.geometryLat[a] + (graph.geometryLat[a + 1] - graph.geometryLat[a]) * ratio
          ),
        ];
      }
      walked += length;
    }
    return [toDegrees(graph.geometryLon[start]), toDegrees(graph.geometryLat[start])];
  };
  const first = pointAt(low);
  lon.push(first[0]);
  lat.push(first[1]);
  let walked = 0;
  for (let segment = 0; segment < segmentLengths.length; segment++) {
    walked += segmentLengths[segment];
    if (walked > low && walked < high) {
      lon.push(toDegrees(graph.geometryLon[start + segment + 1]));
      lat.push(toDegrees(graph.geometryLat[start + segment + 1]));
    }
  }
  const last = pointAt(high);
  lon.push(last[0]);
  lat.push(last[1]);
  if (reverse) {
    lon.reverse();
    lat.reverse();
  }
  outLon.push(...lon);
  outLat.push(...lat);
}

export function appendWholeEdge(
  graph: RoutingGraph,
  edge: number,
  forward: boolean,
  outLon: number[],
  outLat: number[]
): void {
  const start = graph.edgeGeometryStart[edge];
  const end = graph.edgeGeometryStart[edge + 1];
  if (forward) {
    for (let point = start + 1; point < end; point++) {
      outLon.push(toDegrees(graph.geometryLon[point]));
      outLat.push(toDegrees(graph.geometryLat[point]));
    }
  } else {
    for (let point = end - 2; point >= start; point--) {
      outLon.push(toDegrees(graph.geometryLon[point]));
      outLat.push(toDegrees(graph.geometryLat[point]));
    }
  }
}

export function polylineMetres(lon: readonly number[], lat: readonly number[]): number {
  let total = 0;
  for (let point = 1; point < lon.length; point++) {
    total += haversineMetres(lon[point - 1], lat[point - 1], lon[point], lat[point]);
  }
  return total;
}
