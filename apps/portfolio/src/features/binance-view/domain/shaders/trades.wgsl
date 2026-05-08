// Trades layer shader — consumes `trades-common.wgsl`.
//
// Instancing scheme: one instance per visible bucket, 6 vertices each
// (two triangles forming a screen-aligned quad in `[-1, 1]` uv space).
// The fragment shader inscribes a circle inside the quad, splits it
// into a buy / sell pie sector by `buyFraction`, and stamps a cyan
// outline ring of constant device-pixel thickness on top.

// Explicit array type required for Safari/Metal — without it the
// pipeline rejects with "Vertex library failed creation" while Chrome
// (Naga/Tint) is happy to infer `array<vec2<f32>, 6>` from the RHS.
const QUAD_POSITIONS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0), vec2<f32>(-1.0,  1.0),
);

struct VsOut {
    @builtin(position) posNDC: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) buyFraction: f32,
    @location(2) radiusPx: f32,
    @location(3) fillOpacity: f32,
};

@vertex
fn vsTrade(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VsOut {
    let descriptor = descriptors[iid];

    // World → NDC. Time deltaMs in `[viewTimeStartDeltaMs, viewTimeEndDeltaMs]`
    // maps to NDC x in `[-1, -1 + 2 * plotXNorm]`; the rightmost
    // `1 - plotXNorm` slice of the canvas is reserved for the Y-axis
    // panel and must stay clear of bucket geometry.
    let timeRange = uniforms.viewTimeEndDeltaMs - uniforms.viewTimeStartDeltaMs;
    let normTime = (descriptor.centerTimeDeltaMs - uniforms.viewTimeStartDeltaMs) / timeRange;
    let plotXNorm = uniforms.plotWidthPx / uniforms.canvasW;
    let centerX_NDC = -1.0 + 2.0 * normTime * plotXNorm;

    // Price: `centerPriceDelta` is `vwap - priceMin` already de-biased
    // by the CPU side (keeps shader math in low-magnitude floats).
    let priceRange = uniforms.priceMax - uniforms.priceMin;
    let centerY_NDC = -1.0 + 2.0 * (descriptor.centerPriceDelta / priceRange);

    let quad = QUAD_POSITIONS[vid];
    let radiusNdc = vec2<f32>(
        descriptor.radiusPx / uniforms.canvasW * 2.0,
        descriptor.radiusPx / uniforms.canvasH * 2.0,
    );
    let posNdc = vec2<f32>(centerX_NDC, centerY_NDC) + quad * radiusNdc;

    var out: VsOut;
    out.posNDC = vec4<f32>(posNdc, 0.0, 1.0);
    out.uv = quad;
    out.buyFraction = descriptor.buyFraction;
    out.radiusPx = descriptor.radiusPx;
    out.fillOpacity = descriptor.fillOpacity;
    return out;
}

@fragment
fn fsTrade(in: VsOut) -> @location(0) vec4<f32> {
    let dist = length(in.uv);
    let aaUv = AA_WIDTH_PX / in.radiusPx;

    // Outer AA: smooth fade at the rim of the inscribed circle (r = 1
    // in uv space). Anything beyond the rim contributes alpha 0.
    let outerR = 1.0;
    let alphaO = 1.0 - smoothstep(outerR - aaUv, outerR, dist);

    // Stroke / fill boundary: smoothstep across `innerR` so the
    // outline ring blends cleanly into the coloured core.
    let innerR = 1.0 - OUTLINE_PX / in.radiusPx;
    let isOutline = smoothstep(innerR - aaUv, innerR + aaUv, dist);

    // Pie split — 12 o'clock = uv (0, 1), going clockwise.
    // `atan2(uv.x, uv.y)` returns 0 at 12 o'clock and grows clockwise
    // for `uv.x > 0`; remap into `[0, 1)`.
    let TAU: f32 = 6.28318530718;
    let raw = atan2(in.uv.x, in.uv.y);
    let normAngle = select(raw, raw + TAU, raw < 0.0) / TAU;

    var isBuyMix: f32;
    if (in.buyFraction <= 0.0) {
        isBuyMix = 0.0;
    } else if (in.buyFraction >= 1.0) {
        isBuyMix = 1.0;
    } else {
        isBuyMix = 1.0 - smoothstep(in.buyFraction - aaUv, in.buyFraction + aaUv, normAngle);
    }

    let COLOR_BUY     = vec3<f32>(COLOR_BUY_R,     COLOR_BUY_G,     COLOR_BUY_B);
    let COLOR_SELL    = vec3<f32>(COLOR_SELL_R,    COLOR_SELL_G,    COLOR_SELL_B);
    let COLOR_OUTLINE = vec3<f32>(COLOR_OUTLINE_R, COLOR_OUTLINE_G, COLOR_OUTLINE_B);

    let fillRGB = mix(COLOR_SELL, COLOR_BUY, isBuyMix);
    let rgb = mix(fillRGB, COLOR_OUTLINE, isOutline);

    // Size-driven fill opacity — bigger circles fade so the heatmap
    // underneath stays readable. Outline (`isOutline ≈ 1`) keeps full
    // alpha; only the fill area is multiplied. With OUTLINE_PX = 0
    // there's no outline ring and the whole circle gets the opacity.
    let alphaMult = mix(in.fillOpacity, 1.0, isOutline);
    let finalAlpha = alphaO * alphaMult;

    // Premultiplied alpha so this layer composes cleanly over the
    // heatmap / mid-price passes that already use the same blend.
    return vec4<f32>(rgb * finalAlpha, finalAlpha);
}
