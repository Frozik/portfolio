import { BOB_RADIUS, RAILS_LENGTH, ROD_LENGTH } from '../../domain/constants';
import type { IPoint } from '../../domain/types';
import { RAILS_CAPS_WIDTH } from './constants';

const SCENE_MARGIN = 12;

export const SCENE_WIDTH = RAILS_LENGTH + 2 * (RAILS_CAPS_WIDTH + SCENE_MARGIN);
export const SCENE_HEIGHT = 2 * (ROD_LENGTH + BOB_RADIUS + SCENE_MARGIN);

const MAX_SCENE_SCALE = 1;

/** How much the scene shrinks to fit a viewport of the given CSS size; it never grows past 1:1. */
export function sceneScale(width: number, height: number): number {
  return Math.min(width / SCENE_WIDTH, height / SCENE_HEIGHT, MAX_SCENE_SCALE);
}

/** A viewport point (CSS px from the top-left corner) in scene coordinates, origin at the rail's zero mark. */
export function toScenePoint({ x, y }: IPoint, width: number, height: number): IPoint {
  const scale = sceneScale(width, height);

  return { x: (x - width / 2) / scale, y: (y - height / 2) / scale };
}
