import { isNil } from 'lodash-es';
import { mat4 } from 'wgpu-matrix';

import { createOrbitalCameraController } from './sun-camera-controller';
import {
  BACKGROUND_COLOR,
  FAR_PLANE,
  FIELD_OF_VIEW_RADIANS,
  INSTANCE_COUNT,
  MS_PER_SECOND,
  MSAA_SAMPLE_COUNT,
  NEAR_PLANE,
  VERTICES_PER_TRIANGLE,
} from './sun-constants';
import { createDepthTexture, createMsaaTexture, initSunGPUResources } from './sun-gpu-resources';

export function runSun(canvas: HTMLCanvasElement): () => void {
  let destroyed = false;
  let animationFrameId = 0;

  const camera = createOrbitalCameraController(canvas);

  let gpuCleanup: (() => void) | undefined;

  void initGPU().then(cleanup => {
    if (destroyed) {
      cleanup();
    } else {
      gpuCleanup = cleanup;
    }
  });

  async function initGPU(): Promise<() => void> {
    const resources = await initSunGPUResources(canvas);
    const { device, ctx, format, pipeline, bindGroup, uniformBuf } = resources;

    if (destroyed) {
      device.destroy();
      return () => {};
    }

    let depthTexture = createDepthTexture(
      device,
      canvas.width || 1,
      canvas.height || 1,
      MSAA_SAMPLE_COUNT
    );

    let msaaTexture: GPUTexture | null = null;
    let msaaView: GPUTextureView | null = null;

    function ensureMsaaTextureSize(w: number, h: number): void {
      if (!isNil(msaaTexture) && msaaTexture.width === w && msaaTexture.height === h) {
        return;
      }
      msaaTexture?.destroy();
      if (w === 0 || h === 0) {
        msaaTexture = null;
        msaaView = null;
        return;
      }
      msaaTexture = createMsaaTexture(device, w, h, format, MSAA_SAMPLE_COUNT);
      msaaView = msaaTexture.createView();
    }

    function resizeCanvasToDisplaySize() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        depthTexture.destroy();
        depthTexture = createDepthTexture(device, w, h, MSAA_SAMPLE_COUNT);
        ensureMsaaTextureSize(w, h);
      }
    }

    resizeCanvasToDisplaySize();
    const resizeObserver = new ResizeObserver(resizeCanvasToDisplaySize);
    resizeObserver.observe(canvas);

    const startTime = performance.now();

    function frame() {
      if (destroyed) {
        return;
      }

      resizeCanvasToDisplaySize();

      const time = (performance.now() - startTime) / MS_PER_SECOND;

      const view = camera.getViewMatrix();
      const aspect = canvas.width / Math.max(1, canvas.height);
      const proj = mat4.perspective(FIELD_OF_VIEW_RADIANS, aspect, NEAR_PLANE, FAR_PLANE);
      const mvp = mat4.multiply(proj, view);

      // Write uniforms: time (f32) + pad (3xf32) + mvp (16xf32)
      const UNIFORM_FLOAT_COUNT = 20;
      const uniformData = new Float32Array(UNIFORM_FLOAT_COUNT);
      uniformData[0] = time;
      // [1..3] padding
      const MVP_OFFSET = 4;
      uniformData.set(new Float32Array(mvp as Float32Array), MVP_OFFSET);
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      ensureMsaaTextureSize(canvas.width, canvas.height);

      if (isNil(msaaView)) {
        animationFrameId = requestAnimationFrame(frame);
        return;
      }

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: msaaView,
            resolveTarget: ctx.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: BACKGROUND_COLOR,
            storeOp: 'discard',
          },
        ],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'discard',
        },
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(VERTICES_PER_TRIANGLE, INSTANCE_COUNT, 0, 0);
      pass.end();

      device.queue.submit([encoder.finish()]);

      animationFrameId = requestAnimationFrame(frame);
    }

    animationFrameId = requestAnimationFrame(frame);

    return () => {
      resizeObserver.disconnect();
      msaaTexture?.destroy();
      uniformBuf.destroy();
      depthTexture.destroy();
      device.destroy();
    };
  }

  return () => {
    destroyed = true;
    cancelAnimationFrame(animationFrameId);
    camera.destroy();
    gpuCleanup?.();
  };
}
