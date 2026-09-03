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
  /**
   * Encodes the caster's depth-only draws into an already opened shadow pass.
   *
   * The pass draws the WHOLE model, always. A shadow is a property of the
   * building, not of what the editor is currently aimed at: dimming a storey
   * to ghost it while editing another must change its alpha in the colour
   * pass only. Dropping ghosted storeys out of this pass would light up the
   * yard and the roof terrace the moment someone opened the ground floor —
   * the sun study would answer a different plan than the one on screen.
   */
  drawShadow(pass: GPURenderPassEncoder): void;
}
