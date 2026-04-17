import type { Vec3Array } from './topology-types';

// GPU-ready RGB float triple (0..1 range)
export type RgbFloat = readonly [number, number, number];

// Style types
export type LineStyle =
  | { readonly type: 'solid' }
  | { readonly type: 'dashed'; readonly dash: number; readonly gap: number };

export type MarkerType = 'solid' | 'circle';

// Partial style for cascade resolution
export type PartialElementStyle = {
  readonly color?: string;
  readonly width?: number;
  readonly size?: number;
  readonly alpha?: number;
  readonly line?: LineStyle;
  readonly markerType?: MarkerType;
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
};

// Fully resolved style
export type ResolvedElementStyle = {
  readonly color: string;
  readonly width: number;
  readonly size: number;
  readonly alpha: number;
  readonly line: LineStyle;
  readonly markerType: MarkerType;
  readonly strokeColor: string;
  readonly strokeWidth: number;
};

// A visual segment piece for GPU rendering
export interface RenderSegment {
  readonly startPosition: Vec3Array;
  readonly endPosition: Vec3Array;
  readonly lineId: number;
  readonly modifiers: readonly string[];
  readonly startVertexIndex: number;
  readonly endVertexIndex: number;
}

// Per-instance line style for GPU
export interface LineInstanceStyle {
  readonly width: number;
  readonly color: RgbFloat;
  readonly alpha: number;
  readonly lineType: number;
  readonly dash: number;
  readonly gap: number;
}

// A fully styled segment ready for GPU upload
export interface StyledSegment {
  readonly startPosition: Vec3Array;
  readonly endPosition: Vec3Array;
  readonly visibleStyle: LineInstanceStyle;
  readonly hiddenStyle: LineInstanceStyle;
  readonly lineId: number;
  readonly startVertexIndex: number;
  readonly endVertexIndex: number;
}

// Per-marker style for a single visibility pass
export interface MarkerInstanceStyle {
  readonly size: number;
  readonly color: RgbFloat;
  readonly alpha: number;
  readonly strokeColor: RgbFloat;
  readonly strokeWidth: number;
}

// A visual vertex marker for GPU rendering
export interface RenderMarker {
  readonly position: Vec3Array;
  readonly vertexId: number;
  readonly modifiers: readonly string[];
  readonly vertexIndex: number;
}

// A fully styled vertex marker ready for GPU upload
export interface StyledMarker {
  readonly position: Vec3Array;
  readonly markerType: number;
  readonly visibleStyle: MarkerInstanceStyle;
  readonly hiddenStyle: MarkerInstanceStyle;
  readonly vertexIndex: number;
}

/**
 * Triangulated solution face data ready for GPU upload.
 * Each vertex is 7 floats: position(3) + rgba(4).
 */
export interface SolutionFaceRenderData {
  readonly vertices: Float32Array;
  readonly vertexCount: number;
}

// Output of the representation builder
export interface SceneRepresentation {
  readonly segments: readonly StyledSegment[];
  readonly markers: readonly StyledMarker[];
  readonly solutionFace?: SolutionFaceRenderData;
}
