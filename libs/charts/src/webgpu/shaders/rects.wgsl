struct RectUniforms {
    canvas: vec2<f32>,
    color: vec4<f32>,
    // Nought solid, one dashed, two a zigzag.
    pattern: f32,
    // The dash and its gap, or the period of the zigzag.
    length: f32,
    thickness: f32,
};

struct PixelRect {
    origin: vec2<f32>,
    size: vec2<f32>,
};

const SOLID: f32 = 0.0;
const DASHED: f32 = 1.0;
const ZIGZAG: f32 = 2.0;

@group(0) @binding(0) var<uniform> uniforms: RectUniforms;
@group(0) @binding(1) var<storage, read> rects: array<PixelRect>;

struct RectOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) distanceAlong: f32,
    @location(1) distanceAcross: f32,
    @location(2) sizeAcross: f32,
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
    let isTall = rect.size.y > rect.size.x;

    var output: RectOutput;
    output.position = vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
    output.distanceAlong = select(offset.x, offset.y, isTall);
    output.distanceAcross = select(offset.y, offset.x, isTall);
    output.sizeAcross = select(rect.size.y, rect.size.x, isTall);
    return output;
}

// A triangle wave between -1 and 1 with the period one, at 1 on the whole numbers.
fn triangle(phase: f32) -> f32 {
    return abs(fract(phase) - 0.5) * 4.0 - 1.0;
}

// How much of the pixel the zigzag line covers: its distance from the line, softened over one pixel.
fn zigzagCoverage(input: RectOutput) -> f32 {
    let amplitude = max(0.0, (input.sizeAcross - uniforms.thickness) / 2.0);
    let centre = input.sizeAcross / 2.0 + amplitude * triangle(input.distanceAlong / uniforms.length);
    // The line is measured across the rect; its slope makes it wider there than it is thick.
    let slope = 4.0 * amplitude / uniforms.length;
    let halfWidth = uniforms.thickness * sqrt(1.0 + slope * slope) / 2.0;
    return clamp(halfWidth + 0.5 - abs(input.distanceAcross - centre), 0.0, 1.0);
}

@fragment
fn fragmentMain(input: RectOutput) -> @location(0) vec4<f32> {
    if (uniforms.pattern == DASHED && input.distanceAlong % (uniforms.length * 2.0) >= uniforms.length) {
        discard;
    }
    if (uniforms.pattern == ZIGZAG) {
        return uniforms.color * zigzagCoverage(input);
    }
    return uniforms.color;
}
