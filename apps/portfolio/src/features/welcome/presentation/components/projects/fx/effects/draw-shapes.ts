/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import type { IFxDrawContext } from '../types';

export interface IFloatingShape {
  x: number;
  y: number;
  size: number;
  sides: number;
  rotation: number;
  vx: number;
  vy: number;
  vr: number;
  filled: boolean;
}

export function createShapesState(): IFloatingShape[] {
  return Array.from({ length: 14 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: 0.03 + Math.random() * 0.05,
    sides: 3 + Math.floor(Math.random() * 5),
    rotation: Math.random() * Math.PI * 2,
    vx: (Math.random() - 0.5) * 0.08,
    vy: (Math.random() - 0.5) * 0.08,
    vr: (Math.random() - 0.5) * 1.2,
    filled: Math.random() > 0.5,
  }));
}

export function drawShapes(
  { ctx, width, height, speed, accent, dpr }: IFxDrawContext,
  shapes: IFloatingShape[]
): void {
  const deltaTime = 0.016 * speed;

  for (const shape of shapes) {
    shape.x += shape.vx * deltaTime;
    shape.y += shape.vy * deltaTime;
    shape.rotation += shape.vr * deltaTime;
    if (shape.x < 0 || shape.x > 1) {
      shape.vx *= -1;
    }
    if (shape.y < 0 || shape.y > 1) {
      shape.vy *= -1;
    }
    const cx = shape.x * width;
    const cy = shape.y * height;
    const radius = shape.size * Math.min(width, height);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(shape.rotation);
    ctx.beginPath();
    for (let vertexIndex = 0; vertexIndex <= shape.sides; vertexIndex++) {
      const angle = (vertexIndex / shape.sides) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (vertexIndex === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (shape.filled) {
      ctx.fillStyle = accent(0.35);
      ctx.fill();
    }
    ctx.strokeStyle = accent(0.8);
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();
    ctx.restore();
  }
}
