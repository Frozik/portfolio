// Mid-price line shader — consumes `mid-price-common.wgsl`.
//
// Instancing scheme: one instance per line segment, 12 vertices each:
//   [0..6)   — join-B disc cap at `sampleB`
//   [6..12)  — body rectangle from `sampleA` to `sampleB`
//
// We deliberately do NOT draw a cap at `sampleA`: adjacent segments
// share the junction sample (`sampleB` of segment i == `sampleA` of
// segment i+1), so the previous segment's join-B already stitches the
// corner. A second cap in the next segment would paint its outline
// annulus on top of the previous segment's body tail — the exact
// artefact that prompted this restructuring.
//
// Geometry is expanded by `2 × outlineWidthPx` (one side each) so the
// coloured core keeps its nominal `widthFromRatio` thickness and the
// outline sits *outside* the core rather than eating into it. The
// body interpolates colour from `colorA` at `sampleA` to `colorB` at
// `sampleB` — adjacent segments therefore transition smoothly through
// the junction cap colour instead of switching hues in one step.

struct MidVsOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    // Offset of this fragment from the line centre, expressed in
    // unit-basis coordinates (range `[-0.5, 0.5]` per axis). The
    // fragment shader derives `normalizedDistance = length(...) * 2.0`
    // from it; doing the reduction there rather than at the vertex
    // stage keeps the varying linearly interpolable across the quad.
    // For the straight body the X axis runs along the line direction
    // (irrelevant to thickness) so we zero it out — the shader ends
    // up reading `|basis.y|` for body fragments and `length(basis)`
    // for disc caps, which is exactly what we need.
    @location(1) unitOffset: vec2<f32>,
    // Fraction of `normalizedDistance` that stays inside the coloured
    // core; anything beyond is the black outline band.
    @location(2) innerFraction: f32,
};

const MID_JOIN_BASIS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(0.5, -0.5),
);

const MID_RECT_BASIS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -0.5),
    vec2<f32>(1.0, -0.5),
    vec2<f32>(1.0, 0.5),
    vec2<f32>(0.0, -0.5),
    vec2<f32>(1.0, 0.5),
    vec2<f32>(0.0, 0.5),
);

const MID_JOIN_B_END: u32 = 6u;

fn totalWidthPx(innerWidthPx: f32) -> f32 {
    return innerWidthPx + 2.0 * U.outlineWidthPx;
}

fn innerFractionOf(innerWidthPx: f32) -> f32 {
    let total = totalWidthPx(innerWidthPx);
    if (total <= 0.0) {
        return 0.0;
    }
    return innerWidthPx / total;
}

@vertex
fn vsMidPrice(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32
) -> MidVsOut {
    var out: MidVsOut;

    let sampleA = readGlobalSample(iid);
    let sampleB = readGlobalSample(iid + 1u);

    let pixelA = dataToPixel(sampleA.timeDeltaMs, sampleA.price);
    let pixelB = dataToPixel(sampleB.timeDeltaMs, sampleB.price);

    // `packedColor` at sample B describes the segment A→B (the
    // accumulator writes it when B arrives, comparing against the
    // previous sample). The join cap at B therefore matches this
    // segment's colour; the body gradients into it from `colorA`.
    let widthA = widthFromRatio(sampleA.priceChangeRatio);
    let widthB = widthFromRatio(sampleB.priceChangeRatio);
    let colorA = unpackColorWgsl(sampleA.packedColor);
    let colorB = unpackColorWgsl(sampleB.packedColor);

    let totalA = totalWidthPx(widthA);
    let totalB = totalWidthPx(widthB);

    if (vid < MID_JOIN_B_END) {
        let basis = MID_JOIN_BASIS[vid];
        out.color = colorB;
        out.unitOffset = basis;
        out.innerFraction = innerFractionOf(widthB);
        let offsetPixels = basis * totalB;
        out.position = vec4<f32>(pixelToClip(pixelB + offsetPixels), 0.0, 1.0);
    } else {
        let localVid = vid - MID_JOIN_B_END;
        let basis = MID_RECT_BASIS[localVid];

        let direction = pixelB - pixelA;
        let normal = safeNormalize(vec2<f32>(-direction.y, direction.x));

        // Interpolate thickness end-to-end so the rectangle joins the
        // disc cap at B smoothly when adjacent segments disagree in
        // slope, and gradient the colour across the segment so the
        // join transition reads as a smooth blend rather than a step.
        let innerThickness = mix(widthA, widthB, basis.x);
        let totalThickness = mix(totalA, totalB, basis.x);
        let basePixel = mix(pixelA, pixelB, basis.x);
        let offsetPixel = basePixel + normal * (basis.y * totalThickness);

        out.color = mix(colorA, colorB, basis.x);
        // X runs along the line direction — only the perpendicular
        // component (Y) contributes to distance from the centre line.
        out.unitOffset = vec2<f32>(0.0, basis.y);
        out.innerFraction = innerFractionOf(innerThickness);
        out.position = vec4<f32>(pixelToClip(offsetPixel), 0.0, 1.0);
    }

    return out;
}

// The line is drawn in two passes sharing this single vertex shader,
// each pass picking one of the two fragment entry points below:
//
//   1. `fsMidPriceInterior` — paints the coloured core of every
//      segment and writes `1` into the stencil buffer at every
//      covered sample (pipeline-side `stencilFront.passOp: 'replace'`,
//      reference = 1).
//   2. `fsMidPriceOutline` — paints the black outline band but is
//      gated by `stencilCompare: 'equal'` with reference = 0. Any
//      pixel already marked as interior by the first pass (including
//      interiors of *other* segments drawn in the same call) fails
//      the stencil test, so the outline of a newer segment can no
//      longer overwrite the body of an older one.
//
// Splitting the two branches into separate entry points lets each
// pipeline discard its "wrong half" up-front instead of toggling on a
// uniform / constant every frame.

@fragment
fn fsMidPriceInterior(in: MidVsOut) -> @location(0) vec4<f32> {
    let normalizedDistance = length(in.unitOffset) * 2.0;
    if (normalizedDistance > in.innerFraction) {
        discard;
    }
    return in.color;
}

@fragment
fn fsMidPriceOutline(in: MidVsOut) -> @location(0) vec4<f32> {
    let normalizedDistance = length(in.unitOffset) * 2.0;
    // Disc caps inscribe a circle inside the unit quad; corners land
    // at `normalizedDistance > 1.0` and must be discarded so joins read
    // as filled circles rather than squares. Body rectangles top out
    // at exactly `1.0` so the same check leaves them untouched.
    if (normalizedDistance > 1.0) {
        discard;
    }
    if (normalizedDistance <= in.innerFraction) {
        discard;
    }
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
