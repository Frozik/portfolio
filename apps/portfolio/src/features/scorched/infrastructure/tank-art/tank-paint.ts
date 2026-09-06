import type { ShapeInstance } from '../shape-instances';
import type { SHAPE_KIND } from '../shape-instances';

export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export function mixColor(startColor: RgbColor, endColor: RgbColor, fraction: number): RgbColor {
  return {
    red: startColor.red + (endColor.red - startColor.red) * fraction,
    green: startColor.green + (endColor.green - startColor.green) * fraction,
    blue: startColor.blue + (endColor.blue - startColor.blue) * fraction,
  };
}

const WHITE: RgbColor = { red: 1, green: 1, blue: 1 };

const BLACK: RgbColor = { red: 0, green: 0, blue: 0 };

export function shade(color: RgbColor, fraction: number): RgbColor {
  return mixColor(color, BLACK, fraction);
}

export function tint(color: RgbColor, fraction: number): RgbColor {
  return mixColor(color, WHITE, fraction);
}

/** The cartoon look of the reference sheet: a dark contour drawn behind every filled part. */
export const OUTLINE_COLOR: RgbColor = { red: 0.07, green: 0.08, blue: 0.14 };

const OUTLINE_WU = 0.7;

export const HALF = 0.5;

export interface PartShape {
  readonly centerXWu: number;
  readonly centerYWu: number;
  readonly halfWidthWu: number;
  readonly halfHeightWu: number;
  readonly kind?: (typeof SHAPE_KIND)[keyof typeof SHAPE_KIND];
  readonly rotationRadians?: number;
}

export function toInstance(shape: PartShape, color: RgbColor): ShapeInstance {
  return {
    centerXWu: shape.centerXWu,
    centerYWu: shape.centerYWu,
    halfWidthWu: shape.halfWidthWu,
    halfHeightWu: shape.halfHeightWu,
    kind: shape.kind,
    rotationRadians: shape.rotationRadians,
    red: color.red,
    green: color.green,
    blue: color.blue,
  };
}

export function toOutline(shape: PartShape): ShapeInstance {
  return toInstance(
    {
      ...shape,
      halfWidthWu: shape.halfWidthWu + OUTLINE_WU,
      halfHeightWu: shape.halfHeightWu + OUTLINE_WU,
    },
    OUTLINE_COLOR
  );
}
