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

// The wick and the ticks marking its high and low are twice the outline.
const WICK_WIDTH_RATIO: f32 = 2.0;
// The ticks reach this far out from the wick, as a share of the body width.
const TICK_LENGTH_RATIO: f32 = 0.6;

// The hovered candle: its body and wick lifted this far towards white.
const HOVER_BRIGHTEN: f32 = 0.45;
const WHITE: vec3<f32> = vec3<f32>(1.0, 1.0, 1.0);
// Two candles a whole second apart never land within this of each other.
const HOVER_TIME_TOLERANCE_MS: f32 = 0.5;

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
    @location(4) isHovered: f32,            // 1 for the candle under the cursor
    @location(5) wickEndsOffsetPx: vec2<f32>, // high and low relative to the quad centre, device px
    @location(6) tickVisibility: vec2<f32>,  // 1 where a wick reaches past the body: upper, lower
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

    let wickWidth = U.outlineWidthPx * WICK_WIDTH_RATIO;
    let quadTop = min(highY, bodyCenterY - bodyHalfExtent) - wickWidth;
    let quadBottom = max(lowY, bodyCenterY + bodyHalfExtent) + wickWidth;
    let quadHeight = quadBottom - quadTop;
    let quadCenterY = (quadTop + quadBottom) * 0.5;
    let quadWidth = U.candleWidthPx + 2.0 * wickWidth;

    let unit = QUAD_UNITS[vid];
    let pixel = vec2<f32>(centerX, quadCenterY) + unit * vec2<f32>(quadWidth, quadHeight);

    var out: CandleVsOut;
    out.position = pixelToClip(pixel);
    out.offsetPx = unit * vec2<f32>(quadWidth, quadHeight);
    out.bodyHalfExtentPx = bodyHalfExtent;
    out.bodyCenterOffsetPx = bodyCenterY - quadCenterY;
    out.isUp = select(0.0, 1.0, candle.close >= candle.open);
    let isHovered = U.hasHoveredCandle == 1u
        && abs(candle.timeDeltaMs - U.hoveredTimeDeltaMs) < HOVER_TIME_TOLERANCE_MS;
    out.isHovered = select(0.0, 1.0, isHovered);
    out.wickEndsOffsetPx = vec2<f32>(highY, lowY) - quadCenterY;
    // A tick only marks a wick that clears the body; one on a flat candle
    // would just be a dash across it.
    let bodyTopY = bodyCenterY - bodyHalfExtent;
    let bodyBottomY = bodyCenterY + bodyHalfExtent;
    out.tickVisibility = vec2<f32>(
        select(0.0, 1.0, highY + wickWidth <= bodyTopY),
        select(0.0, 1.0, lowY - wickWidth >= bodyBottomY),
    );
    return out;
}

/** The candle's own colour, or the same colour lifted towards white when hovered. */
fn lift(color: vec3<f32>, isHovered: f32) -> vec4<f32> {
    return vec4<f32>(mix(color, WHITE, HOVER_BRIGHTEN * isHovered), 1.0);
}

@fragment
fn fsCandle(in: CandleVsOut) -> @location(0) vec4<f32> {
    let bodyHalfWidth = U.candleWidthPx * 0.5;
    let distanceFromBodyCenterY = abs(in.offsetPx.y - in.bodyCenterOffsetPx);
    let insideBody = abs(in.offsetPx.x) <= bodyHalfWidth && distanceFromBodyCenterY <= in.bodyHalfExtentPx;
    let outlineColor = vec3<f32>(COLOR_OUTLINE_R, COLOR_OUTLINE_G, COLOR_OUTLINE_B);
    if (insideBody) {
        let outlineInset = U.outlineWidthPx;
        let onOutline = abs(in.offsetPx.x) > bodyHalfWidth - outlineInset
            || distanceFromBodyCenterY > in.bodyHalfExtentPx - outlineInset;
        if (onOutline) {
            return lift(outlineColor, in.isHovered);
        }
        if (in.isUp > 0.5) {
            return lift(vec3<f32>(COLOR_UP_R, COLOR_UP_G, COLOR_UP_B), in.isHovered);
        }
        return lift(vec3<f32>(COLOR_DOWN_R, COLOR_DOWN_G, COLOR_DOWN_B), in.isHovered);
    }
    let wickWidth = U.outlineWidthPx * WICK_WIDTH_RATIO;
    let highOffset = in.wickEndsOffsetPx.x;
    let lowOffset = in.wickEndsOffsetPx.y;
    // The wick runs exactly from high to low; the ticks sit inside its ends, so
    // the tick's outer edge is the very end of the wick rather than a cross on it.
    let onWick = abs(in.offsetPx.x) <= wickWidth * 0.5
        && in.offsetPx.y >= highOffset && in.offsetPx.y <= lowOffset;
    let tickHalfLength = U.candleWidthPx * TICK_LENGTH_RATIO * 0.5;
    let distanceBelowHigh = in.offsetPx.y - highOffset;
    let distanceAboveLow = lowOffset - in.offsetPx.y;
    let onUpperTick = in.tickVisibility.x > 0.5
        && distanceBelowHigh >= 0.0 && distanceBelowHigh <= wickWidth;
    let onLowerTick = in.tickVisibility.y > 0.5
        && distanceAboveLow >= 0.0 && distanceAboveLow <= wickWidth;
    let onTick = abs(in.offsetPx.x) <= tickHalfLength && (onUpperTick || onLowerTick);
    if (onWick || onTick) {
        return lift(outlineColor, in.isHovered);
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
