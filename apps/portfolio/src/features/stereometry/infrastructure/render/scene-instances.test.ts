import type { StyledMarker, StyledSegment } from '../../application/render/styled-scene';
import {
  FLOATS_PER_STYLED_LINE,
  MARKER_INSTANCE_FLOATS,
  packPreviewLine,
  packPreviewMarker,
  packStyledMarkers,
  packStyledSegments,
} from './scene-instances';

const SEGMENT: StyledSegment = {
  startPosition: [1, 2, 3],
  endPosition: [4, 5, 6],
  visibleStyle: { width: 1, color: [0.1, 0.2, 0.3], alpha: 0.4, lineType: 0, dash: 0, gap: 0 },
  hiddenStyle: { width: 2, color: [0.5, 0.6, 0.7], alpha: 0.8, lineType: 1, dash: 0.05, gap: 0.05 },
  lineId: 7,
  startVertexIndex: 8,
  endVertexIndex: 9,
};

const MARKER: StyledMarker = {
  position: [1, 2, 3],
  markerType: 1,
  visibleStyle: {
    size: 10,
    color: [0.1, 0.2, 0.3],
    alpha: 1,
    strokeColor: [1, 1, 1],
    strokeWidth: 2,
  },
  hiddenStyle: {
    size: 10,
    color: [0, 0, 0],
    alpha: 0.5,
    strokeColor: [0.6, 0.6, 0.6],
    strokeWidth: 2,
  },
  vertexIndex: 4,
};

function near(values: ArrayLike<number>): number[] {
  return Array.from(values, value => Math.round(value * 1000) / 1000);
}

describe('packStyledSegments', () => {
  it('lays out endpoints, both styles and the vertex indices as the line shaders read them', () => {
    const packed = packStyledSegments([SEGMENT]);

    expect(packed).toHaveLength(FLOATS_PER_STYLED_LINE);
    expect(near(packed)).toEqual([
      1, 2, 3, 4, 5, 6, 1, 0.1, 0.2, 0.3, 0.4, 0, 0, 0, 2, 0.5, 0.6, 0.7, 0.8, 1, 0.05, 0.05, 8, 9,
    ]);
  });
});

describe('packStyledMarkers', () => {
  it('lays out position, type, both styles and the vertex index as the marker shader reads them', () => {
    const packed = packStyledMarkers([MARKER]);

    expect(packed).toHaveLength(MARKER_INSTANCE_FLOATS);
    expect(near(packed)).toEqual([
      1, 2, 3, 1, 10, 0.1, 0.2, 0.3, 1, 1, 1, 1, 2, 10, 0, 0, 0, 0.5, 0.6, 0.6, 0.6, 2, 4, 0,
    ]);
  });
});

describe('preview packing', () => {
  it('fills only the visible style of the preview line', () => {
    const buffer = new Float32Array(FLOATS_PER_STYLED_LINE);

    packPreviewLine(buffer, [0, 0, 0], [1, 1, 1], { width: 3, color: [0.2, 0.4, 0.6], alpha: 1 });

    expect(near(buffer.subarray(0, 11))).toEqual([0, 0, 0, 1, 1, 1, 3, 0.2, 0.4, 0.6, 1]);
    expect(Array.from(buffer.subarray(11))).toEqual(new Array(FLOATS_PER_STYLED_LINE - 11).fill(0));
  });

  it('uses the preview style for both passes of the preview marker', () => {
    const buffer = new Float32Array(MARKER_INSTANCE_FLOATS);

    packPreviewMarker(buffer, [1, 1, 1], {
      markerType: 0,
      size: 16,
      color: [0, 0, 0],
      alpha: 1,
      strokeColor: [0.2, 0.5, 0.7],
      strokeWidth: 6,
    });

    expect(near(buffer.subarray(4, 13))).toEqual(near(buffer.subarray(13, 22)));
    expect(buffer[3]).toBe(0);
  });
});
