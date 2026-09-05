import type { Vector } from 'matter-js';

import { BOB_RADIUS } from '../../domain/constants';
import { BOB_FILL_COLOR, LINE_THICKNESS, STROKE_COLOR } from './constants';

export function drawBobs(context: CanvasRenderingContext2D, positions: readonly Vector[]): void {
  context.save();

  for (const position of positions) {
    context.beginPath();
    context.arc(position.x, position.y, BOB_RADIUS, 0, 2 * Math.PI);
    context.fillStyle = BOB_FILL_COLOR;
    context.fill();
    context.lineWidth = LINE_THICKNESS;
    context.strokeStyle = STROKE_COLOR;
    context.stroke();
  }

  context.restore();
}
