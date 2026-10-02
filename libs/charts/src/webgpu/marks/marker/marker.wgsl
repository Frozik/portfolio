// 6 vertices: a square round the element; the figure is cut out of it in the fragment stage.
fn markerVertex(vertex: u32, instance: u32) -> VertexOutput {
    let point = corePoint(instance);
    if (point.gap) {
        return collapsed();
    }

    let corner = QUAD[vertex];
    let figure = u32(layer.params.x);

    var output: VertexOutput;
    output.local = corner * point.fillSize;
    output.halfSize = vec2<f32>(point.fillSize * 0.5);
    output.strokeWidth = point.strokeSize;
    output.fill = point.fillColor;
    output.stroke = point.strokeColor;
    // Figure nought is the circle; the polygons follow in the order of their table.
    output.mode = select(MODE_POLYGON, MODE_CIRCLE, figure == 0u);
    output.figure = max(figure, 1u) - 1u;
    output.position = toClip(point.pixel + output.local);
    return output;
}
