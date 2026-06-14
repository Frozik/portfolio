struct CompositeUniforms {
    opacity: f32,
};

struct CompositeVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var offscreenTex: texture_2d<f32>;
@group(0) @binding(1) var offscreenSampler: sampler;
@group(0) @binding(2) var<uniform> CU: CompositeUniforms;

// Fullscreen triangle: 3 vertices covering the entire screen
@vertex
fn vsComposite(@builtin(vertex_index) vid: u32) -> CompositeVSOut {
    var out: CompositeVSOut;

    // Generates a large triangle that covers the viewport:
    // vid=0: (-1, -1), vid=1: (3, -1), vid=2: (-1, 3)
    let x = f32(vid & 1u) * 4.0 - 1.0;
    let y = f32((vid >> 1u) & 1u) * 4.0 - 1.0;

    out.position = vec4<f32>(x, y, 0.0, 1.0);
    // Map from clip space to UV: x: [-1,1] -> [0,1], y: [-1,1] -> [1,0] (flip Y)
    out.uv = vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5);

    return out;
}

@fragment
fn fsComposite(in: CompositeVSOut) -> @location(0) vec4<f32> {
    let color = textureSample(offscreenTex, offscreenSampler, in.uv);
    // Apply layer opacity -- multiply alpha by the uniform opacity
    // Output premultiplied alpha for correct blending
    return vec4<f32>(color.rgb * CU.opacity, color.a * CU.opacity);
}
