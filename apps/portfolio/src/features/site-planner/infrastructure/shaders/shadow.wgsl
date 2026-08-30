// Reading the shadow map. The map itself is filled by the depth-only pass that
// runs first in the frame (infrastructure/layers/shadow-layer.ts), from the
// vertex entry points that sit beside the geometry they draw.
//
// Group 1 rather than a free binding in group 0: the ground and the objects have
// their own group 0 layouts, and both bind this same group unchanged.

@group(1) @binding(0) var shadowMap: texture_depth_2d;
@group(1) @binding(1) var shadowComparisonSampler: sampler_comparison;

// Slope-scale depth bias, in metres of ground rather than in units of the light
// box: a surface turned away from the sun crosses more depth per texel and needs
// more room, a surface facing it needs almost none. Converting from metres here
// is what keeps the bias honest whatever size of plot the box was built around.
//
// Deliberately small, because a bias is the wrong tool for the grazing sun this
// scene spends its evenings in: it slides a shadow away from whatever casts it by
// bias / sin(sun elevation), which is decimetres of daylight under a wall by the
// time it is large enough to matter there. The normal offset below takes that
// case; the bias is left with the middle band of angles, where the offset falls a
// centimetre or two short, and with the depth quantisation beneath it.
const SLOPE_BIAS_METERS = 0.02;
const MIN_BIAS_METERS = 0.005;

// 3×3 percentage-closer filtering: nine taps around the texel soften the
// staircase a single comparison leaves along a shadow's edge.
const PCF_RADIUS = 1;

// How far along its own normal a receiver is pushed before it is looked up,
// counted in shadow texels. The lookup has to clear the whole footprint it reads:
// the filter reaches one texel out and the comparison sampler blends over half a
// texel more, so about one and a half — two leaves a margin. What it costs is
// that the lookup drifts across the surface by at most that many texels, some
// 8 cm on a plot forty metres across, inside the ±10 cm the feature targets.
const NORMAL_OFFSET_TEXELS = 2.0;

/**
 * Where a receiver stands as the shadow map sees it, moved first along its own
 * normal — normal-offset shadows, the cure for a surface shadowing itself.
 *
 * One texel of the map holds a single depth for the whole patch of ground it
 * stands for, and at a low sun that patch runs decimetres deep; comparing a
 * fragment's own depth against it stripes flat faces with their own shadow. Going
 * *across* the surface instead of along the light buys the same clearance and
 * costs only a lateral drift of the lookup — the shadow keeps its footing where
 * the wall meets the ground.
 *
 * The offset follows the sine of the incidence angle: with the sun down the
 * normal a texel spans no depth at all and nothing is needed, and it is at
 * grazing incidence that the error is at its worst.
 */
fn toLightSpace(worldPosition: vec3<f32>, normal: vec3<f32>) -> vec3<f32> {
    let surfaceNormal = normalize(normal);
    let sunCosine = dot(surfaceNormal, Scene.sunDirection);
    let incidenceSine = sqrt(max(1.0 - sunCosine * sunCosine, 0.0));
    let offsetPosition = worldPosition + surfaceNormal *
        (NORMAL_OFFSET_TEXELS * Scene.shadowTexelWorldSizeMeters * incidenceSine);
    let lightClip = Scene.lightViewProjection * vec4<f32>(offsetPosition, 1.0);

    // Light clip space is orthographic, so w is 1 — the only step left is from
    // clip's [-1, 1] x/y to the texture's [0, 1], with y flipped for the
    // top-down texel order.
    return vec3<f32>(
        lightClip.x * 0.5 + 0.5,
        lightClip.y * -0.5 + 0.5,
        lightClip.z,
    );
}

/** 1 where the sun reaches the surface, 0 where something stands in its way. */
fn shadowFactor(lightSpacePosition: vec3<f32>, normal: vec3<f32>) -> f32 {
    // Outside the light's box nothing was rendered into the map, so nothing can
    // be shadowing this point either. Depth is checked at both ends: a point
    // behind the near plane would compare against a negative reference and come
    // back shadowed everywhere.
    if (lightSpacePosition.z < 0.0 ||
        lightSpacePosition.z > 1.0 ||
        any(lightSpacePosition.xy < vec2<f32>(0.0)) ||
        any(lightSpacePosition.xy > vec2<f32>(1.0))) {
        return 1.0;
    }

    let biasMeters = max(
        SLOPE_BIAS_METERS * (1.0 - dot(normal, Scene.sunDirection)),
        MIN_BIAS_METERS
    );
    let comparisonDepth = lightSpacePosition.z - biasMeters / Scene.shadowDepthRangeMeters;
    let texelSize = 1.0 / vec2<f32>(textureDimensions(shadowMap));

    var lit = 0.0;

    for (var row = -PCF_RADIUS; row <= PCF_RADIUS; row++) {
        for (var column = -PCF_RADIUS; column <= PCF_RADIUS; column++) {
            let offset = vec2<f32>(f32(column), f32(row)) * texelSize;

            // The level-taking variant, and deliberately: it needs no
            // derivatives, so it stays legal under the early return above —
            // which `textureSampleCompare` would not, its uniform control flow
            // requirement being broken by any fragment that leaves early.
            lit += textureSampleCompareLevel(
                shadowMap,
                shadowComparisonSampler,
                lightSpacePosition.xy + offset,
                comparisonDepth
            );
        }
    }

    let tapCount = f32((2 * PCF_RADIUS + 1) * (2 * PCF_RADIUS + 1));

    return lit / tapCount;
}
