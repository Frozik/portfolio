import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import { TICKS_PER_SECOND } from '../../domain/constants';
import particleComputeSource from '../compute/particles.wgsl?raw';
import type { ParticlePool } from '../particles/particle-pool';
import {
  MAX_PARTICLES,
  PARTICLE_GRAVITY_WU_PER_TICK_SQUARED,
  PARTICLE_VERTEX_COUNT,
  PARTICLE_WORKGROUP_SIZE,
} from '../render-constants';
import commonShaderSource from '../shaders/common.wgsl?raw';
import particleShaderSource from '../shaders/particles.wgsl?raw';

const particleRenderSource = commonShaderSource + particleShaderSource;

/** Both the gravity and the step count fit in one 16-byte uniform block. */
const PARAMS_FLOAT_COUNT = 4;
const GRAVITY_OFFSET = 0;
const STEP_COUNT_OFFSET = 1;

const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;
/** A stalled tab must not replay its whole absence as one enormous puff of smoke. */
const MAX_STEPS_PER_FRAME = 4;
const MAX_ACCUMULATED_SECONDS = MAX_STEPS_PER_FRAME * SECONDS_PER_TICK;

/**
 * The cosmetic particle system: one compute dispatch integrates the whole pool, one
 * instanced draw paints it. Both bind the same storage buffer the CPU spawns into, so a burst
 * costs one buffer write and nothing per frame afterwards.
 *
 * The pool runs on its own 60 Hz clock rather than the display's, exactly like the dirt collapse,
 * so smoke rises at the same speed on a 60 Hz laptop and a 144 Hz monitor.
 */
export class ParticleLayer implements RenderLayer {
  private readonly params = new Float32Array(PARAMS_FLOAT_COUNT);
  private computePipeline!: GPUComputePipeline;
  private computeBindGroup!: GPUBindGroup;
  private renderPipeline!: GPURenderPipeline;
  private renderBindGroup!: GPUBindGroup;
  private paramsBuffer!: GPUBuffer;
  private device!: GPUDevice;
  private accumulatedSeconds = 0;
  private previousTimeSeconds: number | undefined;

  constructor(
    private readonly uniformBuffer: GPUBuffer,
    private readonly pool: ParticlePool
  ) {}

  init(context: GpuContext): void {
    const { device, format } = context;

    this.device = device;
    this.paramsBuffer = device.createBuffer({
      size: this.params.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.params[GRAVITY_OFFSET] = PARTICLE_GRAVITY_WU_PER_TICK_SQUARED;

    const computeLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    this.computePipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [computeLayout] }),
      compute: {
        module: device.createShaderModule({ code: particleComputeSource }),
        entryPoint: 'updateParticles',
        constants: { PARTICLE_WORKGROUP_SIZE },
      },
    });

    this.computeBindGroup = device.createBindGroup({
      layout: computeLayout,
      entries: [
        { binding: 0, resource: { buffer: this.pool.buffer } },
        { binding: 1, resource: { buffer: this.paramsBuffer } },
      ],
    });

    const renderLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    const shaderModule = device.createShaderModule({ code: particleRenderSource });

    this.renderPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [renderLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vsParticle' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fsParticle',
        targets: [
          {
            format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });

    this.renderBindGroup = device.createBindGroup({
      layout: renderLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.pool.buffer } },
      ],
    });
  }

  update(state: FrameState): void {
    const previousTimeSeconds = this.previousTimeSeconds;

    this.previousTimeSeconds = state.time;

    if (isNil(previousTimeSeconds)) {
      return;
    }

    this.accumulatedSeconds = Math.min(
      this.accumulatedSeconds + (state.time - previousTimeSeconds),
      MAX_ACCUMULATED_SECONDS
    );
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    const steps = Math.floor(this.accumulatedSeconds / SECONDS_PER_TICK);

    this.accumulatedSeconds -= steps * SECONDS_PER_TICK;

    if (steps > 0) {
      this.params[STEP_COUNT_OFFSET] = steps;
      this.device.queue.writeBuffer(this.paramsBuffer, 0, this.params);

      const pass = encoder.beginComputePass();

      pass.setPipeline(this.computePipeline);
      pass.setBindGroup(0, this.computeBindGroup);
      pass.dispatchWorkgroups(Math.ceil(MAX_PARTICLES / PARTICLE_WORKGROUP_SIZE));
      pass.end();
    }

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{ view: canvasView, loadOp: 'load', storeOp: 'store' }],
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.draw(PARTICLE_VERTEX_COUNT, MAX_PARTICLES);
    renderPass.end();
  }

  dispose(): void {
    this.paramsBuffer.destroy();
  }
}
