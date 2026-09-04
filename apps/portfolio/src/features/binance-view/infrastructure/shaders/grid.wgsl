// Background grid: one axis-aligned rectangle per instance, in device pixels.
//
// Bindings (group 0) — must match `createGridBindGroupLayout`:
//   0: uniform     GridUniforms
//   1: storage(ro) array<GridRect>

struct GridUniforms {
    viewport: vec2<f32>,            // device pixels (full canvas)
    _pad: vec2<f32>,
};                                  // total = 16 bytes

struct GridRect {
    origin: vec2<f32>,              // top-left corner, device pixels
    size: vec2<f32>,                // width / height, device pixels
};                                  // total = 16 bytes

@group(0) @binding(0) var<uniform> U: GridUniforms;
@group(0) @binding(1) var<storage, read> rects: array<GridRect>;

override COLOR_R: f32;
override COLOR_G: f32;
override COLOR_B: f32;

// Explicit array type required for Safari/Metal (see trades.wgsl).
const QUAD_UNITS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0),
);

@vertex
fn vsGrid(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> @builtin(position) vec4<f32> {
    let rect = rects[iid];
    let pixel = rect.origin + QUAD_UNITS[vid] * rect.size;
    let clip = (pixel / U.viewport) * 2.0 - 1.0;
    return vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
}

@fragment
fn fsGrid() -> @location(0) vec4<f32> {
    return vec4<f32>(COLOR_R, COLOR_G, COLOR_B, 1.0);
}
