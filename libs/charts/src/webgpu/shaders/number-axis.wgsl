// Position along a numeric axis: two float32 parts, like a value.
fn axisX(position: vec2<u32>) -> f32 {
    let high = bitcast<f32>(position.x) - bitcast<f32>(frame.viewStart.x);
    let low = bitcast<f32>(position.y) - bitcast<f32>(frame.viewStart.y);
    return (high + low) * frame.invXSpan;
}
