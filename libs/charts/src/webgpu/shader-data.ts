import { once } from 'lodash-es';
import { makeShaderDataDefinitions } from 'webgpu-utils';

import commonSource from './shaders/common.wgsl?raw';

/**
 * The layout of the uniforms as the shader declares them: the one source for
 * the buffers written from JavaScript. Read on first use, not on import:
 * parsing the shader touches WebGPU globals, and this module is imported on
 * devices that have none — where the charts are drawn by the 2D canvas.
 */
export const uniformLayouts = once(() => {
  const { uniforms } = makeShaderDataDefinitions(commonSource);
  return { frame: uniforms.frame, layer: uniforms.layer };
});
