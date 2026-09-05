import { FACE_POSITION_FLOATS } from '../../domain/constants';
import type { Vec3Array } from '../../domain/topology-types';
import type {
  LineInstanceStyle,
  MarkerInstanceStyle,
  PreviewLineStyle,
  PreviewMarkerStyle,
  StyledMarker,
  StyledSegment,
} from './styled-scene';
import { SOLUTION_FACE_VERTEX_FLOATS } from './styled-scene';

const FLOAT32_BYTES = 4;

/** Styled line instance: 22 floats of the shader `LineInstance` plus the two endpoint vertex indices. */
export const FLOATS_PER_STYLED_LINE = 24;
export const STYLED_LINE_STRIDE = FLOATS_PER_STYLED_LINE * FLOAT32_BYTES;

export const STYLED_LINE_ATTRIBUTES: readonly GPUVertexAttribute[] = [
  { shaderLocation: 0, offset: 0, format: 'float32x3' }, // startPos
  { shaderLocation: 1, offset: 12, format: 'float32x3' }, // endPos
  { shaderLocation: 2, offset: 24, format: 'float32' }, // visibleWidth
  { shaderLocation: 3, offset: 28, format: 'float32x3' }, // visibleColor
  { shaderLocation: 4, offset: 40, format: 'float32' }, // visibleAlpha
  { shaderLocation: 5, offset: 44, format: 'float32' }, // visibleLineType
  { shaderLocation: 6, offset: 48, format: 'float32' }, // visibleDash
  { shaderLocation: 7, offset: 52, format: 'float32' }, // visibleGap
  { shaderLocation: 8, offset: 56, format: 'float32' }, // hiddenWidth
  { shaderLocation: 9, offset: 60, format: 'float32x3' }, // hiddenColor
  { shaderLocation: 10, offset: 72, format: 'float32' }, // hiddenAlpha
  { shaderLocation: 11, offset: 76, format: 'float32' }, // hiddenLineType
  { shaderLocation: 12, offset: 80, format: 'float32' }, // hiddenDash
  { shaderLocation: 13, offset: 84, format: 'float32' }, // hiddenGap
];

/** The line-id pre-pass also reads the endpoint vertex indices. */
export const LINE_ID_ATTRIBUTES: readonly GPUVertexAttribute[] = [
  ...STYLED_LINE_ATTRIBUTES,
  { shaderLocation: 14, offset: 88, format: 'float32' }, // startVertexIndex
  { shaderLocation: 15, offset: 92, format: 'float32' }, // endVertexIndex
];

/** Marker instance: position(3) + type(1) + visible style(9) + hidden style(9) + vertexIndex(1) + reserved(1). */
export const MARKER_INSTANCE_FLOATS = 24;
export const MARKER_INSTANCE_STRIDE = MARKER_INSTANCE_FLOATS * FLOAT32_BYTES;

export const MARKER_ATTRIBUTES: readonly GPUVertexAttribute[] = [
  { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
  { shaderLocation: 1, offset: 12, format: 'float32' }, // markerType
  { shaderLocation: 2, offset: 16, format: 'float32' }, // visibleSize
  { shaderLocation: 3, offset: 20, format: 'float32x3' }, // visibleColor
  { shaderLocation: 4, offset: 32, format: 'float32' }, // visibleAlpha
  { shaderLocation: 5, offset: 36, format: 'float32x3' }, // visibleStrokeColor
  { shaderLocation: 6, offset: 48, format: 'float32' }, // visibleStrokeWidth
  { shaderLocation: 7, offset: 52, format: 'float32' }, // hiddenSize
  { shaderLocation: 8, offset: 56, format: 'float32x3' }, // hiddenColor
  { shaderLocation: 9, offset: 68, format: 'float32' }, // hiddenAlpha
  { shaderLocation: 10, offset: 72, format: 'float32x3' }, // hiddenStrokeColor
  { shaderLocation: 11, offset: 84, format: 'float32' }, // hiddenStrokeWidth
  { shaderLocation: 12, offset: 88, format: 'float32' }, // vertexIndex
];

export const FACE_VERTEX_STRIDE = FACE_POSITION_FLOATS * FLOAT32_BYTES;
export const FACE_ATTRIBUTES: readonly GPUVertexAttribute[] = [
  { shaderLocation: 0, offset: 0, format: 'float32x3' },
];

export const SOLUTION_FACE_VERTEX_STRIDE = SOLUTION_FACE_VERTEX_FLOATS * FLOAT32_BYTES;
export const SOLUTION_FACE_ATTRIBUTES: readonly GPUVertexAttribute[] = [
  { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
  { shaderLocation: 1, offset: 12, format: 'float32x4' }, // rgba
];

function writeLineStyle(buffer: Float32Array, offset: number, style: LineInstanceStyle): void {
  buffer[offset] = style.width;
  buffer[offset + 1] = style.color[0];
  buffer[offset + 2] = style.color[1];
  buffer[offset + 3] = style.color[2];
  buffer[offset + 4] = style.alpha;
  buffer[offset + 5] = style.lineType;
  buffer[offset + 6] = style.dash;
  buffer[offset + 7] = style.gap;
}

function writeLineEndpoints(
  buffer: Float32Array,
  offset: number,
  pointA: Vec3Array,
  pointB: Vec3Array
): void {
  buffer.set(pointA, offset);
  buffer.set(pointB, offset + 3);
}

export function packStyledSegments(segments: readonly StyledSegment[]): Float32Array {
  const buffer = new Float32Array(segments.length * FLOATS_PER_STYLED_LINE);

  segments.forEach((segment, index) => {
    const offset = index * FLOATS_PER_STYLED_LINE;
    writeLineEndpoints(buffer, offset, segment.startPosition, segment.endPosition);
    writeLineStyle(buffer, offset + 6, segment.visibleStyle);
    writeLineStyle(buffer, offset + 14, segment.hiddenStyle);
    buffer[offset + 22] = segment.startVertexIndex;
    buffer[offset + 23] = segment.endVertexIndex;
  });

  return buffer;
}

/**
 * The preview line renders with `renderMode = ALL` and never reaches the line-id
 * pass, so only the visible style is filled; the hidden style stays zero.
 */
export function packPreviewLine(
  buffer: Float32Array,
  pointA: Vec3Array,
  pointB: Vec3Array,
  style: PreviewLineStyle
): void {
  writeLineEndpoints(buffer, 0, pointA, pointB);
  buffer[6] = style.width;
  buffer[7] = style.color[0];
  buffer[8] = style.color[1];
  buffer[9] = style.color[2];
  buffer[10] = style.alpha;
}

function writeMarkerStyle(buffer: Float32Array, offset: number, style: MarkerInstanceStyle): void {
  buffer[offset] = style.size;
  buffer[offset + 1] = style.color[0];
  buffer[offset + 2] = style.color[1];
  buffer[offset + 3] = style.color[2];
  buffer[offset + 4] = style.alpha;
  buffer[offset + 5] = style.strokeColor[0];
  buffer[offset + 6] = style.strokeColor[1];
  buffer[offset + 7] = style.strokeColor[2];
  buffer[offset + 8] = style.strokeWidth;
}

function writeMarkerInstance(
  buffer: Float32Array,
  offset: number,
  position: Vec3Array,
  markerType: number,
  visibleStyle: MarkerInstanceStyle,
  hiddenStyle: MarkerInstanceStyle,
  vertexIndex: number
): void {
  buffer.set(position, offset);
  buffer[offset + 3] = markerType;
  writeMarkerStyle(buffer, offset + 4, visibleStyle);
  writeMarkerStyle(buffer, offset + 13, hiddenStyle);
  buffer[offset + 22] = vertexIndex;
}

export function packStyledMarkers(markers: readonly StyledMarker[]): Float32Array {
  const buffer = new Float32Array(markers.length * MARKER_INSTANCE_FLOATS);

  markers.forEach((marker, index) => {
    writeMarkerInstance(
      buffer,
      index * MARKER_INSTANCE_FLOATS,
      marker.position,
      marker.markerType,
      marker.visibleStyle,
      marker.hiddenStyle,
      marker.vertexIndex
    );
  });

  return buffer;
}

/** Preview markers render with `renderMode = ALL`, so both passes carry the same style. */
export function packPreviewMarker(
  buffer: Float32Array,
  position: Vec3Array,
  style: PreviewMarkerStyle
): void {
  writeMarkerInstance(buffer, 0, position, style.markerType, style, style, 0);
}
