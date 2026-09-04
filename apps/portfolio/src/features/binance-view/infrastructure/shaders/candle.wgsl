// Candle layer shader — consumes `candle-common.wgsl`.
//
// `vsCandle` / `fsCandle`: one instance per candle, a quad covering the
// wick's vertical extent; the fragment shader paints the body between open
// and close and the wick between high and low.
//
// `vsMovingAverage` / `fsMovingAverage`: one instance per pair of adjacent
// candles, a line segment between their moving-average values; the channel
// and colour come from override constants so MA5 and MA10 are two pipelines.

override COLOR_UP_R: f32;
override COLOR_UP_G: f32;
override COLOR_UP_B: f32;
override COLOR_DOWN_R: f32;
override COLOR_DOWN_G: f32;
override COLOR_DOWN_B: f32;
override COLOR_OUTLINE_R: f32;
override COLOR_OUTLINE_G: f32;
override COLOR_OUTLINE_B: f32;

// Explicit array type required for Safari/Metal (see trades.wgsl).
const QUAD_UNITS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5), vec2<f32>(0.5, -0.5), vec2<f32>(-0.5, 0.5),
    vec2<f32>(0.5, -0.5), vec2<f32>(0.5, 0.5), vec2<f32>(-0.5, 0.5),
);

struct CandleVsOut {
    @builtin(position) position: vec4<f32>,
    @location(0) offsetPx: vec2<f32>,       // fragment offset from the candle centre, device px
    @location(1) bodyHalfExtentPx: f32,     // half of the body height, device px
    @location(2) bodyCenterOffsetPx: f32,   // body centre relative to the quad centre, device px
    @location(3) isUp: f32,                 // 1 when close >= open
};

@vertex
fn vsCandle(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> CandleVsOut {
    let candle = readGlobalCandle(iid);
    let centerX = candleCenterX(candle);
    let highY = dataToPixel(candle.timeDeltaMs, candle.high).y;
    let lowY = dataToPixel(candle.timeDeltaMs, candle.low).y;
    let openY = dataToPixel(candle.timeDeltaMs, candle.open).y;
    let closeY = dataToPixel(candle.timeDeltaMs, candle.close).y;

    let bodyTop = min(openY, closeY);
    let bodyBottom = max(openY, closeY);
    let bodyHalfExtent = max((bodyBottom - bodyTop) * 0.5, U.minBodyHeightPx * 0.5);
    let bodyCenterY = (bodyTop + bodyBottom) * 0.5;

    let quadTop = min(highY, bodyCenterY - bodyHalfExtent) - U.wickWidthPx;
    let quadBottom = max(lowY, bodyCenterY + bodyHalfExtent) + U.wickWidthPx;
    let quadHeight = quadBottom - quadTop;
    let quadCenterY = (quadTop + quadBottom) * 0.5;
    let quadWidth = U.candleWidthPx + 2.0 * U.wickWidthPx;

    let unit = QUAD_UNITS[vid];
    let pixel = vec2<f32>(centerX, quadCenterY) + unit * vec2<f32>(quadWidth, quadHeight);

    var out: CandleVsOut;
    out.position = pixelToClip(pixel);
    out.offsetPx = unit * vec2<f32>(quadWidth, quadHeight);
    out.bodyHalfExtentPx = bodyHalfExtent;
    out.bodyCenterOffsetPx = bodyCenterY - quadCenterY;
    out.isUp = select(0.0, 1.0, candle.close >= candle.open);
    return out;
}

@fragment
fn fsCandle(in: CandleVsOut) -> @location(0) vec4<f32> {
    let bodyHalfWidth = U.candleWidthPx * 0.5;
    let distanceFromBodyCenterY = abs(in.offsetPx.y - in.bodyCenterOffsetPx);
    let insideBody = abs(in.offsetPx.x) <= bodyHalfWidth && distanceFromBodyCenterY <= in.bodyHalfExtentPx;
    if (insideBody) {
        let outlineInset = U.wickWidthPx;
        let onOutline = abs(in.offsetPx.x) > bodyHalfWidth - outlineInset
            || distanceFromBodyCenterY > in.bodyHalfExtentPx - outlineInset;
        if (onOutline) {
            return vec4<f32>(COLOR_OUTLINE_R, COLOR_OUTLINE_G, COLOR_OUTLINE_B, 1.0);
        }
        if (in.isUp > 0.5) {
            return vec4<f32>(COLOR_UP_R, COLOR_UP_G, COLOR_UP_B, 1.0);
        }
        return vec4<f32>(COLOR_DOWN_R, COLOR_DOWN_G, COLOR_DOWN_B, 1.0);
    }
    if (abs(in.offsetPx.x) <= U.wickWidthPx * 0.5) {
        return vec4<f32>(COLOR_OUTLINE_R, COLOR_OUTLINE_G, COLOR_OUTLINE_B, 1.0);
    }
    discard;
    // Unreachable: WGSL still requires a return after `discard`.
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

override MA_CHANNEL: u32;
override MA_COLOR_R: f32;
override MA_COLOR_G: f32;
override MA_COLOR_B: f32;

const RECT_UNITS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -0.5), vec2<f32>(1.0, -0.5), vec2<f32>(1.0, 0.5),
    vec2<f32>(0.0, -0.5), vec2<f32>(1.0, 0.5), vec2<f32>(0.0, 0.5),
);

fn movingAverageOf(candle: Candle) -> f32 {
    if (MA_CHANNEL == 0u) {
        return candle.movingAverage5;
    }
    return candle.movingAverage10;
}

@vertex
fn vsMovingAverage(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> @builtin(position) vec4<f32> {
    let candleA = readGlobalCandle(iid);
    let candleB = readGlobalCandle(iid + 1u);
    let pixelA = vec2<f32>(candleCenterX(candleA), dataToPixel(candleA.timeDeltaMs, movingAverageOf(candleA)).y);
    let pixelB = vec2<f32>(candleCenterX(candleB), dataToPixel(candleB.timeDeltaMs, movingAverageOf(candleB)).y);

    let direction = pixelB - pixelA;
    let length2 = dot(direction, direction);
    var normal = vec2<f32>(0.0, 1.0);
    if (length2 > 1e-12) {
        normal = vec2<f32>(-direction.y, direction.x) * inverseSqrt(length2);
    }

    let unit = RECT_UNITS[vid];
    let pixel = mix(pixelA, pixelB, unit.x) + normal * (unit.y * U.lineWidthPx);
    return pixelToClip(pixel);
}

@fragment
fn fsMovingAverage() -> @location(0) vec4<f32> {
    return vec4<f32>(MA_COLOR_R, MA_COLOR_G, MA_COLOR_B, 1.0);
}
