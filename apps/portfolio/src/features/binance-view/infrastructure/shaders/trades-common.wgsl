// Shared WGSL declarations for the trades layer.
//
// Bindings (group 0) — must match `createTradesBindGroupLayout`:
//   0: uniform       TradesUniforms             (vertex)
//   1: storage(ro)   array<VolumeBarDescriptor> (vertex)
//
// Every bucket is fed through a storage buffer (one descriptor per visible
// bucket) instead of a sparse data-texture; the bucket count is small
// enough for that to win on simplicity.

struct TradesUniforms {
    canvasW: f32,                   // device pixels
    canvasH: f32,                   // device pixels
    plotWidthPx: f32,               // device pixels of the plot area (canvas - Y-axis panel)
    viewTimeStartDeltaMs: f32,      // view window start, relative to the global anchor
    viewTimeEndDeltaMs: f32,        // view window end,   relative to the global anchor
    panelTopPx: f32,                // device-pixel y where the volume panel starts
    panelHeightPx: f32,             // device-pixel height of the volume panel
    barWidthPx: f32,                // device-pixel width of one volume bar
    _pad0: f32, _pad1: f32, _pad2: f32, _pad3: f32,
    _pad4: f32, _pad5: f32, _pad6: f32, _pad7: f32,
};                                  // total = 64 bytes

struct VolumeBarDescriptor {
    centerTimeDeltaMs: f32,         // bucket centre - viewTimeStart anchor
    volumeFraction: f32,            // bucket volume / max visible volume, in [0, 1]
    buyFraction: f32,               // notional buy fraction in [0, 1]
    isHovered: f32,                 // 1 for the bucket under the pointer
};                                  // total = 16 bytes

// `override` constants without default values are required to be
// supplied via `constants: {}` at pipeline creation time.
override HOVER_MIX:         f32;
override COLOR_BUY_R:       f32;
override COLOR_BUY_G:       f32;
override COLOR_BUY_B:       f32;
override COLOR_SELL_R:      f32;
override COLOR_SELL_G:      f32;
override COLOR_SELL_B:      f32;

@group(0) @binding(0) var<uniform> uniforms: TradesUniforms;
@group(0) @binding(1) var<storage, read> volumeBars: array<VolumeBarDescriptor>;

/** Device-pixel x of a time delta anchored at the view start. */
fn timeDeltaToPixelX(timeDeltaMs: f32) -> f32 {
    let timeRange = uniforms.viewTimeEndDeltaMs - uniforms.viewTimeStartDeltaMs;
    return ((timeDeltaMs - uniforms.viewTimeStartDeltaMs) / timeRange) * uniforms.plotWidthPx;
}

fn pixelToClip(pixel: vec2<f32>) -> vec4<f32> {
    let clip = (pixel / vec2<f32>(uniforms.canvasW, uniforms.canvasH)) * 2.0 - 1.0;
    return vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
}
