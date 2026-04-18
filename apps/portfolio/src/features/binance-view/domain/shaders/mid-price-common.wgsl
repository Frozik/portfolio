// Shared WGSL declarations for the mid-price line overlay.
//
// Bindings (group 0) — must match `createMidPriceBindGroupLayout`:
//   0: uniform         MidPriceUniforms
//   1: texture_2d<f32> dataTexture (rgba32float, unfilterable-float)
//   2: storage(ro)     array<MidPriceBlockDescriptor>

struct MidPriceUniforms {
    viewport: vec2<f32>,            // device pixels (full canvas)
    plotWidthPx: f32,               // device pixels of the plot area (canvas - Y-axis panel)
    viewTimeStartDeltaMs: f32,      // view window start, relative to globalBaseTime
    viewTimeEndDeltaMs: f32,        // view window end,   relative to globalBaseTime
    priceMin: f32,                  // viewport lower bound (absolute price)
    priceMax: f32,                  // viewport upper bound (absolute price)
    minWidthPx: f32,                // shader-side floor for line width
    maxWidthPx: f32,                // shader-side ceiling for line width
    widthScale: f32,                // growth factor applied to |Δprice / price|
    blockCount: u32,                // number of live mid-price blocks
    textureWidth: u32,              // mid-price data-texture width in texels
    outlineWidthPx: f32,            // black outline thickness (device pixels, per side)
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
};                                  // total = 64 bytes

struct MidPriceBlockDescriptor {
    textureOffset: u32,             // row * textureWidth + slotIndex * SAMPLES_PER_BLOCK
    count: u32,                     // 1..SAMPLES_PER_BLOCK
    baseTimeDeltaMs: f32,           // block.firstTimestampMs - globalBaseTime
    basePrice: f32,                 // block.basePrice (absolute price of first sample)
};

@group(0) @binding(0) var<uniform> U: MidPriceUniforms;
@group(0) @binding(1) var dataTexture: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> blocks: array<MidPriceBlockDescriptor>;

struct DecodedSample {
    timeDeltaMs: f32,               // relative to globalBaseTime
    price: f32,                     // absolute price in quote currency
    priceChangeRatio: f32,          // signed (current - prev) / current
    packedColor: f32,               // packColor() bit-reinterpreted to f32
};

/**
 * Stitches all live blocks into one logical point list indexed by
 * `globalIndex`. The join instance `i` connects global sample `i` to
 * `i + 1`, so a point in the N-th block whose local index is K gets
 * global index (sumCountsBefore + K).
 */
fn readGlobalSample(globalIndex: u32) -> DecodedSample {
    var accumulated: u32 = 0u;
    for (var blockIdx: u32 = 0u; blockIdx < U.blockCount; blockIdx = blockIdx + 1u) {
        let count = blocks[blockIdx].count;
        if (globalIndex < accumulated + count) {
            let localIndex = globalIndex - accumulated;
            let texOffset = blocks[blockIdx].textureOffset + localIndex;
            let row = texOffset / U.textureWidth;
            let col = texOffset % U.textureWidth;
            let texel = textureLoad(dataTexture, vec2<u32>(col, row), 0);
            var result: DecodedSample;
            result.timeDeltaMs = blocks[blockIdx].baseTimeDeltaMs + texel.x;
            result.price = blocks[blockIdx].basePrice + texel.y;
            result.priceChangeRatio = texel.z;
            result.packedColor = texel.w;
            return result;
        }
        accumulated = accumulated + count;
    }
    var fallback: DecodedSample;
    fallback.timeDeltaMs = 0.0;
    fallback.price = 0.0;
    fallback.priceChangeRatio = 0.0;
    fallback.packedColor = 0.0;
    return fallback;
}

const COLOR_BYTE_MASK: u32 = 0xFFu;
const COLOR_SHIFT_R: u32 = 8u;
const COLOR_SHIFT_G: u32 = 16u;
const COLOR_SHIFT_B: u32 = 24u;
const COLOR_SCALE: f32 = 255.0;

fn unpackColorWgsl(packed: f32) -> vec4<f32> {
    let bits = bitcast<u32>(packed);
    let a = f32(bits & COLOR_BYTE_MASK) / COLOR_SCALE;
    let r = f32((bits >> COLOR_SHIFT_R) & COLOR_BYTE_MASK) / COLOR_SCALE;
    let g = f32((bits >> COLOR_SHIFT_G) & COLOR_BYTE_MASK) / COLOR_SCALE;
    let b = f32((bits >> COLOR_SHIFT_B) & COLOR_BYTE_MASK) / COLOR_SCALE;
    return vec4<f32>(r, g, b, a);
}

fn safeNormalize(v: vec2<f32>) -> vec2<f32> {
    let len2 = dot(v, v);
    if (len2 > 1e-20) {
        return v * inverseSqrt(len2);
    }
    return vec2<f32>(0.0, 1.0);
}

/**
 * Map a (timeDelta, absolute price) pair into device-pixel coordinates
 * inside the plot area. Time maps across `plotWidthPx` only — the
 * right `Y_AXIS_PANEL_CSS_PX * dpr` pixels of the canvas are reserved
 * for the Y-axis panel and must stay clear of line geometry. Y is
 * flipped so higher prices render toward the top of the canvas.
 */
fn dataToPixel(timeDeltaMs: f32, price: f32) -> vec2<f32> {
    let timeRange = U.viewTimeEndDeltaMs - U.viewTimeStartDeltaMs;
    let priceRange = U.priceMax - U.priceMin;
    let normalizedX = (timeDeltaMs - U.viewTimeStartDeltaMs) / timeRange;
    let normalizedY = (price - U.priceMin) / priceRange;
    return vec2<f32>(normalizedX * U.plotWidthPx, (1.0 - normalizedY) * U.viewport.y);
}

fn pixelToClip(pixel: vec2<f32>) -> vec2<f32> {
    let clip = (pixel / U.viewport) * 2.0 - 1.0;
    return vec2<f32>(clip.x, -clip.y);
}

/**
 * Map the signed relative price change stored in the texel to a
 * drawn line width in device pixels.
 *
 *     width = clamp(minWidthPx × |ratio| × widthScale,
 *                   minWidthPx, maxWidthPx)
 *
 * The floor means even an unchanged segment renders at the minimum
 * visible thickness; the ceiling caps how thick very volatile
 * segments can grow.
 */
fn widthFromRatio(priceChangeRatio: f32) -> f32 {
    let raw = U.minWidthPx * abs(priceChangeRatio) * U.widthScale;
    return clamp(raw, U.minWidthPx, U.maxWidthPx);
}
