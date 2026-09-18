import type { PuzzleDefinition } from '../types';

/** Cube. The hexagonal section through three points on its edges. */
export const PUZZLE_5: PuzzleDefinition = {
  id: 'puzzle_5',
  camera: {
    center: [0, 0, 0],
    distance: { min: 1.8, max: 7.7, initial: 3.2 },
    angle: { elevation: Math.PI / 2.35, azimuth: Math.PI / 7 },
    projection: 'perspective',
  },
  input: {
    vertices: [
      [0.75, -0.75, 0.25],
      [-0.25, -0.75, 0.75],
      [0.75, 0.25, -0.75],
    ],
    figures: [
      {
        vertices: [
          [-0.75, -0.75, 0.75],
          [0.75, -0.75, 0.75],
          [0.75, -0.75, -0.75],
          [-0.75, -0.75, -0.75],
          [-0.75, 0.75, 0.75],
          [0.75, 0.75, 0.75],
          [0.75, 0.75, -0.75],
          [-0.75, 0.75, -0.75],
        ],
        faces: [
          [0, 1, 2, 3],
          [4, 5, 6, 7],
          [0, 1, 5, 4],
          [1, 2, 6, 5],
          [2, 3, 7, 6],
          [3, 0, 4, 7],
        ],
      },
    ],
  },
  expected: {
    faces: [
      [
        [0.75, 0.25, -0.75],
        [0.75, -0.75, 0.25],
        [-0.25, -0.75, 0.75],
        [-0.75, -0.5, 0.75],
        [-0.75, 0.75, -0.5],
        [-0.25, 0.75, -0.75],
      ],
    ],
  },
};
