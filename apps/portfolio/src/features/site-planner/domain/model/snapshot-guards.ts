import type { Vector2 } from '@frozik/utils/math/vector2';
import type { CsgOperand, CsgOperation, CsgTerm, Shape, ShapeComposition } from './shapes';

/** The primitive type guards a stored document is validated with: records, numbers, vectors, shapes and the CSG tree. */
/**
 * How deep the term tree may nest. The editor never builds anything remotely
 * this deep; the ceiling is there so a hand-written file cannot drive the
 * recursive validator — or the recursive fold behind it — off the stack.
 */
const MAX_TERM_DEPTH = 16;

const CSG_OPERATIONS: readonly CsgOperation[] = ['union', 'subtract'];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArrayOf<TItem>(
  value: unknown,
  isItem: (item: unknown) => item is TItem
): value is readonly TItem[] {
  return Array.isArray(value) && value.every(isItem);
}

export function isOneOf<TOption extends string>(
  value: unknown,
  options: readonly TOption[]
): value is TOption {
  return typeof value === 'string' && options.some(option => option === value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isVector2(value: unknown): value is Vector2 {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

export function isShape(value: unknown): value is Shape {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isVector2(value.center)) {
    return false;
  }

  // The anchor joined after version 5 shipped; its absence is a valid document,
  // which is why the version is not bumped (the underlay set the precedent).
  if (value.anchorFactors !== undefined && !isVector2(value.anchorFactors)) {
    return false;
  }

  switch (value.kind) {
    case 'rectangle':
    case 'ellipse':
      return (
        isPositiveNumber(value.width) &&
        isPositiveNumber(value.length) &&
        isFiniteNumber(value.rotationDegrees)
      );
    case 'circle':
      return isPositiveNumber(value.radius);
    default:
      return false;
  }
}

function isCsgOperand(value: unknown, depth: number): value is CsgOperand {
  if (isRecord(value) && value.kind === 'group') {
    return (
      depth < MAX_TERM_DEPTH && isNonEmptyString(value.id) && areCsgTerms(value.terms, depth + 1)
    );
  }

  return isShape(value);
}

function isCsgTerm(value: unknown, depth: number): value is CsgTerm {
  return (
    isRecord(value) &&
    isCsgOperand(value.operand, depth) &&
    isOneOf(value.operation, CSG_OPERATIONS)
  );
}

function areCsgTerms(value: unknown, depth: number): value is readonly CsgTerm[] {
  return Array.isArray(value) && value.every(term => isCsgTerm(term, depth));
}

export function isShapeComposition(value: unknown): value is ShapeComposition {
  return isRecord(value) && areCsgTerms(value.terms, 0);
}
