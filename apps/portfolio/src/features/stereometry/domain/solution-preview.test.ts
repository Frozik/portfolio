import { PUZZLE_1 } from './puzzles/puzzle-1';
import { PUZZLE_2 } from './puzzles/puzzle-2';
import { buildSolutionPreview } from './solution-preview';
import type { PuzzleDefinition } from './types';

const SIZE = 200;

/** A cube seen from the front: the far face is hidden, the near face is not. */
const CUBE: PuzzleDefinition = {
  id: 'cube',
  camera: {
    angle: { elevation: Math.PI / 2, azimuth: 0 },
    distance: { min: 3, max: 10, initial: 6 },
  },
  input: {
    figures: [
      {
        vertices: [
          [-1, -1, -1],
          [1, -1, -1],
          [1, 1, -1],
          [-1, 1, -1],
          [-1, -1, 1],
          [1, -1, 1],
          [1, 1, 1],
          [-1, 1, 1],
        ],
        faces: [
          [0, 1, 2, 3],
          [4, 5, 6, 7],
          [0, 1, 5, 4],
          [2, 3, 7, 6],
          [1, 2, 6, 5],
          [0, 3, 7, 4],
        ],
      },
    ],
  },
  expected: {},
};

describe('buildSolutionPreview', () => {
  it('projects the figure into the requested picture size', () => {
    const preview = buildSolutionPreview(PUZZLE_1, SIZE, SIZE);

    const inside = (point: { readonly x: number; readonly y: number }) =>
      point.x >= 0 && point.x <= SIZE && point.y >= 0 && point.y <= SIZE;

    expect(preview).toMatchObject({ width: SIZE, height: SIZE });
    expect(preview.markers.some(marker => inside(marker.position))).toBe(true);
    expect(preview.segments.some(segment => inside(segment.start) && inside(segment.end))).toBe(
      true
    );
  });

  it('marks the far side of the figure as hidden and the near side as visible', () => {
    const preview = buildSolutionPreview(CUBE, SIZE, SIZE);
    const nearCorner = preview.markers.find(
      marker => marker.position.x < SIZE / 2 && marker.position.y < SIZE / 2
    );

    expect(preview.segments.some(segment => segment.hidden)).toBe(true);
    expect(preview.segments.some(segment => !segment.hidden)).toBe(true);
    expect(preview.markers.filter(marker => marker.hidden)).toHaveLength(4);
    expect(preview.markers.filter(marker => !marker.hidden)).toHaveLength(4);
    expect(nearCorner).toBeDefined();
  });

  it('fades what lies beyond the camera target and keeps the near side at full opacity', () => {
    const preview = buildSolutionPreview(CUBE, SIZE, SIZE);
    const fades = preview.markers.map(marker => marker.depthFade);

    expect(Math.max(...fades)).toBe(1);
    expect(Math.min(...fades)).toBeLessThan(1);
    expect(
      preview.markers.filter(marker => marker.hidden).every(marker => marker.depthFade < 1)
    ).toBe(true);
  });

  it('paints hidden elements before visible ones', () => {
    const preview = buildSolutionPreview(CUBE, SIZE, SIZE);
    const firstVisible = preview.segments.findIndex(segment => !segment.hidden);

    expect(preview.segments.slice(firstVisible).every(segment => !segment.hidden)).toBe(true);
  });

  it('draws the expected cross-section as a solution polygon with solution-styled edges', () => {
    const preview = buildSolutionPreview(PUZZLE_1, SIZE, SIZE);

    expect(preview.faces).toHaveLength(1);
    expect(preview.faces[0]).toHaveLength(PUZZLE_1.expected.faces?.[0].length ?? 0);
    expect(preview.segments.some(segment => segment.modifiers.includes('solution'))).toBe(true);
  });

  it('renders every shipped puzzle', () => {
    for (const puzzle of [PUZZLE_1, PUZZLE_2]) {
      const preview = buildSolutionPreview(puzzle, SIZE, SIZE);
      expect(preview.segments.length).toBeGreaterThan(0);
    }
  });
});
