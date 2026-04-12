struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    lineWidth: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct EdgeInstance {
    @location(0) startPos: vec3<f32>,
    @location(1) endPos: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
};

const EDGE_COLOR: vec3<f32> = vec3<f32>(0.85, 0.9, 0.95);

/** Pipeline-overridable: 1.0 for visible edges, reduced for hidden edges */
@id(0) override edgeBrightness: f32 = 1.0;

/**
 * Each edge instance is drawn as a screen-space quad (2 triangles, 6 vertices).
 * The vertex shader expands each edge into a rectangle of `lineWidth` pixels
 * perpendicular to the line direction in screen space.
 *
 * Quad corners:
 *   0 = start−left,  1 = start−right
 *   2 = end−left,    3 = end−right
 *
 * Two triangles: (0,2,1) and (1,2,3)
 */
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    edge: EdgeInstance
) -> VertexOutput {
    // Map vertex_index (0..5) to quad corner index (0..3)
    let cornerMap = array<u32, 6>(0u, 2u, 1u, 1u, 2u, 3u);
    let corner = cornerMap[vertexIndex];

    // Decode corner: bit 1 = end vs start, bit 0 = right vs left
    let isEnd = (corner & 2u) != 0u;
    let side = f32(i32(corner & 1u)) * 2.0 - 1.0;

    // Project both endpoints to clip space
    let clipA = uniforms.mvp * vec4<f32>(edge.startPos, 1.0);
    let clipB = uniforms.mvp * vec4<f32>(edge.endPos, 1.0);

    // Select the clip position for this vertex's endpoint
    let clipPos = select(clipA, clipB, isEnd);

    // Convert to screen-space pixels for perpendicular direction computation
    let halfViewport = uniforms.viewport * 0.5;
    let screenA = (clipA.xy / clipA.w) * halfViewport;
    let screenB = (clipB.xy / clipB.w) * halfViewport;

    // Perpendicular direction in screen space
    let screenDir = screenB - screenA;
    let screenLen = length(screenDir);

    // Guard against degenerate edges (zero length)
    let safeDir = select(
        screenDir / screenLen,
        vec2<f32>(1.0, 0.0),
        screenLen < 0.001
    );
    let perp = vec2<f32>(-safeDir.y, safeDir.x);

    // Offset in pixels, then convert back to NDC
    let offsetPixels = perp * side * uniforms.lineWidth * 0.5;
    let offsetNdc = offsetPixels / halfViewport;

    var result: VertexOutput;
    result.clipPosition = vec4<f32>(
        clipPos.xy + offsetNdc * clipPos.w,
        clipPos.z,
        clipPos.w
    );
    return result;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(EDGE_COLOR * edgeBrightness, 1.0);
}
