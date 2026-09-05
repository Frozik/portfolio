import type { Vector } from 'matter-js';

import { ROD_THICKNESS, STROKE_COLOR } from './constants';

export function drawRods(context: CanvasRenderingContext2D, positions: readonly Vector[]): void {
  const [first, ...rest] = positions;
  if (rest.length === 0) {
    return;
  }

  context.save();

  context.lineWidth = ROD_THICKNESS;
  context.strokeStyle = STROKE_COLOR;

  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const position of rest) {
    context.lineTo(position.x, position.y);
  }
  context.stroke();

  context.restore();
}
