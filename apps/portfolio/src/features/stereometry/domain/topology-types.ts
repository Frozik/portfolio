export type Vec3Array = readonly [number, number, number];

// Line kind discriminant
// - 'edge': figure boundary edge (auto-created from faces)
// - 'segment': finite segment from PuzzleInput
// - 'edge-extended': infinite line created by extending an edge (shares lineId with the edge)
// - 'segment-extended': infinite line created by extending a segment (shares lineId with the segment)
// - 'line': infinite construction line drawn by the user
export type LineKind = 'edge' | 'segment' | 'edge-extended' | 'segment-extended' | 'line';

// Vertex kind discriminant
export type VertexKind = 'figure' | 'input' | 'intersection';

// A line, segment, or edge in the topology
export interface TopologyLine {
  readonly lineId: number;
  readonly pointA: Vec3Array;
  readonly pointB: Vec3Array;
  readonly kind: LineKind;
  readonly isInput: boolean;
  // Topology vertex IDs at the endpoints (computed during finalization)
  readonly startVertexId: number;
  readonly endVertexId: number;
}

// A vertex in the topology
export interface TopologyVertex {
  readonly vertexId: number;
  readonly position: Vec3Array;
  readonly kind: VertexKind;
  readonly crossLineIds: readonly number[];
}

// Intersection provenance
export interface IntersectionEntity {
  readonly position: Vec3Array;
  readonly sourceLineIds: readonly number[];
}

// Figure topology (immutable, from puzzle)
export interface FigureTopology {
  readonly vertices: readonly Vec3Array[];
  readonly edges: readonly [number, number][];
  readonly faces: readonly (readonly number[])[];
  readonly faceTriangles: readonly [number, number, number][];
  readonly figureFaceTriangles: readonly (readonly [number, number, number][])[];
}

// The complete scene topology state
export interface SceneTopology {
  readonly figures: readonly FigureTopology[];
  readonly lines: readonly TopologyLine[];
  readonly vertices: readonly TopologyVertex[];
  readonly intersections: readonly IntersectionEntity[];
  readonly nextLineId: number;
  readonly nextVertexId: number;
}

/** Sentinel value for a line endpoint that has no matching topology vertex */
export const NO_VERTEX_ID = -1;

// Selection state
export type SelectionState =
  | { readonly type: 'none' }
  | { readonly type: 'line'; readonly lineId: number };

export const SELECTION_NONE: SelectionState = { type: 'none' };
