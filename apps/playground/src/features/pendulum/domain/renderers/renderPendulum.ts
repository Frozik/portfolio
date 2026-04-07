import type { IWorld } from '../types';
import { renderBobs } from './renderBobs';
import { renderPivot } from './renderPivot';
import { renderRods } from './renderRods';

export function renderPendulum(context: CanvasRenderingContext2D, { pivot, bobs }: IWorld) {
  const bobsPositions = bobs.map(({ position }) => position);

  context.save();

  renderRods(context, pivot.position, ...bobsPositions);

  renderPivot(context, pivot.position);

  renderBobs(context, ...bobsPositions);

  context.restore();
}
