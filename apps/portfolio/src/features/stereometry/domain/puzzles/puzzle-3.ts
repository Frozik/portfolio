import type { PuzzleDefinition } from '../types';

/** Regular octahedron. The pentagonal section through three points on its edges. */
export const PUZZLE_3: PuzzleDefinition = {
  id: 'puzzle_3',
  camera: {
    center: [0, 0, 0],
    distance: { min: 1.5, max: 6.7, initial: 2.8 },
    angle: { elevation: Math.PI / 2.35, azimuth: Math.PI / 7 },
    projection: 'perspective',
  },
  input: {
    vertices: [
      [0, -0.55, 0.55],
      [0.275, 0, 0.825],
      [-0.55, 0, -0.55],
    ],
    figures: [
      {
        vertices: [
          [0, -1.1, 0],
          [0, 0, 1.1],
          [1.1, 0, 0],
          [0, 0, -1.1],
          [-1.1, 0, 0],
          [0, 1.1, 0],
        ],
        faces: [
          [0, 1, 2],
          [0, 2, 3],
          [0, 3, 4],
          [0, 4, 1],
          [5, 2, 1],
          [5, 3, 2],
          [5, 4, 3],
          [5, 1, 4],
        ],
      },
    ],
  },
  expected: {
    faces: [
      [
        [-0.55, 0, -0.55],
        [-0.366667, -0.733333, 0],
        [0, -0.55, 0.55],
        [0.275, 0, 0.825],
        [0, 1.1, 0],
      ],
    ],
  },
};
