import type { Vector } from 'matter-js';

import { ROD_THICKNESS } from './constants';

export function renderRods(context: CanvasRenderingContext2D, ...positions: Vector[]) {
  if (positions.length < 2) {
    return;
  }

  context.save();

  context.lineWidth = ROD_THICKNESS;
  context.strokeStyle = 'white';

  context.beginPath();
  context.moveTo(positions[0].x, positions[0].y);
  for (let index = 1; index < positions.length; index++) {
    context.lineTo(positions[index].x, positions[index].y);
  }
  context.stroke();

  context.restore();
}
