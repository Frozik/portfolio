import type { PuzzleDefinition } from '../types';

export const PENTAGONAL_PYRAMID: PuzzleDefinition = {
  name: 'Pentagonal Pyramid',
  input: {
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
  expected: {},
};
