import { ROD_LENGTH } from '../constants';
import type { IPoint, IWorld } from '../types';

export function pivotPosition({ pivotX }: IWorld): IPoint {
  return { x: pivotX, y: 0 };
}

/** Bob k hangs at the end of the k-th rod; angles are measured from the downward vertical, y pointing down. */
export function bobPositions({ pivotX, angles }: IWorld): readonly IPoint[] {
  const positions: IPoint[] = [];
  let x = pivotX;
  let y = 0;

  for (const angle of angles) {
    x += ROD_LENGTH * Math.sin(angle);
    y += ROD_LENGTH * Math.cos(angle);
    positions.push({ x, y });
  }

  return positions;
}

/** Absolute bob velocities in px/ms: the pivot's motion plus every rod's rotation up the chain. */
export function bobVelocities({
  pivotVelocity,
  angles,
  angularVelocities,
}: IWorld): readonly IPoint[] {
  const velocities: IPoint[] = [];
  let x = pivotVelocity;
  let y = 0;

  for (const [index, angle] of angles.entries()) {
    const tangentialSpeed = ROD_LENGTH * angularVelocities[index];
    x += tangentialSpeed * Math.cos(angle);
    y -= tangentialSpeed * Math.sin(angle);
    velocities.push({ x, y });
  }

  return velocities;
}
