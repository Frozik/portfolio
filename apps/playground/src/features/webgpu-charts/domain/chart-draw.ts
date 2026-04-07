import { assert } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { mat4 } from 'wgpu-matrix';

const VERTICES_PER_INSTANCE = 18;
const DIAMOND_SEGMENT_COUNT = 4;
const DIAMOND_POINT_COUNT = 5;

const BACKGROUND_R = 0.149;
const BACKGROUND_G = 0.149;
const BACKGROUND_B = 0.149;

const SIN_PEN_MIN = 2.0;
const SIN_PEN_MAX = 20.0;

const DIAMOND_MARGIN = 20;

const SIN_SEGMENTS_DIVISOR = 4;
const HALF = 0.5;

const MSAA_SAMPLE_COUNT = 4;
const SIN_Y_LAYER_OPACITY = 0.7;

// --- Animated shapes constants ---
const MAX_SHAPES = 1_000;
const SHAPE_FADE_DURATION = 0.5;
const SHAPE_HOLD_DURATION_MIN = 2.0;
const SHAPE_HOLD_DURATION_MAX = 3.0;
const SHAPE_SIZE_MIN = 40;
const SHAPE_SIZE_MAX = 160;
const SHAPE_BORDER_THICKNESS = 0.08;
const SHAPE_TYPE_COUNT = 10;
const SHAPE_VERTICES_PER_INSTANCE = 6;
const SHAPE_MIN_BRIGHTNESS = 0.4;
// Each shape: 3 x vec4<f32> = 48 bytes
const SHAPE_INSTANCE_BYTES = 48;
const SHAPE_BUFFER_SIZE = MAX_SHAPES * SHAPE_INSTANCE_BYTES;

// Shape type enum
const SHAPE_CIRCLE = 0;
const SHAPE_SQUARE = 1;
const SHAPE_RHOMBUS = 2;
const SHAPE_PENTAGON = 3;
const SHAPE_HEXAGON = 4;
const SHAPE_STAR = 5;
const SHAPE_TRIANGLE_UP = 6;
const SHAPE_TRIANGLE_DOWN = 7;
const SHAPE_TRIANGLE_LEFT = 8;
const SHAPE_TRIANGLE_RIGHT = 9;

const SHAPE_OPACITY_MIN = 0.6;
const SHAPE_OPACITY_MAX = 1.0;

interface ShapeInstance {
  x: number;
  y: number;
  halfSize: number;
  spawnTime: number;
  r: number;
  g: number;
  b: number;
  holdDuration: number;
  shapeType: number;
  fillMode: number;
  maxOpacity: number;
}

function polar(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [Math.cos(rad) * radius, Math.sin(rad) * radius];
}

function computePolygonVertices(
  count: number,
  startAngleDeg: number,
  radius: number
): [number, number][] {
  const vertices: [number, number][] = [];
  const angleStep = 360 / count;
  for (let i = 0; i < count; i++) {
    vertices.push(polar(startAngleDeg + i * angleStep, radius));
  }
  return vertices;
}

// Precompute polygon vertices for WGSL embedding
const POLYGON_RADIUS = 0.5;
const STAR_INNER_RADIUS = 0.2;
const RHOMBUS_RADIUS_SHORT = 0.3;
const RHOMBUS_RADIUS_LONG = 0.5;
const TRIANGLE_START_ANGLE = 90;
const PENTAGON_VERTEX_COUNT = 5;
const HEXAGON_VERTEX_COUNT = 6;
const STAR_VERTEX_COUNT = 10;
const STAR_ANGLE_STEP = 36;
const TRIANGLE_VERTEX_COUNT = 3;

const SQUARE_VERTICES: [number, number][] = [
  [-0.5, -0.5],
  [-0.5, 0.5],
  [0.5, 0.5],
  [0.5, -0.5],
];

const RHOMBUS_VERTICES: [number, number][] = [
  polar(0, RHOMBUS_RADIUS_SHORT),
  polar(90, RHOMBUS_RADIUS_LONG),
  polar(180, RHOMBUS_RADIUS_SHORT),
  polar(270, RHOMBUS_RADIUS_LONG),
];

const PENTAGON_VERTICES = computePolygonVertices(
  PENTAGON_VERTEX_COUNT,
  TRIANGLE_START_ANGLE,
  POLYGON_RADIUS
);
const HEXAGON_VERTICES = computePolygonVertices(
  HEXAGON_VERTEX_COUNT,
  TRIANGLE_START_ANGLE,
  POLYGON_RADIUS
);

const STAR_VERTICES: [number, number][] = [];
for (let i = 0; i < STAR_VERTEX_COUNT; i++) {
  const angle = TRIANGLE_START_ANGLE + i * STAR_ANGLE_STEP;
  const radius = i % 2 === 0 ? POLYGON_RADIUS : STAR_INNER_RADIUS;
  STAR_VERTICES.push(polar(angle, radius));
}

const TRIANGLE_UP_VERTICES = computePolygonVertices(
  TRIANGLE_VERTEX_COUNT,
  TRIANGLE_START_ANGLE,
  POLYGON_RADIUS
);
const TRIANGLE_DOWN_VERTICES = computePolygonVertices(
  TRIANGLE_VERTEX_COUNT,
  TRIANGLE_START_ANGLE + 180,
  POLYGON_RADIUS
);
const TRIANGLE_LEFT_VERTICES = computePolygonVertices(TRIANGLE_VERTEX_COUNT, 180, POLYGON_RADIUS);
const TRIANGLE_RIGHT_VERTICES = computePolygonVertices(TRIANGLE_VERTEX_COUNT, 0, POLYGON_RADIUS);

function formatWGSLVertexArray(name: string, verts: [number, number][]): string {
  const count = verts.length;
  const entries = verts.map(([x, y]) => `  vec2<f32>(${x.toFixed(6)}, ${y.toFixed(6)}),`);
  return `const ${name}: array<vec2<f32>, ${count}> = array<vec2<f32>, ${count}>(\n${entries.join('\n')}\n);`;
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function spawnShape(time: number): ShapeInstance {
  let r = Math.random();
  let g = Math.random();
  let b = Math.random();
  // Ensure minimum brightness
  const brightness = (r + g + b) / 3;
  if (brightness < SHAPE_MIN_BRIGHTNESS) {
    const boost = SHAPE_MIN_BRIGHTNESS / Math.max(brightness, 0.01);
    r = Math.min(1, r * boost);
    g = Math.min(1, g * boost);
    b = Math.min(1, b * boost);
  }

  return {
    x: 0,
    y: 0,
    halfSize: randomInRange(SHAPE_SIZE_MIN / 2, SHAPE_SIZE_MAX / 2),
    spawnTime: time,
    r,
    g,
    b,
    holdDuration: randomInRange(SHAPE_HOLD_DURATION_MIN, SHAPE_HOLD_DURATION_MAX),
    shapeType: Math.floor(Math.random() * SHAPE_TYPE_COUNT),
    fillMode: Math.random() < HALF ? 0 : 1,
    maxOpacity: randomInRange(SHAPE_OPACITY_MIN, SHAPE_OPACITY_MAX),
  };
}

function getShapeLifetime(shape: ShapeInstance): number {
  return 2 * SHAPE_FADE_DURATION + shape.holdDuration;
}

function writeShapeToBuffer(shape: ShapeInstance, buffer: Float32Array, offset: number): void {
  const FLOATS_PER_VEC4 = 4;
  // vec4 0: x, y, halfSize, spawnTime
  buffer[offset] = shape.x;
  buffer[offset + 1] = shape.y;
  buffer[offset + 2] = shape.halfSize;
  buffer[offset + 3] = shape.spawnTime;
  // vec4 1: r, g, b, holdDuration
  buffer[offset + FLOATS_PER_VEC4] = shape.r;
  buffer[offset + FLOATS_PER_VEC4 + 1] = shape.g;
  buffer[offset + FLOATS_PER_VEC4 + 2] = shape.b;
  buffer[offset + FLOATS_PER_VEC4 + 3] = shape.holdDuration;
  // vec4 2: shapeType, fillMode, maxOpacity, 0
  const VEC4_2_OFFSET = FLOATS_PER_VEC4 * 2;
  buffer[offset + VEC4_2_OFFSET] = shape.shapeType;
  buffer[offset + VEC4_2_OFFSET + 1] = shape.fillMode;
  buffer[offset + VEC4_2_OFFSET + 2] = shape.maxOpacity;
  buffer[offset + VEC4_2_OFFSET + 3] = 0;
}

// Uniform buffer layout:
// mat4x4<f32> mvp            (64 bytes, offset 0)
// vec2<f32>   viewport       (8 bytes, offset 64)
// f32         time           (4 bytes, offset 72)
// u32         sinCount       (4 bytes, offset 76)
// f32         sinPenMin      (4 bytes, offset 80)
// f32         sinPenMax      (4 bytes, offset 84)
// f32         diamondMargin  (4 bytes, offset 88)
// u32         diamondOffset  (4 bytes, offset 92)
// u32         sinYCount      (4 bytes, offset 96)
// padding                    (12 bytes, offset 100 — pad to 112 for 16-byte alignment)
// total = 112 bytes
const UNIFORM_BUFFER_SIZE = 112;

// Compositing uniform: just the opacity float (padded to 16 for alignment)
const COMPOSITE_UNIFORM_SIZE = 16;

const FULLSCREEN_TRIANGLE_VERTEX_COUNT = 3;

export function runCharter(canvas: HTMLCanvasElement): VoidFunction {
  let destroyed = false;
  let gpuCleanup: (() => void) | undefined;

  void initCharter(canvas).then(cleanup => {
    if (destroyed) {
      cleanup();
    } else {
      gpuCleanup = cleanup;
    }
  });

  return () => {
    destroyed = true;
    gpuCleanup?.();
  };
}

async function initCharter(canvas: HTMLCanvasElement): Promise<VoidFunction> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'WebGPU adapter not available');
  const device = await adapter.requestDevice();

  const maybeCtx = canvas.getContext('webgpu');
  assert(!isNil(maybeCtx), 'Failed to get WebGPU canvas context');
  const ctx: GPUCanvasContext = maybeCtx;
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });

  const uniformBuf = device.createBuffer({
    size: UNIFORM_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shaderModule = device.createShaderModule({ code: WGSL_SOURCE });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const mainPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: { module: shaderModule, entryPoint: 'vs' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs',
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        },
      ],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  // Sin-Y offscreen pipeline — renders into rgba8unorm with alpha for compositing
  const offscreenFormat: GPUTextureFormat = 'rgba8unorm';

  const sinYPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: { module: shaderModule, entryPoint: 'vsSinY' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fsSinY',
      targets: [
        {
          format: offscreenFormat,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        },
      ],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  });

  // Compositing pipeline — fullscreen triangle, samples offscreen texture
  const compositeShaderModule = device.createShaderModule({ code: WGSL_COMPOSITE_SOURCE });

  const compositeBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const compositePipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [compositeBindGroupLayout],
    }),
    vertex: { module: compositeShaderModule, entryPoint: 'vsComposite' },
    fragment: {
      module: compositeShaderModule,
      entryPoint: 'fsComposite',
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        },
      ],
    },
    primitive: { topology: 'triangle-list' },
  });

  const compositeSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  const compositeUniformBuf = device.createBuffer({
    size: COMPOSITE_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  {
    const data = new Float32Array([SIN_Y_LAYER_OPACITY, 0, 0, 0]);
    device.queue.writeBuffer(compositeUniformBuf, 0, data);
  }

  // --- Shapes pipeline ---
  const shapesShaderModule = device.createShaderModule({ code: WGSL_SHAPES_SOURCE });

  const shapesStorageBuf = device.createBuffer({
    size: SHAPE_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const shapesBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  const shapesPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [shapesBindGroupLayout],
    }),
    vertex: { module: shapesShaderModule, entryPoint: 'vsShapes' },
    fragment: {
      module: shapesShaderModule,
      entryPoint: 'fsShapes',
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        },
      ],
    },
    primitive: { topology: 'triangle-list' },
  });

  const shapesBindGroup = device.createBindGroup({
    layout: shapesBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuf } },
      { binding: 1, resource: { buffer: shapesStorageBuf } },
    ],
  });

  // Initialize shapes with staggered spawn times
  const shapes: ShapeInstance[] = [];
  const shapeDataBuffer = new Float32Array(SHAPE_BUFFER_SIZE / Float32Array.BYTES_PER_ELEMENT);
  {
    const averageLifetime =
      2 * SHAPE_FADE_DURATION + (SHAPE_HOLD_DURATION_MIN + SHAPE_HOLD_DURATION_MAX) / 2;
    for (let i = 0; i < MAX_SHAPES; i++) {
      const shape = spawnShape(0);
      // Stagger spawn times so shapes don't all appear at once
      shape.spawnTime = -(averageLifetime / MAX_SHAPES) * i;
      shapes.push(shape);
    }
  }

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuf },
      },
    ],
  });

  // MSAA render target for main pass — recreated on resize
  let msaaTexture: GPUTexture | null = null;
  let msaaView: GPUTextureView | null = null;

  // Offscreen textures for sin-Y layer
  let offscreenMsaaTexture: GPUTexture | null = null;
  let offscreenMsaaView: GPUTextureView | null = null;
  let offscreenResolveTexture: GPUTexture | null = null;
  let offscreenResolveView: GPUTextureView | null = null;
  let compositeBindGroup: GPUBindGroup | null = null;

  let canvasWidth = 0;
  let canvasHeight = 0;

  function ensureMsaaTexture(): void {
    if (
      !isNil(msaaTexture) &&
      msaaTexture.width === canvasWidth &&
      msaaTexture.height === canvasHeight
    ) {
      return;
    }

    msaaTexture?.destroy();

    if (canvasWidth === 0 || canvasHeight === 0) {
      msaaTexture = null;
      msaaView = null;
      return;
    }

    msaaTexture = device.createTexture({
      size: [canvasWidth, canvasHeight],
      format,
      sampleCount: MSAA_SAMPLE_COUNT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    msaaView = msaaTexture.createView();
  }

  function ensureOffscreenTextures(): void {
    if (
      !isNil(offscreenMsaaTexture) &&
      offscreenMsaaTexture.width === canvasWidth &&
      offscreenMsaaTexture.height === canvasHeight
    ) {
      return;
    }

    offscreenMsaaTexture?.destroy();
    offscreenResolveTexture?.destroy();

    if (canvasWidth === 0 || canvasHeight === 0) {
      offscreenMsaaTexture = null;
      offscreenMsaaView = null;
      offscreenResolveTexture = null;
      offscreenResolveView = null;
      compositeBindGroup = null;
      return;
    }

    offscreenMsaaTexture = device.createTexture({
      size: [canvasWidth, canvasHeight],
      format: offscreenFormat,
      sampleCount: MSAA_SAMPLE_COUNT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    offscreenMsaaView = offscreenMsaaTexture.createView();

    offscreenResolveTexture = device.createTexture({
      size: [canvasWidth, canvasHeight],
      format: offscreenFormat,
      sampleCount: 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    offscreenResolveView = offscreenResolveTexture.createView();

    compositeBindGroup = device.createBindGroup({
      layout: compositeBindGroupLayout,
      entries: [
        { binding: 0, resource: offscreenResolveView },
        { binding: 1, resource: compositeSampler },
        { binding: 2, resource: { buffer: compositeUniformBuf } },
      ],
    });
  }

  function updateCanvasSize(): void {
    const dpr = Math.max(1, window.devicePixelRatio);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    canvasWidth = w;
    canvasHeight = h;
  }

  function computeSinXSegmentCount(): number {
    return Math.trunc(canvasWidth / SIN_PEN_MAX / SIN_SEGMENTS_DIVISOR) * SIN_SEGMENTS_DIVISOR + 1;
  }

  function computeSinYSegmentCount(): number {
    return Math.trunc(canvasHeight / SIN_PEN_MAX / SIN_SEGMENTS_DIVISOR) * SIN_SEGMENTS_DIVISOR + 1;
  }

  function writeUniforms(time: number): void {
    const halfW = canvasWidth * HALF;
    const halfH = canvasHeight * HALF;

    // Orthographic projection: world coords (centered) -> NDC
    const mvp = mat4.ortho(-halfW, halfW, -halfH, halfH, -1, 1);

    const sinCount = computeSinXSegmentCount();
    const sinYCount = computeSinYSegmentCount();

    const data = new ArrayBuffer(UNIFORM_BUFFER_SIZE);
    const f32 = new Float32Array(data);
    const u32 = new Uint32Array(data);

    // mat4x4 mvp at offset 0 (16 floats)
    f32.set(mvp as Float32Array, 0);

    // viewport at offset 16 (2 floats)
    const VIEWPORT_OFFSET = 16;
    f32[VIEWPORT_OFFSET] = canvasWidth;
    f32[VIEWPORT_OFFSET + 1] = canvasHeight;

    // time at offset 18
    const TIME_OFFSET = 18;
    f32[TIME_OFFSET] = time;

    // sinCount at offset 19 (u32)
    const SIN_COUNT_OFFSET = 19;
    u32[SIN_COUNT_OFFSET] = sinCount;

    // sinPenMin at offset 20
    const SIN_PEN_MIN_OFFSET = 20;
    f32[SIN_PEN_MIN_OFFSET] = SIN_PEN_MIN;

    // sinPenMax at offset 21
    const SIN_PEN_MAX_OFFSET = 21;
    f32[SIN_PEN_MAX_OFFSET] = SIN_PEN_MAX;

    // diamondMargin at offset 22
    const DIAMOND_MARGIN_OFFSET = 22;
    f32[DIAMOND_MARGIN_OFFSET] = DIAMOND_MARGIN;

    // diamondOffset at offset 23 (u32) - where diamond instances start
    const DIAMOND_OFFSET_OFFSET = 23;
    u32[DIAMOND_OFFSET_OFFSET] = sinCount;

    // sinYCount at offset 24 (u32)
    const SIN_Y_COUNT_OFFSET = 24;
    u32[SIN_Y_COUNT_OFFSET] = sinYCount;

    device.queue.writeBuffer(uniformBuf, 0, data);
  }

  updateCanvasSize();

  const resizeObserver = new ResizeObserver(() => {
    updateCanvasSize();
  });
  resizeObserver.observe(canvas);

  let animationFrameId = 0;
  let disposed = false;
  const startTime = performance.now();

  function frame(): void {
    if (disposed) {
      return;
    }

    updateCanvasSize();

    const MS_PER_SECOND = 1000;
    const time = (performance.now() - startTime) / MS_PER_SECOND;
    const sinXCount = computeSinXSegmentCount();
    const sinYCount = computeSinYSegmentCount();

    writeUniforms(time);

    const mainInstances = sinXCount + DIAMOND_SEGMENT_COUNT;

    ensureMsaaTexture();
    ensureOffscreenTextures();

    if (isNil(msaaView) || isNil(offscreenMsaaView) || isNil(offscreenResolveView)) {
      animationFrameId = requestAnimationFrame(frame);
      return;
    }

    const canvasTexView = ctx.getCurrentTexture().createView();
    const encoder = device.createCommandEncoder();

    // Pass 1: Main MSAA pass — diamond + sin-X
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: msaaView,
            resolveTarget: canvasTexView,
            loadOp: 'clear',
            clearValue: {
              r: BACKGROUND_R,
              g: BACKGROUND_G,
              b: BACKGROUND_B,
              a: 1,
            },
            storeOp: 'discard',
          },
        ],
      });

      pass.setPipeline(mainPipeline);
      pass.setBindGroup(0, bindGroup);

      if (mainInstances > 0) {
        pass.draw(VERTICES_PER_INSTANCE, mainInstances, 0, 0);
      }

      pass.end();
    }

    // Pass 2: Offscreen MSAA pass — sin-Y into transparent offscreen
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: offscreenMsaaView,
            resolveTarget: offscreenResolveView,
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            storeOp: 'discard',
          },
        ],
      });

      pass.setPipeline(sinYPipeline);
      pass.setBindGroup(0, bindGroup);

      if (sinYCount > 0) {
        pass.draw(VERTICES_PER_INSTANCE, sinYCount, 0, 0);
      }

      pass.end();
    }

    // Pass 3: Composite offscreen over main canvas with layer opacity
    {
      assert(!isNil(compositeBindGroup), 'Composite bind group must exist');

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: canvasTexView,
            loadOp: 'load',
            storeOp: 'store',
          },
        ],
      });

      pass.setPipeline(compositePipeline);
      pass.setBindGroup(0, compositeBindGroup);
      pass.draw(FULLSCREEN_TRIANGLE_VERTEX_COUNT, 1, 0, 0);

      pass.end();
    }

    // Pass 4: Animated shapes — update lifecycle and render
    {
      const halfW = canvasWidth * HALF;
      const halfH = canvasHeight * HALF;
      const FLOATS_PER_SHAPE = SHAPE_INSTANCE_BYTES / Float32Array.BYTES_PER_ELEMENT;

      for (let i = 0; i < MAX_SHAPES; i++) {
        const shape = shapes[i];
        const elapsed = time - shape.spawnTime;
        const lifetime = getShapeLifetime(shape);

        if (elapsed > lifetime) {
          // Respawn
          const newShape = spawnShape(time);
          newShape.x = randomInRange(-halfW + newShape.halfSize, halfW - newShape.halfSize);
          newShape.y = randomInRange(-halfH + newShape.halfSize, halfH - newShape.halfSize);
          shapes[i] = newShape;
        }

        writeShapeToBuffer(shapes[i], shapeDataBuffer, i * FLOATS_PER_SHAPE);
      }

      device.queue.writeBuffer(shapesStorageBuf, 0, shapeDataBuffer);

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: canvasTexView,
            loadOp: 'load',
            storeOp: 'store',
          },
        ],
      });

      pass.setPipeline(shapesPipeline);
      pass.setBindGroup(0, shapesBindGroup);
      pass.draw(SHAPE_VERTICES_PER_INSTANCE, MAX_SHAPES, 0, 0);
      pass.end();
    }

    device.queue.submit([encoder.finish()]);

    animationFrameId = requestAnimationFrame(frame);
  }

  animationFrameId = requestAnimationFrame(frame);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrameId);
    resizeObserver.disconnect();
    msaaTexture?.destroy();
    offscreenMsaaTexture?.destroy();
    offscreenResolveTexture?.destroy();
    uniformBuf.destroy();
    compositeUniformBuf.destroy();
    shapesStorageBuf.destroy();
    device.destroy();
  };
}

// Diamond points: 5 points (4 segments, closing the loop)
// Index: 0=(-1,-1), 1=(1,-1), 2=(1,1), 3=(-1,1), 4=(-1,-1)
// Widths: 4, 16, 4, 16, 4
// Colors: blue, green, orange, red, blue

const WGSL_SOURCE = /* wgsl */ `
const PI: f32 = 3.14159265358979323846;
const HALF: f32 = 0.5;
const DIAMOND_POINT_COUNT: u32 = ${DIAMOND_POINT_COUNT}u;
const DIAMOND_SEGMENT_COUNT: u32 = ${DIAMOND_SEGMENT_COUNT}u;

struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    time: f32,
    sinCount: u32,
    sinPenMin: f32,
    sinPenMax: f32,
    diamondMargin: f32,
    diamondOffset: u32,
    sinYCount: u32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) joinCenter: vec2<f32>,
    @location(2) joinWidth: f32,
};

// 6 vertices for a join quad (2 triangles)
const JOIN_BASIS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(0.5, -0.5),
);

// 6 vertices for a line rectangle (2 triangles)
const RECT_BASIS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -0.5),
    vec2<f32>(1.0, -0.5),
    vec2<f32>(1.0, 0.5),
    vec2<f32>(0.0, -0.5),
    vec2<f32>(1.0, 0.5),
    vec2<f32>(0.0, 0.5),
);

// Diamond data
const DIAMOND_POSITIONS: array<vec2<f32>, 5> = array<vec2<f32>, 5>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
);

const DIAMOND_WIDTHS: array<f32, 5> = array<f32, 5>(4.0, 16.0, 4.0, 16.0, 4.0);

const DIAMOND_COLORS: array<vec4<f32>, 5> = array<vec4<f32>, 5>(
    vec4<f32>(0.0, 0.5, 1.0, 1.0),
    vec4<f32>(0.5, 1.0, 0.0, 1.0),
    vec4<f32>(1.0, 0.5, 0.0, 1.0),
    vec4<f32>(1.0, 0.0, 0.5, 1.0),
    vec4<f32>(0.0, 0.5, 1.0, 1.0),
);

fn getSinUVPoint(index: f32, count: f32) -> vec2<f32> {
    let x = (index / count - HALF) * 2.0;
    let y = sin(x * HALF * PI + U.time);
    let indexU32 = u32(index);
    let sign = select(-1.0, 1.0, (indexU32 + 1u) % 4u > 1u);
    return vec2<f32>(x, y * sign);
}

fn getSinWidth(index: f32, count: f32) -> f32 {
    return U.sinPenMin + (index / count) * U.sinPenMax;
}

fn getSinColor(uv: vec2<f32>) -> vec4<f32> {
    return vec4<f32>(HALF, (uv.x + 1.0) / 2.0, (uv.y + 1.0) / 2.0, 1.0);
}

// Sin-Y: perpendicular sine wave along the Y axis
fn getSinYUVPoint(index: f32, count: f32) -> vec2<f32> {
    let y = (index / count - HALF) * 2.0;
    let x = sin(y * HALF * PI + U.time);
    let indexU32 = u32(index);
    let sign = select(-1.0, 1.0, (indexU32 + 1u) % 4u > 1u);
    return vec2<f32>(x * sign, y);
}

fn getSinYColor(uv: vec2<f32>) -> vec4<f32> {
    return vec4<f32>((uv.y + 1.0) / 2.0, HALF, (uv.x + 1.0) / 2.0, 1.0);
}

struct SegmentData {
    pointA: vec2<f32>,
    pointB: vec2<f32>,
    widthA: f32,
    widthB: f32,
    colorA: vec4<f32>,
    colorB: vec4<f32>,
};

fn getSegmentData(instanceId: u32) -> SegmentData {
    var seg: SegmentData;

    if (instanceId < U.sinCount) {
        // Sine wave segment
        let count = f32(U.sinCount);
        let indexA = f32(instanceId);
        let indexB = f32(instanceId + 1u);

        let uvA = getSinUVPoint(indexA, count);
        let uvB = getSinUVPoint(indexB, count);

        let sizeX = U.viewport.x - 4.0 * U.sinPenMax;
        let sizeY = U.viewport.y - 4.0 * U.sinPenMax;

        seg.pointA = vec2<f32>(uvA.x * sizeX * HALF, uvA.y * sizeY * HALF);
        seg.pointB = vec2<f32>(uvB.x * sizeX * HALF, uvB.y * sizeY * HALF);
        seg.widthA = getSinWidth(indexA, count);
        seg.widthB = getSinWidth(indexB, count);
        seg.colorA = getSinColor(uvA);
        seg.colorB = getSinColor(uvB);
    } else {
        // Diamond segment
        let diamondIdx = instanceId - U.diamondOffset;

        let posA = DIAMOND_POSITIONS[diamondIdx];
        let posB = DIAMOND_POSITIONS[diamondIdx + 1u];

        let sizeX = U.viewport.x - U.diamondMargin;
        let sizeY = U.viewport.y - U.diamondMargin;

        seg.pointA = posA * vec2<f32>(sizeX * HALF, sizeY * HALF);
        seg.pointB = posB * vec2<f32>(sizeX * HALF, sizeY * HALF);
        seg.widthA = DIAMOND_WIDTHS[diamondIdx];
        seg.widthB = DIAMOND_WIDTHS[diamondIdx + 1u];
        seg.colorA = DIAMOND_COLORS[diamondIdx];
        seg.colorB = DIAMOND_COLORS[diamondIdx + 1u];
    }

    return seg;
}

fn getSinYSegmentData(instanceId: u32) -> SegmentData {
    var seg: SegmentData;

    let count = f32(U.sinYCount);
    let indexA = f32(instanceId);
    let indexB = f32(instanceId + 1u);

    let uvA = getSinYUVPoint(indexA, count);
    let uvB = getSinYUVPoint(indexB, count);

    let sizeX = U.viewport.x - 4.0 * U.sinPenMax;
    let sizeY = U.viewport.y - 4.0 * U.sinPenMax;

    seg.pointA = vec2<f32>(uvA.x * sizeX * HALF, uvA.y * sizeY * HALF);
    seg.pointB = vec2<f32>(uvB.x * sizeX * HALF, uvB.y * sizeY * HALF);
    seg.widthA = getSinWidth(indexA, count);
    seg.widthB = getSinWidth(indexB, count);
    seg.colorA = getSinYColor(uvA);
    seg.colorB = getSinYColor(uvB);

    return seg;
}

fn safeNormalize(v: vec2<f32>) -> vec2<f32> {
    let len2 = dot(v, v);
    if (len2 > 1e-20) {
        return v * inverseSqrt(len2);
    }
    return vec2<f32>(0.0, 1.0);
}

fn buildVertex(seg: SegmentData, vid: u32) -> VSOut {
    var out: VSOut;

    let JOIN_A_END: u32 = 6u;
    let JOIN_B_END: u32 = 12u;

    if (vid < JOIN_A_END) {
        // Join A (circle at pointA)
        let basis = JOIN_BASIS[vid];
        out.joinCenter = basis;
        out.joinWidth = seg.widthA;
        out.color = seg.colorA;

        let offset = basis * seg.widthA;
        out.position = U.mvp * vec4<f32>(seg.pointA + offset, 0.0, 1.0);
    } else if (vid < JOIN_B_END) {
        // Join B (circle at pointB)
        let localVid = vid - JOIN_A_END;
        let basis = JOIN_BASIS[localVid];
        out.joinCenter = basis;
        out.joinWidth = seg.widthB;
        out.color = seg.colorB;

        let offset = basis * seg.widthB;
        out.position = U.mvp * vec4<f32>(seg.pointB + offset, 0.0, 1.0);
    } else {
        // Line body rectangle
        let localVid = vid - JOIN_B_END;
        let basis = RECT_BASIS[localVid];

        out.joinCenter = vec2<f32>(0.0, 0.0);
        out.joinWidth = 0.0;

        // Direction along the segment
        let dir = seg.pointB - seg.pointA;
        let normal = safeNormalize(vec2<f32>(-dir.y, dir.x));

        // Width at this vertex depends on t (basis.x)
        let w = mix(seg.widthA, seg.widthB, basis.x);

        // Base position along the segment
        let basePos = mix(seg.pointA, seg.pointB, basis.x);
        let vertexPos = basePos + normal * (basis.y * w);

        out.color = mix(seg.colorA, seg.colorB, basis.x);
        out.position = U.mvp * vec4<f32>(vertexPos, 0.0, 1.0);
    }

    return out;
}

@vertex
fn vs(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    let seg = getSegmentData(iid);
    return buildVertex(seg, vid);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    if (in.joinWidth > 0.0 && dot(in.joinCenter, in.joinCenter) > 0.25) {
        discard;
    }
    return in.color;
}

// Sin-Y vertex shader — uses sinYCount instances
@vertex
fn vsSinY(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    let seg = getSinYSegmentData(iid);
    return buildVertex(seg, vid);
}

// Sin-Y fragment shader — renders opaque (alpha=1) into offscreen
@fragment
fn fsSinY(in: VSOut) -> @location(0) vec4<f32> {
    if (in.joinWidth > 0.0 && dot(in.joinCenter, in.joinCenter) > 0.25) {
        discard;
    }
    return in.color;
}
`;

const WGSL_SHAPES_SOURCE = /* wgsl */ `
const HALF: f32 = 0.5;
const FADE_DURATION: f32 = ${SHAPE_FADE_DURATION};
const BORDER_THICKNESS: f32 = ${SHAPE_BORDER_THICKNESS};
const MAX_SHAPES: u32 = ${MAX_SHAPES}u;
const SHAPE_TYPE_COUNT: u32 = ${SHAPE_TYPE_COUNT}u;

// Shape type constants
const SHAPE_CIRCLE: u32 = ${SHAPE_CIRCLE}u;
const SHAPE_SQUARE: u32 = ${SHAPE_SQUARE}u;
const SHAPE_RHOMBUS: u32 = ${SHAPE_RHOMBUS}u;
const SHAPE_PENTAGON: u32 = ${SHAPE_PENTAGON}u;
const SHAPE_HEXAGON: u32 = ${SHAPE_HEXAGON}u;
const SHAPE_STAR: u32 = ${SHAPE_STAR}u;
const SHAPE_TRIANGLE_UP: u32 = ${SHAPE_TRIANGLE_UP}u;
const SHAPE_TRIANGLE_DOWN: u32 = ${SHAPE_TRIANGLE_DOWN}u;
const SHAPE_TRIANGLE_LEFT: u32 = ${SHAPE_TRIANGLE_LEFT}u;
const SHAPE_TRIANGLE_RIGHT: u32 = ${SHAPE_TRIANGLE_RIGHT}u;

// Polygon vertex arrays
${formatWGSLVertexArray('SQUARE_VERTS', SQUARE_VERTICES)}
${formatWGSLVertexArray('RHOMBUS_VERTS', RHOMBUS_VERTICES)}
${formatWGSLVertexArray('PENTAGON_VERTS', PENTAGON_VERTICES)}
${formatWGSLVertexArray('HEXAGON_VERTS', HEXAGON_VERTICES)}
${formatWGSLVertexArray('STAR_VERTS', STAR_VERTICES)}
${formatWGSLVertexArray('TRIANGLE_UP_VERTS', TRIANGLE_UP_VERTICES)}
${formatWGSLVertexArray('TRIANGLE_DOWN_VERTS', TRIANGLE_DOWN_VERTICES)}
${formatWGSLVertexArray('TRIANGLE_LEFT_VERTS', TRIANGLE_LEFT_VERTICES)}
${formatWGSLVertexArray('TRIANGLE_RIGHT_VERTS', TRIANGLE_RIGHT_VERTICES)}

// Vertex counts for each polygon type
const SQUARE_COUNT: u32 = ${SQUARE_VERTICES.length}u;
const RHOMBUS_COUNT: u32 = ${RHOMBUS_VERTICES.length}u;
const PENTAGON_COUNT: u32 = ${PENTAGON_VERTICES.length}u;
const HEXAGON_COUNT: u32 = ${HEXAGON_VERTICES.length}u;
const STAR_COUNT: u32 = ${STAR_VERTICES.length}u;
const TRIANGLE_COUNT: u32 = ${TRIANGLE_UP_VERTICES.length}u;

struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    time: f32,
    sinCount: u32,
    sinPenMin: f32,
    sinPenMax: f32,
    diamondMargin: f32,
    diamondOffset: u32,
    sinYCount: u32,
};

struct ShapeData {
    posAndSize: vec4<f32>,  // x, y, halfSize, spawnTime
    colorAndHold: vec4<f32>,  // r, g, b, holdDuration
    typeAndFill: vec4<f32>,  // shapeType, fillMode, maxOpacity, 0
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var<storage, read> shapes: array<ShapeData, ${MAX_SHAPES}>;

struct ShapesVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) @interpolate(flat) color: vec3<f32>,
    @location(2) @interpolate(flat) opacity: f32,
    @location(3) @interpolate(flat) shapeType: u32,
    @location(4) @interpolate(flat) fillMode: u32,
};

// Quad corners for 2 triangles (6 vertices)
const QUAD_POSITIONS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
);

fn computeOpacity(time: f32, spawnTime: f32, holdDuration: f32) -> f32 {
    let elapsed = time - spawnTime;
    let fadeInEnd = FADE_DURATION;
    let holdEnd = FADE_DURATION + holdDuration;
    let fadeOutEnd = holdEnd + FADE_DURATION;

    if (elapsed < 0.0) {
        return 0.0;
    }
    if (elapsed < fadeInEnd) {
        return elapsed / FADE_DURATION;
    }
    if (elapsed < holdEnd) {
        return 1.0;
    }
    if (elapsed < fadeOutEnd) {
        return 1.0 - (elapsed - holdEnd) / FADE_DURATION;
    }
    return 0.0;
}

@vertex
fn vsShapes(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> ShapesVSOut {
    var out: ShapesVSOut;

    let shape = shapes[iid];
    let pos = shape.posAndSize.xy;
    let halfSize = shape.posAndSize.z;
    let spawnTime = shape.posAndSize.w;
    let holdDuration = shape.colorAndHold.w;

    let quadPos = QUAD_POSITIONS[vid];
    out.uv = quadPos;  // UV in [-0.5, 0.5]

    let worldPos = pos + quadPos * halfSize * 2.0;
    out.position = U.mvp * vec4<f32>(worldPos, 0.0, 1.0);

    out.color = shape.colorAndHold.xyz;
    let maxOpacity = shape.typeAndFill.z;
    out.opacity = computeOpacity(U.time, spawnTime, holdDuration) * maxOpacity;
    out.shapeType = u32(shape.typeAndFill.x);
    out.fillMode = u32(shape.typeAndFill.y);

    return out;
}

// Get polygon vertex by index for a given shape type
fn getPolygonVertex(shapeType: u32, index: u32) -> vec2<f32> {
    switch (shapeType) {
        case ${SHAPE_SQUARE}u: { return SQUARE_VERTS[index]; }
        case ${SHAPE_RHOMBUS}u: { return RHOMBUS_VERTS[index]; }
        case ${SHAPE_PENTAGON}u: { return PENTAGON_VERTS[index]; }
        case ${SHAPE_HEXAGON}u: { return HEXAGON_VERTS[index]; }
        case ${SHAPE_STAR}u: { return STAR_VERTS[index]; }
        case ${SHAPE_TRIANGLE_UP}u: { return TRIANGLE_UP_VERTS[index]; }
        case ${SHAPE_TRIANGLE_DOWN}u: { return TRIANGLE_DOWN_VERTS[index]; }
        case ${SHAPE_TRIANGLE_LEFT}u: { return TRIANGLE_LEFT_VERTS[index]; }
        case ${SHAPE_TRIANGLE_RIGHT}u: { return TRIANGLE_RIGHT_VERTS[index]; }
        default: { return vec2<f32>(0.0, 0.0); }
    }
}

fn getPolygonVertexCount(shapeType: u32) -> u32 {
    switch (shapeType) {
        case ${SHAPE_SQUARE}u: { return SQUARE_COUNT; }
        case ${SHAPE_RHOMBUS}u: { return RHOMBUS_COUNT; }
        case ${SHAPE_PENTAGON}u: { return PENTAGON_COUNT; }
        case ${SHAPE_HEXAGON}u: { return HEXAGON_COUNT; }
        case ${SHAPE_STAR}u: { return STAR_COUNT; }
        case ${SHAPE_TRIANGLE_UP}u, ${SHAPE_TRIANGLE_DOWN}u, ${SHAPE_TRIANGLE_LEFT}u, ${SHAPE_TRIANGLE_RIGHT}u: { return TRIANGLE_COUNT; }
        default: { return 0u; }
    }
}

// Ray-casting point-in-polygon test
fn pointInPolygon(p: vec2<f32>, shapeType: u32) -> bool {
    let count = getPolygonVertexCount(shapeType);
    if (count == 0u) { return false; }

    var inside = false;
    var j = count - 1u;

    for (var i = 0u; i < count; i = i + 1u) {
        let vi = getPolygonVertex(shapeType, i);
        let vj = getPolygonVertex(shapeType, j);

        if (((vi.y > p.y) != (vj.y > p.y)) &&
            (p.x < (vj.x - vi.x) * (p.y - vi.y) / (vj.y - vi.y) + vi.x)) {
            inside = !inside;
        }
        j = i;
    }

    return inside;
}

// Distance from point to nearest polygon edge
fn distToPolygonEdge(p: vec2<f32>, shapeType: u32) -> f32 {
    let count = getPolygonVertexCount(shapeType);
    if (count == 0u) { return 1e10; }

    var minDist = 1e10;
    var j = count - 1u;

    for (var i = 0u; i < count; i = i + 1u) {
        let a = getPolygonVertex(shapeType, j);
        let b = getPolygonVertex(shapeType, i);
        let ab = b - a;
        let ap = p - a;
        let t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
        let closest = a + ab * t;
        let d = length(p - closest);
        minDist = min(minDist, d);
        j = i;
    }

    return minDist;
}

// Smoothstep anti-aliasing width in UV space based on halfSize
const AA_WIDTH: f32 = 0.01;

@fragment
fn fsShapes(in: ShapesVSOut) -> @location(0) vec4<f32> {
    if (in.opacity <= 0.0) {
        discard;
    }

    let uv = in.uv;
    var alpha: f32 = 0.0;

    if (in.shapeType == SHAPE_CIRCLE) {
        let dist = length(uv);
        if (in.fillMode == 0u) {
            // Solid circle
            alpha = 1.0 - smoothstep(HALF - AA_WIDTH, HALF, dist);
        } else {
            // Hollow circle
            let outerAlpha = 1.0 - smoothstep(HALF - AA_WIDTH, HALF, dist);
            let innerRadius = HALF - BORDER_THICKNESS;
            let innerAlpha = smoothstep(innerRadius - AA_WIDTH, innerRadius, dist);
            alpha = outerAlpha * innerAlpha;
        }
    } else {
        // Polygon shapes
        let inside = pointInPolygon(uv, in.shapeType);
        let edgeDist = distToPolygonEdge(uv, in.shapeType);

        if (in.fillMode == 0u) {
            // Solid polygon
            if (inside) {
                alpha = smoothstep(0.0, AA_WIDTH, edgeDist);
            } else {
                alpha = 0.0;
            }
        } else {
            // Hollow polygon
            if (inside) {
                let outerAlpha = smoothstep(0.0, AA_WIDTH, edgeDist);
                let innerAlpha = 1.0 - smoothstep(BORDER_THICKNESS - AA_WIDTH, BORDER_THICKNESS, edgeDist);
                alpha = outerAlpha * innerAlpha;
            } else {
                alpha = 0.0;
            }
        }
    }

    if (alpha <= 0.0) {
        discard;
    }

    let finalAlpha = alpha * in.opacity;
    // Premultiplied alpha output
    return vec4<f32>(in.color * finalAlpha, finalAlpha);
}
`;

const WGSL_COMPOSITE_SOURCE = /* wgsl */ `
struct CompositeUniforms {
    opacity: f32,
};

struct CompositeVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var offscreenTex: texture_2d<f32>;
@group(0) @binding(1) var offscreenSampler: sampler;
@group(0) @binding(2) var<uniform> CU: CompositeUniforms;

// Fullscreen triangle: 3 vertices covering the entire screen
@vertex
fn vsComposite(@builtin(vertex_index) vid: u32) -> CompositeVSOut {
    var out: CompositeVSOut;

    // Generates a large triangle that covers the viewport:
    // vid=0: (-1, -1), vid=1: (3, -1), vid=2: (-1, 3)
    let x = f32(vid & 1u) * 4.0 - 1.0;
    let y = f32((vid >> 1u) & 1u) * 4.0 - 1.0;

    out.position = vec4<f32>(x, y, 0.0, 1.0);
    // Map from clip space to UV: x: [-1,1] -> [0,1], y: [-1,1] -> [1,0] (flip Y)
    out.uv = vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5);

    return out;
}

@fragment
fn fsComposite(in: CompositeVSOut) -> @location(0) vec4<f32> {
    let color = textureSample(offscreenTex, offscreenSampler, in.uv);
    // Apply layer opacity — multiply alpha by the uniform opacity
    // Output premultiplied alpha for correct blending
    return vec4<f32>(color.rgb * CU.opacity, color.a * CU.opacity);
}
`;
