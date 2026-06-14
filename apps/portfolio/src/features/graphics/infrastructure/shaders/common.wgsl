struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    time: f32,
    sinCount: u32,
    sinPenMin: f32,
    sinPenMax: f32,
    borderMargin: f32,
    borderOffset: u32,
    sinYCount: u32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
