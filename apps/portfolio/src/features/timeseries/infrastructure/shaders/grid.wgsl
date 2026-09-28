// Dashed grid under the series: one axis-aligned rectangle per instance, in
// device pixels measured from the top-left canvas corner.

struct GridUniforms {
    viewport: vec2<f32>,
    dashLength: f32,
    opacity: f32,
};

struct GridLine {
    origin: vec2<f32>,
    size: vec2<f32>,
};

@group(0) @binding(0) var<uniform> U: GridUniforms;
@group(0) @binding(1) var<storage, read> gridLines: array<GridLine>;

override COLOR_R: f32;
override COLOR_G: f32;
override COLOR_B: f32;

struct GridVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) distanceAlongLine: f32,
};

const QUAD_UNITS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0),
);

@vertex
fn vsGrid(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> GridVSOut {
    var out: GridVSOut;

    let gridLine = gridLines[iid];
    let offset = QUAD_UNITS[vid] * gridLine.size;
    let clip = ((gridLine.origin + offset) / U.viewport) * 2.0 - 1.0;

    out.position = vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
    out.distanceAlongLine = select(offset.x, offset.y, gridLine.size.y > gridLine.size.x);

    return out;
}

@fragment
fn fsGrid(in: GridVSOut) -> @location(0) vec4<f32> {
    if (in.distanceAlongLine % (U.dashLength * 2.0) >= U.dashLength) {
        discard;
    }
    return vec4<f32>(COLOR_R, COLOR_G, COLOR_B, U.opacity);
}
