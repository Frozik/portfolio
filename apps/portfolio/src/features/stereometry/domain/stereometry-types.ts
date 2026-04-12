export type SelectionState =
  | { readonly type: 'none' }
  | { readonly type: 'edge'; readonly edgeIndex: number }
  | { readonly type: 'vertex'; readonly vertexIndex: number }
  | { readonly type: 'intersection'; readonly intersectionIndex: number };

/**
 * Static definition of a puzzle — input data for a level.
 * Contains the geometry (vertices, edges, faces) that the user will work with.
 */
export interface PuzzleDefinition {
  readonly name: string;
  readonly vertices: readonly [number, number, number][];
  readonly edges: readonly [number, number][];
  readonly faces: readonly (readonly number[])[];
}

/**
 * Computed topology derived from a PuzzleDefinition.
 * Includes precomputed data needed for rendering, hit testing, and intersection detection.
 */
export interface FigureTopology {
  readonly vertices: readonly [number, number, number][];
  readonly edges: readonly [number, number][];
  readonly faces: readonly (readonly number[])[];
  /** For each face, which edge indices belong to it */
  readonly faceEdges: readonly (readonly number[])[];
  /** Triangulated faces for ray intersection testing */
  readonly faceTriangles: readonly [number, number, number][];
  /** Maps each triangle in faceTriangles to its face index */
  readonly triangleFaceIndex: readonly number[];
}

export interface VertexEntity {
  readonly position: readonly [number, number, number];
  /** Index in the topology vertices array, or undefined for computed vertices */
  readonly topologyIndex: number | undefined;
}

export interface SegmentEntity {
  readonly edgeIndex: number;
}

export interface LineEntity {
  readonly edgeIndex: number;
}

export interface IntersectionEntity {
  readonly position: readonly [number, number, number];
  /** Which two edge indices produced this intersection */
  readonly sourceEdgeA: number;
  readonly sourceEdgeB: number;
}

export interface SceneState {
  readonly vertices: readonly VertexEntity[];
  readonly segments: readonly SegmentEntity[];
  readonly lines: readonly LineEntity[];
  readonly intersections: readonly IntersectionEntity[];
}

export const SELECTION_NONE: SelectionState = { type: 'none' };

export type CameraInteractionMode = 'rotate' | 'pan';
