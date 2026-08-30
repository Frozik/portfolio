// Shared by every layer of the 3D view. World axes: +X east, +Y up, +Z south —
// plan north is -Z (see domain/view/world-frame.ts).

struct SceneUniforms {
    // World -> clip space, camera included.
    viewProjection: mat4x4<f32>,
    // World -> the sun's own clip space, as the shadow map was rasterised.
    lightViewProjection: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    // Light reaching the ground with no sun on it at all.
    ambientStrength: f32,
    // Unit vector pointing *towards* the sun, so a surface normal dots straight against it.
    sunDirection: vec3<f32>,
    // Strength of the direct light: zero once the sun is under the horizon.
    sunIntensity: f32,
    // Depth of the light's box in metres; the shadow bias is authored in metres.
    shadowDepthRangeMeters: f32,
    // World size of one shadow texel; the normal offset is authored in texels.
    shadowTexelWorldSizeMeters: f32,
};

@group(0) @binding(0) var<uniform> Scene: SceneUniforms;

fn worldToClip(worldPosition: vec3<f32>) -> vec4<f32> {
    return Scene.viewProjection * vec4<f32>(worldPosition, 1.0);
}

/**
 * Lambert term against the sun, floored by the ambient light. The shadow only
 * ever darkens the direct half — ground the sun cannot reach keeps the sky's
 * light rather than going black, which is also what makes the night, where the
 * intensity is zero, need no separate case.
 */
fn sunShading(normal: vec3<f32>, shadow: f32) -> f32 {
    return Scene.ambientStrength +
        Scene.sunIntensity * shadow * max(dot(normal, Scene.sunDirection), 0.0);
}
