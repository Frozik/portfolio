import carTextureUrl from '../assets/car-colormap.png?url';
import carModelUrl from '../assets/car-suv.glb?url';
import { fitCarMesh } from '../gltf/fit-car-mesh';
import { parseGlb } from '../gltf/parse-glb';
import type { GpuMesh } from './gpu-mesh';
import { createIndexBuffer, createVertexBuffer } from './gpu-mesh';

export interface TexturedCarAsset {
  readonly mesh: GpuMesh;
  readonly texture: GPUTexture;
  readonly bindGroup: GPUBindGroup;
}

/**
 * Fetches the bundled CC0 car asset (Kenney car kit) and its palette and
 * uploads both. The asset is bundled, so this only rejects in truly broken
 * setups — and the caller keeps its sculpted stand-in then.
 */
export async function loadTexturedCar(
  device: GPUDevice,
  textureBindGroupLayout: GPUBindGroupLayout
): Promise<TexturedCarAsset> {
  const [modelBuffer, imageBlob] = await Promise.all([
    fetch(carModelUrl).then(response => response.arrayBuffer()),
    fetch(carTextureUrl).then(response => response.blob()),
  ]);
  const mesh = fitCarMesh(parseGlb(modelBuffer));
  const image = await createImageBitmap(imageBlob);
  const texture = device.createTexture({
    size: [image.width, image.height],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture({ source: image }, { texture }, [
    image.width,
    image.height,
  ]);

  return {
    texture,
    bindGroup: device.createBindGroup({
      layout: textureBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
        },
        { binding: 1, resource: texture.createView() },
      ],
    }),
    mesh: {
      vertexBuffers: [
        createVertexBuffer(device, mesh.positions),
        createVertexBuffer(device, mesh.normals),
        createVertexBuffer(device, mesh.uvs),
      ],
      indexBuffer: createIndexBuffer(device, mesh.indices),
      indexCount: mesh.indices.length,
    },
  };
}
