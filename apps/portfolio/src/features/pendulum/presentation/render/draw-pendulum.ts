import type { IWorld } from '../../domain/types';
import { drawBobs } from './draw-bobs';
import { drawPivot } from './draw-pivot';
import { drawRods } from './draw-rods';

export function drawPendulum(context: CanvasRenderingContext2D, { pivot, bobs }: IWorld): void {
  const bobsPositions = bobs.map(({ position }) => position);

  context.save();

  drawRods(context, [pivot.position, ...bobsPositions]);
  drawPivot(context, pivot.position);
  drawBobs(context, bobsPositions);

  context.restore();
}
