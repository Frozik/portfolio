// The islands' fill: Khokhloma — black lacquer, gold tendrils, gold and
// green leaves, red berries — painted procedurally in board metres, so the
// pattern is continuous across an island and differs per level by the seed.

struct BoardUniforms {
    viewport: vec2<f32>,   // device pixels
    origin: vec2<f32>,     // device-pixel position of the board's lower-left corner
    xAxis: vec2<f32>,      // the board's x axis in device pixels per metre
    yAxis: vec2<f32>,      // the board's y axis in device pixels per metre — turned a quarter on a landscape canvas
    scale: f32,            // device pixels per metre
    seed: f32,             // per-level shift of the pattern, metres
    time: f32,             // seconds since the session started; unused here
    _pad: f32,
};

@group(0) @binding(0) var<uniform> U: BoardUniforms;

struct VertexIn {
    @location(0) position: vec2<f32>,
    @location(1) color: vec4<f32>,
};

struct VertexOut {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) board: vec2<f32>,
};

const GOLD = vec3<f32>(0.86, 0.62, 0.18);
const GOLD_DARK = vec3<f32>(0.6, 0.4, 0.1);
const GOLD_LIGHT = vec3<f32>(1.0, 0.88, 0.5);
const RED = vec3<f32>(0.74, 0.1, 0.07);
const GREEN = vec3<f32>(0.24, 0.46, 0.16);

// One motif per cell of this size, jittered inside it.
const MOTIF_CELL_METERS = 0.22;
const BERRY_RADIUS_METERS = 0.042;
const BERRY_HIGHLIGHT_RADIUS_METERS = 0.012;
const LEAF_LENGTH_METERS = 0.075;
const LEAF_WIDTH_METERS = 0.03;
const LEAF_VEIN_METERS = 0.006;
// Tendrils: a warped wave field, gold where it crosses zero.
const TENDRIL_SCALE = 5.0;
const TENDRIL_WIDTH = 0.45;
const SOFT_EDGE_METERS = 0.008;
const TAU = 6.2831853;

@vertex
fn vsBoard(vertex: VertexIn) -> VertexOut {
    let pixel = U.origin + U.xAxis * vertex.position.x + U.yAxis * vertex.position.y;
    let clip = pixel / U.viewport * 2.0 - 1.0;
    var out: VertexOut;
    out.clipPosition = vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
    out.color = vertex.color;
    out.board = vertex.position;
    return out;
}

fn hash21(p: vec2<f32>) -> f32 {
    var q = fract(p * vec2<f32>(123.34, 456.21));
    q = q + dot(q, q + 45.32);
    return fract(q.x * q.y);
}

fn hash22(p: vec2<f32>) -> vec2<f32> {
    let h = hash21(p);
    return vec2<f32>(h, hash21(p + h + 7.1));
}

fn rotate(p: vec2<f32>, angle: f32) -> vec2<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return vec2<f32>(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn edge(inside: f32) -> f32 {
    return 1.0 - smoothstep(-SOFT_EDGE_METERS, SOFT_EDGE_METERS, inside);
}

fn tendrils(p: vec2<f32>) -> f32 {
    let q = p * TENDRIL_SCALE;
    let field = sin(q.x * 3.1 + 1.3 * sin(q.y * 1.7 + 0.5)) + sin(q.y * 2.6 + 1.1 * sin(q.x * 1.9 + 2.0));
    return 1.0 - smoothstep(TENDRIL_WIDTH * 0.6, TENDRIL_WIDTH, abs(field));
}

fn paintMotif(color: vec3<f32>, p: vec2<f32>, cell: vec2<f32>) -> vec3<f32> {
    let jitter = hash22(cell);
    let center = (cell + 0.2 + 0.6 * jitter) * MOTIF_CELL_METERS;
    let d = p - center;
    let kind = hash21(cell + 3.3);
    var painted = color;
    if (kind < 0.32) {
        let berry = edge(length(d) - BERRY_RADIUS_METERS);
        let shine = edge(length(d - vec2<f32>(0.012, 0.012)) - BERRY_HIGHLIGHT_RADIUS_METERS);
        painted = mix(painted, RED, berry);
        painted = mix(painted, GOLD_LIGHT, shine * berry);
    } else if (kind < 0.82) {
        let local = rotate(d, jitter.x * TAU);
        let ellipse = (local.x * local.x) / (LEAF_LENGTH_METERS * LEAF_LENGTH_METERS)
            + (local.y * local.y) / (LEAF_WIDTH_METERS * LEAF_WIDTH_METERS);
        let leaf = 1.0 - smoothstep(0.8, 1.0, ellipse);
        let vein = edge(abs(local.y) - LEAF_VEIN_METERS) * step(abs(local.x), LEAF_LENGTH_METERS * 0.8);
        let tint = select(GOLD, GREEN, kind > 0.66);
        painted = mix(painted, tint, leaf);
        painted = mix(painted, GOLD_DARK, vein * leaf);
    }
    return painted;
}

@fragment
fn fsKhokhloma(in: VertexOut) -> @location(0) vec4<f32> {
    let p = in.board + vec2<f32>(U.seed, U.seed * 0.618);
    var color = in.color.rgb;
    color = mix(color, GOLD_DARK, tendrils(p) * 0.9);
    let cell = floor(p / MOTIF_CELL_METERS);
    for (var dy = -1; dy <= 1; dy = dy + 1) {
        for (var dx = -1; dx <= 1; dx = dx + 1) {
            color = paintMotif(color, p, cell + vec2<f32>(f32(dx), f32(dy)));
        }
    }
    return vec4<f32>(color, in.color.a);
}
