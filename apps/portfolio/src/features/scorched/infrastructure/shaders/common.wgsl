struct Uniforms {
    // World unit -> clip space: clip = worldOffset + worldPosition * worldScale. World y points
    // up, matching the domain's bottom-left origin.
    worldScale: vec2<f32>,
    worldOffset: vec2<f32>,
    fieldSize: vec2<f32>,
    // Seconds since the renderer started; drives the sky twinkle.
    timeSeconds: f32,
    // How far past the field the sky and terrain quads reach, so a screen shake can slide the
    // world without exposing the letterbox behind it.
    shakeOverscanWu: f32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;

fn worldToClip(worldPosition: vec2<f32>) -> vec4<f32> {
    return vec4<f32>(U.worldOffset + worldPosition * U.worldScale, 0.0, 1.0);
}
