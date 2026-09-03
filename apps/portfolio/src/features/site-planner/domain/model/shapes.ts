import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';
import { isNil } from 'lodash-es';

import type { Meters } from '../units';

export type ShapeId = Opaque<'ShapeId', string>;

export interface RectangleShape {
  readonly kind: 'rectangle';
  readonly id: ShapeId;
  /** Plan coordinates: `x` runs east, `y` runs north. */
  readonly center: Vector2;
  /** Extent along the local X axis before rotation. */
  readonly width: Meters;
  readonly length: Meters;
  /** The anchor as extent fractions; absent = the centre (`shape-anchor.ts`). */
  readonly anchorFactors?: Vector2;
  /** Counter-clockwise; 0 keeps the sides aligned with the plan axes. */
  readonly rotationDegrees: number;
}

export interface CircleShape {
  readonly kind: 'circle';
  readonly id: ShapeId;
  readonly center: Vector2;
  readonly radius: Meters;
  /** The anchor as radius fractions; absent = the centre (`shape-anchor.ts`). */
  readonly anchorFactors?: Vector2;
}

/**
 * An ellipse stated by the BOX it is inscribed in rather than by two radii:
 * same centre, same two extents, same turn as a rectangle — so every gesture,
 * handle, anchor and dimension a rectangle already has works on it unchanged.
 */
export interface EllipseShape {
  readonly kind: 'ellipse';
  readonly id: ShapeId;
  readonly center: Vector2;
  /** Extent across the local X axis — the full width of the bounding box. */
  readonly width: Meters;
  readonly length: Meters;
  readonly anchorFactors?: Vector2;
  readonly rotationDegrees: number;
}

export type Shape = RectangleShape | CircleShape | EllipseShape;

/** The shapes a rotated box describes; the two the same grips manipulate. */
export type BoxedShape = RectangleShape | EllipseShape;

export function isBoxedShape(shape: Shape): shape is BoxedShape {
  return shape.kind === 'rectangle' || shape.kind === 'ellipse';
}

export type CsgOperation = 'union' | 'subtract';

/**
 * A composition folded on its own before it joins the fold that holds it. It is
 * what makes "cut a hole in this, then subtract the whole thing" expressible:
 * without the nesting, every term would be flattened into one left fold, where a
 * later subtraction cannot be confined to an earlier part.
 */
export interface ShapeGroup {
  readonly kind: 'group';
  /** Minted by {@link createShapeId}: groups and shapes share one id space. */
  readonly id: ShapeId;
  readonly terms: readonly CsgTerm[];
}

/** What a term folds into the result: a primitive, or a composition of its own. */
export type CsgOperand = Shape | ShapeGroup;

export interface CsgTerm {
  readonly operand: CsgOperand;
  readonly operation: CsgOperation;
}

/**
 * Left fold over the terms in order — the first term always contributes as a
 * union, in the root as in every group. Every consumer evaluates a composition
 * through a single function, so the nesting stays confined to the fold.
 */
export interface ShapeComposition {
  readonly terms: readonly CsgTerm[];
}

/** The root composition and every group in it fold the same way. */
type TermContainer = ShapeComposition | ShapeGroup;

/** A group together with the operation it joins its parent fold with. */
export interface GroupTerm {
  readonly group: ShapeGroup;
  readonly operation: CsgOperation;
}

export function isShapeGroup(operand: CsgOperand): operand is ShapeGroup {
  return operand.kind === 'group';
}

/** Every primitive of the tree, parents before their nested groups. */
export function flattenShapes(container: TermContainer): readonly Shape[] {
  const shapes: Shape[] = [];

  collectShapes(container.terms, shapes);

  return shapes;
}

/**
 * The group and every group nested inside it — the places a move of that group
 * cannot land in, since taking it there would take the target away with it.
 */
export function collectGroupSubtreeIds(group: ShapeGroup): ReadonlySet<ShapeId> {
  const ids = new Set<ShapeId>([group.id]);

  collectNestedGroupIds(group.terms, ids);

  return ids;
}

/** The term the operand takes part in, wherever in the tree that operand sits. */
export function findTerm(container: TermContainer, operandId: ShapeId): CsgTerm | undefined {
  for (const term of container.terms) {
    if (term.operand.id === operandId) {
      return term;
    }

    if (isShapeGroup(term.operand)) {
      const nested = findTerm(term.operand, operandId);

      if (!isNil(nested)) {
        return nested;
      }
    }
  }

  return undefined;
}

export function findShape(container: TermContainer, shapeId: ShapeId): Shape | undefined {
  const operand = findTerm(container, shapeId)?.operand;

  return isNil(operand) || isShapeGroup(operand) ? undefined : operand;
}

export function findGroupTerm(container: TermContainer, groupId: ShapeId): GroupTerm | undefined {
  const term = findTerm(container, groupId);

  return isNil(term) || !isShapeGroup(term.operand)
    ? undefined
    : { group: term.operand, operation: term.operation };
}

/** Every shape but the named one — the others a gesture aims at and snaps to. */
export function shapesExcept(shapes: readonly Shape[], excludedId: ShapeId): readonly Shape[] {
  return shapes.filter(shape => shape.id !== excludedId);
}

export function createShapeId(): ShapeId {
  return crypto.randomUUID() as ShapeId;
}

export function createRectangle({
  center,
  width,
  length,
  rotationDegrees,
}: {
  readonly center: Vector2;
  readonly width: Meters;
  readonly length: Meters;
  readonly rotationDegrees: number;
}): RectangleShape {
  return { kind: 'rectangle', id: createShapeId(), center, width, length, rotationDegrees };
}

export function createEllipse({
  center,
  width,
  length,
  rotationDegrees,
}: {
  readonly center: Vector2;
  readonly width: Meters;
  readonly length: Meters;
  readonly rotationDegrees: number;
}): EllipseShape {
  return { kind: 'ellipse', id: createShapeId(), center, width, length, rotationDegrees };
}

export function createCircle({
  center,
  radius,
}: {
  readonly center: Vector2;
  readonly radius: Meters;
}): CircleShape {
  return { kind: 'circle', id: createShapeId(), center, radius };
}

/**
 * The zero-sized shape a drawing gesture grows from. The tools are named after
 * the kinds they draw, so the rubber band, the slab tool and any future drawing
 * surface all mint their draft here rather than each keeping its own ternary.
 */
export function createEmptyShape(kind: Shape['kind'], center: Vector2): Shape {
  switch (kind) {
    case 'rectangle':
      return createRectangle({ center, width: 0, length: 0, rotationDegrees: 0 });
    case 'ellipse':
      return createEllipse({ center, width: 0, length: 0, rotationDegrees: 0 });
    case 'circle':
      return createCircle({ center, radius: 0 });
    default:
      return assertNever(kind);
  }
}

function collectNestedGroupIds(terms: readonly CsgTerm[], ids: Set<ShapeId>): void {
  for (const { operand } of terms) {
    if (isShapeGroup(operand)) {
      ids.add(operand.id);
      collectNestedGroupIds(operand.terms, ids);
    }
  }
}

function collectShapes(terms: readonly CsgTerm[], shapes: Shape[]): void {
  for (const { operand } of terms) {
    switch (operand.kind) {
      case 'group':
        collectShapes(operand.terms, shapes);

        break;
      case 'rectangle':
      case 'circle':
      case 'ellipse':
        shapes.push(operand);

        break;
      default:
        assertNever(operand);
    }
  }
}

/**
 * Slides a whole composition by one offset: every leaf's centre moves, groups
 * are descended, nothing else changes — which is what dragging a building as
 * one object means.
 */
export function translateComposition(
  composition: ShapeComposition,
  offset: Vector2
): ShapeComposition {
  return { terms: composition.terms.map(term => translateTerm(term, offset)) };
}

function translateTerm(term: CsgTerm, offset: Vector2): CsgTerm {
  const { operand } = term;

  if (isShapeGroup(operand)) {
    return {
      ...term,
      operand: { ...operand, terms: operand.terms.map(inner => translateTerm(inner, offset)) },
    };
  }

  return {
    ...term,
    operand: {
      ...operand,
      center: { x: operand.center.x + offset.x, y: operand.center.y + offset.y },
    },
  };
}
