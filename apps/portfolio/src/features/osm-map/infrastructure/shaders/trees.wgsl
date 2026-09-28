struct Uniforms {
    viewProjection: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    fogStart: f32,
    fogColor: vec3<f32>,
    fogEnd: f32,
    sunDirection: vec3<f32>,
    time: f32,
    riseSeconds: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
};

struct Placement {
    offset: vec2<f32>,
    scale: f32,
    riseStart: f32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
// One tile's placement per draw, picked by the bind group's dynamic offset.
@group(0) @binding(1) var<uniform> placement: Placement;

const AMBIENT: f32 = 0.5;
// Instances come as int16 tenths of a metre.
const INSTANCE_UNIT_M: f32 = 0.1;
// No two trees of a wood are quite the same green.
const TINT_SPREAD: f32 = 0.3;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) viewDistance: f32,
    @location(2) color: vec3<f32>,
};

fn hash(seed: u32) -> f32 {
    var x = seed * 747796405u + 2891336453u;
    x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
    x = (x >> 22u) ^ x;
    return f32(x) / 4294967295.0;
}

@vertex
fn vs(
    @location(0) local: vec3<f32>,
    @location(1) localNormal: vec3<f32>,
    @location(2) color: vec3<f32>,
    // Trunk foot x east and z south from the tile corner, crown radius, height.
    @location(3) tree: vec4<i32>,
    @builtin(instance_index) instanceIndex: u32,
) -> VSOut {
    let foot = vec2<f32>(tree.xy) * INSTANCE_UNIT_M;
    let crownRadius = f32(tree.z) * INSTANCE_UNIT_M;
    let progress = clamp((U.time - placement.riseStart) / U.riseSeconds, 0.0, 1.0);
    let settled = 1.0 - pow(1.0 - progress, 3.0);
    let height = f32(tree.w) * INSTANCE_UNIT_M * settled;
    let metres = vec3<f32>(
        foot.x + local.x * crownRadius,
        local.y * height,
        foot.y + local.z * crownRadius,
    );
    let world = vec3<f32>(
        placement.offset.x + metres.x * placement.scale,
        metres.y * placement.scale,
        placement.offset.y + metres.z * placement.scale,
    );

    var out: VSOut;
    out.position = U.viewProjection * vec4<f32>(world, 1.0);
    out.normal = vec3<f32>(
        localNormal.x / crownRadius,
        localNormal.y / max(height, INSTANCE_UNIT_M),
        localNormal.z / crownRadius,
    );
    out.viewDistance = distance(world, U.cameraPosition);
    out.color = color * (1.0 - TINT_SPREAD * 0.5 + TINT_SPREAD * hash(instanceIndex));
    return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    let normal = normalize(in.normal);
    let diffuse = max(dot(normal, U.sunDirection), 0.0);
    let lit = in.color * (AMBIENT + (1.0 - AMBIENT) * diffuse);
    let fog = smoothstep(U.fogStart, U.fogEnd, in.viewDistance);
    return vec4<f32>(mix(lit, U.fogColor, fog), 1.0);
}
