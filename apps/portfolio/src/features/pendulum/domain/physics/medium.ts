import type { IPoint } from '../types';

/**
 * Newton drag `a = −k·|v|·v` of the medium the bobs move through; `k` is
 * `½·ρ·C_d·A / m` in 1/px. Air on a 1 kg sphere of the bob's 13 px radius
 * at 100 px per metre: ½ · 1.2 · 0.47 · π·0.13² / 1 ≈ 0.015 per metre.
 */
const AIR_DRAG = 0.015 / 100;

export function dragAcceleration(velocity: IPoint): IPoint {
  const speed = Math.hypot(velocity.x, velocity.y);

  return { x: -AIR_DRAG * speed * velocity.x, y: -AIR_DRAG * speed * velocity.y };
}
