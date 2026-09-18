import type { PuzzleDefinition } from '../types';

/** A cube and a triangular prism on one base plane. The line where two of their face planes meet. */
export const PUZZLE_1: PuzzleDefinition = {
  id: 'puzzle_1',
  camera: {
    center: [-0.085288, 0, 0.075],
    distance: { min: 3.2, max: 14.2, initial: 5.9 },
    angle: { elevation: Math.PI / 2.35, azimuth: Math.PI / 7 },
    projection: 'perspective',
  },
  input: {
    vertices: [
      [-1.4, 0, -0.75],
      [0.810289, 0, 0.225],
    ],
    figures: [
      {
        vertices: [
          [-2.15, -0.75, 0.75],
          [-0.65, -0.75, 0.75],
          [-0.65, -0.75, -0.75],
          [-2.15, -0.75, -0.75],
          [-2.15, 0.75, 0.75],
          [-0.65, 0.75, 0.75],
          [-0.65, 0.75, -0.75],
          [-2.15, 0.75, -0.75],
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
      {
        vertices: [
          [1.2, -0.75, 0.9],
          [1.979423, -0.75, -0.45],
          [0.420577, -0.75, -0.45],
          [1.2, 0.75, 0.9],
          [1.979423, 0.75, -0.45],
          [0.420577, 0.75, -0.45],
        ],
        faces: [
          [0, 1, 2],
          [3, 4, 5],
          [0, 1, 4, 3],
          [1, 2, 5, 4],
          [2, 0, 3, 5],
        ],
      },
    ],
  },
  expected: {
    lines: [
      [
        [0.247372, -0.75, -0.75],
        [0.247372, 0.75, -0.75],
      ],
    ],
  },
};
