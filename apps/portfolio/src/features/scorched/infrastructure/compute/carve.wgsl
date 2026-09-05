// Stamps the round's explosions into the terrain texture. The domain has already
// resolved the terrain by the time an op reaches this pass — the stamp is what the player sees
// happen, not what decides the game.

struct CarveOp {
    center: vec2<f32>,
    // x = radius in world units, y = kind.
    settings: vec2<f32>,
};

struct CarveParams {
    opCount: u32,
    scorchRingWu: f32,
    padding: vec2<f32>,
};

@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var targetTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<storage, read> ops: array<CarveOp>;
@group(0) @binding(3) var<uniform> params: CarveParams;

override CARVE_WORKGROUP_SIZE: u32;

const KIND_WEDGE: f32 = 1.0;
const KIND_SCORCH: f32 = 2.0;
const KIND_DEPOSIT: f32 = 3.0;

const DIRT_PRESENT: f32 = 1.0;
const NO_DIRT: f32 = 0.0;
const DIRT_THRESHOLD: f32 = 0.5;
const SUPPORTED: f32 = 1.0;
const NO_SCORCH: f32 = 0.0;
const HALF_TEXEL: f32 = 0.5;

const NOISE_DIRECTION = vec2<f32>(127.1, 311.7);
const NOISE_SCALE: f32 = 43758.5453;

fn paletteNoise(point: vec2<f32>) -> f32 {
    return fract(sin(dot(point, NOISE_DIRECTION)) * NOISE_SCALE);
}

// Negative inside the shape, positive outside — the scorch ring reads the outside distance.
fn signedDistance(op: CarveOp, point: vec2<f32>) -> f32 {
    let origin = op.center;
    let radius = op.settings.x;
    let kind = op.settings.y;

    if (kind == KIND_WEDGE) {
        // The riot charge's void: deepest straight above the apex, tapering out at ±radius.
        return max(abs(point.x - origin.x) + (point.y - origin.y) - radius, origin.y - point.y);
    }

    return length(point - origin) - radius;
}

fn applyOp(texel: vec4<f32>, op: CarveOp, point: vec2<f32>) -> vec4<f32> {
    let kind = op.settings.y;
    let distanceWu = signedDistance(op, point);

    // Napalm char: burns the dirt black where the fire lies without moving a grain of it.
    if (kind == KIND_SCORCH) {
        if (distanceWu <= 0.0 && texel.r >= DIRT_THRESHOLD) {
            let closeness = -distanceWu / op.settings.x;

            return vec4<f32>(texel.r, texel.g, max(texel.b, closeness), texel.a);
        }

        return texel;
    }

    if (distanceWu <= 0.0) {
        if (kind == KIND_DEPOSIT) {
            return vec4<f32>(DIRT_PRESENT, paletteNoise(point), NO_SCORCH, SUPPORTED);
        }

        return vec4<f32>(NO_DIRT, NO_SCORCH, texel.b, SUPPORTED);
    }

    let isScorchable = kind != KIND_DEPOSIT && texel.r >= DIRT_THRESHOLD;

    if (!isScorchable || distanceWu > params.scorchRingWu) {
        return texel;
    }

    let scorch = 1.0 - distanceWu / params.scorchRingWu;

    return vec4<f32>(texel.r, texel.g, max(texel.b, scorch), texel.a);
}

@compute @workgroup_size(CARVE_WORKGROUP_SIZE, CARVE_WORKGROUP_SIZE)
fn carveTerrain(@builtin(global_invocation_id) id: vec3<u32>) {
    let size = textureDimensions(sourceTexture);

    if (id.x >= size.x || id.y >= size.y) {
        return;
    }

    let coordinate = vec2<i32>(i32(id.x), i32(id.y));
    // Row zero is the field ceiling, so the world y of a row counts down from the field height.
    let point = vec2<f32>(f32(id.x) + HALF_TEXEL, f32(size.y - id.y) - HALF_TEXEL);
    var texel = textureLoad(sourceTexture, coordinate, 0);

    for (var index = 0u; index < params.opCount; index = index + 1u) {
        texel = applyOp(texel, ops[index], point);
    }

    textureStore(targetTexture, coordinate, texel);
}
