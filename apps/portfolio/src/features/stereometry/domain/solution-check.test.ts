import { describe, expect, it } from 'vitest';
import { preparePuzzle } from './geometry';
import { computeSolutionStatus } from './solution-check';
import { addLine, createTopologyFromPuzzle } from './topology';
import type { SceneTopology, Vec3Array } from './topology-types';
import type { PuzzleDefinition, PuzzleExpectedResult } from './types';

/** Tetrahedron at origin for testing. */
const TETRAHEDRON: PuzzleDefinition = {
  id: 'tetrahedron',
  input: {
    figures: [
      {
        vertices: [
          [0, 0, 0],
          [2, 0, 0],
          [1, 0, 2],
          [1, 2, 1],
        ],
        faces: [
          [0, 1, 2],
          [0, 1, 3],
          [1, 2, 3],
          [0, 2, 3],
        ],
      },
    ],
  },
  expected: {},
};

function createTetrahedronScene(): SceneTopology {
  const { topology } = preparePuzzle(TETRAHEDRON);
  return createTopologyFromPuzzle(topology);
}

describe('computeSolutionStatus', () => {
  it('returns isSolved=false when expected is empty', () => {
    const scene = createTetrahedronScene();
    const status = computeSolutionStatus({}, scene);
    expect(status.isSolved).toBe(false);
  });

  it('returns isSolved=false when an expected vertex is missing', () => {
    const scene = createTetrahedronScene();
    const status = computeSolutionStatus({ vertices: [[99, 99, 99]] }, scene);
    expect(status.isSolved).toBe(false);
  });

  it('returns isSolved=true when all expected vertices exist as figure vertices', () => {
    const scene = createTetrahedronScene();
    const status = computeSolutionStatus(
      {
        vertices: [
          [0, 0, 0],
          [2, 0, 0],
        ],
      },
      scene
    );
    expect(status.isSolved).toBe(true);
    expect(status.solutionVertexPositions).toHaveLength(2);
  });

  it('returns isSolved=false when an expected line is not covered by any topology line', () => {
    const scene = createTetrahedronScene();
    const status = computeSolutionStatus(
      {
        lines: [
          [
            [5, 5, 5],
            [6, 6, 6],
          ],
        ],
      },
      scene
    );
    expect(status.isSolved).toBe(false);
  });

  it('matches an expected line against a figure edge (edge covers the segment)', () => {
    const scene = createTetrahedronScene();
    // Tetrahedron has an edge from [0,0,0] to [2,0,0]
    const status = computeSolutionStatus(
      {
        lines: [
          [
            [0, 0, 0],
            [2, 0, 0],
          ],
        ],
      },
      scene
    );
    expect(status.isSolved).toBe(true);
  });

  it('matches an expected line against a user-drawn infinite line (collinear)', () => {
    const { topology } = preparePuzzle(TETRAHEDRON);
    let scene = createTopologyFromPuzzle(topology);
    // Draw a user line along the x-axis far from the figure
    scene = addLine(scene, [5, 0, 0], [10, 0, 0], topology);
    // Expected line within infinite extent of user line
    const status = computeSolutionStatus(
      {
        lines: [
          [
            [3, 0, 0],
            [4, 0, 0],
          ],
        ],
      },
      scene
    );
    expect(status.isSolved).toBe(true);
  });

  it('returns isSolved=false when face perimeter edge is missing', () => {
    const scene = createTetrahedronScene();
    // The face requires an edge from [0,0,0] → [99,99,99] which doesn't exist
    const status = computeSolutionStatus(
      {
        faces: [
          [
            [0, 0, 0],
            [2, 0, 0],
            [99, 99, 99],
          ],
        ],
      },
      scene
    );
    expect(status.isSolved).toBe(false);
  });

  it('matches a triangular face whose edges coincide with figure edges', () => {
    const scene = createTetrahedronScene();
    // Face [0,0,0]-[2,0,0]-[1,0,2]-[0,0,0] — all sides are figure edges of the base
    const face: readonly Vec3Array[] = [
      [0, 0, 0],
      [2, 0, 0],
      [1, 0, 2],
    ];
    const status = computeSolutionStatus({ faces: [face] }, scene);
    expect(status.isSolved).toBe(true);
  });

  it('includes face vertices and line endpoints in solutionVertexPositions', () => {
    const scene = createTetrahedronScene();
    const expected: PuzzleExpectedResult = {
      vertices: [[1, 2, 1]],
      lines: [
        [
          [0, 0, 0],
          [2, 0, 0],
        ],
      ],
      faces: [
        [
          [0, 0, 0],
          [2, 0, 0],
          [1, 0, 2],
        ],
      ],
    };
    const status = computeSolutionStatus(expected, scene);
    expect(status.isSolved).toBe(true);
    // 1 explicit + 2 line endpoints + 3 face vertices = 6 positions
    expect(status.solutionVertexPositions).toHaveLength(6);
  });

  it('includes face perimeter ranges in solutionLineRanges', () => {
    const scene = createTetrahedronScene();
    const face: readonly Vec3Array[] = [
      [0, 0, 0],
      [2, 0, 0],
      [1, 0, 2],
    ];
    const status = computeSolutionStatus({ faces: [face] }, scene);
    expect(status.isSolved).toBe(true);
    // 3 face edges as perimeter ranges
    expect(status.solutionLineRanges).toHaveLength(3);
  });

  it('does not allow a finite edge to cover a segment outside its bounds', () => {
    const scene = createTetrahedronScene();
    // Tetrahedron edge goes from [0,0,0] to [2,0,0]. Expected line reaches [3,0,0] — out of bounds.
    const status = computeSolutionStatus(
      {
        lines: [
          [
            [0, 0, 0],
            [3, 0, 0],
          ],
        ],
      },
      scene
    );
    expect(status.isSolved).toBe(false);
  });
});
