// The terrain texture, sampled nearest onto the field quad. Red is dirt presence, green
// the palette variation that rides along as dirt falls, blue the scorch a blast burnt into it.

@group(0) @binding(1) var terrainTexture: texture_2d<f32>;
@group(0) @binding(2) var terrainSampler: sampler;

const DIRT_THRESHOLD: f32 = 0.5;
const DIRT_DARK = vec3<f32>(0.34, 0.22, 0.13);
const DIRT_LIGHT = vec3<f32>(0.62, 0.44, 0.26);
const SCORCH_COLOR = vec3<f32>(0.08, 0.06, 0.06);
const RIM_COLOR = vec3<f32>(0.76, 0.63, 0.38);
const RIM_STRENGTH: f32 = 0.55;
/** How much darker the deepest dirt is than the surface. */
const DEPTH_SHADE: f32 = 0.45;

@fragment
fn fsTerrain(in: FieldQuadVSOut) -> @location(0) vec4<f32> {
    let textureSize = vec2<f32>(textureDimensions(terrainTexture));
    let texel = textureSample(terrainTexture, terrainSampler, in.uv);
    let above = textureSample(terrainTexture, terrainSampler, in.uv - vec2<f32>(0.0, 1.0 / textureSize.y));

    if (texel.r < DIRT_THRESHOLD) {
        discard;
    }

    let shaded = mix(DIRT_DARK, DIRT_LIGHT, texel.g) * mix(1.0, DEPTH_SHADE, clamp(in.uv.y, 0.0, 1.0));
    // A lit rim wherever dirt meets open air reads as the jagged silhouette of the original.
    let rimmed = select(shaded, mix(shaded, RIM_COLOR, RIM_STRENGTH), above.r < DIRT_THRESHOLD);

    return vec4<f32>(mix(rimmed, SCORCH_COLOR, texel.b), 1.0);
}
