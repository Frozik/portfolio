import { assertNever } from '@frozik/utils/assert/assertNever';

export type TAnnotationTool = 'rectangle' | 'arrow' | 'pen' | 'redact';

export const ANNOTATION_TOOLS: readonly TAnnotationTool[] = ['rectangle', 'arrow', 'pen', 'redact'];

export interface IPoint {
  readonly x: number;
  readonly y: number;
}

export interface IBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface IStroke {
  readonly color: string;
  readonly width: number;
}

export type TShape =
  | {
      readonly kind: 'rectangle';
      readonly from: IPoint;
      readonly to: IPoint;
      readonly stroke: IStroke;
    }
  | { readonly kind: 'arrow'; readonly from: IPoint; readonly to: IPoint; readonly stroke: IStroke }
  | { readonly kind: 'pen'; readonly points: readonly IPoint[]; readonly stroke: IStroke }
  | { readonly kind: 'redact'; readonly from: IPoint; readonly to: IPoint };

export interface IAnnotation {
  readonly shapes: readonly TShape[];
  readonly undone: readonly TShape[];
}

export const EMPTY_ANNOTATION: IAnnotation = { shapes: [], undone: [] };

export const ANNOTATION_COLORS: readonly string[] = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff'];

const BASE_STROKE_WIDTH = 4;
/** Thin, three times thin, nine times thin — enough range for a hairline note and a mark visible in a thumbnail. */
export const STROKE_WIDTHS: readonly number[] = [1, 3, 9].map(factor => factor * BASE_STROKE_WIDTH);

/** Strokes thinner than this are accidental clicks, not shapes. */
const MIN_SHAPE_EXTENT = 3;

export function addShape(annotation: IAnnotation, shape: TShape): IAnnotation {
  if (isDegenerate(shape)) {
    return annotation;
  }
  return { shapes: [...annotation.shapes, shape], undone: [] };
}

export function undo(annotation: IAnnotation): IAnnotation {
  const last = annotation.shapes.at(-1);
  if (last === undefined) {
    return annotation;
  }
  return { shapes: annotation.shapes.slice(0, -1), undone: [...annotation.undone, last] };
}

export function redo(annotation: IAnnotation): IAnnotation {
  const last = annotation.undone.at(-1);
  if (last === undefined) {
    return annotation;
  }
  return { shapes: [...annotation.shapes, last], undone: annotation.undone.slice(0, -1) };
}

export function toBox(from: IPoint, to: IPoint): IBox {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

const ARROW_HEAD_ANGLE = Math.PI / 7;

/** The two wing tips of an arrow head ending at `to`. */
export function arrowHead(from: IPoint, to: IPoint, size: number): readonly [IPoint, IPoint] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const wing = (direction: number): IPoint => ({
    x: to.x - size * Math.cos(angle + direction * ARROW_HEAD_ANGLE),
    y: to.y - size * Math.sin(angle + direction * ARROW_HEAD_ANGLE),
  });
  return [wing(1), wing(-1)];
}

function isDegenerate(shape: TShape): boolean {
  switch (shape.kind) {
    case 'rectangle':
    case 'redact': {
      const box = toBox(shape.from, shape.to);
      return box.width < MIN_SHAPE_EXTENT && box.height < MIN_SHAPE_EXTENT;
    }
    case 'arrow':
      return Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y) < MIN_SHAPE_EXTENT;
    case 'pen':
      return shape.points.length < 2;
    default:
      return assertNever(shape);
  }
}
