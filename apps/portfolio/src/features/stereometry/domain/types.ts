export type SelectionState =
  | { readonly type: 'none' }
  | { readonly type: 'edge'; readonly edgeIndex: number }
  | { readonly type: 'line'; readonly lineIndex: number };

/**
 * A closed 3D solid defined by its vertices and faces.
 * Edges are derived automatically from adjacent face vertices.
 *
 * Example — a tetrahedron:
 * ```
 * { vertices: [[0,0,0], [1,0,0], [0.5,1,0], [0.5,0.5,1]],
 *   faces: [[0,1,2], [0,1,3], [1,2,3], [0,2,3]] }
 * ```
 */
export interface PuzzleFigure {
  /** Vertex positions in 3D space [x, y, z] */
  readonly vertices: readonly (readonly [number, number, number])[];
  /**
   * Each face is an array of vertex indices (into `vertices`) defining a planar polygon.
   * Vertex order determines the outward-facing normal (counter-clockwise winding).
   */
  readonly faces: readonly (readonly number[])[];
}

/**
 * Input data shown to the user at the start of the puzzle.
 * Defines the geometric scene the user will work with.
 *
 * Example — "find the cross-section of a pyramid by a plane through 3 points":
 * ```
 * { figures: [pyramidFigure],
 *   vertices: [[0.5, 0, 0.5], [0, -0.75, 0.5], [0.5, -0.75, -0.5]] }
 * ```
 *
 * Example — "find the cross-section by a plane through a point and a line":
 * ```
 * { figures: [pyramidFigure],
 *   vertices: [[0.5, 0, 0.5]],
 *   lines: [[[0, -0.75, 1], [0.951, -0.75, 0.309]]] }
 * ```
 */
export interface PuzzleInput {
  /** 3D solids that form the scene (pyramids, prisms, etc.) */
  readonly figures: readonly PuzzleFigure[];
  /**
   * Additional standalone points displayed in the scene.
   * Used as given points for construction tasks (e.g., "plane through 3 points").
   */
  readonly vertices?: readonly (readonly [number, number, number])[];
  /**
   * Additional lines displayed in the scene, each defined by two 3D points.
   * Used as given lines for construction tasks (e.g., "plane through a point and a line").
   */
  readonly lines?: readonly (readonly [
    readonly [number, number, number],
    readonly [number, number, number],
  ])[];
}

/**
 * The correct answer the user must construct to solve the puzzle.
 * The solver verifies the user's constructions against these values.
 *
 * Example — cross-section result (a triangle):
 * ```
 * { lines: [
 *     [[0.5, 0, 0.5], [0, -0.75, 0.5]],
 *     [[0, -0.75, 0.5], [0.5, -0.75, -0.5]],
 *     [[0.5, -0.75, -0.5], [0.5, 0, 0.5]],
 *   ]
 * }
 * ```
 */
export interface PuzzleExpectedResult {
  /** Points that must be constructed (e.g., intersection points) */
  readonly vertices?: readonly (readonly [number, number, number])[];
  /** Line segments that must be constructed (e.g., cross-section edges) */
  readonly lines?: readonly (readonly [
    readonly [number, number, number],
    readonly [number, number, number],
  ])[];
}

/**
 * Complete puzzle definition — pure data, no computation.
 *
 * A puzzle consists of:
 * - `name` — display title
 * - `input` — the geometric scene and given elements shown to the user
 * - `expected` — the correct construction the user must produce
 *
 * Edges of figures are derived from faces by `preparePuzzle()`.
 */
/** Camera viewing angles */
export interface PuzzleCameraAngle {
  /** Elevation angle in radians (angle from horizontal) */
  readonly elevation: number;
  /** Azimuth angle in radians (horizontal rotation) */
  readonly azimuth: number;
}

/** Camera distance (zoom) limits */
export interface PuzzleCameraDistance {
  readonly min: number;
  readonly max: number;
  readonly initial: number;
}

/** Camera projection type */
export type CameraProjection = 'perspective' | 'orthographic';

/** Camera configuration for a puzzle. All fields fall back to global defaults if omitted. */
export interface PuzzleCamera {
  /** Camera target point — the scene is centered on this position */
  readonly center?: readonly [number, number, number];
  /** Projection type. Defaults to 'perspective'. */
  readonly projection?: CameraProjection;
  /** Initial viewing angles */
  readonly angle?: PuzzleCameraAngle;
  /** Camera distance (zoom) limits and initial value */
  readonly distance?: PuzzleCameraDistance;
}

export interface PuzzleDefinition {
  /** Display title of the puzzle */
  readonly name: string;
  /** Geometric scene and given elements shown to the user */
  readonly input: PuzzleInput;
  /** Correct answer — constructions the user must produce to solve the puzzle */
  readonly expected: PuzzleExpectedResult;
  /** Camera configuration. Falls back to global defaults if omitted. */
  readonly camera?: PuzzleCamera;
}

/** Result of preparePuzzle — everything the renderer and scene need */
export interface PreparedPuzzle {
  readonly name: string;
  readonly topology: FigureTopology;
}

/**
 * Computed topology derived from a PuzzleDefinition.
 * Includes precomputed data needed for rendering, hit testing, and intersection detection.
 */
export interface FigureTopology {
  readonly vertices: readonly (readonly [number, number, number])[];
  readonly edges: readonly [number, number][];
  readonly faces: readonly (readonly number[])[];
  /** Triangulated faces for ray intersection testing */
  readonly faceTriangles: readonly [number, number, number][];
}

export interface VertexEntity {
  readonly position: readonly [number, number, number];
  /** Index in the topology vertices array, or undefined for computed vertices */
  readonly topologyIndex: number | undefined;
}

export interface IntersectionEntity {
  readonly position: readonly [number, number, number];
}

/** A line in the scene defined by two points */
export interface SceneLine {
  readonly pointA: readonly [number, number, number];
  readonly pointB: readonly [number, number, number];
}

/** Modifiers describing what a segment of a line represents */
export type SegmentModifier = 'segment' | 'inner';

/** A renderable line piece output by the segment processor */
export interface ProcessedSegment {
  readonly startPosition: readonly [number, number, number];
  readonly endPosition: readonly [number, number, number];
  /** Modifier for this segment. Undefined = regular line (no special styling). */
  readonly modifier?: SegmentModifier;
  readonly sourceLineIndex: number;
}

/** Per-instance line style for GPU rendering */
export interface LineInstanceStyle {
  readonly width: number;
  readonly color: readonly [number, number, number];
  readonly alpha: number;
  readonly lineType: number;
  readonly dash: number;
  readonly gap: number;
}

/** A fully styled segment ready for GPU upload — one per instance in the line buffer */
export interface StyledSegment {
  readonly startPosition: readonly [number, number, number];
  readonly endPosition: readonly [number, number, number];
  readonly visibleStyle: LineInstanceStyle;
  readonly hiddenStyle: LineInstanceStyle;
  readonly sourceLineIndex: number;
}

/** Per-marker style for a single visibility pass */
export interface MarkerInstanceStyle {
  readonly size: number;
  readonly color: readonly [number, number, number];
  readonly alpha: number;
  readonly strokeColor: readonly [number, number, number];
  readonly strokeWidth: number;
}

/** A fully styled vertex marker ready for GPU upload — carries both visible and hidden styles */
export interface StyledMarker {
  readonly position: readonly [number, number, number];
  /** 0 = solid (filled circle), 1 = circle (stroke + fill) */
  readonly markerType: number;
  readonly visibleStyle: MarkerInstanceStyle;
  readonly hiddenStyle: MarkerInstanceStyle;
}

export interface SceneState {
  readonly vertices: readonly VertexEntity[];
  readonly lines: readonly SceneLine[];
  readonly intersections: readonly IntersectionEntity[];
}

export const SELECTION_NONE: SelectionState = { type: 'none' };

export type CameraInteractionMode = 'rotate' | 'pan';

export type LineStyle =
  | { readonly type: 'solid' }
  | { readonly type: 'dashed'; readonly dash: number; readonly gap: number };

/** Partial style — each entry overrides only the fields it defines */
export type MarkerType = 'solid' | 'circle';

/** Partial style — each entry overrides only the fields it defines */
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

/** Resolved style — all fields populated after cascade resolution */
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

/** GPU-ready RGB float triple (0..1 range) */
export type RgbFloat = readonly [number, number, number];
