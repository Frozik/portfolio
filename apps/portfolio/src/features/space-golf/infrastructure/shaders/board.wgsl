// Flat-coloured triangles in board metres, mapped onto the canvas by one
// uniform scale and origin; the board's y axis points up, the canvas's down.

struct BoardUniforms {
    viewport: vec2<f32>,   // device pixels
    origin: vec2<f32>,     // device-pixel position of the board's lower-left corner
    scale: f32,            // device pixels per metre
    _pad: f32,
};

@group(0) @binding(0) var<uniform> U: BoardUniforms;

struct VertexIn {
    @location(0) position: vec2<f32>,
    @location(1) color: vec4<f32>,
};

struct VertexOut {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@vertex
fn vsBoard(vertex: VertexIn) -> VertexOut {
    let pixel = vec2<f32>(U.origin.x + vertex.position.x * U.scale, U.origin.y - vertex.position.y * U.scale);
    let clip = pixel / U.viewport * 2.0 - 1.0;
    var out: VertexOut;
    out.clipPosition = vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
    out.color = vertex.color;
    return out;
}

@fragment
fn fsBoard(in: VertexOut) -> @location(0) vec4<f32> {
    return in.color;
}
