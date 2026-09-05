import { FLOATS_PER_PARTICLE, MAX_PARTICLES, PARTICLE_BYTES } from '../render-constants';
import type { ParticleInstance } from './particle-spawn';

/** Packs instances into the flat layout `particles.wgsl` reads, twelve floats per particle. */
function writeParticles(
  target: Float32Array,
  particles: readonly ParticleInstance[],
  firstIndex = 0
): void {
  particles.forEach((particle, index) => {
    const offset = (firstIndex + index) * FLOATS_PER_PARTICLE;

    target[offset] = particle.x;
    target[offset + 1] = particle.y;
    target[offset + 2] = particle.velocityX;
    target[offset + 3] = particle.velocityY;
    target[offset + 4] = 0;
    target[offset + 5] = particle.lifespanTicks;
    target[offset + 6] = particle.sizeWu;
    target[offset + 7] = particle.kind;
    target[offset + 8] = particle.red;
    target[offset + 9] = particle.green;
    target[offset + 10] = particle.blue;
    target[offset + 11] = particle.alpha;
  });
}

/**
 * The GPU storage buffer the particle passes share. Spawns are written straight into it as
 * a ring: a burst that runs off the end wraps around and takes the oldest slots, so a nuke can
 * never allocate and the pool's cost is fixed for the whole session.
 */
export class ParticlePool {
  readonly buffer: GPUBuffer;

  private readonly staging = new Float32Array(MAX_PARTICLES * FLOATS_PER_PARTICLE);
  private cursor = 0;

  constructor(private readonly device: GPUDevice) {
    this.buffer = device.createBuffer({
      size: MAX_PARTICLES * PARTICLE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.clear();
  }

  spawn(particles: readonly ParticleInstance[]): void {
    if (particles.length === 0) {
      return;
    }

    const batch = particles.slice(0, MAX_PARTICLES);
    const headCount = Math.min(batch.length, MAX_PARTICLES - this.cursor);

    this.writeRun(this.cursor, batch.slice(0, headCount));
    this.writeRun(0, batch.slice(headCount));
    this.cursor = (this.cursor + batch.length) % MAX_PARTICLES;
  }

  /** A new round starts on an empty field; leftover smoke from the last one would be a ghost. */
  clear(): void {
    this.staging.fill(0);
    this.device.queue.writeBuffer(this.buffer, 0, this.staging);
    this.cursor = 0;
  }

  dispose(): void {
    this.buffer.destroy();
  }

  private writeRun(firstIndex: number, particles: readonly ParticleInstance[]): void {
    if (particles.length === 0) {
      return;
    }

    writeParticles(this.staging, particles, firstIndex);
    this.device.queue.writeBuffer(
      this.buffer,
      firstIndex * PARTICLE_BYTES,
      this.staging.buffer,
      this.staging.byteOffset + firstIndex * PARTICLE_BYTES,
      particles.length * PARTICLE_BYTES
    );
  }
}
