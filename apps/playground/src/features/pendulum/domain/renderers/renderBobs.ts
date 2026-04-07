import type { Vector } from 'matter-js';

import { BOB_RADIUS } from '../constants';
import { LINE_THICKNESS } from './constants';

export function renderBobs(context: CanvasRenderingContext2D, ...positions: Vector[]) {
  context.save();

  for (const position of positions) {
    context.beginPath();
    context.arc(position.x, position.y, BOB_RADIUS, 0, 2 * Math.PI);
    context.fillStyle = '#FF5733';
    context.fill();
    context.lineWidth = LINE_THICKNESS;
    context.strokeStyle = 'white';
    context.stroke();
  }

  context.restore();
}
