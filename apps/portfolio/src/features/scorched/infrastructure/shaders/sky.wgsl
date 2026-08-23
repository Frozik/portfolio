// [§11.3] The backdrop: a vertical gradient with an optional starfield, both ours.

struct SkyParams {
    topColor: vec4<f32>,
    horizonColor: vec4<f32>,
    // x = stars per 100 × 100 wu of sky (zero leaves the gradient clean); the rest is padding.
    settings: vec4<f32>,
};

@group(0) @binding(1) var<uniform> Sky: SkyParams;

const STAR_CELL_WU: f32 = 25.0;
/** One cell covers this fraction of the 100 × 100 wu the density is quoted for. */
const STAR_CELL_AREA_FRACTION: f32 = 0.0625;
const STAR_RADIUS_WU: f32 = 1.1;
const STAR_TWINKLE_RATE: f32 = 1.7;
const STAR_TWINKLE_DEPTH: f32 = 0.35;
const STAR_SEED_SPREAD: f32 = 23.0;
const STAR_COLOR = vec3<f32>(1.0, 0.98, 0.9);

const NOISE_DIRECTION = vec2<f32>(127.1, 311.7);
const NOISE_SCALE: f32 = 43758.5453;
const NOISE_OFFSET_X = vec2<f32>(17.3, 5.1);
const NOISE_OFFSET_Y = vec2<f32>(41.7, 91.3);

fn hash21(point: vec2<f32>) -> f32 {
    return fract(sin(dot(point, NOISE_DIRECTION)) * NOISE_SCALE);
}

/** One star per grid cell at most, placed and dimmed by the cell's own hash. */
fn starBrightness(fieldPosition: vec2<f32>) -> f32 {
    let cell = floor(fieldPosition / STAR_CELL_WU);
    let presence = hash21(cell);

    if (presence > Sky.settings.x * STAR_CELL_AREA_FRACTION) {
        return 0.0;
    }

    let starPosition = vec2<f32>(hash21(cell + NOISE_OFFSET_X), hash21(cell + NOISE_OFFSET_Y));
    let offsetWu = (fract(fieldPosition / STAR_CELL_WU) - starPosition) * STAR_CELL_WU;
    let twinkle =
        1.0 - STAR_TWINKLE_DEPTH
        + STAR_TWINKLE_DEPTH * sin(U.timeSeconds * STAR_TWINKLE_RATE + presence * STAR_SEED_SPREAD);

    return twinkle * smoothstep(STAR_RADIUS_WU, 0.0, length(offsetWu));
}

@fragment
fn fsSky(in: FieldQuadVSOut) -> @location(0) vec4<f32> {
    // The quad overscans the field so the shake cannot expose the letterbox, so the gradient is
    // read at a clamped uv — extrapolating it past the horizon would tint the overscan band.
    let depth = clamp(in.uv.y, 0.0, 1.0);
    let gradient = mix(Sky.topColor.rgb, Sky.horizonColor.rgb, depth);
    let fieldPosition = in.uv * U.fieldSize;
    // Stars fade out towards the horizon, where the haze of the gradient washes them away.
    let stars = starBrightness(fieldPosition) * (1.0 - depth);

    return vec4<f32>(gradient + STAR_COLOR * stars, 1.0);
}
