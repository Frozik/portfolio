// Shared WGSL declarations for the candle layer.
//
// Bindings (group 0) — must match `createCandleBindGroupLayout`:
//   0: uniform         CandleUniforms
//   1: texture_2d<f32> dataTexture (rgba32float, two texels per candle)
//   2: storage(ro)     array<CandleBlockDescriptor>

struct CandleUniforms {
    viewport: vec2<f32>,            // device pixels (full canvas)
    plotWidthPx: f32,               // device pixels of the plot area (canvas - Y-axis panel)
    viewTimeStartDeltaMs: f32,      // view window start, relative to globalBaseTime
    viewTimeEndDeltaMs: f32,        // view window end,   relative to globalBaseTime
    priceMin: f32,                  // viewport lower bound (absolute price)
    priceMax: f32,                  // viewport upper bound (absolute price)
    candleWidthPx: f32,             // body width, device pixels
    wickWidthPx: f32,               // wick / outline thickness, device pixels
    minBodyHeightPx: f32,           // floor on the body height, device pixels
    lineWidthPx: f32,               // moving-average line thickness, device pixels
    blockCount: u32,
    textureWidth: u32,
    plotHeightPx: f32,              // device pixels of the price area (canvas - volume panel)
    _pad1: u32,
    _pad2: u32,
};                                  // total = 64 bytes

struct CandleBlockDescriptor {
    textureOffset: u32,             // first texel of the block's slot
    count: u32,                     // candles in the block
    baseTimeDeltaMs: f32,           // block.firstBucketStartMs - globalBaseTime
    basePrice: f32,                 // block.basePrice
};

@group(0) @binding(0) var<uniform> U: CandleUniforms;
@group(0) @binding(1) var dataTexture: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> blocks: array<CandleBlockDescriptor>;

const TEXELS_PER_CANDLE: u32 = 2u;
const CANDLE_DURATION_MS: f32 = 1000.0;

struct Candle {
    timeDeltaMs: f32,               // bucket start, relative to globalBaseTime
    open: f32,
    high: f32,
    low: f32,
    close: f32,
    movingAverage5: f32,
    movingAverage10: f32,
};

fn loadTexel(offset: u32) -> vec4<f32> {
    let row = offset / U.textureWidth;
    let col = offset % U.textureWidth;
    return textureLoad(dataTexture, vec2<u32>(col, row), 0);
}

/** Candle `globalIndex` across the visible blocks stitched in time order. */
fn readGlobalCandle(globalIndex: u32) -> Candle {
    var accumulated: u32 = 0u;
    var result: Candle;
    for (var blockIdx: u32 = 0u; blockIdx < U.blockCount; blockIdx = blockIdx + 1u) {
        let count = blocks[blockIdx].count;
        if (globalIndex < accumulated + count) {
            let localIndex = globalIndex - accumulated;
            let texOffset = blocks[blockIdx].textureOffset + localIndex * TEXELS_PER_CANDLE;
            let first = loadTexel(texOffset);
            let second = loadTexel(texOffset + 1u);
            let basePrice = blocks[blockIdx].basePrice;
            result.timeDeltaMs = blocks[blockIdx].baseTimeDeltaMs + first.x;
            result.open = basePrice + first.y;
            result.high = basePrice + first.z;
            result.low = basePrice + first.w;
            result.close = basePrice + second.x;
            result.movingAverage5 = basePrice + second.y;
            result.movingAverage10 = basePrice + second.z;
            return result;
        }
        accumulated = accumulated + count;
    }
    return result;
}

/** Map (time relative to globalBaseTime, absolute price) into device pixels of the plot area. */
fn dataToPixel(timeDeltaMs: f32, price: f32) -> vec2<f32> {
    let timeRange = U.viewTimeEndDeltaMs - U.viewTimeStartDeltaMs;
    let priceRange = U.priceMax - U.priceMin;
    let normalizedX = (timeDeltaMs - U.viewTimeStartDeltaMs) / timeRange;
    let normalizedY = (price - U.priceMin) / priceRange;
    return vec2<f32>(normalizedX * U.plotWidthPx, (1.0 - normalizedY) * U.plotHeightPx);
}

fn pixelToClip(pixel: vec2<f32>) -> vec4<f32> {
    let clip = (pixel / U.viewport) * 2.0 - 1.0;
    return vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
}

/** Pixel x of the middle of the candle's second. */
fn candleCenterX(candle: Candle) -> f32 {
    return dataToPixel(candle.timeDeltaMs + CANDLE_DURATION_MS * 0.5, candle.close).x;
}
