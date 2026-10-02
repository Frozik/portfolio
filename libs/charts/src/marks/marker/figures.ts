const HALF = 0.5;
const INNER_STAR = 0.2;
const RHOMBUS_HALF_WIDTH = 0.3;
const ARROW_SHAFT = 0.15;
const ARROW_NECK = 0;
const FULL_TURN_DEGREES = 360;
const DEGREES_TO_RADIANS = Math.PI / 180;

export interface IFigurePoint {
  readonly x: number;
  readonly y: number;
}

function polar(degrees: number, radius: number): IFigurePoint {
  const angle = degrees * DEGREES_TO_RADIANS;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function regular(sides: number, firstDegrees: number): readonly IFigurePoint[] {
  return Array.from({ length: sides }, (_, index) =>
    polar(firstDegrees + (index * FULL_TURN_DEGREES) / sides, HALF)
  );
}

function star(): readonly IFigurePoint[] {
  const POINTS = 5;
  return Array.from({ length: POINTS * 2 }, (_, index) =>
    polar(90 + (index * FULL_TURN_DEGREES) / (POINTS * 2), index % 2 === 0 ? HALF : INNER_STAR)
  );
}

function turned(points: readonly IFigurePoint[], quarterTurns: number): readonly IFigurePoint[] {
  const angle = (quarterTurns * Math.PI) / 2;
  const cos = Math.round(Math.cos(angle));
  const sin = Math.round(Math.sin(angle));
  return points.map(point => ({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }));
}

const TRIANGLE_UP: readonly IFigurePoint[] = [
  { x: 0, y: HALF },
  { x: -HALF, y: -HALF },
  { x: HALF, y: -HALF },
];

const ARROW_UP: readonly IFigurePoint[] = [
  { x: 0, y: HALF },
  { x: -HALF, y: ARROW_NECK },
  { x: -ARROW_SHAFT, y: ARROW_NECK },
  { x: -ARROW_SHAFT, y: -HALF },
  { x: ARROW_SHAFT, y: -HALF },
  { x: ARROW_SHAFT, y: ARROW_NECK },
  { x: HALF, y: ARROW_NECK },
];

/**
 * Every marker figure but the circle as a polygon in a unit square centred on
 * the element, Y up. The one table both backends draw from: a new figure is a
 * row here, not a new mark and not a new shader branch (§5.3).
 */
export const POLYGON_FIGURES = [
  'square',
  'rhombus',
  'triangleUp',
  'triangleLeft',
  'triangleDown',
  'triangleRight',
  'arrowUp',
  'arrowLeft',
  'arrowDown',
  'arrowRight',
  'pentagon',
  'hexagon',
  'star',
] as const;

export type TPolygonFigure = (typeof POLYGON_FIGURES)[number];
export type TFigure = 'circle' | TPolygonFigure;

export const FIGURE_POLYGONS: Readonly<Record<TPolygonFigure, readonly IFigurePoint[]>> = {
  square: [
    { x: -HALF, y: -HALF },
    { x: -HALF, y: HALF },
    { x: HALF, y: HALF },
    { x: HALF, y: -HALF },
  ],
  rhombus: [
    { x: RHOMBUS_HALF_WIDTH, y: 0 },
    { x: 0, y: HALF },
    { x: -RHOMBUS_HALF_WIDTH, y: 0 },
    { x: 0, y: -HALF },
  ],
  triangleUp: TRIANGLE_UP,
  triangleLeft: turned(TRIANGLE_UP, 1),
  triangleDown: turned(TRIANGLE_UP, 2),
  triangleRight: turned(TRIANGLE_UP, 3),
  arrowUp: ARROW_UP,
  arrowLeft: turned(ARROW_UP, 1),
  arrowDown: turned(ARROW_UP, 2),
  arrowRight: turned(ARROW_UP, 3),
  pentagon: regular(5, 90),
  hexagon: regular(6, 90),
  star: star(),
};
