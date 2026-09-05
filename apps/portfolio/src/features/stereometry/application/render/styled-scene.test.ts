import type { RenderSegment, SceneMarker } from '../../domain/render-types';
import { styleMarker, styleScene, styleSegment, styleSolutionFace } from './styled-scene';

const SOLUTION_RGB = [0xef / 0xff, 0xbf / 0xff, 0x04 / 0xff] as const;

function segment(modifiers: RenderSegment['modifiers']): RenderSegment {
  return {
    startPosition: [0, 0, 0],
    endPosition: [1, 0, 0],
    lineId: 1,
    modifiers,
    startVertexIndex: -1,
    endVertexIndex: -1,
  };
}

function marker(modifiers: SceneMarker['modifiers']): SceneMarker {
  return { position: [0, 0, 0], modifiers, vertexIndex: 0 };
}

describe('styleSegment', () => {
  it('gives a plain line a solid visible style and a dashed, dimmed hidden style', () => {
    const styled = styleSegment(segment([]));

    expect(styled.visibleStyle.lineType).toBe(0);
    expect(styled.hiddenStyle.lineType).toBe(1);
    expect(styled.hiddenStyle.alpha).toBeLessThan(styled.visibleStyle.alpha);
  });

  it('paints solution segments in the solution colour', () => {
    const styled = styleSegment(segment(['edge', 'segment', 'solution']));

    styled.visibleStyle.color.forEach((channel, index) =>
      expect(channel).toBeCloseTo(SOLUTION_RGB[index])
    );
  });

  it('keeps the segment identity fields', () => {
    const styled = styleSegment({ ...segment([]), startVertexIndex: 3, endVertexIndex: 5 });

    expect(styled).toMatchObject({ lineId: 1, startVertexIndex: 3, endVertexIndex: 5 });
  });
});

describe('styleMarker', () => {
  it('draws plain vertices as circles and input vertices as solid dots', () => {
    expect(styleMarker(marker([])).markerType).toBe(1);
    expect(styleMarker(marker(['input'])).markerType).toBe(0);
  });

  it('produces GPU channel values within 0..1 for both passes', () => {
    const styled = styleMarker(marker(['inner', 'selected']));

    for (const channel of [...styled.visibleStyle.color, ...styled.hiddenStyle.strokeColor]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });
});

describe('styleSolutionFace', () => {
  it('interleaves each position with the translucent solution colour', () => {
    const styled = styleSolutionFace({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      vertexCount: 3,
    });

    expect(styled.vertexCount).toBe(3);
    expect(styled.vertices).toHaveLength(3 * 7);
    expect(Array.from(styled.vertices.subarray(7, 10))).toEqual([1, 0, 0]);
    expect(styled.vertices[10]).toBeCloseTo(SOLUTION_RGB[0]);
    expect(styled.vertices[13]).toBeCloseTo(0.1);
  });
});

describe('styleScene', () => {
  it('styles every part of the representation and leaves an absent face absent', () => {
    const scene = styleScene({ segments: [segment([])], markers: [marker([])] });

    expect(scene.segments).toHaveLength(1);
    expect(scene.markers).toHaveLength(1);
    expect(scene.solutionFace).toBeUndefined();
  });
});
