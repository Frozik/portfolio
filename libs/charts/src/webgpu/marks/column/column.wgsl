// 6 vertices: a rectangle from the baseline to the value, in the middle of the
// element's interval. A candle counts by its close.
fn columnVertex(vertex: u32, instance: u32) -> VertexOutput {
    let column = readElement(instance);
    if (column.gap) {
        return collapsed();
    }

    let onePixel = frame.devicePixelRatio;
    let centerX = (column.x + layer.stepOverSpan * 0.5) * frame.canvas.x;
    // When no coarser scale is left the columns narrow to what their interval leaves them (§4.3).
    let width = max(min(column.fillSize, layer.params.x), onePixel);
    let top = column.close * frame.canvas.y;
    let base = layer.params.y * frame.canvas.y;

    var output: VertexOutput;
    output.halfSize = vec2<f32>(width, max(abs(top - base), onePixel)) * 0.5;
    output.local = QUAD[vertex] * output.halfSize * 2.0;
    output.mode = MODE_RECT;
    output.strokeWidth = min(column.strokeSize, width * 0.5);
    output.fill = column.fillColor;
    output.stroke = column.strokeColor;
    output.position = toClip(vec2<f32>(centerX, (top + base) * 0.5) + output.local);
    return output;
}
