// Trades layer shader — consumes `trades-common.wgsl`.
//
// Volume panel: one instance per bucket, two stacked rectangles (buy on
// the bottom, sell above) whose total height is the bucket's share of the
// heaviest visible bucket. The hovered bucket's bar is brightened.

// Explicit array type required for Safari/Metal — without it the
// pipeline rejects with "Vertex library failed creation" while Chrome
// (Naga/Tint) is happy to infer `array<vec2<f32>, 6>` from the RHS.
const BAR_UNITS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, 0.0), vec2<f32>(0.5, 0.0), vec2<f32>(-0.5, 1.0),
    vec2<f32>(0.5, 0.0), vec2<f32>(0.5, 1.0), vec2<f32>(-0.5, 1.0),
);

const BAR_VERTICES_PER_RECT: u32 = 6u;

struct VolumeVsOut {
    @builtin(position) posNDC: vec4<f32>,
    @location(0) isBuy: f32,
    @location(1) isHovered: f32,
};

@vertex
fn vsVolumeBar(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VolumeVsOut {
    let bar = volumeBars[iid];
    let bottomPx = uniforms.panelTopPx + uniforms.panelHeightPx;
    let totalHeightPx = bar.volumeFraction * uniforms.panelHeightPx;
    let buyHeightPx = totalHeightPx * bar.buyFraction;
    let isBuy = vid < BAR_VERTICES_PER_RECT;
    let rectBottomPx = select(bottomPx - buyHeightPx, bottomPx, isBuy);
    let rectHeightPx = select(totalHeightPx - buyHeightPx, buyHeightPx, isBuy);

    let unit = BAR_UNITS[vid % BAR_VERTICES_PER_RECT];
    let centerX = timeDeltaToPixelX(bar.centerTimeDeltaMs);
    let pixel = vec2<f32>(centerX + unit.x * uniforms.barWidthPx, rectBottomPx - unit.y * rectHeightPx);

    var out: VolumeVsOut;
    out.posNDC = pixelToClip(pixel);
    out.isBuy = select(0.0, 1.0, isBuy);
    out.isHovered = bar.isHovered;
    return out;
}

@fragment
fn fsVolumeBar(in: VolumeVsOut) -> @location(0) vec4<f32> {
    let buy = vec3<f32>(COLOR_BUY_R, COLOR_BUY_G, COLOR_BUY_B);
    let sell = vec3<f32>(COLOR_SELL_R, COLOR_SELL_G, COLOR_SELL_B);
    let base = mix(sell, buy, in.isBuy);
    return vec4<f32>(mix(base, vec3<f32>(1.0), in.isHovered * HOVER_MIX), 1.0);
}
