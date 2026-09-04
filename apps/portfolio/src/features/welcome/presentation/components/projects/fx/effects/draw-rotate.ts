import type { IFxDrawContext } from '../types';

const CENTER_Y_RATIO = 0.55;
const SCALE_RATIO = 0.3;
const BASE_RADIUS = 1;
const APEX_HEIGHT = 1.55;
const BASE_SIDES = 5;
const SPIN_SPEED = 0.35;
const TILT_X = -0.38;
const CAMERA_Z = 4;
const GROUND_ALPHA = 0.12;
const GROUND_Y_RATIO = 0.55;
const EDGE_LINE_WIDTH_PX = 1.4;
const HIDDEN_EDGE_ALPHA = 0.28;
const HIDDEN_EDGE_DASH_PX = [3, 4] as const;
const VISIBLE_EDGE_ALPHA = 0.9;
const CONSTRUCTION_SPEED = 0.3;
const CONSTRUCTION_LEAD = 1.4;
const CONSTRUCTION_LINE_WIDTH_PX = 1.6;
const SECTION_ALPHA = 0.75;
const SECTION_DASH_PX = [5, 4] as const;
const CONSTRUCTION_TIP_RADIUS_PX = 2.5;
const SECTION_TIP_RADIUS_PX = 2.2;
const VERTEX_ALPHA = 0.95;
const VERTEX_RADIUS_PX = 2.8;
const SECTION_EDGE_START = 2;
const SECTION_EDGE_END = 3;
const SECTION_APEX_EDGE_LEFT = 1;
const SECTION_APEX_EDGE_RIGHT = 4;

type Point3 = readonly [number, number, number];

interface IPoint2 {
  readonly x: number;
  readonly y: number;
}

function midpoint(first: Point3, second: Point3): Point3 {
  return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2, (first[2] + second[2]) / 2];
}

/** A pentagonal pyramid turning in 3D while construction lines are drawn across it. */
export function drawRotate({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const centerX = width / 2;
  const centerY = height * CENTER_Y_RATIO;
  const scale = Math.min(width, height) * SCALE_RATIO;

  const base: readonly Point3[] = Array.from({ length: BASE_SIDES }, (_, vertexIndex) => {
    const angle = (vertexIndex / BASE_SIDES) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(angle) * BASE_RADIUS, 0, Math.sin(angle) * BASE_RADIUS];
  });
  const apex: Point3 = [0, -APEX_HEIGHT, 0];
  const vertexAt = (index: number): Point3 => base[index] ?? apex;

  const spin = time * SPIN_SPEED;
  const sinSpin = Math.sin(spin);
  const cosSpin = Math.cos(spin);
  const sinTilt = Math.sin(TILT_X);
  const cosTilt = Math.cos(TILT_X);

  const rotate = ([x, y, z]: Point3): Point3 => {
    const spunX = x * cosSpin + z * sinSpin;
    const spunZ = -x * sinSpin + z * cosSpin;
    return [spunX, y * cosTilt - spunZ * sinTilt, y * sinTilt + spunZ * cosTilt];
  };
  const project = (point: Point3): IPoint2 => {
    const [x, y, z] = rotate(point);
    const perspective = CAMERA_Z / (CAMERA_Z - z);
    return { x: centerX + x * scale * perspective, y: centerY + y * scale * perspective };
  };

  ctx.strokeStyle = accent(GROUND_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(0, centerY + scale * GROUND_Y_RATIO);
  ctx.lineTo(width, centerY + scale * GROUND_Y_RATIO);
  ctx.stroke();

  const drawEdge = (from: Point3, to: Point3): void => {
    const isHidden = rotate(midpoint(from, to))[2] < 0;
    const start = project(from);
    const end = project(to);
    ctx.save();
    ctx.lineWidth = EDGE_LINE_WIDTH_PX * devicePixelRatio;
    ctx.strokeStyle = accent(isHidden ? HIDDEN_EDGE_ALPHA : VISIBLE_EDGE_ALPHA);
    ctx.setLineDash(isHidden ? HIDDEN_EDGE_DASH_PX.map(dash => dash * devicePixelRatio) : []);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  };
  base.forEach((vertex, vertexIndex) => {
    drawEdge(vertex, vertexAt((vertexIndex + 1) % BASE_SIDES));
    drawEdge(vertex, apex);
  });

  const progress = Math.min(1, ((time * CONSTRUCTION_SPEED) % 1) * CONSTRUCTION_LEAD);
  const drawProgressive = (
    from: IPoint2,
    to: IPoint2,
    alpha: number,
    dash: readonly number[]
  ): IPoint2 => {
    const tip = { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
    ctx.save();
    ctx.strokeStyle = accent(alpha);
    ctx.lineWidth = CONSTRUCTION_LINE_WIDTH_PX * devicePixelRatio;
    ctx.setLineDash(dash.map(segment => segment * devicePixelRatio));
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.restore();
    return tip;
  };

  const oppositeEdgeMidpoint = midpoint(vertexAt(SECTION_EDGE_START), vertexAt(SECTION_EDGE_END));
  const medianTip = drawProgressive(project(vertexAt(0)), project(oppositeEdgeMidpoint), 1, []);
  const sectionTip = drawProgressive(
    project(midpoint(vertexAt(SECTION_APEX_EDGE_LEFT), apex)),
    project(midpoint(vertexAt(SECTION_APEX_EDGE_RIGHT), apex)),
    SECTION_ALPHA,
    SECTION_DASH_PX
  );

  ctx.fillStyle = accent(1);
  ctx.beginPath();
  ctx.arc(medianTip.x, medianTip.y, CONSTRUCTION_TIP_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sectionTip.x, sectionTip.y, SECTION_TIP_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();

  for (const vertex of [...base, apex]) {
    const point = project(vertex);
    ctx.fillStyle = accent(VERTEX_ALPHA);
    ctx.beginPath();
    ctx.arc(point.x, point.y, VERTEX_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }
}
