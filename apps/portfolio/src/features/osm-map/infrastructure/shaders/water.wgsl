struct Uniforms {
    viewProjection: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    fogStart: f32,
    fogColor: vec3<f32>,
    fogEnd: f32,
    sunDirection: vec3<f32>,
    time: f32,
    // From the waves' anchor on the ground to the frame's origin, in map units.
    waveOffset: vec2<f32>,
    riseSeconds: f32,
    metresPerUnit: f32,
};

struct Placement {
    offset: vec2<f32>,
    scale: f32,
    riseStart: f32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var<storage, read> placements: array<Placement>;
// Where the raster map shows open water, per canvas pixel: the water yields to whatever the raster painted over it.
@group(0) @binding(2) var rasterWater: texture_2d<f32>;

// Positions come as int16 tenths of a metre.
const POSITION_UNIT_M: f32 = 0.1;
const TAU: f32 = 6.283185307;
const GRAVITY_MPS2: f32 = 9.81;

// The surface is a sum of travelling waves in ground metres, longest first,
// each shorter and weaker than the one before. Wavelengths are larger than a
// pond's real ripples on purpose: at map zooms those are far below a pixel.
const WAVE_COUNT: i32 = 14;
const LONGEST_WAVE_M: f32 = 25.0;
const FREQUENCY_GROWTH: f32 = 1.16;
const WEIGHT_DECAY: f32 = 0.82;
// Waves run downwind, fanned this far to either side.
const WIND_ANGLE_RAD: f32 = 0.6;
const WIND_SPREAD_RAD: f32 = 1.2;
// Each wave pulls the next ones toward its crests, which sharpens them and breaks the regular grid of sines.
const CREST_DRAG: f32 = 0.35;
const DIRECTION_SEED_STEP: f32 = 1232.399963;
// Surface slope per unit of wave slope: how choppy the water reads.
const STEEPNESS: f32 = 0.45;
// A wave fades out between four and two pixels per wavelength, before it can alias.
const WAVE_FADES_FROM: f32 = 0.25;
const WAVE_GONE_AT: f32 = 0.5;

const DEEP_COLOR: vec3<f32> = vec3<f32>(0.27, 0.52, 0.68);
const CREST_COLOR: vec3<f32> = vec3<f32>(0.50, 0.72, 0.83);
const SKY_COLOR: vec3<f32> = vec3<f32>(0.80, 0.90, 0.97);
const SUN_COLOR: vec3<f32> = vec3<f32>(1.0, 0.97, 0.88);
// Reflectance of water looked at straight down.
const FRESNEL_AT_NORMAL: f32 = 0.02;
const FRESNEL_POWER: f32 = 5.0;
const GLINT_SHININESS: f32 = 160.0;
const GLINT_STRENGTH: f32 = 0.4;
// How much the sun's angle to the surface darkens and lightens the water body.
const SHADING: f32 = 0.6;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    // Relative to the camera target, in map units.
    @location(0) world: vec3<f32>,
    @location(1) settled: f32,
};

struct Surface {
    // 0 in the troughs, 1 on the crests.
    height: f32,
    // Slope of the surface along plan x and y.
    slope: vec2<f32>,
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
    out.world = world;
    out.settled = clamp((U.time - placement.riseStart) / U.riseSeconds, 0.0, 1.0);
    return out;
}

fn surfaceAt(plan: vec2<f32>, metresPerPixel: f32) -> Surface {
    var position = plan;
    var frequency = TAU / LONGEST_WAVE_M;
    var weight = 1.0;
    var seed = 0.0;
    var height = 0.0;
    var totalWeight = 0.0;
    var slope = vec2<f32>(0.0);
    for (var index = 0; index < WAVE_COUNT; index++) {
        let angle = WIND_ANGLE_RAD + sin(seed) * WIND_SPREAD_RAD;
        let direction = vec2<f32>(cos(angle), sin(angle));
        // Deep-water dispersion: long waves outrun short ones.
        let phase = dot(direction, position) * frequency - U.time * sqrt(GRAVITY_MPS2 * frequency);
        let crest = exp(sin(phase) - 1.0);
        let crestSlope = crest * cos(phase);
        let wavelengthsPerPixel = metresPerPixel * frequency / TAU;
        let visible = weight * (1.0 - smoothstep(WAVE_FADES_FROM, WAVE_GONE_AT, wavelengthsPerPixel));

        position -= direction * (crestSlope * visible * CREST_DRAG / frequency);
        height += crest * visible;
        totalWeight += weight;
        slope += direction * (crestSlope * visible);

        weight *= WEIGHT_DECAY;
        frequency *= FREQUENCY_GROWTH;
        seed += DIRECTION_SEED_STEP;
    }
    return Surface(height / totalWeight, slope * STEEPNESS);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    // Metres from the anchor, x east, y north: one pattern across every tile.
    let plan = (in.world.xz + U.waveOffset) * U.metresPerUnit * vec2<f32>(1.0, -1.0);
    let metresPerPixel = length(fwidth(plan));
    let surface = surfaceAt(plan, metresPerPixel);
    // Plan y runs north, world z south.
    let normal = normalize(vec3<f32>(-surface.slope.x, 1.0, surface.slope.y));
    let toCamera = normalize(U.cameraPosition - in.world);

    let facing = max(dot(normal, toCamera), 0.0);
    let fresnel = FRESNEL_AT_NORMAL + (1.0 - FRESNEL_AT_NORMAL) * pow(1.0 - facing, FRESNEL_POWER);
    let lit = mix(1.0, max(dot(normal, U.sunDirection), 0.0) / U.sunDirection.y, SHADING);
    let body = mix(DEEP_COLOR, CREST_COLOR, surface.height) * lit;
    let halfway = normalize(toCamera + U.sunDirection);
    let glint = pow(max(dot(normal, halfway), 0.0), GLINT_SHININESS) * GLINT_STRENGTH;
    let color = mix(body, SKY_COLOR, fresnel) + SUN_COLOR * glint;

    let fog = smoothstep(U.fogStart, U.fogEnd, distance(in.world, U.cameraPosition));
    let onOpenWater = textureLoad(rasterWater, vec2<i32>(in.position.xy), 0).r;
    let alpha = (1.0 - fog) * in.settled * onOpenWater;
    return vec4<f32>(min(color, vec3<f32>(1.0)) * alpha, alpha);
}
