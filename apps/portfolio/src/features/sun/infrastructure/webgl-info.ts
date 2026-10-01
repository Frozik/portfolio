import { isNil } from 'lodash-es';

import type { WebGlInfo } from '../domain/gpu-capabilities';

/**
 * Asks WebGL what the card is: its renderer string names the real GPU even
 * where the WebGPU adapter is masked, and a context refused under
 * `failIfMajorPerformanceCaveat` means WebGL runs in software.
 */
export function readWebGlInfo(): WebGlInfo | undefined {
  const gl = createContext({});
  if (isNil(gl)) {
    return undefined;
  }
  const unmasked = gl.getExtension('WEBGL_debug_renderer_info');
  const info: Omit<WebGlInfo, 'isSoftware'> = {
    renderer: String(
      gl.getParameter(isNil(unmasked) ? gl.RENDERER : unmasked.UNMASKED_RENDERER_WEBGL)
    ),
    vendor: String(gl.getParameter(isNil(unmasked) ? gl.VENDOR : unmasked.UNMASKED_VENDOR_WEBGL)),
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
  };
  release(gl);
  const accelerated = createContext({ failIfMajorPerformanceCaveat: true });
  release(accelerated);
  return { ...info, isSoftware: isNil(accelerated) };
}

function createContext(attributes: WebGLContextAttributes): WebGLRenderingContext | null {
  const canvas = document.createElement('canvas');
  return canvas.getContext('webgl2', attributes) ?? canvas.getContext('webgl', attributes);
}

function release(gl: WebGLRenderingContext | null): void {
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
}
