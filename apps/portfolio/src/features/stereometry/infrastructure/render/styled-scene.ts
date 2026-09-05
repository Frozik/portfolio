import type {
  RenderSegment,
  SceneMarker,
  SceneRepresentation,
  SolutionFaceGeometry,
  StyleModifier,
} from '../../domain/render-types';
import type { Vec3Array } from '../../domain/topology-types';
import { STEREOMETRY_STYLES } from './scene-styles';
import type { ResolvedElementStyle, RgbFloat } from './style-resolver';
import { hexToRgb, resolveStyle } from './style-resolver';

const LINE_TYPE_SOLID = 0;
const LINE_TYPE_DASHED = 1;
const MARKER_TYPE_SOLID = 0;
const MARKER_TYPE_CIRCLE = 1;

/** Solution face vertex: position(3) + rgba(4). */
export const SOLUTION_FACE_VERTEX_FLOATS = 7;
const FLOATS_PER_POSITION = 3;

export interface LineInstanceStyle {
  readonly width: number;
  readonly color: RgbFloat;
  readonly alpha: number;
  readonly lineType: number;
  readonly dash: number;
  readonly gap: number;
}

export interface StyledSegment {
  readonly startPosition: Vec3Array;
  readonly endPosition: Vec3Array;
  readonly visibleStyle: LineInstanceStyle;
  readonly hiddenStyle: LineInstanceStyle;
  readonly lineId: number;
  readonly startVertexIndex: number;
  readonly endVertexIndex: number;
}

export interface MarkerInstanceStyle {
  readonly size: number;
  readonly color: RgbFloat;
  readonly alpha: number;
  readonly strokeColor: RgbFloat;
  readonly strokeWidth: number;
}

export interface StyledMarker {
  readonly position: Vec3Array;
  readonly markerType: number;
  readonly visibleStyle: MarkerInstanceStyle;
  readonly hiddenStyle: MarkerInstanceStyle;
  readonly vertexIndex: number;
}

/** Solution face vertices interleaved as position + rgba, ready for upload. */
export interface SolutionFaceRenderData {
  readonly vertices: Float32Array;
  readonly vertexCount: number;
}

export interface StyledScene {
  readonly segments: readonly StyledSegment[];
  readonly markers: readonly StyledMarker[];
  readonly solutionFace: SolutionFaceRenderData | undefined;
}

export interface PreviewMarkerStyle {
  readonly markerType: number;
  readonly size: number;
  readonly color: RgbFloat;
  readonly alpha: number;
  readonly strokeColor: RgbFloat;
  readonly strokeWidth: number;
}

export interface PreviewLineStyle {
  readonly width: number;
  readonly color: RgbFloat;
  readonly alpha: number;
}

function markerTypeCode(resolved: ResolvedElementStyle): number {
  return resolved.markerType === 'circle' ? MARKER_TYPE_CIRCLE : MARKER_TYPE_SOLID;
}

function toLineInstanceStyle(resolved: ResolvedElementStyle): LineInstanceStyle {
  const dashed = resolved.line.type === 'dashed';
  return {
    width: resolved.width,
    color: hexToRgb(resolved.color),
    alpha: resolved.alpha,
    lineType: dashed ? LINE_TYPE_DASHED : LINE_TYPE_SOLID,
    dash: resolved.line.type === 'dashed' ? resolved.line.dash : 0,
    gap: resolved.line.type === 'dashed' ? resolved.line.gap : 0,
  };
}

function toMarkerInstanceStyle(resolved: ResolvedElementStyle): MarkerInstanceStyle {
  return {
    size: resolved.size,
    color: hexToRgb(resolved.color),
    alpha: resolved.alpha,
    strokeColor: hexToRgb(resolved.strokeColor),
    strokeWidth: resolved.strokeWidth,
  };
}

function hiddenModifiersOf(modifiers: readonly StyleModifier[]): readonly StyleModifier[] {
  return ['hidden', ...modifiers];
}

export function styleSegment(segment: RenderSegment): StyledSegment {
  return {
    startPosition: segment.startPosition,
    endPosition: segment.endPosition,
    visibleStyle: toLineInstanceStyle(resolveStyle(STEREOMETRY_STYLES, 'line', segment.modifiers)),
    hiddenStyle: toLineInstanceStyle(
      resolveStyle(STEREOMETRY_STYLES, 'line', hiddenModifiersOf(segment.modifiers))
    ),
    lineId: segment.lineId,
    startVertexIndex: segment.startVertexIndex,
    endVertexIndex: segment.endVertexIndex,
  };
}

export function styleMarker(marker: SceneMarker): StyledMarker {
  const visible = resolveStyle(STEREOMETRY_STYLES, 'vertex', marker.modifiers);
  const hidden = resolveStyle(STEREOMETRY_STYLES, 'vertex', hiddenModifiersOf(marker.modifiers));

  return {
    position: marker.position,
    markerType: markerTypeCode(visible),
    visibleStyle: toMarkerInstanceStyle(visible),
    hiddenStyle: toMarkerInstanceStyle(hidden),
    vertexIndex: marker.vertexIndex,
  };
}

export function styleSolutionFace(face: SolutionFaceGeometry): SolutionFaceRenderData {
  const resolved = resolveStyle(STEREOMETRY_STYLES, 'face', ['solution']);
  const [red, green, blue] = hexToRgb(resolved.color);
  const vertices = new Float32Array(face.vertexCount * SOLUTION_FACE_VERTEX_FLOATS);

  for (let vertexIndex = 0; vertexIndex < face.vertexCount; vertexIndex++) {
    const readOffset = vertexIndex * FLOATS_PER_POSITION;
    const writeOffset = vertexIndex * SOLUTION_FACE_VERTEX_FLOATS;
    vertices.set(
      face.positions.subarray(readOffset, readOffset + FLOATS_PER_POSITION),
      writeOffset
    );
    vertices[writeOffset + 3] = red;
    vertices[writeOffset + 4] = green;
    vertices[writeOffset + 5] = blue;
    vertices[writeOffset + 6] = resolved.alpha;
  }

  return { vertices, vertexCount: face.vertexCount };
}

/** Maps the semantic scene onto the style map: colours, widths and dashes per element. */
export function styleScene(representation: SceneRepresentation): StyledScene {
  return {
    segments: representation.segments.map(styleSegment),
    markers: representation.markers.map(styleMarker),
    solutionFace:
      representation.solutionFace === undefined
        ? undefined
        : styleSolutionFace(representation.solutionFace),
  };
}

export function resolvePreviewMarkerStyle(): PreviewMarkerStyle {
  const resolved = resolveStyle(STEREOMETRY_STYLES, 'vertex', ['preview']);
  return { markerType: markerTypeCode(resolved), ...toMarkerInstanceStyle(resolved) };
}

export function resolvePreviewLineStyle(): PreviewLineStyle {
  const resolved = resolveStyle(STEREOMETRY_STYLES, 'line', ['preview']);
  return { width: resolved.width, color: hexToRgb(resolved.color), alpha: resolved.alpha };
}

export function resolveBackgroundColor(): GPUColor {
  const [red, green, blue] = hexToRgb(resolveStyle(STEREOMETRY_STYLES, 'background', []).color);
  return { r: red, g: green, b: blue, a: 1.0 };
}
