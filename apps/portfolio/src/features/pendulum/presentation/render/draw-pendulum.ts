import { bobPositions, pivotPosition } from '../../domain/physics/kinematics';
import type { IWorld } from '../../domain/types';
import { drawBobs } from './draw-bobs';
import { drawPivot } from './draw-pivot';
import { drawRods } from './draw-rods';

export function drawPendulum(context: CanvasRenderingContext2D, world: IWorld): void {
  const pivot = pivotPosition(world);
  const bobs = bobPositions(world);

  context.save();

  drawRods(context, [pivot, ...bobs]);
  drawPivot(context, pivot);
  drawBobs(context, bobs);

  context.restore();
}
