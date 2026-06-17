/**
 * Unified line shader with per-fragment depth texture sampling.
 * Samples the face depth texture at the LINE CENTER (not the fragment position)
 * to decide visible/hidden style. This ensures the entire line width uses one style,
 * even when the line straddles a face edge.
 * The depth attachment is a separate line-only depth buffer for z-ordering.
 */
struct LineInstance {
    @location(0) startPos: vec3<f32>,
    @location(1) endPos: vec3<f32>,
    @location(2) visibleWidth: f32,
    @location(3) visibleColor: vec3<f32>,
    @location(4) visibleAlpha: f32,
    @location(5) visibleLineType: f32,
    @location(6) visibleDash: f32,
    @location(7) visibleGap: f32,
    @location(8) hiddenWidth: f32,
    @location(9) hiddenColor: vec3<f32>,
    @location(10) hiddenAlpha: f32,
    @location(11) hiddenLineType: f32,
    @location(12) hiddenDash: f32,
    @location(13) hiddenGap: f32,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    /** World-space distance along the segment; perspective-correct interpolation
     *  reconstructs the true world position, so the dash phase is anchored to
     *  the geometry and never crawls under camera motion */
    @location(0) lineDistance: f32,
    @location(1) @interpolate(flat) visibleColor: vec3<f32>,
    @location(2) @interpolate(flat) visibleAlpha: f32,
    @location(3) @interpolate(flat) visibleDash: f32,
    @location(4) @interpolate(flat) visibleGap: f32,
    @location(5) @interpolate(flat) hiddenColor: vec3<f32>,
    @location(6) @interpolate(flat) hiddenAlpha: f32,
    @location(7) @interpolate(flat) hiddenDash: f32,
    @location(8) @interpolate(flat) hiddenGap: f32,
    @location(9) worldDepth: f32,
    /** Clip-space endpoints for per-fragment spine depth computation */
    @location(10) @interpolate(flat) clipStart: vec4<f32>,
    @location(11) @interpolate(flat) clipEnd: vec4<f32>,
    /** Half-viewport-scaled screen endpoints, for the SDF cap/feather coverage */
    @location(12) @interpolate(flat) screenStart: vec2<f32>,
    @location(13) @interpolate(flat) screenEnd: vec2<f32>,
    @location(14) @interpolate(flat) visibleHalfWidthPx: f32,
    @location(15) @interpolate(flat) hiddenHalfWidthPx: f32,
};

@group(0) @binding(1) var faceDepth: texture_depth_2d;
@group(0) @binding(2) var depthSampler: sampler;

/**
 * Render mode filter (pipeline-overridable constant):
 *   0 = render all fragments (default, used by preview)
 *   1 = render only hidden (occluded) fragments
 *   2 = render only visible (non-occluded) fragments
 */
override renderMode: u32 = 0u;

/** Expands a line segment into a screen-space quad using max width of both styles */
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    line: LineInstance
) -> VertexOutput {
    let visibleHalfWidth = cssToGpuPixels(line.visibleWidth) * 0.5;
    let hiddenHalfWidth = cssToGpuPixels(line.hiddenWidth) * 0.5;
    let lineHalfWidth = max(visibleHalfWidth, hiddenHalfWidth);

    let corner = quadCornerIndex(vertexIndex);
    let isEnd = (corner & 2u) != 0u;
    let side = quadSideX(corner);

    let projected = projectEndpointsWithParams(line.startPos, line.endPos);
    let clipA = projected.clipA;
    let clipB = projected.clipB;
    let clipPos = select(clipA, clipB, isEnd);

    let halfViewport = uniforms.viewport * 0.5;
    let screenA = (clipA.xy / clipA.w) * halfViewport;
    let screenB = (clipB.xy / clipB.w) * halfViewport;
    let perp = computeScreenPerp(screenA, screenB);
    // Longitudinal axis (screen space); zero-length segments fall back to perp's normal
    let along = vec2<f32>(perp.y, -perp.x);

    // Extend the quad past each endpoint by half-width + feather so the SDF has
    // room to round the cap instead of clipping it to a butt end.
    let capExtend = lineHalfWidth + FEATHER_HALF_PX;
    let capSign = select(-1.0, 1.0, isEnd);
    let offsetPixels = perp * side * (lineHalfWidth + FEATHER_HALF_PX) + along * capSign * capExtend;
    let offsetNdc = pixelsToNdc(offsetPixels);

    let endpointPos = select(line.startPos, line.endPos, isEnd);

    // Dash pattern lives in world units along the segment: stable under camera
    // motion, with the pattern fitted so both segment endpoints end in a dash
    let worldLen = distance(line.endPos, line.startPos);
    let endpointParam = select(projected.paramA, projected.paramB, isEnd);
    let visiblePattern = fitDashPattern(line.visibleDash, line.visibleGap, worldLen);
    let hiddenPattern = fitDashPattern(line.hiddenDash, line.hiddenGap, worldLen);

    var result: VertexOutput;
    result.clipPosition = vec4<f32>(clipPos.xy + offsetNdc * clipPos.w, max(clipPos.z, 0.0), clipPos.w);
    result.lineDistance = endpointParam * worldLen;
    result.visibleColor = line.visibleColor;
    result.visibleAlpha = line.visibleAlpha;
    result.visibleDash = visiblePattern.x;
    result.visibleGap = visiblePattern.y;
    result.hiddenColor = line.hiddenColor;
    result.hiddenAlpha = line.hiddenAlpha;
    result.hiddenDash = hiddenPattern.x;
    result.hiddenGap = hiddenPattern.y;
    result.worldDepth = dot(endpointPos - uniforms.cameraTarget, uniforms.cameraForward);
    result.clipStart = clipA;
    result.clipEnd = clipB;
    result.screenStart = screenA;
    result.screenEnd = screenB;
    result.visibleHalfWidthPx = visibleHalfWidth;
    result.hiddenHalfWidthPx = hiddenHalfWidth;
    return result;
}

/** Renders a line fragment with occlusion test at the line center */
@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    // Per-fragment spine-point depth, shared with the line-id pass via common.wgsl
    let spine = computeSpineSample(input.clipStart, input.clipEnd, input.clipPosition);

    let faceDepthValue = textureSampleLevel(faceDepth, depthSampler, spine.uv, 0);
    let isOccluded = isDepthOccluded(faceDepthValue, spine.depth);

    // Filter by render mode: discard fragments that don't match the requested visibility
    if (renderMode == 1u && !isOccluded) { discard; }
    if (renderMode == 2u && isOccluded) { discard; }

    // Select style based on occlusion
    let color = select(input.visibleColor, input.hiddenColor, isOccluded);
    let alpha = select(input.visibleAlpha, input.hiddenAlpha, isOccluded);
    let dash = select(input.visibleDash, input.hiddenDash, isOccluded);
    let gap = select(input.visibleGap, input.hiddenGap, isOccluded);

    // Dash pattern
    let patternLength = dash + gap;
    if (patternLength > 0.0) {
        if (input.lineDistance % patternLength >= dash) {
            discard;
        }
    }

    // SDF cap/feather: round the caps and anti-alias the edges of the line at
    // the occlusion-selected width inside the (wider) max-width quad.
    let halfWidthPx = select(input.visibleHalfWidthPx, input.hiddenHalfWidthPx, isOccluded);
    let spineDistance = distanceToSpine(input.screenStart, input.screenEnd, input.clipPosition);
    let coverage = lineSdfCoverage(spineDistance, halfWidthPx);
    if (coverage <= 0.0) {
        discard;
    }

    let depthFade = depthFadeFromForwardDistance(input.worldDepth);

    return vec4<f32>(color, alpha * depthFade * coverage);
}
