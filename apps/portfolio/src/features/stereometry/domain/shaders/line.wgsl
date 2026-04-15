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
    @location(0) @interpolate(linear) lineDistance: f32,
    @location(1) @interpolate(flat) visibleColor: vec3<f32>,
    @location(2) @interpolate(flat) visibleAlpha: f32,
    @location(3) @interpolate(flat) visibleDash: f32,
    @location(4) @interpolate(flat) visibleGap: f32,
    @location(5) @interpolate(flat) hiddenColor: vec3<f32>,
    @location(6) @interpolate(flat) hiddenAlpha: f32,
    @location(7) @interpolate(flat) hiddenDash: f32,
    @location(8) @interpolate(flat) hiddenGap: f32,
    @location(9) worldDepth: f32,
    /** Line center UV for depth sampling (without width offset) */
    @location(10) @interpolate(linear) lineCenterUV: vec2<f32>,
    /** Line center NDC depth for occlusion comparison */
    @location(11) @interpolate(linear) lineCenterDepth: f32,
};

@group(0) @binding(1) var faceDepth: texture_depth_2d;
@group(0) @binding(2) var depthSampler: sampler;


/** Expands a line segment into a screen-space quad using max width of both styles */
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    line: LineInstance
) -> VertexOutput {
    let lineWidth = max(cssToGpuPixels(line.visibleWidth), cssToGpuPixels(line.hiddenWidth));

    let corner = quadCornerIndex(vertexIndex);
    let isEnd = (corner & 2u) != 0u;
    let side = quadSideX(corner);

    let clips = projectEndpoints(line.startPos, line.endPos);
    let clipA = clips[0];
    let clipB = clips[1];
    let clipPos = select(clipA, clipB, isEnd);

    let halfViewport = uniforms.viewport * 0.5;
    let screenA = (clipA.xy / clipA.w) * halfViewport;
    let screenB = (clipB.xy / clipB.w) * halfViewport;
    let perp = computeScreenPerp(screenA, screenB);

    let offsetNdc = pixelsToNdc(perp * side * lineWidth * 0.5);
    let screenLen = length(screenB - screenA);

    let endpointPos = select(line.startPos, line.endPos, isEnd);

    // Line center position (without perpendicular width offset)
    let centerNdcXY = clipPos.xy / clipPos.w;
    let centerUV = centerNdcXY * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);
    let centerDepth = max(clipPos.z, 0.0) / clipPos.w;

    var result: VertexOutput;
    result.clipPosition = vec4<f32>(clipPos.xy + offsetNdc * clipPos.w, max(clipPos.z, 0.0), clipPos.w);
    result.lineDistance = select(0.0, screenLen, isEnd);
    result.visibleColor = line.visibleColor;
    result.visibleAlpha = line.visibleAlpha;
    result.visibleDash = cssToGpuPixels(line.visibleDash);
    result.visibleGap = cssToGpuPixels(line.visibleGap);
    result.hiddenColor = line.hiddenColor;
    result.hiddenAlpha = line.hiddenAlpha;
    result.hiddenDash = cssToGpuPixels(line.hiddenDash);
    result.hiddenGap = cssToGpuPixels(line.hiddenGap);
    result.worldDepth = dot(endpointPos - uniforms.cameraTarget, uniforms.cameraForward);
    result.lineCenterUV = centerUV;
    result.lineCenterDepth = centerDepth;
    return result;
}

/** Renders a line fragment with occlusion test at the line center */
@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    // Sample face depth at the LINE CENTER, not the fragment position.
    // This makes the entire line width use one style (visible or hidden).
    let faceDepthValue = textureSampleLevel(faceDepth, depthSampler, input.lineCenterUV, 0);
    let isOccluded = faceDepthValue < input.lineCenterDepth;

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

    // Depth fade
    let normalizedDepth = input.worldDepth / uniforms.cameraDistance;
    let depthFade = clamp(1.0 - normalizedDepth * uniforms.depthFadeRate, uniforms.depthFadeMin, 1.0);

    return vec4<f32>(color, alpha * depthFade);
}
