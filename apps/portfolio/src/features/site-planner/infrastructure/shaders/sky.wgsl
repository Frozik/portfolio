// The backdrop of the 3D view: one triangle covering the canvas, painted with a
// vertical gradient. It binds nothing — the sky does not move with the camera,
// so the whole layer is two constants and a mix.

struct SkyVSOut {
    @builtin(position) position: vec4<f32>,
    // 0 at the top of the canvas, 1 at the bottom.
    @location(0) depth: f32,
};

// A single oversized triangle rather than a quad: one primitive, no diagonal seam.
const SKY_TRIANGLE = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, 3.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
);

const SKY_TOP_COLOR = vec3<f32>(0.039, 0.063, 0.094);
const SKY_HORIZON_COLOR = vec3<f32>(0.027, 0.035, 0.047);

@vertex
fn vsSky(@builtin(vertex_index) vertexIndex: u32) -> SkyVSOut {
    let corner = SKY_TRIANGLE[vertexIndex];

    var out: SkyVSOut;
    out.position = vec4<f32>(corner, 0.0, 1.0);
    out.depth = (1.0 - corner.y) * 0.5;

    return out;
}

@fragment
fn fsSky(in: SkyVSOut) -> @location(0) vec4<f32> {
    return vec4<f32>(mix(SKY_TOP_COLOR, SKY_HORIZON_COLOR, clamp(in.depth, 0.0, 1.0)), 1.0);
}
