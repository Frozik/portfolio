// Terrain tiles, sprites and trees are all axis-aligned textured quads over the same atlas —
// they differ only in the instance buffer they read and in the order they are drawn (§11.3).

struct QuadInstance {
    // xy = top-left position in world units, zw = size in world units.
    rect: vec4<f32>,
    // xy = atlas UV minimum, zw = atlas UV maximum of the whole sprite.
    uv: vec4<f32>,
    // x = quarter turns clockwise, y = animation frame count, zw unused.
    params: vec4<f32>,
};

@group(0) @binding(1) var<storage, read> instances: array<QuadInstance>;
@group(0) @binding(2) var atlasTexture: texture_2d<f32>;
@group(0) @binding(3) var atlasSampler: sampler;

override ANIMATION_TICKS_PER_FRAME: f32;

const ALPHA_CUTOFF: f32 = 0.5;
const SINGLE_FRAME: f32 = 1.0;

const QUAD_CORNERS = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0),
);

struct QuadVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// Sprites are authored facing up; one turn rotates the art 90 degrees clockwise on screen.
fn rotateCorner(corner: vec2<f32>, turns: u32) -> vec2<f32> {
    switch (turns) {
        case 1u: { return vec2<f32>(corner.y, 1.0 - corner.x); }
        case 2u: { return vec2<f32>(1.0 - corner.x, 1.0 - corner.y); }
        case 3u: { return vec2<f32>(1.0 - corner.y, corner.x); }
        default: { return corner; }
    }
}

@vertex
fn vsQuad(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
) -> QuadVSOut {
    let instance = instances[instanceIndex];
    let corner = QUAD_CORNERS[vertexIndex];

    let worldPosition = instance.rect.xy + corner * instance.rect.zw;
    let frameCount = max(SINGLE_FRAME, instance.params.y);
    let frameIndex = floor(U.tick / ANIMATION_TICKS_PER_FRAME) % frameCount;
    let frameWidth = (instance.uv.z - instance.uv.x) / frameCount;
    let frameMinU = instance.uv.x + frameIndex * frameWidth;
    let lookup = rotateCorner(corner, u32(instance.params.x));

    var out: QuadVSOut;
    out.position = vec4<f32>(U.worldOffset + worldPosition * U.worldScale, 0.0, 1.0);
    out.uv = vec2<f32>(
        frameMinU + lookup.x * frameWidth,
        mix(instance.uv.y, instance.uv.w, lookup.y),
    );

    return out;
}

@fragment
fn fsQuad(in: QuadVSOut) -> @location(0) vec4<f32> {
    let color = textureSample(atlasTexture, atlasSampler, in.uv);

    if (color.a < ALPHA_CUTOFF) {
        discard;
    }

    return vec4<f32>(color.rgb, 1.0);
}
