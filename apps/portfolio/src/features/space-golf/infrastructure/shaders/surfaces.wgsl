// The elastic and viscous surfaces, painted in each band's own frame:
// `along` runs the face, `across` goes into the block from the face line
// (negative outside it). The membrane is a taut, woven gold skin between
// two posts with a shimmer running along it; the goo is a dark, glossy
// mass hanging out of the face in slowly stretching drips.

struct BoardUniforms {
    viewport: vec2<f32>,   // device pixels
    origin: vec2<f32>,     // device-pixel position of the board's lower-left corner
    scale: f32,            // device pixels per metre
    seed: f32,             // per-level shift of the pattern, metres
    time: f32,             // seconds since the session started
    _pad: f32,
};

@group(0) @binding(0) var<uniform> U: BoardUniforms;

struct VertexIn {
    @location(0) position: vec2<f32>,
    @location(1) local: vec4<f32>,   // along, across, length, width — metres
    @location(2) kind: vec4<f32>,    // x: 0 membrane, 1 goo
};

struct VertexOut {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) local: vec4<f32>,
    @location(1) @interpolate(flat) kind: f32,
};

const GOLD_LIGHT = vec3<f32>(1.0, 0.9, 0.55);
const GOLD = vec3<f32>(0.9, 0.68, 0.22);
const GOLD_DEEP = vec3<f32>(0.55, 0.36, 0.08);
const POST = vec3<f32>(0.3, 0.2, 0.05);
const GOO_LIGHT = vec3<f32>(0.62, 0.36, 0.78);
const GOO = vec3<f32>(0.34, 0.14, 0.46);
const GOO_DEEP = vec3<f32>(0.14, 0.04, 0.2);
const GOO_GLOSS = vec3<f32>(0.9, 0.8, 1.0);

const POST_METERS = 0.04;
const WEAVE_PERIOD = 190.0;         // radians per metre: a thread every 3.3 cm
const SHIMMER_PERIOD = 22.0;
const SHIMMER_SPEED = 3.5;
const COIL_PERIOD = 70.0;
const DRIP_METERS = 0.06;
const DRIP_PERIOD = 15.0;
const DRIP_SPEED = 0.5;
const BLOB_CELL_METERS = 0.13;
const BLOB_RADIUS_METERS = 0.032;
const BLOB_DRIFT_METERS_PER_SECOND = 0.02;
const SOFT_EDGE_METERS = 0.006;
const TAU = 6.2831853;

@vertex
fn vsSurface(vertex: VertexIn) -> VertexOut {
    let pixel = vec2<f32>(U.origin.x + vertex.position.x * U.scale, U.origin.y - vertex.position.y * U.scale);
    let clip = pixel / U.viewport * 2.0 - 1.0;
    var out: VertexOut;
    out.clipPosition = vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
    out.local = vertex.local;
    out.kind = vertex.kind.x;
    return out;
}

fn hash21(p: vec2<f32>) -> f32 {
    var q = fract(p * vec2<f32>(123.34, 456.21));
    q = q + dot(q, q + 45.32);
    return fract(q.x * q.y);
}

fn soft(inside: f32) -> f32 {
    return 1.0 - smoothstep(-SOFT_EDGE_METERS, SOFT_EDGE_METERS, inside);
}

fn membrane(along: f32, across: f32, span: f32, width: f32) -> vec4<f32> {
    if (across < 0.0) {
        discard;
    }
    let depth = across / width;
    var color = mix(GOLD_LIGHT, GOLD_DEEP, depth);
    let weave = 0.5 + 0.5 * sin(along * WEAVE_PERIOD) * sin(across * WEAVE_PERIOD);
    color = color * (0.88 + 0.24 * weave);
    let shimmer = 0.5 + 0.5 * sin(along * SHIMMER_PERIOD - U.time * SHIMMER_SPEED);
    color = color + vec3<f32>(0.14) * shimmer * (1.0 - depth);
    let coil = 1.0 - smoothstep(0.0, 0.35, abs(sin(along * COIL_PERIOD + across * COIL_PERIOD)));
    color = mix(color, POST, coil * smoothstep(0.5, 0.75, depth) * 0.7);
    let post = max(soft(along - POST_METERS), soft(span - POST_METERS - along));
    color = mix(color, POST, post);
    return vec4<f32>(color, 1.0);
}

fn goo(along: f32, across: f32, span: f32, width: f32) -> vec4<f32> {
    let phase = along * DRIP_PERIOD + hash21(vec2<f32>(floor(along * 6.0), 1.0)) * TAU;
    let drip = DRIP_METERS
        * (0.5 + 0.5 * sin(phase + U.time * DRIP_SPEED))
        * (0.55 + 0.45 * sin(along * 33.0 - U.time * 0.3));
    let hang = smoothstep(0.0, 1.0, min(along, span - along) / (DRIP_METERS * 1.5));
    let alpha = smoothstep(-SOFT_EDGE_METERS, SOFT_EDGE_METERS, across + drip * hang);
    if (alpha <= 0.0) {
        discard;
    }
    let depth = clamp(across / width, 0.0, 1.0);
    var color = mix(GOO_LIGHT, GOO_DEEP, depth);
    let drift = U.time * BLOB_DRIFT_METERS_PER_SECOND;
    let cell = floor((along + drift) / BLOB_CELL_METERS);
    for (var neighbour = -1; neighbour <= 1; neighbour = neighbour + 1) {
        let c = cell + f32(neighbour);
        let r1 = hash21(vec2<f32>(c, 2.0));
        let r2 = hash21(vec2<f32>(c, 5.0));
        let centre = vec2<f32>((c + 0.25 + 0.5 * r1) * BLOB_CELL_METERS - drift, width * (0.2 + 0.6 * r2));
        let d = vec2<f32>(along, across) - centre;
        let blob = soft(length(d) - BLOB_RADIUS_METERS * (0.6 + 0.4 * r1));
        color = mix(color, GOO, blob * 0.8);
        let shine = soft(length(d - vec2<f32>(0.01, -0.01)) - BLOB_RADIUS_METERS * 0.25);
        color = mix(color, GOO_GLOSS, shine * blob * 0.7);
    }
    let gloss = soft(abs(across + drip * hang * 0.45) - 0.006) * 0.75;
    color = mix(color, GOO_GLOSS, gloss);
    return vec4<f32>(color, alpha);
}

@fragment
fn fsSurface(in: VertexOut) -> @location(0) vec4<f32> {
    let along = in.local.x;
    let across = in.local.y;
    let span = in.local.z;
    let width = in.local.w;
    if (in.kind > 0.5) {
        return goo(along, across, span, width);
    }
    return membrane(along, across, span, width);
}
