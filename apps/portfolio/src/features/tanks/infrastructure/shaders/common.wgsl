struct Uniforms {
    // World unit -> clip space: clip = worldOffset + worldPosition * worldScale.
    worldScale: vec2<f32>,
    worldOffset: vec2<f32>,
    // Ticks since the stage started; drives the terrain shimmer frames.
    tick: f32,
    padding: f32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
