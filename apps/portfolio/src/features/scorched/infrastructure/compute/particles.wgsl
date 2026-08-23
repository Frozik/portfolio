// Integrates the cosmetic particle pool (§11.2): one thread per slot, thousands of debris chips,
// smoke puffs and napalm flames advanced in a single dispatch. Nothing here can affect gameplay —
// the domain resolved the damage before the burst that spawned these was ever queued.

struct Particle {
    // xy = position in world units, zw = velocity in world units per tick.
    motion: vec4<f32>,
    // x = age in ticks, y = lifespan in ticks, z = size in world units, w = kind.
    life: vec4<f32>,
    color: vec4<f32>,
};

struct ParticleParams {
    gravityWuPerTickSquared: f32,
    stepCount: f32,
    padding: vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: ParticleParams;

override PARTICLE_WORKGROUP_SIZE: u32;

const KIND_SMOKE: f32 = 1.0;
const KIND_FLAME: f32 = 2.0;

// Smoke and flame are buoyant, so they climb against gravity and slow down as they spread.
const SMOKE_DRAG: f32 = 0.97;
const SMOKE_BUOYANCY_WU_PER_TICK_SQUARED: f32 = 0.004;
const FLAME_DRAG: f32 = 0.94;
const DEBRIS_DRAG: f32 = 0.995;

fn stepParticle(particle: Particle) -> Particle {
    let kind = particle.life.w;
    var velocity = particle.motion.zw;

    if (kind == KIND_SMOKE || kind == KIND_FLAME) {
        let drag = select(SMOKE_DRAG, FLAME_DRAG, kind == KIND_FLAME);

        velocity.y = velocity.y + SMOKE_BUOYANCY_WU_PER_TICK_SQUARED;
        velocity = velocity * drag;
    } else {
        velocity.y = velocity.y - params.gravityWuPerTickSquared;
        velocity = velocity * DEBRIS_DRAG;
    }

    var stepped = particle;

    stepped.motion = vec4<f32>(particle.motion.xy + velocity, velocity);
    stepped.life = vec4<f32>(
        particle.life.x + 1.0,
        particle.life.y,
        particle.life.z,
        particle.life.w,
    );

    return stepped;
}

@compute @workgroup_size(PARTICLE_WORKGROUP_SIZE)
fn updateParticles(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;

    if (index >= arrayLength(&particles)) {
        return;
    }

    var particle = particles[index];

    // A dead slot is left exactly as it is: the ring cursor overwrites it when the next burst
    // needs the room, and the render pass already discards anything past its lifespan.
    if (particle.life.x >= particle.life.y) {
        return;
    }

    var step = 0.0;

    loop {
        if (step >= params.stepCount || particle.life.x >= particle.life.y) {
            break;
        }

        particle = stepParticle(particle);
        step = step + 1.0;
    }

    particles[index] = particle;
}
