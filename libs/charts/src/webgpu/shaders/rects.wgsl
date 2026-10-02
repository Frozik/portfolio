struct RectUniforms {
    canvas: vec2<f32>,
    dashLength: f32,
    color: vec4<f32>,
};

struct PixelRect {
    origin: vec2<f32>,
    size: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: RectUniforms;
@group(0) @binding(1) var<storage, read> rects: array<PixelRect>;

struct RectOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) distanceAlong: f32,
};

const QUAD: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0),
);

@vertex
fn vertexMain(
    @builtin(vertex_index) vertex: u32,
    @builtin(instance_index) instance: u32,
) -> RectOutput {
    let rect = rects[instance];
    let offset = QUAD[vertex] * rect.size;
    let clip = ((rect.origin + offset) / uniforms.canvas) * 2.0 - 1.0;

    var output: RectOutput;
    output.position = vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
    output.distanceAlong = select(offset.x, offset.y, rect.size.y > rect.size.x);
    return output;
}

@fragment
fn fragmentMain(input: RectOutput) -> @location(0) vec4<f32> {
    if (uniforms.dashLength > 0.0 && input.distanceAlong % (uniforms.dashLength * 2.0) >= uniforms.dashLength) {
        discard;
    }
    return uniforms.color;
}
