import type { PuzzleDefinition } from '../types';

/** Regular hexagonal prism. The pentagonal section through three points on its edges. */
export const PUZZLE_4: PuzzleDefinition = {
  id: 'puzzle_4',
  camera: {
    center: [0, 0, 0],
    distance: { min: 1.7, max: 7.4, initial: 3.1 },
    angle: { elevation: Math.PI / 2.35, azimuth: Math.PI / 7 },
    projection: 'perspective',
  },
  input: {
    vertices: [
      [0.433013, -0.75, 0.75],
      [0.866025, -0.75, -0.25],
      [0.216506, 0.75, 0.875],
    ],
    figures: [
      {
        vertices: [
          [0, -0.75, 1],
          [0.866025, -0.75, 0.5],
          [0.866025, -0.75, -0.5],
          [0, -0.75, -1],
          [-0.866025, -0.75, -0.5],
          [-0.866025, -0.75, 0.5],
          [0, 0.75, 1],
          [0.866025, 0.75, 0.5],
          [0.866025, 0.75, -0.5],
          [0, 0.75, -1],
          [-0.866025, 0.75, -0.5],
          [-0.866025, 0.75, 0.5],
        ],
        faces: [
          [0, 1, 2, 3, 4, 5],
          [6, 7, 8, 9, 10, 11],
          [0, 1, 7, 6],
          [1, 2, 8, 7],
          [2, 3, 9, 8],
          [3, 4, 10, 9],
          [4, 5, 11, 10],
          [5, 0, 6, 11],
        ],
      },
    ],
  },
  expected: {
    faces: [
      [
        [0.822723, 0.75, -0.525],
        [0.216506, 0.75, 0.875],
        [0.433013, -0.75, 0.75],
        [0.866025, -0.75, -0.25],
        [0.866025, 0.249994, -0.5],
      ],
    ],
  },
};
