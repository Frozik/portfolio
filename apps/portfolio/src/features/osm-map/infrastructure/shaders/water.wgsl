struct Uniforms {
    viewProjection: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    fogStart: f32,
    fogColor: vec3<f32>,
    fogEnd: f32,
    time: f32,
    riseSeconds: f32,
    // Ground metres under one CSS pixel at the camera target.
    metresPerPixel: f32,
    _pad0: f32,
};

struct Placement {
    offset: vec2<f32>,
    scale: f32,
    riseStart: f32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var<storage, read> placements: array<Placement>;

// Positions come as int16 tenths of a metre.
const POSITION_UNIT_M: f32 = 0.1;
const TAU: f32 = 6.283185307;

// The ripple symbol: rows of wavy dashes sized in CSS pixels at the camera
// target, so the pattern keeps its size on screen at every zoom and only
// perspective shrinks it toward the horizon; alternate rows are staggered
// by half a dash so the pattern reads as ripples rather than as ruled lines.
const ROW_SPACING_PX: f32 = 28.0;
const WAVELENGTH_PX: f32 = 64.0;
const AMPLITUDE_PX: f32 = 3.0;
const HALF_WIDTH_PX: f32 = 0.9;
const DASH_PERIOD_PX: f32 = 48.0;
const DASH_FILL: f32 = 0.55;
const DASH_STAGGER: f32 = 0.5;
const ROW_PHASE: f32 = 1.7;
const WAVE_SPEED_RAD_PER_S: f32 = 1.2;
const DRIFT_PERIODS_PER_S: f32 = 0.03;
// A line thinner than a pixel shimmers: it is widened to this and faded instead.
const MIN_HALF_WIDTH_PX: f32 = 0.75;
// Rows closer than this many pixels merge into noise, so the pattern fades out between them.
const ROWS_HIDDEN_BELOW_PX: f32 = 3.0;
const ROWS_SHOWN_ABOVE_PX: f32 = 7.0;
const COLOR: vec3<f32> = vec3<f32>(0.36, 0.60, 0.74);
const OPACITY: f32 = 0.8;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    // Plan metres from the tile corner, x east, y north.
    @location(0) plan: vec2<f32>,
    @location(1) viewDistance: f32,
    @location(2) settled: f32,
};

@vertex
fn vs(
    @location(0) position: vec2<i32>,
    @builtin(instance_index) instanceIndex: u32,
) -> VSOut {
    let placement = placements[instanceIndex];
    let metres = vec2<f32>(position) * POSITION_UNIT_M;
    let world = vec3<f32>(
        placement.offset.x + metres.x * placement.scale,
        0.0,
        placement.offset.y + metres.y * placement.scale,
    );

    var out: VSOut;
    out.position = U.viewProjection * vec4<f32>(world, 1.0);
    out.plan = vec2<f32>(metres.x, -metres.y);
    out.viewDistance = distance(world, U.cameraPosition);
    out.settled = clamp((U.time - placement.riseStart) / U.riseSeconds, 0.0, 1.0);
    return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    // Plan in pattern pixels: metres at the target divided out, so the
    // constants above read as sizes on screen.
    let plan = in.plan / U.metresPerPixel;
    let row = round(plan.y / ROW_SPACING_PX);
    let phase = row * ROW_PHASE + U.time * WAVE_SPEED_RAD_PER_S;
    let centre = row * ROW_SPACING_PX + AMPLITUDE_PX * sin(plan.x * TAU / WAVELENGTH_PX + phase);
    let offset = plan.y - centre;
    let offsetPerPixel = fwidth(offset);
    let halfWidth = max(HALF_WIDTH_PX, offsetPerPixel * MIN_HALF_WIDTH_PX);
    let line = 1.0 - smoothstep(halfWidth - offsetPerPixel, halfWidth + offsetPerPixel, abs(offset));

    let along = plan.x / DASH_PERIOD_PX + row * DASH_STAGGER + U.time * DRIFT_PERIODS_PER_S;
    let intoDash = abs(fract(along) - DASH_FILL * 0.5) - DASH_FILL * 0.5;
    let alongPerPixel = fwidth(along);
    let dash = 1.0 - smoothstep(-alongPerPixel, alongPerPixel, intoDash);

    let rowPixels = ROW_SPACING_PX / fwidth(plan.y);
    let legible = smoothstep(ROWS_HIDDEN_BELOW_PX, ROWS_SHOWN_ABOVE_PX, rowPixels);
    let fog = smoothstep(U.fogStart, U.fogEnd, in.viewDistance);
    let alpha = line * dash * legible * (1.0 - fog) * in.settled * OPACITY;
    return vec4<f32>(COLOR * alpha, alpha);
}
