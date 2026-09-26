struct Uniforms {
    viewProjection: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    time: f32,
    fogColor: vec3<f32>,
    fogStart: f32,
    fogEnd: f32,
    fadeSeconds: f32,
    checkerCells: f32,
    _pad: f32,
};

struct TileInstance {
    origin: vec2<f32>,
    size: f32,
    layer: f32,
    fadeStart: f32,
    baseLayer: f32,
    baseUv: vec2<f32>,
    baseScale: f32,
    // Three scalars, not a vec3: a vec3 aligns to 16 bytes and would grow the
    // struct to 64, out of step with the 48-byte stride the buffer is written with.
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var<storage, read> tiles: array<TileInstance>;
@group(0) @binding(2) var atlasSampler: sampler;
@group(0) @binding(3) var atlas: texture_2d_array<f32>;

const CHECKER_DARK: vec3<f32> = vec3<f32>(0.70, 0.72, 0.75);
const CHECKER_LIGHT: vec3<f32> = vec3<f32>(0.80, 0.82, 0.85);

const CORNERS = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
);

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) viewDistance: f32,
    @location(2) @interpolate(flat) instance: u32,
};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VSOut {
    let tile = tiles[instanceIndex];
    let corner = CORNERS[vertexIndex];
    let ground = tile.origin + corner * tile.size;
    let world = vec3<f32>(ground.x, 0.0, ground.y);

    var out: VSOut;
    out.position = U.viewProjection * vec4<f32>(world, 1.0);
    out.uv = corner;
    out.viewDistance = distance(world, U.cameraPosition);
    out.instance = instanceIndex;
    return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    let tile = tiles[in.instance];

    let cell = floor(in.uv * U.checkerCells);
    let parity = (i32(cell.x) + i32(cell.y)) & 1;
    let checker = select(CHECKER_DARK, CHECKER_LIGHT, parity == 1);

    // textureSample needs uniform control flow, so every tile samples the
    // atlas twice (a missing layer samples layer 0) and weights decide what shows:
    // the base is a cached ancestor's sub-rectangle or the checkerboard, the
    // tile's own image fades in over it.
    let baseLayer = i32(max(tile.baseLayer, 0.0));
    let baseImage = textureSample(atlas, atlasSampler, in.uv * tile.baseScale + tile.baseUv, baseLayer).rgb;
    let base = select(checker, baseImage, tile.baseLayer >= 0.0);
    let layer = i32(max(tile.layer, 0.0));
    let image = textureSample(atlas, atlasSampler, in.uv, layer).rgb;
    let loaded = step(0.0, tile.layer);
    let fade = loaded * smoothstep(0.0, U.fadeSeconds, U.time - tile.fadeStart);
    let color = mix(base, image, fade);

    let fog = smoothstep(U.fogStart, U.fogEnd, in.viewDistance);
    return vec4<f32>(mix(color, U.fogColor, fog), 1.0);
}
