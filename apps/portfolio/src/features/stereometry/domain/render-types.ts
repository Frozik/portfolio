import type { Vec3Array } from './topology-types';

/**
 * Modifiers a scene element can carry. They classify the element for the
 * renderer's style map and also group segments for deduplication and
 * collinear merging.
 */
export type StyleModifier =
  | 'edge'
  | 'hidden'
  | 'inner'
  | 'input'
  | 'preview'
  | 'segment'
  | 'selected'
  | 'solution';

/** A visual piece of a line between two split points. */
export interface RenderSegment {
  readonly startPosition: Vec3Array;
  readonly endPosition: Vec3Array;
  readonly lineId: number;
  readonly modifiers: readonly StyleModifier[];
  readonly startVertexIndex: number;
  readonly endVertexIndex: number;
}

/** A scene vertex as the renderer sees it: where it is and what it is. */
export interface SceneMarker {
  readonly position: Vec3Array;
  readonly modifiers: readonly StyleModifier[];
  readonly vertexIndex: number;
}

/** Fan-triangulated solution polygons: three floats (a position) per vertex. */
export interface SolutionFaceGeometry {
  readonly positions: Float32Array;
  readonly vertexCount: number;
}

export interface SceneRepresentation {
  readonly segments: readonly RenderSegment[];
  readonly markers: readonly SceneMarker[];
  readonly solutionFace?: SolutionFaceGeometry;
}
