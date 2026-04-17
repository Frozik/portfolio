import type { FigureTopology, Vec3Array } from './topology-types';

/**
 * A closed 3D solid defined by its vertices and faces.
 * Edges are derived automatically from adjacent face vertices.
 *
 * Example -- a tetrahedron:
 * ```
 * { vertices: [[0,0,0], [1,0,0], [0.5,1,0], [0.5,0.5,1]],
 *   faces: [[0,1,2], [0,1,3], [1,2,3], [0,2,3]] }
 * ```
 */
export interface PuzzleFigure {
  /** Vertex positions in 3D space [x, y, z] */
  readonly vertices: readonly Vec3Array[];
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
 * Example -- "find the cross-section of a pyramid by a plane through 3 points":
 * ```
 * { figures: [pyramidFigure],
 *   vertices: [[0.5, 0, 0.5], [0, -0.75, 0.5], [0.5, -0.75, -0.5]] }
 * ```
 *
 * Example -- "find the cross-section by a plane through a point and a line":
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
  readonly vertices?: readonly Vec3Array[];
  /**
   * Additional lines displayed in the scene, each defined by two 3D points.
   * Used as given lines for construction tasks (e.g., "plane through a point and a line").
   */
  readonly lines?: readonly (readonly [Vec3Array, Vec3Array])[];
  /**
   * Finite line segments displayed in the scene (not extended to infinity).
   * Rendered with the 'segment' modifier (thicker styling like topology edges).
   */
  readonly segments?: readonly (readonly [Vec3Array, Vec3Array])[];
}

/**
 * The correct answer the user must construct to solve the puzzle.
 * The solver verifies the user's constructions against these values.
 *
 * Example -- cross-section result (a triangle):
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
  readonly vertices?: readonly Vec3Array[];
  /** Line segments that must be constructed (e.g., cross-section edges) */
  readonly lines?: readonly (readonly [Vec3Array, Vec3Array])[];
  /**
   * Planar polygons that must be identified (e.g., the cross-section polygon).
   * Each face is an ordered list of coplanar 3D points defining the polygon boundary.
   */
  readonly faces?: readonly (readonly Vec3Array[])[];
}

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
  /** Camera target point -- the scene is centered on this position */
  readonly center?: Vec3Array;
  /** Projection type. Defaults to 'perspective'. */
  readonly projection?: CameraProjection;
  /** Initial viewing angles */
  readonly angle?: PuzzleCameraAngle;
  /** Camera distance (zoom) limits and initial value */
  readonly distance?: PuzzleCameraDistance;
}

export interface PuzzleDefinition {
  /** Unique puzzle identifier, used as translation key and for persistence */
  readonly id: string;
  /** Geometric scene and given elements shown to the user */
  readonly input: PuzzleInput;
  /** Correct answer -- constructions the user must produce to solve the puzzle */
  readonly expected: PuzzleExpectedResult;
  /** Camera configuration. Falls back to global defaults if omitted. */
  readonly camera?: PuzzleCamera;
  /** URL of an image illustrating the solution (imported via Vite). */
  readonly solutionImage?: string;
}

/** Result of preparePuzzle -- everything the renderer and scene need */
export interface PreparedPuzzle {
  readonly topology: FigureTopology;
}

export type CameraInteractionMode = 'rotate' | 'pan';
