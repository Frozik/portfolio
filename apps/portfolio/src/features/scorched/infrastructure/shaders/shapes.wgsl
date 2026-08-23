// Tanks and shells are drawn as oriented coloured quads (§11.3): a rectangle for a hull or a
// barrel, an ellipse for a turret dome or a shell, a ring for a raised shield. One pipeline,
// one instance buffer per layer.

struct ShapeInstance {
    // xy = centre in world units, zw = half size in world units.
    rect: vec4<f32>,
    color: vec4<f32>,
    // x = rotation in radians, y = kind, z = ring inner radius as a fraction of the outer.
    params: vec4<f32>,
};

@group(0) @binding(1) var<storage, read> instances: array<ShapeInstance>;

/** Every vertex of an instance carries the same kind, so a threshold reads it back safely. */
const ELLIPSE_THRESHOLD: f32 = 0.5;
const RING_THRESHOLD: f32 = 1.5;
const UNIT_RADIUS: f32 = 1.0;

const UNIT_QUAD_CORNERS = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
);

struct ShapeVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) local: vec2<f32>,
    @location(1) color: vec4<f32>,
    @location(2) kind: f32,
    @location(3) innerRadius: f32,
};

@vertex
fn vsShape(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
) -> ShapeVSOut {
    let instance = instances[instanceIndex];
    let corner = UNIT_QUAD_CORNERS[vertexIndex];
    let scaled = corner * instance.rect.zw;
    let angle = instance.params.x;
    let rotated = vec2<f32>(
        scaled.x * cos(angle) - scaled.y * sin(angle),
        scaled.x * sin(angle) + scaled.y * cos(angle),
    );

    var out: ShapeVSOut;
    out.position = worldToClip(instance.rect.xy + rotated);
    out.local = corner;
    out.color = instance.color;
    out.kind = instance.params.y;
    out.innerRadius = instance.params.z;

    return out;
}

@fragment
fn fsShape(in: ShapeVSOut) -> @location(0) vec4<f32> {
    let radius = length(in.local);

    if (in.kind > ELLIPSE_THRESHOLD && radius > UNIT_RADIUS) {
        discard;
    }

    if (in.kind > RING_THRESHOLD && radius < in.innerRadius) {
        discard;
    }

    return in.color;
}
