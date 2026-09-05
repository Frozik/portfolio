import type { IPoint } from '../../domain/types';
import { FORCE_COLOR, LINE_THICKNESS } from './constants';

const FORCE_RADIUS = 20;
// The ring flickers by up to this many extra pixels of thickness per frame.
const FORCE_FLICKER_THICKNESS = 3;

export function drawForce(context: CanvasRenderingContext2D, { x, y }: IPoint): void {
  context.save();

  context.beginPath();
  context.arc(x, y, FORCE_RADIUS, 0, 2 * Math.PI);
  context.lineWidth = LINE_THICKNESS + Math.round(Math.random() * FORCE_FLICKER_THICKNESS);
  context.strokeStyle = FORCE_COLOR;
  context.stroke();

  context.restore();
}
