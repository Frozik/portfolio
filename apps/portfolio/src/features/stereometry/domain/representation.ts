import { assertNever } from '@frozik/utils/assert/assertNever';

import { buildTopologyEdgeSegments } from './edge-segments';
import { FigureInnerPointCache } from './figure-inner-points';
import {
  edgeEndpointsMatch,
  getEdgeEndpoints,
  isCollinearWithLine,
  positionsMatch,
  projectPointOntoLine,
} from './geometry-utils';
import { buildLineSegments } from './line-segments';
import type { RenderSegment, SceneRepresentation } from './render-types';
import { buildMarkers } from './scene-markers';
import { mergeCollinearSegments } from './segment-merge';
import type { SolutionStatus } from './solution-check';
import { isSubSegmentInSolutionRange, lineCoversSegment } from './solution-check';
import { buildSolutionFace } from './solution-face';
import type {
  FigureTopology,
  SelectionState,
  TopologyLine,
  TopologyVertex,
  Vec3Array,
} from './topology-types';
import { NO_VERTEX_ID } from './topology-types';

/** Builds a complete scene representation from topology data. */
export function buildRepresentation(
  figureTopology: FigureTopology,
  lines: readonly TopologyLine[],
  vertices: readonly TopologyVertex[],
  selection: SelectionState,
  previewLine?: { readonly pointA: Vec3Array; readonly pointB: Vec3Array },
  solutionStatus?: SolutionStatus,
  innerPoints: FigureInnerPointCache = new FigureInnerPointCache()
): SceneRepresentation {
  const markers = buildMarkers(figureTopology, vertices, selection, solutionStatus, innerPoints);

  const segments = buildSegments(
    figureTopology,
    lines,
    vertices,
    selection,
    previewLine,
    solutionStatus,
    innerPoints
  );

  const solutionFace = buildSolutionFace(solutionStatus);

  return { segments, markers, solutionFace };
}

/** Sentinel lineId for the preview line (not associated with any topology line) */
const PREVIEW_LINE_ID = -2;

function buildSegments(
  figureTopology: FigureTopology,
  lines: readonly TopologyLine[],
  vertices: readonly TopologyVertex[],
  selection: SelectionState,
  previewLine: { readonly pointA: Vec3Array; readonly pointB: Vec3Array } | undefined,
  solutionStatus: SolutionStatus | undefined,
  innerPoints: FigureInnerPointCache
): readonly RenderSegment[] {
  const selectedLineId = getSelectedLineId(selection);
  const selectedEdgeIndices = findSelectedEdgeIndices(selection, lines, figureTopology);

  const lineSegments: RenderSegment[] = [];

  for (const line of lines) {
    if (line.kind === 'edge') {
      continue;
    }

    const segments = buildLineSegments(line, figureTopology, vertices, innerPoints);
    const isSelected = selectedLineId !== undefined && line.lineId === selectedLineId;
    const isInfiniteLine =
      line.kind === 'line' || line.kind === 'edge-extended' || line.kind === 'segment-extended';
    // Infinite lines collinear with an `expected.lines` anchor pair light up entirely —
    // including ray extensions beyond the anchors — because the line direction itself
    // is the solution. Face-perimeter ranges are bounded segments (not infinite lines)
    // and are intentionally excluded from this rule, so face-edge directions don't
    // cause a collinear infinite line to glow outside the polygon boundary.
    const lineCoversSolutionFully =
      isInfiniteLine &&
      solutionStatus?.isSolved === true &&
      solutionStatus.solutionInfiniteLineAnchors.some(([rangeStart, rangeEnd]) =>
        lineCoversSegment(line, rangeStart, rangeEnd)
      );

    for (const segment of segments) {
      // For infinite lines, sub-segments coincident with a collinear figure edge are marked 'segment' by buildLineSegments.
      // - 'edge-extended': this coincident portion IS the original edge — keep it and promote to 'edge' styling
      //   (buildTopologyEdgeSegments skips the extended edge to avoid duplicate render).
      // - 'line' and 'segment-extended': drop the coincident portion to avoid overlap with the finite element.
      const isOnCollinearEdge = segment.modifiers.includes('segment');
      if (isInfiniteLine && isOnCollinearEdge && line.kind !== 'edge-extended') {
        continue;
      }

      const modifiers = [...segment.modifiers];

      if (line.kind === 'edge-extended' && isOnCollinearEdge && !modifiers.includes('edge')) {
        modifiers.push('edge');
      }

      if (line.isInput && line.kind !== 'edge-extended') {
        // For segment-extended: only the part within the original segment range gets 'input'
        if (line.kind === 'segment-extended') {
          if (isSubSegmentWithinRange(segment, line.pointA, line.pointB)) {
            modifiers.push('input');
          }
        } else {
          modifiers.push('input');
        }
      }

      if (line.kind === 'segment' && !modifiers.includes('segment')) {
        modifiers.push('segment');
      }

      if (isSelected) {
        modifiers.push('selected');
      }

      if (lineCoversSolutionFully || isSubSegmentInSolution(segment, solutionStatus)) {
        modifiers.push('solution');
      }

      lineSegments.push({ ...segment, modifiers });
    }
  }

  if (previewLine !== undefined) {
    const previewTopologyLine: TopologyLine = {
      lineId: PREVIEW_LINE_ID,
      pointA: previewLine.pointA,
      pointB: previewLine.pointB,
      kind: 'line',
      isInput: false,
      startVertexId: NO_VERTEX_ID,
      endVertexId: NO_VERTEX_ID,
    };
    const segments = buildLineSegments(previewTopologyLine, figureTopology, vertices, innerPoints);

    for (const segment of segments) {
      if (segment.modifiers.includes('segment')) {
        continue;
      }

      lineSegments.push({
        ...segment,
        modifiers: [...segment.modifiers, 'preview'],
      });
    }
  }

  const topologySegments = buildTopologyEdgeSegments(
    figureTopology,
    lines,
    vertices,
    selectedEdgeIndices,
    solutionStatus
  );

  return mergeCollinearSegments(deduplicateSegments([...topologySegments, ...lineSegments]));
}

function isSubSegmentInSolution(
  segment: RenderSegment,
  solutionStatus: SolutionStatus | undefined
): boolean {
  if (!solutionStatus?.isSolved) {
    return false;
  }
  return solutionStatus.solutionLineRanges.some(([rangeStart, rangeEnd]) =>
    isSubSegmentInSolutionRange(segment.startPosition, segment.endPosition, rangeStart, rangeEnd)
  );
}

function deduplicateSegments(segments: readonly RenderSegment[]): readonly RenderSegment[] {
  const segmentMap = new Map<string, RenderSegment>();

  for (const segment of segments) {
    const key = segmentPositionKey(segment.startPosition, segment.endPosition);

    const existing = segmentMap.get(key);
    if (existing === undefined || segment.modifiers.length > existing.modifiers.length) {
      segmentMap.set(key, segment);
    }
  }

  return [...segmentMap.values()];
}

const POSITION_KEY_DECIMALS = 6;

function segmentPositionKey(start: Vec3Array, end: Vec3Array): string {
  const startKey = `${start[0].toFixed(POSITION_KEY_DECIMALS)},${start[1].toFixed(POSITION_KEY_DECIMALS)},${start[2].toFixed(POSITION_KEY_DECIMALS)}`;
  const endKey = `${end[0].toFixed(POSITION_KEY_DECIMALS)},${end[1].toFixed(POSITION_KEY_DECIMALS)},${end[2].toFixed(POSITION_KEY_DECIMALS)}`;
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function getSelectedLineId(selection: SelectionState): number | undefined {
  switch (selection.type) {
    case 'line':
      return selection.lineId;
    case 'none':
      return undefined;
    default:
      assertNever(selection);
  }
}

function findSelectedEdgeIndices(
  selection: SelectionState,
  lines: readonly TopologyLine[],
  figureTopology: FigureTopology
): ReadonlySet<number> {
  const indices = new Set<number>();

  switch (selection.type) {
    case 'line': {
      const selectedLineId = selection.lineId;

      for (const line of lines) {
        if (line.lineId !== selectedLineId) {
          continue;
        }

        for (let edgeIndex = 0; edgeIndex < figureTopology.edges.length; edgeIndex++) {
          const [edgeStart, edgeEnd] = getEdgeEndpoints(figureTopology, edgeIndex);

          // For edges/segments: match by endpoint equality (avoids float32 precision issues)
          // For infinite lines: match by geometric collinearity
          const isMatch =
            line.kind === 'line'
              ? isCollinearWithLine(edgeStart, edgeEnd, line.pointA, line.pointB)
              : edgeEndpointsMatch(edgeStart, edgeEnd, line.pointA, line.pointB);

          if (isMatch) {
            indices.add(edgeIndex);
          }
        }
      }
      break;
    }
    case 'none':
      break;
    default:
      assertNever(selection);
  }

  return indices;
}

/**
 * Checks if a render sub-segment's midpoint falls within the original segment range [pointA, pointB].
 * Used to determine if a sub-segment of an extended line is in the "original" part or the "extension" part.
 */
function isSubSegmentWithinRange(
  segment: RenderSegment,
  rangeStart: Vec3Array,
  rangeEnd: Vec3Array
): boolean {
  const midpoint: Vec3Array = [
    (segment.startPosition[0] + segment.endPosition[0]) / 2,
    (segment.startPosition[1] + segment.endPosition[1]) / 2,
    (segment.startPosition[2] + segment.endPosition[2]) / 2,
  ];

  const projection = projectPointOntoLine(midpoint, rangeStart, rangeEnd);
  if (projection === undefined) {
    return positionsMatch(midpoint, rangeStart);
  }

  const ENDPOINT_TOLERANCE = 0.001;
  return (
    projection.parameter >= -ENDPOINT_TOLERANCE && projection.parameter <= 1 + ENDPOINT_TOLERANCE
  );
}
