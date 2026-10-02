import { vec3 } from 'wgpu-matrix';

/** From the south-west and high, so east and north walls read darker than the roofs; the water glints toward it. */
export const SUN_DIRECTION = vec3.normalize([-0.45, 0.8, 0.4]);
