import { vec3 } from 'wgpu-matrix';

import { NO_CONNECTED_VERTEX_INDEX } from './constants';
import type { FigureInnerPointCache } from './figure-inner-points';
import { getEdgeEndpoints, isCollinearWithLine, POINT_ON_LINE_EPSILON_SQ } from './geometry-utils';
import { extendLine, rayTriangleIntersect } from './math';
import {
  deduplicateParameters,
  isDuplicateParameter,
  isInAnyInterval,
  isRangeInAnyInterval,
  mergeIntervals,
  POSITION_EPSILON,
} from './parametric-utils';
import { createRenderSegment } from './render-segment';
import type { RenderSegment } from './render-types';
import type { FigureTopology, TopologyLine, TopologyVertex, Vec3Array } from './topology-types';

const COPLANAR_DISTANCE_THRESHOLD = 1e-4;

/**
 * Splits one topology line into render sub-segments at every face crossing,
 * collinear edge, coplanar face interval and scene vertex it meets, classifying
 * each piece as a collinear `segment`, an `inner` run across a face, or plain.
 */
export function buildLineSegments(
  line: TopologyLine,
  figureTopology: FigureTopology,
  vertices: readonly TopologyVertex[],
  innerPoints: FigureInnerPointCache
): readonly RenderSegment[] {
  const isFiniteSegment = line.kind === 'segment' || line.kind === 'edge';
  const [farStart, farEnd] = isFiniteSegment
    ? [line.pointA, line.pointB]
    : extendLine(line.pointA, line.pointB);
  const lineDirection = vec3.sub(farEnd, farStart);
  const lineLength = vec3.len(lineDirection);

  if (lineLength === 0) {
    return [];
  }

  const normalizedDirection = vec3.normalize(lineDirection) as Vec3Array;

  const collinearEdges = findCollinearEdges(line, figureTopology);

  const faceIntersectionParams = findFaceIntersectionParams(
    farStart,
    normalizedDirection,
    lineLength,
    figureTopology
  );

  const coplanarIntervals = findCoplanarFaceIntervals(
    farStart,
    normalizedDirection,
    lineLength,
    figureTopology
  );

  const segmentIntervals = collinearEdges.map(edgeIndex => {
    const [edgeStart, edgeEnd] = getEdgeEndpoints(figureTopology, edgeIndex);
    const paramA = projectOntoLine(edgeStart, farStart, normalizedDirection, lineLength);
    const paramB = projectOntoLine(edgeEnd, farStart, normalizedDirection, lineLength);
    return {
      start: Math.min(paramA, paramB),
      end: Math.max(paramA, paramB),
    };
  });

  const pointAParam = projectOntoLine(line.pointA, farStart, normalizedDirection, lineLength);
  const pointBParam = projectOntoLine(line.pointB, farStart, normalizedDirection, lineLength);

  const splitParams = new Set<number>();
  splitParams.add(0);
  splitParams.add(1);
  splitParams.add(pointAParam);
  splitParams.add(pointBParam);

  for (const parameter of faceIntersectionParams) {
    splitParams.add(parameter);
  }
  for (const interval of coplanarIntervals) {
    splitParams.add(interval.start);
    splitParams.add(interval.end);
  }
  for (const interval of segmentIntervals) {
    splitParams.add(interval.start);
    splitParams.add(interval.end);
  }

  // Split at scene vertex positions that lie on this line and
  // build parameter -> vertex index mapping for topology-based occlusion
  const vertexIndexByParam = new Map<number, number>();

  for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex++) {
    const vertexPosition = vertices[vertexIndex].position;
    const vertexParam = projectOntoLine(vertexPosition, farStart, normalizedDirection, lineLength);
    const projectedPosition = paramToPosition(
      vertexParam,
      farStart,
      normalizedDirection,
      lineLength
    );

    if (vec3.distSq(vertexPosition, projectedPosition) < POINT_ON_LINE_EPSILON_SQ) {
      vertexIndexByParam.set(vertexParam, vertexIndex);

      if (vertexParam > POSITION_EPSILON && vertexParam < 1 - POSITION_EPSILON) {
        splitParams.add(vertexParam);
      }
    }
  }

  const sortedParams = [...splitParams].sort((paramA, paramB) => paramA - paramB);
  const dedupedParams = deduplicateParameters(sortedParams);

  const mergedCoplanarIntervals = mergeIntervals(coplanarIntervals);

  const results: RenderSegment[] = [];

  for (let index = 0; index < dedupedParams.length - 1; index++) {
    const startParam = dedupedParams[index];
    const endParam = dedupedParams[index + 1];

    if (endParam - startParam < POSITION_EPSILON) {
      continue;
    }

    const midParam = (startParam + endParam) / 2;

    const startPosition = paramToPosition(startParam, farStart, normalizedDirection, lineLength);
    const endPosition = paramToPosition(endParam, farStart, normalizedDirection, lineLength);

    const startVertexIndex = findVertexIndexForParam(startParam, vertexIndexByParam);
    const endVertexIndex = findVertexIndexForParam(endParam, vertexIndexByParam);

    if (isRangeInAnyInterval(startParam, endParam, segmentIntervals)) {
      results.push(
        createRenderSegment(
          startPosition,
          endPosition,
          ['segment'],
          line.lineId,
          startVertexIndex,
          endVertexIndex
        )
      );
      continue;
    }

    if (isInAnyInterval(midParam, mergedCoplanarIntervals)) {
      results.push(
        createRenderSegment(
          startPosition,
          endPosition,
          ['inner'],
          line.lineId,
          startVertexIndex,
          endVertexIndex
        )
      );
      continue;
    }

    const midpoint = paramToPosition(midParam, farStart, normalizedDirection, lineLength);
    const isInner = innerPoints.isInside(figureTopology, midpoint);
    results.push(
      createRenderSegment(
        startPosition,
        endPosition,
        isInner ? ['inner'] : [],
        line.lineId,
        startVertexIndex,
        endVertexIndex
      )
    );
  }

  return results;
}

function projectOntoLine(
  point: Vec3Array,
  farStart: Vec3Array,
  normalizedDirection: Vec3Array,
  lineLength: number
): number {
  return vec3.dot(vec3.sub(point, farStart), normalizedDirection) / lineLength;
}

function paramToPosition(
  parameter: number,
  farStart: Vec3Array,
  normalizedDirection: Vec3Array,
  lineLength: number
): Vec3Array {
  return vec3.addScaled(farStart, normalizedDirection, parameter * lineLength) as Vec3Array;
}

function findCollinearEdges(line: TopologyLine, figureTopology: FigureTopology): readonly number[] {
  const collinearEdges: number[] = [];

  for (let edgeIndex = 0; edgeIndex < figureTopology.edges.length; edgeIndex++) {
    const [edgeStart, edgeEnd] = getEdgeEndpoints(figureTopology, edgeIndex);

    if (isCollinearWithLine(edgeStart, edgeEnd, line.pointA, line.pointB)) {
      collinearEdges.push(edgeIndex);
    }
  }

  return collinearEdges;
}

function findFaceIntersectionParams(
  farStart: Vec3Array,
  normalizedDirection: Vec3Array,
  lineLength: number,
  figureTopology: FigureTopology
): readonly number[] {
  const parameters: number[] = [];

  for (const triangleIndices of figureTopology.faceTriangles) {
    const vertexA = figureTopology.vertices[triangleIndices[0]];
    const vertexB = figureTopology.vertices[triangleIndices[1]];
    const vertexC = figureTopology.vertices[triangleIndices[2]];

    const parameterT = rayTriangleIntersect(
      farStart,
      normalizedDirection,
      vertexA,
      vertexB,
      vertexC
    );

    if (parameterT !== undefined && parameterT > 0) {
      const normalizedParameter = parameterT / lineLength;
      if (
        normalizedParameter > POSITION_EPSILON &&
        normalizedParameter < 1 - POSITION_EPSILON &&
        !isDuplicateParameter(normalizedParameter, parameters)
      ) {
        parameters.push(normalizedParameter);
      }
    }
  }

  return parameters;
}

function findCoplanarFaceIntervals(
  farStart: Vec3Array,
  normalizedDirection: Vec3Array,
  lineLength: number,
  figureTopology: FigureTopology
): readonly { start: number; end: number }[] {
  const intervals: { start: number; end: number }[] = [];

  for (let faceIndex = 0; faceIndex < figureTopology.faces.length; faceIndex++) {
    const faceVertexIndices = figureTopology.faces[faceIndex];
    if (faceVertexIndices.length < 3) {
      continue;
    }

    const faceVertices = faceVertexIndices.map(index => figureTopology.vertices[index]);

    const edgeAB = vec3.sub(faceVertices[1], faceVertices[0]);
    const edgeAC = vec3.sub(faceVertices[2], faceVertices[0]);
    const faceNormal = vec3.cross(edgeAB, edgeAC);
    const normalLength = vec3.len(faceNormal);

    if (normalLength < POSITION_EPSILON) {
      continue;
    }

    const unitNormal = vec3.normalize(faceNormal) as Vec3Array;

    if (Math.abs(vec3.dot(normalizedDirection, unitNormal)) > COPLANAR_DISTANCE_THRESHOLD) {
      continue;
    }

    const distanceToPlane = vec3.dot(vec3.sub(farStart, faceVertices[0]), unitNormal);
    if (Math.abs(distanceToPlane) > COPLANAR_DISTANCE_THRESHOLD) {
      continue;
    }

    const interval = clipLineToConvexPolygon(
      farStart,
      normalizedDirection,
      lineLength,
      faceVertices
    );

    if (interval !== undefined) {
      intervals.push(interval);
    }
  }

  return intervals;
}

function clipLineToConvexPolygon(
  farStart: Vec3Array,
  normalizedDirection: Vec3Array,
  lineLength: number,
  polygonVertices: readonly Vec3Array[]
): { start: number; end: number } | undefined {
  let tMin = 0;
  let tMax = 1;

  const faceEdgeAB = vec3.sub(polygonVertices[1], polygonVertices[0]);
  const faceEdgeAC = vec3.sub(polygonVertices[2], polygonVertices[0]);
  const faceNormal = vec3.cross(faceEdgeAB, faceEdgeAC);

  for (let index = 0; index < polygonVertices.length; index++) {
    const nextIndex = (index + 1) % polygonVertices.length;
    const edgeStart = polygonVertices[index];
    const edgeEnd = polygonVertices[nextIndex];
    const edgeDir = vec3.sub(edgeEnd, edgeStart);

    const inwardNormal = vec3.cross(faceNormal, edgeDir);
    const inwardLength = vec3.len(inwardNormal);

    if (inwardLength < POSITION_EPSILON) {
      continue;
    }

    const unitInward = vec3.normalize(inwardNormal) as Vec3Array;

    const startOffset = vec3.dot(vec3.sub(farStart, edgeStart), unitInward);
    const directionDot = vec3.dot(normalizedDirection, unitInward) * lineLength;

    if (Math.abs(directionDot) < POSITION_EPSILON) {
      if (startOffset < -POSITION_EPSILON) {
        return undefined;
      }
      continue;
    }

    const tEdge = -startOffset / directionDot;

    if (directionDot < 0) {
      tMax = Math.min(tMax, tEdge);
    } else {
      tMin = Math.max(tMin, tEdge);
    }

    if (tMin > tMax) {
      return undefined;
    }
  }

  if (tMax - tMin < POSITION_EPSILON) {
    return undefined;
  }

  return { start: tMin, end: tMax };
}

function findVertexIndexForParam(
  parameter: number,
  vertexIndexByParam: ReadonlyMap<number, number>
): number {
  const exactMatch = vertexIndexByParam.get(parameter);
  if (exactMatch !== undefined) {
    return exactMatch;
  }

  for (const [storedParam, vertexIndex] of vertexIndexByParam) {
    if (Math.abs(parameter - storedParam) < POSITION_EPSILON) {
      return vertexIndex;
    }
  }

  return NO_CONNECTED_VERTEX_INDEX;
}
