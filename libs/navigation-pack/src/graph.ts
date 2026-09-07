import type { RoadClass } from './format';

/**
 * The routing graph as the pack stores it: undirected edges between routing
 * nodes, each edge carrying per-profile access bits for both directions.
 * Everything is a typed array so a pack decodes into the worker without
 * per-object allocation.
 */
export interface RoutingGraph {
  readonly nodeCount: number;
  /** Microdegrees. */
  readonly nodeLon: Int32Array;
  readonly nodeLat: Int32Array;

  readonly edgeCount: number;
  readonly edgeFrom: Uint32Array;
  readonly edgeTo: Uint32Array;
  /** Centimetres along the geometry. */
  readonly edgeLengthCm: Uint32Array;
  /** `ACCESS_BIT` mask. */
  readonly edgeAccess: Uint8Array;
  readonly edgeRoadClass: Uint8Array;
  /** `EDGE_FLAG` mask. */
  readonly edgeFlags: Uint8Array;
  /** Index into `names`; 0 is "no name". */
  readonly edgeNameIndex: Uint32Array;
  /** `edgeCount + 1` offsets into the geometry arrays; every edge starts at its `from` node and ends at `to`. */
  readonly edgeGeometryStart: Uint32Array;

  readonly geometryLon: Int32Array;
  readonly geometryLat: Int32Array;

  /** `names[0]` is the empty string. */
  readonly names: readonly string[];

  readonly restrictionFromEdge: Uint32Array;
  readonly restrictionViaNode: Uint32Array;
  readonly restrictionToEdge: Uint32Array;
  /** `RESTRICTION_KIND`. */
  readonly restrictionKind: Uint8Array;
}

/** Adjacency in CSR form, derived from the edges when a pack is loaded. */
export interface Adjacency {
  /** `nodeCount + 1` offsets into `edges`. */
  readonly start: Uint32Array;
  /** Edge ids incident to the node; direction is decided per traversal. */
  readonly edges: Uint32Array;
}

export function buildAdjacency(graph: RoutingGraph): Adjacency {
  const degree = new Uint32Array(graph.nodeCount + 1);
  for (let edge = 0; edge < graph.edgeCount; edge++) {
    degree[graph.edgeFrom[edge] + 1]++;
    degree[graph.edgeTo[edge] + 1]++;
  }
  for (let node = 0; node < graph.nodeCount; node++) {
    degree[node + 1] += degree[node];
  }
  const start = degree;
  const fill = start.slice(0, graph.nodeCount);
  const edges = new Uint32Array(start[graph.nodeCount]);
  for (let edge = 0; edge < graph.edgeCount; edge++) {
    edges[fill[graph.edgeFrom[edge]]++] = edge;
    edges[fill[graph.edgeTo[edge]]++] = edge;
  }
  return { start, edges };
}

export function edgeRoadClass(graph: RoutingGraph, edge: number): RoadClass {
  return graph.edgeRoadClass[edge] as RoadClass;
}

export function edgeGeometryLength(graph: RoutingGraph, edge: number): number {
  return graph.edgeGeometryStart[edge + 1] - graph.edgeGeometryStart[edge];
}
