/**
 * Per-instance line with visible and hidden styles.
 * GPU depth test determines which style each pixel uses.
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
    @location(1) @interpolate(flat) lineColor: vec3<f32>,
    @location(2) lineAlpha: f32,
    @location(3) @interpolate(flat) lineDash: f32,
    @location(4) @interpolate(flat) lineGap: f32,
    @location(5) worldDepth: f32,
};

/** Pipeline-overridable: 0 = visible pass, 1 = hidden pass */
@id(0) override useHiddenStyle: f32 = 0.0;

/** Selects the active style (visible or hidden) and scales sizes to GPU pixels */
fn selectLineStyle(line: LineInstance) -> array<f32, 7> {
    let isHidden = useHiddenStyle > 0.5;
    return array<f32, 7>(
        cssToGpuPixels(select(line.visibleWidth, line.hiddenWidth, isHidden)),
        select(line.visibleAlpha, line.hiddenAlpha, isHidden),
        cssToGpuPixels(select(line.visibleDash, line.hiddenDash, isHidden)),
        cssToGpuPixels(select(line.visibleGap, line.hiddenGap, isHidden)),
        select(line.visibleColor.r, line.hiddenColor.r, isHidden),
        select(line.visibleColor.g, line.hiddenColor.g, isHidden),
        select(line.visibleColor.b, line.hiddenColor.b, isHidden),
    );
}

/** Projects both endpoints to clip space with near-plane clamping */
fn projectEndpoints(startPos: vec3<f32>, endPos: vec3<f32>) -> array<vec4<f32>, 2> {
    let rawClipA = uniforms.mvp * vec4<f32>(startPos, 1.0);
    let rawClipB = uniforms.mvp * vec4<f32>(endPos, 1.0);
    return array<vec4<f32>, 2>(
        clampToNearPlane(rawClipA, rawClipB),
        clampToNearPlane(rawClipB, rawClipA),
    );
}

/** Computes the perpendicular offset direction in screen space */
fn computeScreenPerp(screenA: vec2<f32>, screenB: vec2<f32>) -> vec2<f32> {
    let screenDir = screenB - screenA;
    let screenLen = length(screenDir);
    let safeDir = select(screenDir / screenLen, vec2<f32>(1.0, 0.0), screenLen < 0.001);
    return vec2<f32>(-safeDir.y, safeDir.x);
}

/** Expands a line segment into a screen-space quad */
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    line: LineInstance
) -> VertexOutput {
    let style = selectLineStyle(line);
    let lineWidth = style[0];
    let alpha = style[1];
    let dash = style[2];
    let gap = style[3];
    let color = vec3<f32>(style[4], style[5], style[6]);

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

    var result: VertexOutput;
    // Clamp z to near plane so lines extending towards the camera aren't clipped by the rasterizer
    result.clipPosition = vec4<f32>(clipPos.xy + offsetNdc * clipPos.w, max(clipPos.z, 0.0), clipPos.w);
    result.lineDistance = select(0.0, screenLen, isEnd);
    result.lineColor = color;
    result.lineAlpha = alpha;
    result.lineDash = dash;
    result.lineGap = gap;
    result.worldDepth = dot(endpointPos - uniforms.cameraTarget, uniforms.cameraForward);
    return result;
}

/** Renders a line fragment with dash pattern and depth fade */
@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let patternLength = input.lineDash + input.lineGap;
    if (patternLength > 0.0) {
        if (input.lineDistance % patternLength >= input.lineDash) {
            discard;
        }
    }

    let normalizedDepth = input.worldDepth / uniforms.cameraDistance;
    let depthFade = clamp(1.0 - normalizedDepth * uniforms.depthFadeRate, uniforms.depthFadeMin, 1.0);

    return vec4<f32>(input.lineColor, input.lineAlpha * depthFade);
}
