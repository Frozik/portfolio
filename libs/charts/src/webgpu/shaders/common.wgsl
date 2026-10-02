// Shared by every mark: the bindings, the reading of elements, and the fragment stage (§6.6).

struct Frame {
    canvas: vec2<f32>,
    devicePixelRatio: f32,
    invXSpan: f32,
    viewStart: vec2<u32>,
};

struct Layer {
    mark: u32,
    shape: u32,
    chunkCount: u32,
    // 1 while the layer draws the outline of its mark instead of the mark itself.
    outline: u32,
    params: vec4<f32>,
    stepOverSpan: f32,
    // The value scale the layer is drawn against: its minimum in two parts
    // (or the logarithm of it), one over its length, and where on the canvas
    // it lies, as fractions of the canvas height counted from the bottom.
    valueKind: u32,
    valueMin: vec2<f32>,
    invValueSpan: f32,
    scaleOrigin: f32,
    scaleShare: f32,
};

struct Chunk {
    texel: u32,
    // Elements up to and including this chunk, counted through the whole layer.
    end: u32,
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var dataTexture: texture_2d<u32>;
@group(1) @binding(0) var<uniform> layer: Layer;
@group(1) @binding(1) var<storage, read> chunks: array<Chunk>;

const TEXTURE_WIDTH: u32 = 2048u;
const SHAPE_CANDLE: u32 = 1u;
const POINT_TEXELS: u32 = 2u;
const CANDLE_TEXELS: u32 = 4u;
const CANDLE_POINTS: u32 = 4u;

const SCALE_LOG: u32 = 1u;

const JOIN_LINEAR: u32 = 0u;
const JOIN_STEP_AFTER: u32 = 1u;

const MODE_SOLID: u32 = 0u;
const MODE_RECT: u32 = 1u;
const MODE_CIRCLE: u32 = 2u;
const MODE_POLYGON: u32 = 3u;
const MODE_CANDLE: u32 = 4u;

const QUAD: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
);

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) fill: vec4<f32>,
    @location(1) stroke: vec4<f32>,
    // Pixels from the centre of the shape, Y up.
    @location(2) local: vec2<f32>,
    @location(3) halfSize: vec2<f32>,
    @location(4) strokeWidth: f32,
    @location(5) @interpolate(flat) mode: u32,
    @location(6) @interpolate(flat) figure: u32,
    // A candle inside its bounding box: where its body is centred along Y, half the body's height, half the wick's width.
    @location(7) @interpolate(flat) candle: vec3<f32>,
};

// One element as every mark sees it, whatever its shape: positions are
// fractions of the viewport, for a point all four values are its value.
struct Element {
    x: f32,
    open: f32,
    low: f32,
    high: f32,
    close: f32,
    fillSize: f32,
    fillColor: vec4<f32>,
    strokeSize: f32,
    strokeColor: vec4<f32>,
    gap: bool,
};

struct PointSample {
    pixel: vec2<f32>,
    fillSize: f32,
    fillColor: vec4<f32>,
    strokeSize: f32,
    strokeColor: vec4<f32>,
    gap: bool,
};

fn loadTexel(index: u32) -> vec4<u32> {
    return textureLoad(dataTexture, vec2<u32>(index % TEXTURE_WIDTH, index / TEXTURE_WIDTH), 0);
}

fn texelsPerElement() -> u32 {
    return select(POINT_TEXELS, CANDLE_TEXELS, layer.shape == SHAPE_CANDLE);
}

fn elementTexel(element: u32) -> u32 {
    var low: u32 = 0u;
    var high: u32 = layer.chunkCount;
    while (low < high) {
        let middle = (low + high) / 2u;
        if (chunks[middle].end <= element) {
            low = middle + 1u;
        } else {
            high = middle;
        }
    }
    let chunk = min(low, layer.chunkCount - 1u);
    var before: u32 = 0u;
    if (chunk > 0u) {
        before = chunks[chunk - 1u].end;
    }
    return chunks[chunk].texel + (element - before) * texelsPerElement();
}

// Colours are premultiplied here, once, so the fragment stage can mix a
// transparent fill with an opaque stroke without a dark fringe.
fn unpackColor(bits: u32) -> vec4<f32> {
    let alpha = f32((bits >> 24u) & 0xFFu) / 255.0;
    let color = vec3<f32>(
        f32(bits & 0xFFu),
        f32((bits >> 8u) & 0xFFu),
        f32((bits >> 16u) & 0xFFu),
    ) / 255.0;
    return vec4<f32>(color * alpha, alpha);
}

// A float32 NaN told by its bits: the compiler may assume a NaN never happens
// and drop `x != x`, but it does not touch integer comparisons.
fn isGap(bits: u32) -> bool {
    return (bits & 0x7F800000u) == 0x7F800000u && (bits & 0x007FFFFFu) != 0u;
}

// A value as a fraction of the canvas height from its bottom. On a linear
// scale the minimum is subtracted from each part before the parts are added,
// so the value is never rounded to a single float32; a logarithmic scale
// spans orders of magnitude and has no use for that precision.
fn valueY(high: u32, low: u32) -> f32 {
    var along: f32;
    if (layer.valueKind == SCALE_LOG) {
        along = (log(bitcast<f32>(high) + bitcast<f32>(low)) - layer.valueMin.x) * layer.invValueSpan;
    } else {
        along = ((bitcast<f32>(high) - layer.valueMin.x) + (bitcast<f32>(low) - layer.valueMin.y))
            * layer.invValueSpan;
    }
    return layer.scaleOrigin + along * layer.scaleShare;
}

fn readElement(index: u32) -> Element {
    let base = elementTexel(index);
    let head = loadTexel(base);
    var element: Element;
    var paint: vec4<u32>;

    element.x = axisX(head.xy);
    element.gap = isGap(head.z);
    if (layer.shape == SHAPE_CANDLE) {
        let second = loadTexel(base + 1u);
        let third = loadTexel(base + 2u);
        paint = loadTexel(base + 3u);
        element.open = valueY(head.z, head.w);
        element.close = valueY(second.x, second.y);
        element.low = valueY(second.z, second.w);
        element.high = valueY(third.x, third.y);
    } else {
        paint = loadTexel(base + 1u);
        let value = valueY(head.z, head.w);
        element.open = value;
        element.low = value;
        element.high = value;
        element.close = value;
    }
    element.fillSize = bitcast<f32>(paint.x) * frame.devicePixelRatio;
    element.fillColor = unpackColor(paint.y);
    element.strokeSize = bitcast<f32>(paint.z) * frame.devicePixelRatio;
    element.strokeColor = unpackColor(paint.w);
    return element;
}

fn pointsPerElement() -> u32 {
    return select(1u, CANDLE_POINTS, layer.shape == SHAPE_CANDLE);
}

// A candle as four points spread evenly over its interval: open, low, high, close.
fn corePoint(index: u32) -> PointSample {
    let perElement = pointsPerElement();
    let element = readElement(index / perElement);
    let corner = index % perElement;
    var x = element.x;
    var y = element.close;
    if (layer.shape == SHAPE_CANDLE) {
        x = element.x + layer.stepOverSpan * (f32(corner) * 2.0 + 1.0) / 8.0;
        var corners = array<f32, 4>(element.open, element.low, element.high, element.close);
        y = corners[corner];
    }
    var point: PointSample;
    point.pixel = vec2<f32>(x, y) * frame.canvas;
    point.fillSize = element.fillSize;
    point.fillColor = element.fillColor;
    point.strokeSize = element.strokeSize;
    point.strokeColor = element.strokeColor;
    point.gap = element.gap;
    return point;
}

// The points a line or an area runs through: with a step join every second
// one is a corner built from its two neighbours.
fn joinedPoint(index: u32, join: u32) -> PointSample {
    if (join == JOIN_LINEAR) {
        return corePoint(index);
    }
    let before = corePoint(index / 2u);
    if (index % 2u == 0u) {
        return before;
    }
    let after = corePoint(index / 2u + 1u);
    var corner = before;
    if (join == JOIN_STEP_AFTER) {
        corner.pixel = vec2<f32>(after.pixel.x, before.pixel.y);
    } else {
        corner = after;
        corner.pixel = vec2<f32>(before.pixel.x, after.pixel.y);
    }
    corner.gap = before.gap || after.gap;
    return corner;
}

fn toClip(pixel: vec2<f32>) -> vec4<f32> {
    return vec4<f32>((pixel / frame.canvas) * 2.0 - 1.0, 0.0, 1.0);
}

// An instance that draws nothing: every vertex in one place outside the view.
fn collapsed() -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4<f32>(-2.0, -2.0, 0.0, 1.0);
    output.mode = MODE_SOLID;
    return output;
}

// Signed distance to a simple polygon, negative inside (Inigo Quilez).
fn polygonDistance(position: vec2<f32>, figure: u32) -> f32 {
    let first = FIGURE_FIRST[figure];
    let count = FIGURE_COUNT[figure];
    var squared = dot(position - FIGURE_VERTICES[first], position - FIGURE_VERTICES[first]);
    var sign = 1.0;
    var previous = count - 1u;
    for (var current: u32 = 0u; current < count; current = current + 1u) {
        let vertex = FIGURE_VERTICES[first + current];
        let edge = FIGURE_VERTICES[first + previous] - vertex;
        let offset = position - vertex;
        let nearest = offset - edge * clamp(dot(offset, edge) / dot(edge, edge), 0.0, 1.0);
        squared = min(squared, dot(nearest, nearest));
        let above = position.y >= vertex.y;
        let below = position.y < FIGURE_VERTICES[first + previous].y;
        let left = edge.x * offset.y > edge.y * offset.x;
        if ((above && below && left) || (!above && !below && !left)) {
            sign = -sign;
        }
        previous = current;
    }
    return sign * sqrt(squared);
}

// A candle in one rectangle: the box spans the wick from the low to the high,
// and every pixel is told apart by its distance — inside the body it is body
// (outlined like any rectangle), elsewhere on the axis of the box it is wick.
// The wick is never drawn under the body, so a translucent body stays clean.
fn candleColor(input: VertexOutput) -> vec4<f32> {
    let bodyOffset = vec2<f32>(input.local.x, input.local.y - input.candle.x);
    let toBodyEdge = vec2<f32>(input.halfSize.x, input.candle.y) - abs(bodyOffset);
    let insideBody = min(toBodyEdge.x, toBodyEdge.y);
    let bodyCoverage = clamp(insideBody + 0.5, 0.0, 1.0);
    let filled = clamp(insideBody - input.strokeWidth + 0.5, 0.0, 1.0);
    let body = mix(input.stroke, input.fill, filled) * bodyCoverage;

    let insideWick = min(input.candle.z - abs(input.local.x), input.halfSize.y - abs(input.local.y));
    let wickCoverage = clamp(insideWick + 0.5, 0.0, 1.0) * (1.0 - bodyCoverage);
    if (bodyCoverage + wickCoverage <= 0.0) {
        discard;
    }
    return body + input.stroke * wickCoverage;
}

// Fill and stroke come from one distance to the edge of the shape: deeper
// than the stroke is fill, the band at the edge is stroke, outside is nothing.
@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    if (input.mode == MODE_SOLID) {
        return input.fill;
    }
    if (input.mode == MODE_CANDLE) {
        return candleColor(input);
    }
    var inside: f32;
    if (input.mode == MODE_RECT) {
        let toEdge = input.halfSize - abs(input.local);
        inside = min(toEdge.x, toEdge.y);
    } else if (input.mode == MODE_CIRCLE) {
        inside = input.halfSize.x - length(input.local);
    } else {
        let side = input.halfSize.x * 2.0;
        inside = -polygonDistance(input.local / side, input.figure) * side;
    }
    let coverage = clamp(inside + 0.5, 0.0, 1.0);
    if (coverage <= 0.0) {
        discard;
    }
    if (input.strokeWidth <= 0.0) {
        return input.fill * coverage;
    }
    let filled = clamp(inside - input.strokeWidth + 0.5, 0.0, 1.0);
    return mix(input.stroke, input.fill, filled) * coverage;
}
