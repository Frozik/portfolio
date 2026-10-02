// 6 vertices: one rectangle round the whole candle, from its low to its high
// and as wide as its body. What each pixel of it is — body, outline, wick or
// nothing — the fragment stage tells by distance.
fn candleVertex(vertex: u32, instance: u32) -> VertexOutput {
    let candle = readElement(instance);
    if (candle.gap) {
        return collapsed();
    }

    let onePixel = frame.devicePixelRatio;
    let centerX = (candle.x + layer.stepOverSpan * 0.5) * frame.canvas.x;
    // When no coarser scale is left the candles narrow to what their interval leaves them (§4.3).
    let bodyWidth = max(min(candle.fillSize, layer.params.x), onePixel);
    let wickWidth = max(candle.strokeSize, onePixel);

    let open = candle.open * frame.canvas.y;
    let close = candle.close * frame.canvas.y;
    let bodyCenter = (open + close) * 0.5;
    let bodyHalfHeight = max(abs(close - open), onePixel) * 0.5;
    // A body with no height still gets its pixel, so the box may reach past the extremes.
    let bottom = min(min(candle.low, candle.high) * frame.canvas.y, bodyCenter - bodyHalfHeight);
    let top = max(max(candle.low, candle.high) * frame.canvas.y, bodyCenter + bodyHalfHeight);
    let center = vec2<f32>(centerX, (bottom + top) * 0.5);

    var output: VertexOutput;
    output.halfSize = vec2<f32>(max(bodyWidth, wickWidth), top - bottom) * 0.5;
    output.local = QUAD[vertex] * output.halfSize * 2.0;
    output.mode = MODE_CANDLE;
    output.strokeWidth = min(candle.strokeSize, bodyWidth * 0.5);
    output.fill = candle.fillColor;
    output.stroke = candle.strokeColor;
    output.candle = vec3<f32>(bodyCenter - center.y, bodyHalfHeight, wickWidth * 0.5);
    output.position = toClip(center + output.local);
    return output;
}
