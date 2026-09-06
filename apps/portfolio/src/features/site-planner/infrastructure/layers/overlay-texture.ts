/** The texture the analysis raster is uploaded into, sized by the raster. */
/** The format the analysis raster is authored in: eight bits per RGBA channel. */
const OVERLAY_FORMAT: GPUTextureFormat = 'rgba8unorm';

/** The texture and the plan geometry of the analysis currently on the ground. */
export interface OverlayResources {
  readonly widthTexels: number;
  readonly heightTexels: number;
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
}

export function createOverlayTexture(
  device: GPUDevice,
  widthTexels: number,
  heightTexels: number
): OverlayResources {
  const texture = device.createTexture({
    size: [widthTexels, heightTexels],
    format: OVERLAY_FORMAT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  return { widthTexels, heightTexels, texture, view: texture.createView() };
}
