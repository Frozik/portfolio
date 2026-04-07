import { assert } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { mat4, vec3 } from 'wgpu-matrix';

const INSTANCE_COUNT = 100_000;
const BACKGROUND_COLOR = { r: 0.149, g: 0.149, b: 0.149, a: 1 };

const MIN_CAMERA_DISTANCE = 5;
const MAX_CAMERA_DISTANCE = 20;
const INITIAL_CAMERA_DISTANCE = 16;
const MOUSE_ROTATE_SENSITIVITY = 0.005;
const WHEEL_ZOOM_SENSITIVITY = 0.01;
const INITIAL_ELEVATION = Math.PI / 2;
const ELEVATION_MIN = 0.01;
const ELEVATION_MAX = Math.PI - 0.01;

const FIELD_OF_VIEW_RADIANS = Math.PI / 4;
const NEAR_PLANE = 0.1;
const FAR_PLANE = 100;

export function runSun(canvas: HTMLCanvasElement): () => void {
  let destroyed = false;
  let animationFrameId = 0;

  // Camera state
  let azimuth = 0;
  let elevation = INITIAL_ELEVATION;
  let distance = INITIAL_CAMERA_DISTANCE;

  // Mouse tracking
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function onMouseDown(e: MouseEvent) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) {
      return;
    }

    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    azimuth -= dx * MOUSE_ROTATE_SENSITIVITY;
    elevation = Math.max(
      ELEVATION_MIN,
      Math.min(ELEVATION_MAX, elevation + dy * MOUSE_ROTATE_SENSITIVITY)
    );
  }

  function onMouseUp() {
    isDragging = false;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    distance = Math.max(
      MIN_CAMERA_DISTANCE,
      Math.min(MAX_CAMERA_DISTANCE, distance * (1 + e.deltaY * WHEEL_ZOOM_SENSITIVITY))
    );
  }

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // Touch support
  let lastTouchX = 0;
  let lastTouchY = 0;
  let isTouching = false;

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      isTouching = true;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!isTouching || e.touches.length !== 1) {
      return;
    }

    e.preventDefault();

    const dx = e.touches[0].clientX - lastTouchX;
    const dy = e.touches[0].clientY - lastTouchY;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;

    azimuth -= dx * MOUSE_ROTATE_SENSITIVITY;
    elevation = Math.max(
      ELEVATION_MIN,
      Math.min(ELEVATION_MAX, elevation + dy * MOUSE_ROTATE_SENSITIVITY)
    );
  }

  function onTouchEnd() {
    isTouching = false;
  }

  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);

  let gpuCleanup: (() => void) | undefined;

  void initGPU().then(cleanup => {
    if (destroyed) {
      cleanup();
    } else {
      gpuCleanup = cleanup;
    }
  });

  async function initGPU(): Promise<() => void> {
    assert(!isNil(navigator.gpu), 'WebGPU is not supported');

    const adapter = await navigator.gpu.requestAdapter();
    assert(!isNil(adapter), 'WebGPU adapter not available');
    const device = await adapter.requestDevice();

    if (destroyed) {
      device.destroy();
      return () => {};
    }

    const ctx = canvas.getContext('webgpu') as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: 'premultiplied' });

    // Uniform buffer: time (f32) + pad (f32x3) + mvp (mat4x4) = 4 + 12 + 64 = 80 bytes
    const UNIFORM_SIZE = 80;
    const uniformBuf = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const MSAA_SAMPLE_COUNT = 4;

    // Depth texture (recreated on resize)
    let depthTexture = createDepthTexture(
      device,
      canvas.width || 1,
      canvas.height || 1,
      MSAA_SAMPLE_COUNT
    );

    const shaderModule = device.createShaderModule({ code: wgslSource });

    const bgl = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      vertex: { module: shaderModule, entryPoint: 'vs' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });

    let msaaTexture: GPUTexture | null = null;
    let msaaView: GPUTextureView | null = null;

    function ensureMsaaTexture(w: number, h: number): void {
      if (!isNil(msaaTexture) && msaaTexture.width === w && msaaTexture.height === h) {
        return;
      }
      msaaTexture?.destroy();
      if (w === 0 || h === 0) {
        msaaTexture = null;
        msaaView = null;
        return;
      }
      msaaTexture = device.createTexture({
        size: [w, h],
        format,
        sampleCount: MSAA_SAMPLE_COUNT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      msaaView = msaaTexture.createView();
    }

    const bindGroup = device.createBindGroup({
      layout: bgl,
      entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
    });

    function resizeCanvasToDisplaySize() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        depthTexture.destroy();
        depthTexture = createDepthTexture(device, w, h, MSAA_SAMPLE_COUNT);
        ensureMsaaTexture(w, h);
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

      const time = (performance.now() - startTime) / 1000;

      // Compute camera position from spherical coordinates
      const camX = distance * Math.sin(elevation) * Math.sin(azimuth);
      const camY = distance * Math.cos(elevation);
      const camZ = distance * Math.sin(elevation) * Math.cos(azimuth);

      const eye = vec3.fromValues(camX, camY, camZ);
      const target = vec3.fromValues(0, 0, 0);
      const up = vec3.fromValues(0, 1, 0);

      const view = mat4.lookAt(eye, target, up);
      const aspect = canvas.width / Math.max(1, canvas.height);
      const proj = mat4.perspective(FIELD_OF_VIEW_RADIANS, aspect, NEAR_PLANE, FAR_PLANE);
      const mvp = mat4.multiply(proj, view);

      // Write uniforms: time (f32) + pad (3xf32) + mvp (16xf32)
      const uniformData = new Float32Array(20);
      uniformData[0] = time;
      // [1..3] padding
      uniformData.set(new Float32Array(mvp), 4);
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      ensureMsaaTexture(canvas.width, canvas.height);

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

      const VERTICES_PER_TRIANGLE = 3;
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

    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);

    gpuCleanup?.();
  };
}

function createDepthTexture(
  device: GPUDevice,
  width: number,
  height: number,
  sampleCount: number
): GPUTexture {
  return device.createTexture({
    size: [width, height],
    format: 'depth24plus',
    sampleCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
}

// Port of the GLSL vertex/fragment shaders to WGSL
const wgslSource = /* wgsl */ `
const PI: f32 = 3.1415926535;
const TWO_PI: f32 = PI * 2.0;
const INSTANCE_COUNT: f32 = ${INSTANCE_COUNT}.0;
const SPHERE_RADIUS: f32 = 5.0;
const TRIANGLE_HALF_SIZE: f32 = 0.25;
const EVERY_NTH_CENTER_LINE: f32 = 50.0;

// Golden angle ≈ 2.39996322972865332...
// For range reduction we compute (GOLDEN_ANGLE * instID) mod TWO_PI
// using extended precision to avoid the f32 seam artifact.
// Split 2π into high + low: TWO_PI = TP_HI + TP_LO
const GOLDEN_ANGLE: f32 = 2.3999632297286533;
const INV_TWO_PI: f32 = 0.15915494309189535;
const TP_HI: f32 = 6.28125;       // exact in f32 (few mantissa bits)
const TP_LO: f32 = 0.0019353071795864769; // TWO_PI - TP_HI

struct Uniforms {
    time: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
    mvp: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> U: Uniforms;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

fn random(v3: vec3<f32>) -> f32 {
    return fract(sin(dot(v3, vec3<f32>(12.9898, 78.233, 34.258))) * 43758.5453123);
}

fn square(s: f32) -> f32 {
    return s * s;
}

fn neonGradient(val: f32) -> vec3<f32> {
    return clamp(
        vec3<f32>(
            val * 1.3 + 0.1,
            square(abs(0.43 - val) * 1.7),
            (1.0 - val) * 1.7,
        ),
        vec3<f32>(0.0, 0.0, 0.0),
        vec3<f32>(1.0, 1.0, 1.0),
    );
}

// Cody-Waite range reduction: compute (GOLDEN_ANGLE * instID) mod 2π
// with extended precision to avoid seam artifacts from f32 rounding.
fn reducedTheta(instID: f32) -> f32 {
    let raw = GOLDEN_ANGLE * instID;
    let n = floor(raw * INV_TWO_PI);
    // Subtract n*2π in two steps for precision: raw - n*TP_HI - n*TP_LO
    return (raw - n * TP_HI) - n * TP_LO;
}

fn instPos(instID: f32) -> vec3<f32> {
    let y = 1.0 - (instID / (INSTANCE_COUNT - 1.0)) * 2.0;
    let radius = sqrt(1.0 - square(y));
    let theta = reducedTheta(instID);

    let x = cos(theta) * radius;
    let z = sin(theta) * radius;

    return vec3<f32>(x, y, z) * SPHERE_RADIUS;
}

fn rot2d(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, s, -s, c);
}

// Build an orthonormal basis from a normal vector (no polar singularities).
// Uses the Pixar method (Duff et al. 2017) which is stable for all directions.
fn buildBasis(n: vec3<f32>) -> mat3x3<f32> {
    let sign = select(-1.0, 1.0, n.z >= 0.0);
    let a = -1.0 / (sign + n.z);
    let b = n.x * n.y * a;
    let tangent = vec3<f32>(1.0 + sign * n.x * n.x * a, sign * b, -sign * n.x);
    let bitangent = vec3<f32>(b, sign + n.y * n.y * a, -n.y);
    return mat3x3<f32>(tangent, bitangent, n);
}

@vertex
fn vs(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    let time = U.time * 0.1;
    let instID = f32(iid);

    // Triangle vertex position (equilateral triangle in XY plane)
    var pos = vec3<f32>(0.0, TRIANGLE_HALF_SIZE, 0.0);
    let angle = f32(vid) * TWO_PI / 3.0;
    let rotated = rot2d(angle) * pos.xy;
    pos = vec3<f32>(rotated, 0.0);

    // Instance position on sphere (golden spiral)
    let iPos = instPos(instID);
    let normal = normalize(iPos);

    // Time-based animation
    let shift = random(iPos) * 2.0 - 1.0;
    let sinVal = abs(sin(TWO_PI * (shift + time)));
    pos *= (1.0 - sinVal) * 0.99 + 0.01;

    // Spin the triangle
    let spinRotated = rot2d(TWO_PI * (shift + time * shift)) * pos.xy;
    pos = vec3<f32>(spinRotated, pos.z);

    // Orient triangle to face outward using stable orthonormal basis
    let basis = buildBasis(normal);
    pos = basis * pos;

    // Offset from center + push outward by sinVal
    pos = pos + iPos + normal * sinVal;

    // Every 50th instance: first vertex draws a line to center
    var finalPos: vec4<f32>;
    if (vid == 0u && (u32(instID) % u32(EVERY_NTH_CENTER_LINE)) == 0u) {
        finalPos = U.mvp * vec4<f32>(0.0, 0.0, 0.0, 1.0);
    } else {
        finalPos = U.mvp * vec4<f32>(pos, 1.0);
    }

    var out: VSOut;
    out.position = finalPos;
    out.color = neonGradient(0.6 + sinVal * 0.4);
    return out;
}

@fragment
fn fs(input: VSOut) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 1.0);
}
`;
