struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    lineWidth: f32,
    highlightLineWidth: f32,
    highlightColor: vec3<f32>,
    vertexMarkerSize: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

/** Pipeline-overridable: 1.0 = use highlight color, 0.0 = use white */
@id(0) override useHighlightColor: f32 = 1.0;
/** Pipeline-overridable: marker diameter override (0 = use uniform value) */
@id(1) override markerSizeOverride: f32 = 0.0;

const DEFAULT_MARKER_COLOR: vec3<f32> = vec3<f32>(1.0, 1.0, 1.0);

struct MarkerInstance {
    @location(0) position: vec3<f32>,
    @location(1) instanceBrightness: f32,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) quadUV: vec2<f32>,
    @location(1) @interpolate(flat) brightness: f32,
};

/**
 * Expands a single vertex position into a screen-space billboard quad.
 * Uses the same 6-vertex (2-triangle) pattern as edges.
 * The quad is centered on the projected vertex and sized by vertexMarkerSize.
 * Brightness is per-instance (computed via CPU occlusion test).
 */
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    marker: MarkerInstance,
) -> VertexOutput {
    let cornerMap = array<u32, 6>(0u, 2u, 1u, 1u, 2u, 3u);
    let corner = cornerMap[vertexIndex];

    // Decode corner: bit 1 = top vs bottom, bit 0 = right vs left
    let sideX = f32(i32(corner & 1u)) * 2.0 - 1.0;
    let sideY = f32(i32((corner >> 1u) & 1u)) * 2.0 - 1.0;

    let clipPos = uniforms.mvp * vec4<f32>(marker.position, 1.0);

    let halfViewport = uniforms.viewport * 0.5;
    let effectiveSize = select(uniforms.vertexMarkerSize, markerSizeOverride, markerSizeOverride > 0.0);
    let halfSize = effectiveSize * 0.5;

    let offsetPixels = vec2<f32>(sideX * halfSize, sideY * halfSize);
    let offsetNdc = offsetPixels / halfViewport;

    var result: VertexOutput;
    result.clipPosition = vec4<f32>(
        clipPos.xy + offsetNdc * clipPos.w,
        clipPos.z,
        clipPos.w,
    );
    result.quadUV = vec2<f32>(sideX, sideY);
    result.brightness = marker.instanceBrightness;
    return result;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let distanceSquared = dot(input.quadUV, input.quadUV);
    if (distanceSquared > 1.0) {
        discard;
    }
    let markerColor = select(DEFAULT_MARKER_COLOR, uniforms.highlightColor, useHighlightColor > 0.5);
    return vec4<f32>(markerColor * input.brightness, 1.0);
}
