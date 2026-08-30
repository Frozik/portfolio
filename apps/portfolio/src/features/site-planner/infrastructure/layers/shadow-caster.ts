/**
 * A layer that also draws itself into the shadow map.
 *
 * The shadow pass needs the same geometry the camera passes draw, and that
 * geometry — its buffers, its instancing, its grid arithmetic — belongs to the
 * layer that owns it. So the shadow layer opens the pass and each caster fills
 * it with what it already holds, instead of a second copy of every buffer
 * living somewhere else.
 */
export interface ShadowCaster {
  /** Encodes the caster's depth-only draws into an already opened shadow pass. */
  drawShadow(pass: GPURenderPassEncoder): void;
}
