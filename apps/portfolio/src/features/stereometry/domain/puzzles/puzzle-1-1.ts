import puzzle_1_1_image from '../../../../assets/puzzle_1_1.png';
import type { PuzzleDefinition } from '../types';

export const PUZZLE_1_1: PuzzleDefinition = {
  id: 'puzzle_1_1',
  solutionImage: puzzle_1_1_image,
  camera: {
    center: [0, -0.25, 0],
    distance: { min: 3, max: 10, initial: 5 },
    angle: { elevation: Math.PI / 2.3, azimuth: Math.PI / 30 },
    projection: 'perspective',
  },
  input: {
    vertices: [[0.205725, 0.225, -0.283156]],
    lines: [
      [
        [1.5, -0.75, 1.5],
        [-1.5, -0.75, 1],
      ],
    ],
    segments: [
      [
        [-0.293893, 0, -0.404509],
        [-0.475529, -0.75, 0.654509],
      ],
    ],
    figures: [
      {
        vertices: [
          [0, -0.75, 1],
          [0.951057, -0.75, 0.309017],
          [0.587785, -0.75, -0.809017],
          [-0.587785, -0.75, -0.809017],
          [-0.951057, -0.75, 0.309017],
          [0, 0.75, 0],
        ],
        faces: [
          [5, 0, 1],
          [5, 1, 2],
          [5, 2, 3],
          [5, 3, 4],
          [5, 4, 0],
          [0, 1, 2, 3, 4],
        ],
      },
    ],
  },
  expected: {
    faces: [
      [
        [0.205725, 0.225, -0.283156],
        [0.506437, -0.048748, 0.164551],
        [0, -0.624467, 0.916312],
        [-0.600268, -0.196738, 0.195039],
        [-0.219674, 0.189403, -0.302355],
      ],
    ],
  },
};
