// Position along a time axis: whole seconds and the nanoseconds within the
// second, both exact. The viewport start is subtracted in integers, so only a
// difference no larger than what is on screen ever becomes a float (§6.4).
fn axisX(position: vec2<u32>) -> f32 {
    var seconds = i32(position.x - frame.viewStart.x);
    var nanos = i32(position.y) - i32(frame.viewStart.y);
    if (seconds > 0 && nanos < 0) {
        seconds = seconds - 1;
        nanos = nanos + 1000000000;
    } else if (seconds < 0 && nanos > 0) {
        seconds = seconds + 1;
        nanos = nanos - 1000000000;
    }
    return (f32(seconds) + f32(nanos) * 1e-9) * frame.invXSpan;
}
