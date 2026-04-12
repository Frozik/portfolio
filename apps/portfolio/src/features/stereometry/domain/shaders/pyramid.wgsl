struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    lineWidth: f32,
    highlightLineWidth: f32,
    highlightColor: vec3<f32>,
    vertexMarkerSize: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct EdgeInstance {
    @location(0) startPos: vec3<f32>,
    @location(1) endPos: vec3<f32>,
    @location(2) highlighted: u32,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) @interpolate(flat) isHighlighted: u32,
};

const EDGE_COLOR: vec3<f32> = vec3<f32>(1.0, 1.0, 1.0);

/** Minimum w value for near-plane clipping (prevents behind-camera artifacts) */
const NEAR_CLIP_W: f32 = 0.01;

/** Pipeline-overridable: line width for normal edges (differs between visible/hidden passes) */
@id(0) override normalLineWidth: f32 = 3.0;
/** Pipeline-overridable: line width for highlighted edges (differs between visible/hidden passes) */
@id(1) override highlightedLineWidth: f32 = 5.0;
/** Pipeline-overridable: brightness multiplier (1.0 for visible, reduced for hidden) */
@id(2) override edgeBrightness: f32 = 1.0;

/**
 * Clamps a clip-space point to the near plane by interpolating towards
 * the other endpoint. Prevents artifacts when endpoints are behind the camera.
 */
fn clampToNearPlane(point: vec4<f32>, other: vec4<f32>) -> vec4<f32> {
    if (point.w >= NEAR_CLIP_W) {
        return point;
    }
    let parametricT = (NEAR_CLIP_W - point.w) / (other.w - point.w);
    return mix(point, other, parametricT);
}

/**
 * Each edge instance is drawn as a screen-space quad (2 triangles, 6 vertices).
 * The vertex shader expands each edge into a rectangle perpendicular to
 * the line direction in screen space. Width comes from pipeline overrides
 * so visible and hidden passes can use different thicknesses.
 *
 * Endpoints are clamped to the near plane so lines can extend arbitrarily
 * far without producing thickness artifacts when behind the camera.
 *
 * Quad corners:
 *   0 = start-left,  1 = start-right
 *   2 = end-left,    3 = end-right
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
    let rawClipA = uniforms.mvp * vec4<f32>(edge.startPos, 1.0);
    let rawClipB = uniforms.mvp * vec4<f32>(edge.endPos, 1.0);

    // Clamp endpoints to near plane to prevent behind-camera artifacts
    let clipA = clampToNearPlane(rawClipA, rawClipB);
    let clipB = clampToNearPlane(rawClipB, rawClipA);

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

    // Select line width based on highlight state (overrides differ per pipeline)
    let currentLineWidth = select(normalLineWidth, highlightedLineWidth, edge.highlighted != 0u);

    // Offset in pixels, then convert back to NDC
    let offsetPixels = perp * side * currentLineWidth * 0.5;
    let offsetNdc = offsetPixels / halfViewport;

    var result: VertexOutput;
    result.clipPosition = vec4<f32>(
        clipPos.xy + offsetNdc * clipPos.w,
        clipPos.z,
        clipPos.w
    );
    result.isHighlighted = edge.highlighted;
    return result;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let baseColor = select(EDGE_COLOR, uniforms.highlightColor, input.isHighlighted != 0u);
    return vec4<f32>(baseColor * edgeBrightness, 1.0);
}
