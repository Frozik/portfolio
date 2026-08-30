import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Path64, Paths64, PolyPath64 } from 'clipper2-ts';
import {
  area,
  booleanOpWithPolyTree,
  ClipType,
  difference,
  FillRule,
  InternalClipper,
  PolyTree64,
  union,
} from 'clipper2-ts';

import type { CsgOperand, CsgOperation, CsgTerm, ShapeComposition } from '../model/shapes';
import { SCALE_UNITS_PER_METER } from '../units';
import { fromClipperPath, toClipperPath } from './frame';
import type { MultiPolygon, PolygonWithHoles, Ring } from './polygon-types';
import { polygonizeShape } from './polygonize-shape';

/** Rings below a square centimetre are clipper noise, never something the user drew. */
export const MIN_RING_AREA_SQUARE_METERS = 0.0001;

const MIN_RING_AREA_CLIPPER_UNITS =
  MIN_RING_AREA_SQUARE_METERS * SCALE_UNITS_PER_METER * SCALE_UNITS_PER_METER;

const MIN_RING_VERTEX_COUNT = 3;

/** A triangle cannot cross itself: two of its three edges always share a vertex. */
const MIN_CROSSING_VERTEX_COUNT = 4;

/**
 * Evaluates the composition as a left fold of boolean operations and returns the
 * result as validated, correctly wound polygons with holes.
 */
export function evaluateComposition(composition: ShapeComposition): MultiPolygon {
  return assembleMultiPolygon(foldTerms(composition.terms));
}

/**
 * Turns raw clipper output into the domain representation: nesting comes from a
 * poly tree, every ring is rewound to the {@link Ring} convention and slivers are
 * dropped. `clipper2-ts` has open union defects that surface as mis-wound or
 * degenerate rings, so nothing reaches the rest of the pipeline unchecked.
 */
export function assembleMultiPolygon(paths: Paths64): MultiPolygon {
  const tree = new PolyTree64();

  // The fold works on a flat path list, which carries no outer/hole nesting; a
  // union with nothing rebuilds the hierarchy without changing the geometry.
  booleanOpWithPolyTree(ClipType.Union, paths, null, tree, FillRule.NonZero);

  const polygons: PolygonWithHoles[] = [];

  collectPolygons(tree, polygons);

  return polygons;
}

function foldTerms(terms: readonly CsgTerm[]): Paths64 {
  let result: Paths64 = [];

  for (const term of terms) {
    const clip = operandPaths(term.operand);

    // A group that folds to nothing contributes nothing: joining or removing an
    // empty region leaves the accumulator exactly as it was.
    if (clip.length === 0) {
      continue;
    }

    const next = applyOperation(result, clip, term.operation);

    // A self-intersecting result means the boolean op misbehaved; keeping the
    // previous valid state degrades one term instead of corrupting the plan.
    result = next.some(hasRingSelfIntersection) ? result : next;
  }

  return result;
}

/**
 * The region an operand stands for, as rings clipper can operate on. A group is
 * folded first and only then joined to the fold that holds it — which is what
 * confines a subtraction to the part of the plan it was drawn against.
 */
function operandPaths(operand: CsgOperand): Paths64 {
  switch (operand.kind) {
    case 'group':
      return foldTerms(operand.terms);
    case 'rectangle':
    case 'circle':
      return [toClipperPath(polygonizeShape(operand))];
    default:
      return assertNever(operand);
  }
}

function applyOperation(subject: Paths64, clip: Paths64, operation: CsgOperation): Paths64 {
  switch (operation) {
    case 'union':
      return union(subject, clip, FillRule.NonZero);
    case 'subtract':
      return difference(subject, clip, FillRule.NonZero);
    default:
      return assertNever(operation);
  }
}

function collectPolygons(node: PolyPath64, polygons: PolygonWithHoles[]): void {
  for (let index = 0; index < node.count; index += 1) {
    const outerNode = node.child(index);
    const outerPath = outerNode.polygon;

    if (outerPath === null || !isSignificantRing(outerPath)) {
      continue;
    }

    const holes: Ring[] = [];
    const islandNodes: PolyPath64[] = [];

    for (let holeIndex = 0; holeIndex < outerNode.count; holeIndex += 1) {
      const holeNode = outerNode.child(holeIndex);
      const holePath = holeNode.polygon;

      if (holePath === null || !isSignificantRing(holePath)) {
        continue;
      }

      holes.push(orientRing(holePath, false));
      islandNodes.push(holeNode);
    }

    polygons.push({ outer: orientRing(outerPath, true), holes });

    for (const islandNode of islandNodes) {
      collectPolygons(islandNode, polygons);
    }
  }
}

function isSignificantRing(path: Path64): boolean {
  return (
    path.length >= MIN_RING_VERTEX_COUNT && Math.abs(area(path)) >= MIN_RING_AREA_CLIPPER_UNITS
  );
}

function orientRing(path: Path64, shouldBeCounterClockwise: boolean): Ring {
  const ring = fromClipperPath(path);

  const isCounterClockwise = area(path) >= 0;

  return isCounterClockwise === shouldBeCounterClockwise ? ring : [...ring].reverse();
}

/**
 * True when any two non-adjacent edges of the ring properly cross. Touching and
 * collinear edges are not crossings — a boolean result legitimately contains
 * both, whereas a crossing is the signature of the open `clipper2-ts` union
 * defects this pipeline guards against.
 */
export function hasRingSelfIntersection(ring: Ring): boolean {
  const vertexCount = ring.length;

  if (vertexCount < MIN_CROSSING_VERTEX_COUNT) {
    return false;
  }

  for (let first = 0; first < vertexCount; first += 1) {
    const firstStart = ring[first];
    const firstEnd = ring[(first + 1) % vertexCount];

    for (let second = first + 2; second < vertexCount; second += 1) {
      const isWrappingNeighbour = first === 0 && second === vertexCount - 1;

      if (isWrappingNeighbour) {
        continue;
      }

      const secondStart = ring[second];
      const secondEnd = ring[(second + 1) % vertexCount];

      if (InternalClipper.segsIntersect(firstStart, firstEnd, secondStart, secondEnd, false)) {
        return true;
      }
    }
  }

  return false;
}
