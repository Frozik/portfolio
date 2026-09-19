// The deep sky: galaxies and nebulae painted procedurally in each object's
// own frame — a unit disc, turned and squashed where the quad is — so the
// far background costs no texture and no two of them look alike. Nothing
// out here is bright: it is colour behind the board, not light on it.

struct BoardUniforms {
    viewport: vec2<f32>,   // device pixels
    origin: vec2<f32>,     // device-pixel position of the board's lower-left corner
    xAxis: vec2<f32>,      // the board's x axis in device pixels per metre
    yAxis: vec2<f32>,      // the board's y axis in device pixels per metre
    scale: f32,            // device pixels per metre
    seed: f32,             // per-level shift of the pattern, metres; unused here
    time: f32,             // seconds since the session started; unused here
    _pad: f32,
};

@group(0) @binding(0) var<uniform> U: BoardUniforms;

struct VertexIn {
    @location(0) position: vec2<f32>,
    @location(1) local: vec4<f32>,   // along, across (metres), then the frame: half length, half width
    @location(2) kind: vec4<f32>,    // x: 0 a nebula, 1 a galaxy; y: which colours; z: how brightly it burns
};

struct VertexOut {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) local: vec2<f32>,   // the object's own disc: the rim is one away from the middle
    @location(1) kind: vec3<f32>,
};

// A galaxy: two arms wound out of a bulge, cut by dust lanes, grained with stars.
const ARMS = 2.0;
const SPIRAL_PITCH = 2.7;
const ARM_SHARPNESS = 2.2;
const ARM_FALLOFF = 2.4;
const BULGE_TIGHTNESS = 16.0;
const DUST_LANES = 0.55;
const GALAXY_ALPHA = 0.3;
// A nebula: clouds of two colours, thinning to nothing well inside the rim.
const NEBULA_SCALE = 2.3;
const NEBULA_ALPHA = 0.22;
const NEBULA_EDGE = 0.85;
const OCTAVES = 4;
const TAU = 6.2831853;

const ARM_BLUE = vec3<f32>(0.62, 0.72, 1.0);
const ARM_PALE = vec3<f32>(0.88, 0.92, 1.0);
const BULGE_WARM = vec3<f32>(1.0, 0.89, 0.66);
const NEBULA_VIOLET = vec3<f32>(0.53, 0.38, 0.86);
const NEBULA_TEAL = vec3<f32>(0.26, 0.62, 0.70);
const NEBULA_ROSE = vec3<f32>(0.78, 0.42, 0.56);

@vertex
fn vsDeepSky(vertex: VertexIn) -> VertexOut {
    let pixel = U.origin + U.xAxis * vertex.position.x + U.yAxis * vertex.position.y;
    let clip = pixel / U.viewport * 2.0 - 1.0;
    var out: VertexOut;
    out.clipPosition = vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
    out.local = vec2<f32>(vertex.local.x / vertex.local.z, vertex.local.y / vertex.local.w);
    out.kind = vertex.kind.xyz;
    return out;
}

fn hash21(p: vec2<f32>) -> f32 {
    var q = fract(p * vec2<f32>(127.13, 311.7));
    q = q + dot(q, q + 34.23);
    return fract(q.x * q.y);
}

fn noise(p: vec2<f32>) -> f32 {
    let cell = floor(p);
    let into = fract(p);
    let eased = into * into * (3.0 - 2.0 * into);
    let a = hash21(cell);
    let b = hash21(cell + vec2<f32>(1.0, 0.0));
    let c = hash21(cell + vec2<f32>(0.0, 1.0));
    let d = hash21(cell + vec2<f32>(1.0, 1.0));
    return mix(mix(a, b, eased.x), mix(c, d, eased.x), eased.y);
}

fn fbm(p: vec2<f32>) -> f32 {
    var sum = 0.0;
    var amplitude = 0.5;
    var at = p;
    for (var octave = 0; octave < OCTAVES; octave = octave + 1) {
        sum = sum + amplitude * noise(at);
        at = at * 2.07 + vec2<f32>(1.7, 9.2);
        amplitude = amplitude * 0.5;
    }
    return sum;
}

/** The colours a nebula is painted in: its own, and the next one along. */
fn nebulaTint(tint: f32, step: i32) -> vec3<f32> {
    let index = (i32(tint * 3.0) + step) % 3;
    return select(select(NEBULA_ROSE, NEBULA_TEAL, index == 1), NEBULA_VIOLET, index == 0);
}

fn paintGalaxy(p: vec2<f32>, tint: f32) -> vec4<f32> {
    let away = length(p);
    if (away > 1.0) {
        return vec4<f32>(0.0);
    }
    let angle = atan2(p.y, p.x);
    // A logarithmic spiral: the arms wind tighter towards the middle, as they do.
    let winding = log(max(away, 0.03)) * SPIRAL_PITCH;
    let arms = 0.5 + 0.5 * cos(ARMS * (angle - winding) + tint * TAU);
    // The arms fade out towards the rim and are swallowed by the bulge in the middle.
    let reach = exp(-away * ARM_FALLOFF) * (1.0 - exp(-away * 7.0));
    let grain = 0.45 + 1.1 * fbm(p * 9.0 + tint * 31.0);
    let lanes = 1.0 - DUST_LANES * smoothstep(0.38, 0.85, fbm(p * 4.5 + 7.3));
    let armLight = pow(arms, ARM_SHARPNESS) * reach * grain * lanes;
    let bulge = exp(-away * away * BULGE_TIGHTNESS);
    let halo = exp(-away * 3.2) * 0.22;
    let light = armLight + bulge * 1.3 + halo;
    let color = mix(mix(ARM_BLUE, ARM_PALE, arms * 0.6), BULGE_WARM, clamp(bulge * 1.6, 0.0, 1.0));
    // The rim is cut softly, so the disc never shows the quad it is drawn in.
    let edge = smoothstep(1.0, 0.72, away);
    return vec4<f32>(color, clamp(light, 0.0, 1.6) * GALAXY_ALPHA * edge);
}

fn paintNebula(p: vec2<f32>, tint: f32) -> vec4<f32> {
    let away = length(p);
    if (away > 1.0) {
        return vec4<f32>(0.0);
    }
    let clouds = fbm(p * NEBULA_SCALE + tint * 17.0);
    let wisps = fbm(p * (NEBULA_SCALE * 2.6) + 4.1);
    let edge = smoothstep(1.0, NEBULA_EDGE * 0.35, away);
    let body = pow(clamp(clouds * 1.35 * edge, 0.0, 1.0), 1.5);
    // Knots where the cloud is thickest: the few places a nebula is nearly bright.
    let knots = smoothstep(0.72, 0.95, clouds * edge) * 0.6;
    let color = mix(nebulaTint(tint, 0), nebulaTint(tint, 1), clamp(wisps * 1.4, 0.0, 1.0));
    return vec4<f32>(color + knots * 0.4, (body + knots) * NEBULA_ALPHA);
}

@fragment
fn fsDeepSky(in: VertexOut) -> @location(0) vec4<f32> {
    let painted = select(
        paintNebula(in.local, in.kind.y),
        paintGalaxy(in.local, in.kind.y),
        in.kind.x > 0.5
    );
    return vec4<f32>(painted.rgb, painted.a * in.kind.z);
}
