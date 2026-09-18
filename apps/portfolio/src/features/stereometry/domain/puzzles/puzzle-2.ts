import type { PuzzleDefinition } from '../types';

/** Square pyramid. The trace the cutting plane leaves on the base plane. */
export const PUZZLE_2: PuzzleDefinition = {
  id: 'puzzle_2',
  camera: {
    center: [0.25, 0.15, 0.25],
    distance: { min: 2.4, max: 10.3, initial: 4.3 },
    angle: { elevation: Math.PI / 2.35, azimuth: Math.PI / 7 },
    projection: 'perspective',
  },
  input: {
    vertices: [
      [0, -0.3, 0.75],
      [0.5, 0.15, 0],
      [0, 0.6, -0.25],
    ],
    figures: [
      {
        vertices: [
          [0, -0.75, 1],
          [1, -0.75, 0],
          [0, -0.75, -1],
          [-1, -0.75, 0],
          [0, 1.05, 0],
        ],
        faces: [
          [0, 1, 2, 3],
          [4, 0, 1],
          [4, 1, 2],
          [4, 2, 3],
          [4, 3, 0],
        ],
      },
    ],
  },
  expected: {
    lines: [
      [
        [-0.5, -0.75, 1.5],
        [1.5, -0.75, 0.5],
      ],
    ],
  },
};
