import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { createUpdateOnlyLayer } from '@frozik/utils/webgpu/updateOnlyLayer';

import type { TanksUniforms } from '../tanks-uniforms';

/** Writes the shared uniform buffer once per frame, before any layer draws with it. */
export function createUniformUpdateLayer(uniforms: TanksUniforms): RenderLayer {
  return createUpdateOnlyLayer(state => uniforms.write(state));
}
