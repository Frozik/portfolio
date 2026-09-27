// The station: the flat triangles of its mesh, lit per pixel by where the
// planet's shadow lies on it. Inside the shadow it is dim, out of it it
// stands in the sun, and along the shadow's edge runs the light that came
// round the planet through its air — an arc, red towards the dark and blue
// towards the day.

struct BoardUniforms {
    viewport: vec2<f32>,        // device pixels
    origin: vec2<f32>,          // device-pixel position of the board's lower-left corner
    xAxis: vec2<f32>,           // the board's x axis in device pixels per metre
    yAxis: vec2<f32>,           // the board's y axis in device pixels per metre
    scale: f32,                 // device pixels per metre; unused here
    seed: f32,                  // unused here
    time: f32,                  // unused here
    _pad: f32,
    stationPosition: vec2<f32>, // metres, on the board
    stationAttitude: vec2<f32>, // unit vector: the way its modules are strung
    shadowCentre: vec2<f32>,    // the planet's shadow in the station's own frame, half spans
    halfSpan: f32,              // metres in one half span
    shadowRadius: f32,          // half spans
};

@group(0) @binding(0) var<uniform> U: BoardUniforms;

struct VertexIn {
    @location(0) position: vec2<f32>,
    @location(1) color: vec4<f32>,
};

struct VertexOut {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) local: vec2<f32>,   // the station's own frame, half spans
};

const SHADE = 0.5;
const SUNLIGHT = 1.35;
const PENUMBRA = 0.12;
const FRINGE_WIDTH = 0.08;
const FRINGE_SHIFT = 0.035;
// The arc lights what it crosses by its own colour, and leaves a sheen on even the darkest of it.
const GLINT_GAIN = 1.6;
const GLINT_SHEEN = 0.1;

@vertex
fn vsStation(vertex: VertexIn) -> VertexOut {
    let pixel = U.origin + U.xAxis * vertex.position.x + U.yAxis * vertex.position.y;
    let clip = pixel / U.viewport * 2.0 - 1.0;
    let away = (vertex.position - U.stationPosition) / U.halfSpan;
    let across = vec2<f32>(-U.stationAttitude.y, U.stationAttitude.x);
    var out: VertexOut;
    out.clipPosition = vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
    out.color = vertex.color;
    out.local = vec2<f32>(dot(away, U.stationAttitude), dot(away, across));
    return out;
}

fn band(off: f32) -> f32 {
    let share = off / FRINGE_WIDTH;
    return exp(-share * share);
}

@fragment
fn fsStation(in: VertexOut) -> @location(0) vec4<f32> {
    // How far out of the shadow: negative inside it, nought on its edge.
    let beyond = length(in.local - U.shadowCentre) - U.shadowRadius;
    let light = mix(SHADE, SUNLIGHT, smoothstep(-PENUMBRA, PENUMBRA, beyond));
    let fringe = vec3<f32>(
        band(beyond + FRINGE_SHIFT),
        band(beyond),
        band(beyond - FRINGE_SHIFT)
    );
    let lit = in.color.rgb * (light + fringe * GLINT_GAIN) + fringe * GLINT_SHEEN;
    return vec4<f32>(min(lit, vec3<f32>(1.0)), in.color.a);
}
