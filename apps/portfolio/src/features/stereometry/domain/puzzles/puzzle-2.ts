import type { PuzzleDefinition } from '../types';

/**
 * Right pentagonal prism with regular pentagon bases.
 * The prism is centered at the origin with its axis along the +y direction.
 *
 * Vertices 0..4 form the bottom pentagon (y = -PRISM_HALF_HEIGHT).
 * Vertices 5..9 form the top pentagon    (y = +PRISM_HALF_HEIGHT) with
 * matching xz coordinates.
 *
 * Face winding follows the convention used by puzzle-1-1 (bottom pentagon
 * listed in order [0,1,2,3,4]); the topology layer normalises winding when
 * computing face normals, so each face only needs a consistent traversal.
 */
const PRISM_HALF_HEIGHT = 0.75;

export const PUZZLE_2: PuzzleDefinition = {
  id: 'puzzle_2',
  camera: {
    center: [0, 0, 0],
    distance: { min: 3, max: 10, initial: 5.5 },
    angle: { elevation: Math.PI / 2.4, azimuth: Math.PI / 6 },
    projection: 'perspective',
  },
  input: {
    segments: [
      // Pair 1 -- shared midpoint at the midpoint of edge v2-v7 (P2).
      [
        // P1 -- midpoint of vertical edge v0-v5
        [0, 0, 1],
        // P2 -- midpoint of vertical edge v2-v7
        [0.587785, 0, -0.809017],
      ],
      [
        // P2 -- midpoint of vertical edge v2-v7
        [0.587785, 0, -0.809017],
        // P3 -- midpoint of vertical edge v4-v9
        [-0.951057, 0.4, 0.309017],
      ],
      // Pair 2 -- shared midpoint at the midpoint of top edge v6-v7 (P5).
      [
        // P4 -- midpoint of bottom edge v0-v1
        [0.475529, -PRISM_HALF_HEIGHT, 0.654509],
        // P5 -- midpoint of top edge v6-v7
        [0.769421, PRISM_HALF_HEIGHT, -0.25],
      ],
      [
        // P5 -- midpoint of top edge v6-v7
        [0.769421, PRISM_HALF_HEIGHT, -0.25],
        // P6 -- midpoint of bottom edge v3-v4
        [-0.769423, -PRISM_HALF_HEIGHT, -0.25],
      ],
    ],
    figures: [
      {
        vertices: [
          // Bottom pentagon (y = -PRISM_HALF_HEIGHT)
          [0, -PRISM_HALF_HEIGHT, 1],
          [0.951057, -PRISM_HALF_HEIGHT, 0.309017],
          [0.587785, -PRISM_HALF_HEIGHT, -0.809017],
          [-0.587785, -PRISM_HALF_HEIGHT, -0.809017],
          [-0.951057, -PRISM_HALF_HEIGHT, 0.309017],
          // Top pentagon (y = +PRISM_HALF_HEIGHT)
          [0, PRISM_HALF_HEIGHT, 1],
          [0.951057, PRISM_HALF_HEIGHT, 0.309017],
          [0.587785, PRISM_HALF_HEIGHT, -0.809017],
          [-0.587785, PRISM_HALF_HEIGHT, -0.809017],
          [-0.951057, PRISM_HALF_HEIGHT, 0.309017],
        ],
        faces: [
          // Bottom and top pentagons (winding matches puzzle-1-1's [0,1,2,3,4]).
          [0, 1, 2, 3, 4],
          [5, 6, 7, 8, 9],
          // Lateral quads connecting matching bottom/top vertices.
          [0, 1, 6, 5],
          [1, 2, 7, 6],
          [2, 3, 8, 7],
          [3, 4, 9, 8],
          [4, 0, 5, 9],
        ],
      },
    ],
  },
  expected: {
    // Two anchor points on the intersection line of the two segment-defined
    // planes (Pi_1 through P1, P2, P3; Pi_2 through P4, P5, P6). Both anchors
    // are placed where the intersection line crosses lateral faces of the
    // prism (face v0-v1-v6-v5 and face v2-v3-v8-v7). The validator
    // (`isPointOnInfiniteLine`) only needs collinear anchors.
    lines: [
      [
        [0.759064, -0.197299, 0.448551],
        [-0.418241, 0.342306, -0.809017],
      ],
    ],
  },
};
