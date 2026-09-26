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

struct Car {
    // Plan metres from the tile corner, x east, y north.
    position: vec2<f32>,
    heading: f32,
    placement: f32,
    color: vec3<f32>,
    _pad: f32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var<storage, read> placements: array<Placement>;
@group(0) @binding(2) var<storage, read> cars: array<Car>;

const AMBIENT: f32 = 0.5;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) viewDistance: f32,
    @location(2) color: vec3<f32>,
};

/** Turns a car-local vector (x forward, y up, z south) by the heading, measured in plan from east toward north. */
fn turned(local: vec3<f32>, heading: f32) -> vec3<f32> {
    let plan = vec2<f32>(local.x, -local.z);
    let c = cos(heading);
    let s = sin(heading);
    let rotated = vec2<f32>(plan.x * c - plan.y * s, plan.x * s + plan.y * c);
    return vec3<f32>(rotated.x, local.y, -rotated.y);
}

@vertex
fn vs(
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @builtin(instance_index) instanceIndex: u32,
) -> VSOut {
    let car = cars[instanceIndex];
    let placement = placements[u32(car.placement)];
    let local = turned(position, car.heading);
    let world = vec3<f32>(
        placement.offset.x + (car.position.x + local.x) * placement.scale,
        local.y * placement.scale,
        placement.offset.y + (-car.position.y + local.z) * placement.scale,
    );

    var out: VSOut;
    out.position = U.viewProjection * vec4<f32>(world, 1.0);
    out.normal = turned(normal, car.heading);
    out.viewDistance = distance(world, U.cameraPosition);
    out.color = car.color;
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
