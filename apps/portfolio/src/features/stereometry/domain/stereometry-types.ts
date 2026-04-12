export type SelectionState =
  | { readonly type: 'none' }
  | { readonly type: 'edge'; readonly edgeIndex: number }
  | { readonly type: 'vertex'; readonly vertexIndex: number };

export interface PyramidTopology {
  /** All 6 vertex positions: [base0, base1, base2, base3, base4, apex] */
  readonly vertices: readonly [number, number, number][];
  /** Each face as an array of vertex indices forming its boundary */
  readonly faces: readonly (readonly number[])[];
  /** Each edge as [vertexA, vertexB] */
  readonly edges: readonly [number, number][];
  /** For each face, which edge indices belong to it */
  readonly faceEdges: readonly (readonly number[])[];
  /** Triangulated faces for ray intersection testing */
  readonly faceTriangles: readonly [number, number, number][];
  /** Maps each triangle in faceTriangles to its face index */
  readonly triangleFaceIndex: readonly number[];
}

export const SELECTION_NONE: SelectionState = { type: 'none' };
