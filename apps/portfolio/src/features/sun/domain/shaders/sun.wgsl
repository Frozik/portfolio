const PI: f32 = 3.1415926535;
const TWO_PI: f32 = PI * 2.0;
// Keep in sync with INSTANCE_COUNT in sun-constants.ts
const INSTANCE_COUNT: f32 = 100000.0;
const SPHERE_RADIUS: f32 = 5.0;
const TRIANGLE_HALF_SIZE: f32 = 0.25;
const EVERY_NTH_CENTER_LINE: f32 = 50.0;

// Golden angle ~ 2.39996322972865332...
// For range reduction we compute (GOLDEN_ANGLE * instID) mod TWO_PI
// using extended precision to avoid the f32 seam artifact.
// Split 2pi into high + low: TWO_PI = TP_HI + TP_LO
const GOLDEN_ANGLE: f32 = 2.3999632297286533;
const INV_TWO_PI: f32 = 0.15915494309189535;
const TP_HI: f32 = 6.28125;       // exact in f32 (few mantissa bits)
const TP_LO: f32 = 0.0019353071795864769; // TWO_PI - TP_HI

struct Uniforms {
    time: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
    mvp: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> U: Uniforms;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

fn random(v3: vec3<f32>) -> f32 {
    return fract(sin(dot(v3, vec3<f32>(12.9898, 78.233, 34.258))) * 43758.5453123);
}

fn square(s: f32) -> f32 {
    return s * s;
}

fn neonGradient(val: f32) -> vec3<f32> {
    return clamp(
        vec3<f32>(
            val * 1.3 + 0.1,
            square(abs(0.43 - val) * 1.7),
            (1.0 - val) * 1.7,
        ),
        vec3<f32>(0.0, 0.0, 0.0),
        vec3<f32>(1.0, 1.0, 1.0),
    );
}

// Cody-Waite range reduction: compute (GOLDEN_ANGLE * instID) mod 2pi
// with extended precision to avoid seam artifacts from f32 rounding.
fn reducedTheta(instID: f32) -> f32 {
    let raw = GOLDEN_ANGLE * instID;
    let n = floor(raw * INV_TWO_PI);
    // Subtract n*2pi in two steps for precision: raw - n*TP_HI - n*TP_LO
    return (raw - n * TP_HI) - n * TP_LO;
}

fn instPos(instID: f32) -> vec3<f32> {
    let y = 1.0 - (instID / (INSTANCE_COUNT - 1.0)) * 2.0;
    let radius = sqrt(1.0 - square(y));
    let theta = reducedTheta(instID);

    let x = cos(theta) * radius;
    let z = sin(theta) * radius;

    return vec3<f32>(x, y, z) * SPHERE_RADIUS;
}

fn rot2d(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, s, -s, c);
}

// Build an orthonormal basis from a normal vector (no polar singularities).
// Uses the Pixar method (Duff et al. 2017) which is stable for all directions.
fn buildBasis(n: vec3<f32>) -> mat3x3<f32> {
    let sign = select(-1.0, 1.0, n.z >= 0.0);
    let a = -1.0 / (sign + n.z);
    let b = n.x * n.y * a;
    let tangent = vec3<f32>(1.0 + sign * n.x * n.x * a, sign * b, -sign * n.x);
    let bitangent = vec3<f32>(b, sign + n.y * n.y * a, -n.y);
    return mat3x3<f32>(tangent, bitangent, n);
}

@vertex
fn vs(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    let time = U.time * 0.1;
    let instID = f32(iid);

    // Triangle vertex position (equilateral triangle in XY plane)
    var pos = vec3<f32>(0.0, TRIANGLE_HALF_SIZE, 0.0);
    let angle = f32(vid) * TWO_PI / 3.0;
    let rotated = rot2d(angle) * pos.xy;
    pos = vec3<f32>(rotated, 0.0);

    // Instance position on sphere (golden spiral)
    let iPos = instPos(instID);
    let normal = normalize(iPos);

    // Time-based animation
    let shift = random(iPos) * 2.0 - 1.0;
    let sinVal = abs(sin(TWO_PI * (shift + time)));
    pos *= (1.0 - sinVal) * 0.99 + 0.01;

    // Spin the triangle
    let spinRotated = rot2d(TWO_PI * (shift + time * shift)) * pos.xy;
    pos = vec3<f32>(spinRotated, pos.z);

    // Orient triangle to face outward using stable orthonormal basis
    let basis = buildBasis(normal);
    pos = basis * pos;

    // Offset from center + push outward by sinVal
    pos = pos + iPos + normal * sinVal;

    // Every 50th instance: first vertex draws a line to center
    var finalPos: vec4<f32>;
    if (vid == 0u && (u32(instID) % u32(EVERY_NTH_CENTER_LINE)) == 0u) {
        finalPos = U.mvp * vec4<f32>(0.0, 0.0, 0.0, 1.0);
    } else {
        finalPos = U.mvp * vec4<f32>(pos, 1.0);
    }

    var out: VSOut;
    out.position = finalPos;
    out.color = neonGradient(0.6 + sinVal * 0.4);
    return out;
}

@fragment
fn fs(input: VSOut) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 1.0);
}
