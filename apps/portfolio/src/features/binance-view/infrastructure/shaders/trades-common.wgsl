// Shared WGSL declarations for the trades layer.
//
// Bindings (group 0) — must match `createTradesBindGroupLayout`:
//   0: uniform       TradesUniforms        (vertex + fragment)
//   1: storage(ro)   array<TradeBucketDescriptor> (vertex)
//
// Unlike the heatmap and mid-price layers, the trades layer feeds
// every bucket through a storage buffer (one descriptor per visible
// bucket) instead of a sparse data-texture; the bucket count is small
// enough for that to win on simplicity.

struct TradesUniforms {
    canvasW: f32,                   // device pixels
    canvasH: f32,                   // device pixels
    plotWidthPx: f32,               // device pixels of the plot area (canvas - Y-axis panel)
    viewTimeStartDeltaMs: f32,      // view window start, relative to the global anchor
    viewTimeEndDeltaMs: f32,        // view window end,   relative to the global anchor
    priceMin: f32,                  // viewport lower price bound
    priceMax: f32,                  // viewport upper price bound
    devicePixelRatio: f32,          // CSS → device-pixel multiplier
    // Pad to 64 bytes (8 × f32 = 32 bytes; pad with 8 more f32):
    _pad0: f32, _pad1: f32, _pad2: f32, _pad3: f32,
    _pad4: f32, _pad5: f32, _pad6: f32, _pad7: f32,
};                                  // total = 64 bytes

struct TradeBucketDescriptor {
    centerTimeDeltaMs: f32,         // bucket.bucketStartMs - viewTimeStart anchor
    centerPriceDelta: f32,          // bucket.vwap - priceMin anchor
    radiusPx: f32,                  // device-pixel radius (already scaled)
    buyFraction: f32,               // notional buy fraction in [0, 1]
    fillOpacity: f32,               // size-driven alpha multiplier in [0, 1]
    _pad0: f32, _pad1: f32, _pad2: f32, // pad to 32 bytes (next 16-byte boundary)
};                                  // total = 32 bytes

// `override` constants without default values are required to be
// supplied via `constants: {}` at pipeline creation time.
override OUTLINE_PX:        f32 = 4.0;
override AA_WIDTH_PX:       f32 = 1.0;
override COLOR_BUY_R:       f32;
override COLOR_BUY_G:       f32;
override COLOR_BUY_B:       f32;
override COLOR_SELL_R:      f32;
override COLOR_SELL_G:      f32;
override COLOR_SELL_B:      f32;
override COLOR_OUTLINE_R:   f32;
override COLOR_OUTLINE_G:   f32;
override COLOR_OUTLINE_B:   f32;

@group(0) @binding(0) var<uniform> uniforms: TradesUniforms;
@group(0) @binding(1) var<storage, read> descriptors: array<TradeBucketDescriptor>;
