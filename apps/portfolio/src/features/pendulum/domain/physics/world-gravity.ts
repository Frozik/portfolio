import type { IWorld } from '../types';

export const DEFAULT_GRAVITY = 1;

/** The only place that reaches into the Matter.js engine for gravity. */
export function setWorldGravity(world: IWorld, gravity: number): void {
  world.engine.gravity.y = gravity;
}
