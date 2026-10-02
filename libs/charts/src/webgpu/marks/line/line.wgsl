const LINE_VERTICES_PER_JOIN: u32 = 6u;

// 12 vertices: a round join at point B, then the body from A to B.
fn lineVertex(vertex: u32, instance: u32) -> VertexOutput {
    let join = u32(layer.params.x);
    let pointA = joinedPoint(instance, join);
    let pointB = joinedPoint(instance + 1u, join);
    if (pointA.gap || pointB.gap) {
        return collapsed();
    }

    // The line of another mark's edge is drawn with that mark's stroke.
    let fromStroke = layer.params.y > 0.5;
    var widthA = select(pointA.fillSize, pointA.strokeSize, fromStroke);
    var widthB = select(pointB.fillSize, pointB.strokeSize, fromStroke);
    var colorA = select(pointA.fillColor, pointA.strokeColor, fromStroke);
    var colorB = select(pointB.fillColor, pointB.strokeColor, fromStroke);
    if (layer.outline == 1u) {
        widthA = widthA + pointA.strokeSize * 2.0;
        widthB = widthB + pointB.strokeSize * 2.0;
        colorA = pointA.strokeColor;
        colorB = pointB.strokeColor;
    }

    var output: VertexOutput;
    output.strokeWidth = 0.0;
    if (vertex < LINE_VERTICES_PER_JOIN) {
        let corner = QUAD[vertex];
        output.local = corner * widthB;
        output.halfSize = vec2<f32>(widthB * 0.5);
        output.mode = MODE_CIRCLE;
        output.fill = colorB;
        output.position = toClip(pointB.pixel + corner * widthB);
        return output;
    }

    let corner = QUAD[vertex - LINE_VERTICES_PER_JOIN];
    let along = corner.x + 0.5;
    let direction = pointB.pixel - pointA.pixel;
    let lengthSquared = dot(direction, direction);
    var normal = vec2<f32>(0.0, 1.0);
    if (lengthSquared > 1e-20) {
        normal = vec2<f32>(-direction.y, direction.x) * inverseSqrt(lengthSquared);
    }
    let width = mix(widthA, widthB, along);
    output.mode = MODE_SOLID;
    output.fill = mix(colorA, colorB, along);
    output.position = toClip(mix(pointA.pixel, pointB.pixel, along) + normal * (corner.y * width));
    return output;
}
