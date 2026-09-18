import type { PuzzleDefinition } from '../types';

/** Cuboid. The section through a point, parallel to the plane of two given segments. */
export const PUZZLE_6: PuzzleDefinition = {
  id: 'puzzle_6',
  camera: {
    center: [0, 0, 0],
    distance: { min: 1.9, max: 8.4, initial: 3.5 },
    angle: { elevation: Math.PI / 2.35, azimuth: Math.PI / 7 },
    projection: 'perspective',
  },
  input: {
    vertices: [[-1, -0.2, 0.75]],
    segments: [
      [
        [-1, 0.6, 0.75],
        [1, -0.6, 0.75],
      ],
      [
        [1, -0.6, 0.75],
        [1, 0.6, -0.75],
      ],
    ],
    figures: [
      {
        vertices: [
          [-1, -0.6, 0.75],
          [1, -0.6, 0.75],
          [1, -0.6, -0.75],
          [-1, -0.6, -0.75],
          [-1, 0.6, 0.75],
          [1, 0.6, 0.75],
          [1, 0.6, -0.75],
          [-1, 0.6, -0.75],
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
        [-0.333333, 0.6, -0.75],
        [-1, 0.6, -0.25],
        [-1, -0.2, 0.75],
        [-0.333333, -0.6, 0.75],
        [1, -0.6, -0.25],
        [1, -0.2, -0.75],
      ],
    ],
  },
};
