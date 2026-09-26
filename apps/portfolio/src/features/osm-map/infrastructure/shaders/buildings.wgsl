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
@group(0) @binding(1) var<storage, read> placements: array<Placement>;

const WALL_COLOR: vec3<f32> = vec3<f32>(0.86, 0.85, 0.82);
const ROOF_COLOR: vec3<f32> = vec3<f32>(0.93, 0.92, 0.90);
const AMBIENT: f32 = 0.55;
const ROOF_NORMAL_Y: f32 = 0.5;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) viewDistance: f32,
};

@vertex
fn vs(
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @builtin(instance_index) instanceIndex: u32,
) -> VSOut {
    let placement = placements[instanceIndex];
    // Ease-out cubic: the boxes shoot up and settle, rather than creep to their height.
    let progress = clamp((U.time - placement.riseStart) / U.riseSeconds, 0.0, 1.0);
    let settled = 1.0 - pow(1.0 - progress, 3.0);
    let world = vec3<f32>(
        placement.offset.x + position.x * placement.scale,
        position.y * placement.scale * settled,
        placement.offset.y + position.z * placement.scale,
    );

    var out: VSOut;
    out.position = U.viewProjection * vec4<f32>(world, 1.0);
    out.normal = normal;
    out.viewDistance = distance(world, U.cameraPosition);
    return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    let normal = normalize(in.normal);
    let diffuse = max(dot(normal, U.sunDirection), 0.0);
    let base = select(WALL_COLOR, ROOF_COLOR, normal.y > ROOF_NORMAL_Y);
    let lit = base * (AMBIENT + (1.0 - AMBIENT) * diffuse);
    let fog = smoothstep(U.fogStart, U.fogEnd, in.viewDistance);
    return vec4<f32>(mix(lit, U.fogColor, fog), 1.0);
}
