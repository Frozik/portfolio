// Draws the compute-simulated particle pool (§11.2) as soft instanced discs. The pool is read
// straight out of the same storage buffer the compute pass writes, so nothing is copied per frame.

struct Particle {
    motion: vec4<f32>,
    life: vec4<f32>,
    color: vec4<f32>,
};

@group(0) @binding(1) var<storage, read> pool: array<Particle>;

const UNIT_RADIUS: f32 = 1.0;
const SMOKE_KIND: f32 = 1.0;
/** Smoke swells as it dissipates; debris and flame keep the size they were born with. */
const SMOKE_GROWTH: f32 = 1.6;
const OFFSCREEN_POSITION = vec4<f32>(0.0, 0.0, 2.0, 1.0);

const PARTICLE_QUAD_CORNERS = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
);

struct ParticleVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) local: vec2<f32>,
    @location(1) color: vec4<f32>,
};

@vertex
fn vsParticle(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
) -> ParticleVSOut {
    let particle = pool[instanceIndex];
    // An untouched slot has a zero lifespan, which is exactly what "no particle here" means.
    let remaining = select(0.0, 1.0 - particle.life.x / particle.life.y, particle.life.y > 0.0);

    var out: ParticleVSOut;

    if (remaining <= 0.0) {
        // A dead slot is collapsed behind the far plane rather than branching the fragment stage.
        out.position = OFFSCREEN_POSITION;
        out.local = vec2<f32>(0.0, 0.0);
        out.color = vec4<f32>(0.0, 0.0, 0.0, 0.0);

        return out;
    }

    let growth = select(1.0, 1.0 + (1.0 - remaining) * SMOKE_GROWTH, particle.life.w == SMOKE_KIND);
    let corner = PARTICLE_QUAD_CORNERS[vertexIndex];

    out.position = worldToClip(particle.motion.xy + corner * particle.life.z * growth);
    out.local = corner;
    out.color = vec4<f32>(particle.color.rgb, particle.color.a * remaining);

    return out;
}

@fragment
fn fsParticle(in: ParticleVSOut) -> @location(0) vec4<f32> {
    let distanceFromCenter = length(in.local);

    if (distanceFromCenter > UNIT_RADIUS) {
        discard;
    }

    // A soft edge keeps smoke from reading as a hard bubble; debris is small enough not to care.
    return vec4<f32>(in.color.rgb, in.color.a * (UNIT_RADIUS - distanceFromCenter));
}
