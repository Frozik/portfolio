// The floaters, painted after the Mezen tradition — red ochre and soot on
// dark wood. A square carries the ornament in rows: a zigzag, a lozenge, a
// band of slanted strokes, all inside a red frame; a circle carries it in
// rings: a red rim, a ring of radial strokes, a sun in the middle. Painted
// in each floater's own frame — `along`/`across` from the centre along its
// sides, whichever way it is turned — and scaled to its size, so the small
// and the large one carry the same painting.

struct BoardUniforms {
    viewport: vec2<f32>,   // device pixels
    origin: vec2<f32>,     // device-pixel position of the board's lower-left corner
    scale: f32,            // device pixels per metre
    seed: f32,             // per-level shift of the pattern, metres
    time: f32,             // seconds since the session started; unused here
    _pad: f32,
};

@group(0) @binding(0) var<uniform> U: BoardUniforms;

struct VertexIn {
    @location(0) position: vec2<f32>,
    @location(1) local: vec4<f32>,   // along, across, side, side — metres
    @location(2) kind: vec4<f32>,    // x: 0 rows (a square), 1 rings (a circle)
};

struct VertexOut {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) local: vec4<f32>,
    @location(1) @interpolate(flat) kind: f32,
};

const WOOD = vec3<f32>(0.25, 0.10, 0.07);
const WOOD_LIGHT = vec3<f32>(0.36, 0.15, 0.09);
const OCHRE = vec3<f32>(0.80, 0.26, 0.10);
const OCHRE_DEEP = vec3<f32>(0.56, 0.15, 0.06);
const SOOT = vec3<f32>(0.07, 0.045, 0.035);

// Everything below is in the square's own units: the side is 1, the centre 0.
const FRAME_OUTER = 0.48;
const FRAME_INNER = 0.42;
const HAIRLINE = 0.39;
const LINE = 0.018;
const ROW_TOP = 0.25;
const ZIGZAG_HALF_HEIGHT = 0.07;
const ZIGZAG_PERIODS = 3.0;
const DOT_RADIUS = 0.03;
const LOZENGE_COUNT = 1.0;
const LOZENGE_RADIUS = 0.15;
const LOZENGE_DOT_RADIUS = 0.045;
const ROW_BOTTOM = -0.26;
const HATCH_HALF_HEIGHT = 0.08;
const HATCH_COUNT = 6.0;
const HATCH_SLANT = 0.7;
const HATCH_WIDTH = 0.2;
const CORNER_DOT = 0.34;
const CORNER_DOT_RADIUS = 0.035;
const INTERIOR = 0.36;
const RADIUS = 0.5;
const RIM_OUTER = 0.48;
const RIM_INNER = 0.42;
const RIM_HAIRLINE = 0.39;
const RAY_OUTER = 0.35;
const RAY_INNER = 0.24;
const RAY_COUNT = 12.0;
const RAY_WIDTH = 0.22;
const SUN_RADIUS = 0.15;
const SUN_DOT_RADIUS = 0.045;
const GRAIN_PERIOD = 40.0;
const AGE_CELLS = 24.0;
const EDGE_PIXELS = 1.2;
const TAU = 6.2831853;

@vertex
fn vsMezen(vertex: VertexIn) -> VertexOut {
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

fn soft(inside: f32, aa: f32) -> f32 {
    return 1.0 - smoothstep(-aa, aa, inside);
}

// Signed distance to a square of the given half side, in the max norm.
fn box(p: vec2<f32>, half: f32) -> f32 {
    let q = abs(p) - half;
    return max(q.x, q.y);
}

fn diamond(p: vec2<f32>, radius: f32) -> f32 {
    return abs(p.x) + abs(p.y) - radius;
}

fn triangleWave(x: f32) -> f32 {
    return abs(fract(x) - 0.5) * 4.0 - 1.0;
}

fn frame(color: vec3<f32>, p: vec2<f32>, aa: f32) -> vec3<f32> {
    let band = soft(box(p, FRAME_OUTER), aa) - soft(box(p, FRAME_INNER), aa);
    let hairline = soft(abs(box(p, HAIRLINE)) - LINE * 0.5, aa);
    var painted = mix(color, OCHRE, band);
    painted = mix(painted, SOOT, hairline);
    return painted;
}

fn zigzagRow(color: vec3<f32>, p: vec2<f32>, aa: f32) -> vec3<f32> {
    let inside = soft(abs(p.x) - INTERIOR, aa);
    let wave = ROW_TOP + ZIGZAG_HALF_HEIGHT * triangleWave(p.x * ZIGZAG_PERIODS);
    let line = soft(abs(p.y - wave) - LINE, aa) * inside;
    let trough = vec2<f32>((fract(p.x * ZIGZAG_PERIODS) - 0.5) / ZIGZAG_PERIODS, p.y - (ROW_TOP - ZIGZAG_HALF_HEIGHT * 1.9));
    let dot = soft(length(trough) - DOT_RADIUS, aa) * inside;
    var painted = mix(color, SOOT, line);
    painted = mix(painted, OCHRE, dot);
    return painted;
}

fn lozengeRow(color: vec3<f32>, p: vec2<f32>, aa: f32) -> vec3<f32> {
    let cell = vec2<f32>((fract((p.x + 0.5) * LOZENGE_COUNT) - 0.5) / LOZENGE_COUNT, p.y);
    let shape = diamond(cell, LOZENGE_RADIUS);
    let fill = soft(shape, aa);
    let outline = soft(abs(shape) - LINE * 0.6, aa);
    let center = soft(length(cell) - LOZENGE_DOT_RADIUS, aa);
    let inside = soft(abs(p.x) - INTERIOR, aa);
    var painted = mix(color, OCHRE, fill * inside);
    painted = mix(painted, SOOT, outline * inside);
    painted = mix(painted, SOOT, center * inside);
    return painted;
}

fn hatchRow(color: vec3<f32>, p: vec2<f32>, aa: f32) -> vec3<f32> {
    let inside = soft(abs(p.x) - INTERIOR, aa);
    let rail = soft(abs(abs(p.y - ROW_BOTTOM) - HATCH_HALF_HEIGHT) - LINE * 0.5, aa) * inside;
    let slanted = p.x + (p.y - ROW_BOTTOM) * HATCH_SLANT;
    let stroke = soft(abs(fract(slanted * HATCH_COUNT) - 0.5) - HATCH_WIDTH, aa)
        * soft(abs(p.y - ROW_BOTTOM) - HATCH_HALF_HEIGHT * 0.75, aa) * inside;
    var painted = mix(color, OCHRE_DEEP, stroke);
    painted = mix(painted, SOOT, rail);
    return painted;
}

fn cornerDots(color: vec3<f32>, p: vec2<f32>, aa: f32) -> vec3<f32> {
    let dot = soft(length(abs(p) - CORNER_DOT) - CORNER_DOT_RADIUS, aa);
    return mix(color, SOOT, dot);
}

fn rows(color: vec3<f32>, p: vec2<f32>, aa: f32) -> vec3<f32> {
    var painted = frame(color, p, aa);
    painted = zigzagRow(painted, p, aa);
    painted = lozengeRow(painted, p, aa);
    painted = hatchRow(painted, p, aa);
    return cornerDots(painted, p, aa);
}

fn rings(color: vec3<f32>, p: vec2<f32>, aa: f32) -> vec3<f32> {
    let r = length(p);
    let rim = soft(r - RIM_OUTER, aa) - soft(r - RIM_INNER, aa);
    let hairline = soft(abs(r - RIM_HAIRLINE) - LINE * 0.5, aa);
    let angle = atan2(p.y, p.x) / TAU;
    let ray = soft(abs(fract(angle * RAY_COUNT) - 0.5) - RAY_WIDTH, aa)
        * (soft(r - RAY_OUTER, aa) - soft(r - RAY_INNER, aa));
    let rails = soft(abs(r - RAY_OUTER) - LINE * 0.5, aa) + soft(abs(r - RAY_INNER) - LINE * 0.5, aa);
    let sun = soft(r - SUN_RADIUS, aa);
    let sunOutline = soft(abs(r - SUN_RADIUS) - LINE * 0.6, aa);
    let sunDot = soft(r - SUN_DOT_RADIUS, aa);
    var painted = mix(color, OCHRE, rim);
    painted = mix(painted, SOOT, hairline);
    painted = mix(painted, OCHRE_DEEP, ray);
    painted = mix(painted, SOOT, min(rails, 1.0));
    painted = mix(painted, OCHRE, sun);
    painted = mix(painted, SOOT, sunOutline);
    painted = mix(painted, SOOT, sunDot);
    return painted;
}

@fragment
fn fsMezen(in: VertexOut) -> @location(0) vec4<f32> {
    let side = in.local.z;
    let p = in.local.xy / side;
    let aa = EDGE_PIXELS / (U.scale * side);

    let grain = 0.5 + 0.5 * sin(p.y * GRAIN_PERIOD + 2.5 * sin(p.x * 9.0 + U.seed));
    var color = mix(WOOD, WOOD_LIGHT, grain * 0.55);
    var alpha = 1.0;
    if (in.kind > 0.5) {
        color = rings(color, p, aa);
        alpha = soft(length(p) - RADIUS, aa);
    } else {
        color = rows(color, p, aa);
    }

    // Age: the paint is worn unevenly, a little darker here and there.
    let wear = 0.9 + 0.1 * hash21(floor(p * AGE_CELLS) + U.seed);
    return vec4<f32>(color * wear, alpha);
}
