struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    dpr: f32,
    cameraDistance: f32,
    cameraForward: vec3<f32>,
    cameraTarget: vec3<f32>,
    depthFadeRate: f32,
    depthFadeMin: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

/** Number of vertices per quad (2 triangles = 6 vertices) */
const VERTICES_PER_QUAD: u32 = 6u;

/** Minimum w value for near-plane clipping (prevents behind-camera artifacts) */
const NEAR_CLIP_W: f32 = 0.01;

/** Maps vertex index (0..5) to quad corner index (0..3) */
fn quadCornerIndex(vertexIndex: u32) -> u32 {
    let cornerMap = array<u32, 6>(0u, 2u, 1u, 1u, 2u, 3u);
    return cornerMap[vertexIndex];
}

/** Decodes quad corner: returns (-1 or +1) for left/right side */
fn quadSideX(corner: u32) -> f32 {
    return f32(i32(corner & 1u)) * 2.0 - 1.0;
}

/** Decodes quad corner: returns (-1 or +1) for bottom/top side */
fn quadSideY(corner: u32) -> f32 {
    return f32(i32((corner >> 1u) & 1u)) * 2.0 - 1.0;
}

/** Converts a pixel offset to NDC offset, accounting for viewport size */
fn pixelsToNdc(pixels: vec2<f32>) -> vec2<f32> {
    return pixels / (uniforms.viewport * 0.5);
}

/** Scales a CSS-pixel size to GPU pixels using device pixel ratio */
fn cssToGpuPixels(cssSize: f32) -> f32 {
    return cssSize * uniforms.dpr;
}

/** Depth fade factor from a forward distance along the camera axis (camera-target space).
 *  Only fades objects behind the target (further from camera), not in front of it.
 *  Mirrored on the CPU by `depthFadeAt` in domain/solution-preview.ts for the SVG previews:
 *  change both together. */
fn depthFadeFromForwardDistance(forwardDistance: f32) -> f32 {
    let normalizedDepth = forwardDistance / uniforms.cameraDistance;
    return clamp(1.0 - normalizedDepth * uniforms.depthFadeRate, uniforms.depthFadeMin, 1.0);
}

/** Computes depth fade factor based on world-space distance from camera target. */
fn computeDepthFade(worldPosition: vec3<f32>) -> f32 {
    let toPoint = worldPosition - uniforms.cameraTarget;
    return depthFadeFromForwardDistance(dot(toPoint, uniforms.cameraForward));
}

/** Projected endpoints with the parametric positions they were clamped to */
struct ProjectedEndpoints {
    clipA: vec4<f32>,
    clipB: vec4<f32>,
    /** Position of clipA along the original A→B segment (0 unless near-plane clamped) */
    paramA: f32,
    /** Position of clipB along the original A→B segment (1 unless near-plane clamped) */
    paramB: f32,
};

/**
 * Projects both endpoints to clip space with near-plane clamping and reports
 * where on the original segment each projected endpoint sits. The parameters
 * let dash phases stay anchored to the world-space segment even when an
 * endpoint is clamped (the clamp point slides along the line as the camera moves).
 */
fn projectEndpointsWithParams(startPos: vec3<f32>, endPos: vec3<f32>) -> ProjectedEndpoints {
    let rawClipA = uniforms.mvp * vec4<f32>(startPos, 1.0);
    let rawClipB = uniforms.mvp * vec4<f32>(endPos, 1.0);

    var result: ProjectedEndpoints;
    result.clipA = rawClipA;
    result.clipB = rawClipB;
    result.paramA = 0.0;
    result.paramB = 1.0;

    if (rawClipA.w < NEAR_CLIP_W) {
        let parametricT = (NEAR_CLIP_W - rawClipA.w) / (rawClipB.w - rawClipA.w);
        result.clipA = mix(rawClipA, rawClipB, parametricT);
        result.paramA = parametricT;
    }
    if (rawClipB.w < NEAR_CLIP_W) {
        let parametricT = (NEAR_CLIP_W - rawClipB.w) / (rawClipA.w - rawClipB.w);
        result.clipB = mix(rawClipB, rawClipA, parametricT);
        result.paramB = 1.0 - parametricT;
    }
    return result;
}

/** Projects both endpoints to clip space with near-plane clamping */
fn projectEndpoints(startPos: vec3<f32>, endPos: vec3<f32>) -> array<vec4<f32>, 2> {
    let projected = projectEndpointsWithParams(startPos, endPos);
    return array<vec4<f32>, 2>(projected.clipA, projected.clipB);
}

/**
 * Scales a dash pattern so an integer number of dashes fits a segment of
 * totalLen, with a dash (not a gap) touching both endpoints:
 *   totalLen = n * (dash + gap) - gap
 * Segments shorter than one dash render fully solid. totalLen is constant
 * under camera motion (world units), so the fitted pattern is stable.
 */
fn fitDashPattern(dashLen: f32, gapLen: f32, totalLen: f32) -> vec2<f32> {
    if (dashLen <= 0.0 || gapLen <= 0.0 || totalLen <= 0.0) {
        return vec2<f32>(dashLen, gapLen);
    }
    let period = dashLen + gapLen;
    let dashCount = max(1.0, round((totalLen + gapLen) / period));
    let scale = totalLen / (dashCount * period - gapLen);
    return vec2<f32>(dashLen * scale, gapLen * scale);
}

/** Computes the perpendicular offset direction in screen space */
fn computeScreenPerp(screenA: vec2<f32>, screenB: vec2<f32>) -> vec2<f32> {
    let screenDir = screenB - screenA;
    let screenLen = length(screenDir);
    let safeDir = select(screenDir / screenLen, vec2<f32>(1.0, 0.0), screenLen < 0.001);
    return vec2<f32>(-safeDir.y, safeDir.x);
}

/** Result of projecting a fragment onto the line spine (segment A→B) */
struct SpineSample {
    /** Face-depth-texture UV at the spine point */
    uv: vec2<f32>,
    /** NDC depth at the spine point */
    depth: f32,
};

/**
 * Projects a fragment position onto the line spine and returns the depth-texture
 * UV plus the interpolated NDC depth at that spine point. Used by both the color
 * line pass and the line-id pass so their occlusion classification stays in sync.
 *
 * UV is derived from the screen-space spine position (exact, no perspective error).
 * Depth is a linear interpolation of NDC depths (mathematically correct for
 * screen-space t).
 *
 * IMPORTANT: endpoint depths must stay UNCLAMPED (z/w may legitimately be ≤ 0
 * for the near-plane-clamped end of a long line). Clamping z to 0 here corrupts
 * the screen-space linear depth interpolation along the whole line and
 * misclassifies lines passing in FRONT of faces as hidden once they leave the
 * face outline (regression history: "fix: fixed line visibility depth test").
 * The vertex stage clamps quad-corner z for rasterization only — that clamp
 * must not be repeated for the depth comparison.
 */
fn computeSpineSample(
    clipStart: vec4<f32>,
    clipEnd: vec4<f32>,
    fragmentPosition: vec4<f32>
) -> SpineSample {
    let halfViewport = uniforms.viewport * 0.5;
    let screenA = (clipStart.xy / clipStart.w) * halfViewport;
    let screenB = (clipEnd.xy / clipEnd.w) * halfViewport;
    // @builtin(position).y increases downward, but NDC Y increases upward — invert Y
    let fragmentScreen = vec2<f32>(
        fragmentPosition.x - halfViewport.x,
        halfViewport.y - fragmentPosition.y
    );

    let lineDir = screenB - screenA;
    let lineLenSq = dot(lineDir, lineDir);
    let parametricT = select(
        clamp(dot(fragmentScreen - screenA, lineDir) / lineLenSq, 0.0, 1.0),
        0.5,
        lineLenSq < 0.001
    );

    let spineScreen = screenA + parametricT * lineDir;
    let spineNdc = spineScreen / halfViewport;
    let depthA = clipStart.z / clipStart.w;
    let depthB = clipEnd.z / clipEnd.w;

    var result: SpineSample;
    result.uv = spineNdc * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);
    result.depth = mix(depthA, depthB, parametricT);
    return result;
}
