// 6 vertices: a trapezoid from the segment A–B down to the baseline.
fn areaVertex(vertex: u32, instance: u32) -> VertexOutput {
    let join = u32(layer.params.x);
    let pointA = joinedPoint(instance, join);
    let pointB = joinedPoint(instance + 1u, join);
    if (pointA.gap || pointB.gap) {
        return collapsed();
    }

    let corner = QUAD[vertex];
    let along = corner.x + 0.5;
    let top = mix(pointA.pixel, pointB.pixel, along);
    let baseline = layer.params.y * frame.canvas.y;

    var output: VertexOutput;
    output.mode = MODE_SOLID;
    output.fill = mix(pointA.fillColor, pointB.fillColor, along);
    output.position = toClip(vec2<f32>(top.x, mix(baseline, top.y, corner.y + 0.5)));
    return output;
}
