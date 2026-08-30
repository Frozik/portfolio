// What stands on the ground. The geometry arrives already in world space with a
// normal per vertex (domain/geometry/extrude-footprint.ts), so this stage only
// projects it and lights it against the same sun the terrain is lit by.

// Walls and the apron carrying the pad down to the ground.
const WALL_COLOR = vec3<f32>(0.145, 0.188, 0.255);
// The roof slab, a shade towards the accent blue so the volume reads from above.
const ROOF_COLOR = vec3<f32>(0.169, 0.290, 0.451);
// A face this close to horizontal is roof; everything else is a vertical side.
// The extrusion produces nothing in between, so the split is exact rather than
// a threshold that has to be tuned.
const ROOF_NORMAL_THRESHOLD = 0.7;

struct ObjectVertex {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) lightSpacePosition: vec3<f32>,
};

@vertex
fn vsObject(
    @location(0) worldPosition: vec3<f32>,
    @location(1) normal: vec3<f32>,
) -> ObjectVertex {
    var output: ObjectVertex;

    output.clipPosition = worldToClip(worldPosition);
    output.normal = normal;
    output.lightSpacePosition = toLightSpace(worldPosition, normal);

    return output;
}

@fragment
fn fsObject(input: ObjectVertex) -> @location(0) vec4<f32> {
    // Interpolation across the triangle leaves the normal short of unit length.
    let normal = normalize(input.normal);
    let color = select(WALL_COLOR, ROOF_COLOR, abs(normal.y) > ROOF_NORMAL_THRESHOLD);

    return vec4<f32>(color * sunShading(normal, shadowFactor(input.lightSpacePosition, normal)), 1.0);
}

// The house and the paving as the sun sees them, for the shadow map. Only the
// position is read: the pass writes depth and nothing else.
@vertex
fn vsObjectShadow(@location(0) worldPosition: vec3<f32>) -> @builtin(position) vec4<f32> {
    return Scene.lightViewProjection * vec4<f32>(worldPosition, 1.0);
}

// Paving, draped over the ground it follows (domain/terrain/drape-polygons.ts).
// One constant per surface rather than a vertex colour: a stretch of path has
// one material, and the mesh reaching this stage carries the terrain's own
// normals, so a ribbon across a slope is shaded exactly as the ground beside it.
// The hues mirror the plan's PLAN_COLORS.pathFill / pathDirtFill and the CPU
// side of the seam gradient (PATH_SURFACE_DRAPE_COLORS in drape-polygons.ts),
// so a path reads as the same material in 2D and 3D.
const ASPHALT_COLOR = vec3<f32>(0.4627, 0.5059, 0.6039);
const DIRT_COLOR = vec3<f32>(0.6078, 0.4784, 0.2980);
// Poured concrete — the цоколь skirting every building below its walls.
const FOUNDATION_COLOR = vec3<f32>(0.44, 0.44, 0.46);
// Roof covers: planting over a green roof, decking over a terrace.
const GREEN_ROOF_COLOR = vec3<f32>(0.28, 0.46, 0.26);
const TERRACE_COLOR = vec3<f32>(0.52, 0.42, 0.3);

fn shadePath(input: ObjectVertex, color: vec3<f32>) -> vec4<f32> {
    let normal = normalize(input.normal);

    return vec4<f32>(
        color * sunShading(normal, shadowFactor(input.lightSpacePosition, normal)),
        1.0
    );
}

@fragment
fn fsPathAsphalt(input: ObjectVertex) -> @location(0) vec4<f32> {
    return shadePath(input, ASPHALT_COLOR);
}

// A paving stretch that arrives painted per vertex — the asphalt↔dirt seam
// blend, whose gradient is baked into the mesh colours on the CPU. Shares
// ColoredVertex and fsColored with the trees and the cars.
@vertex
fn vsColoredMesh(
    @location(0) worldPosition: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
) -> ColoredVertex {
    var output: ColoredVertex;

    output.clipPosition = worldToClip(worldPosition);
    output.normal = normal;
    output.color = color;
    output.lightSpacePosition = toLightSpace(worldPosition, normal);

    return output;
}

@fragment
fn fsPathDirt(input: ObjectVertex) -> @location(0) vec4<f32> {
    return shadePath(input, DIRT_COLOR);
}

@fragment
fn fsFoundation(input: ObjectVertex) -> @location(0) vec4<f32> {
    return shadePath(input, FOUNDATION_COLOR);
}

@fragment
fn fsGreenRoof(input: ObjectVertex) -> @location(0) vec4<f32> {
    return shadePath(input, GREEN_ROOF_COLOR);
}

@fragment
fn fsTerrace(input: ObjectVertex) -> @location(0) vec4<f32> {
    return shadePath(input, TERRACE_COLOR);
}

// What every instanced template — a tree, a car — hands the fragment stage: it
// paints itself from its own vertex colours instead of deriving a colour from
// the geometry the way the house does.
struct ColoredVertex {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) lightSpacePosition: vec3<f32>,
};

// A scale this small would divide the normal into nonsense; the domain clamps
// every tree well above it (domain/terrain/place-trees.ts).
const MIN_TREE_SCALE = 1e-3;

/** Where a template vertex of a planted tree stands; shared with the shadow pass. */
fn treeWorldPosition(
    localPosition: vec3<f32>,
    instancePosition: vec3<f32>,
    instanceScale: vec2<f32>,
) -> vec3<f32> {
    let scale = max(instanceScale, vec2<f32>(MIN_TREE_SCALE));

    return instancePosition + vec3<f32>(
        localPosition.x * scale.x,
        localPosition.y * scale.y,
        localPosition.z * scale.x,
    );
}

// Trees: one low-polygon template per species (domain/geometry/tree-mesh.ts),
// drawn once per planted tree. The template counts crown radii in x and z and
// tree heights in y, so the instance's two scales are all it takes to size it —
// and the normal is divided by the same scales, which is what keeps a squat tree
// from being lit as if it were slender.
@vertex
fn vsTree(
    @location(0) localPosition: vec3<f32>,
    @location(1) localNormal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) instancePosition: vec3<f32>,
    @location(4) instanceScale: vec2<f32>,
) -> ColoredVertex {
    let worldPosition = treeWorldPosition(localPosition, instancePosition, instanceScale);
    let scale = max(instanceScale, vec2<f32>(MIN_TREE_SCALE));

    var output: ColoredVertex;

    output.clipPosition = worldToClip(worldPosition);
    output.normal = vec3<f32>(
        localNormal.x / scale.x,
        localNormal.y / scale.y,
        localNormal.z / scale.x,
    );
    output.color = color;
    output.lightSpacePosition = toLightSpace(worldPosition, output.normal);

    return output;
}

// Shared by the trees and the cars: both arrive painted, and both are lit by the
// one sun formula the terrain uses.
@fragment
fn fsColored(input: ColoredVertex) -> @location(0) vec4<f32> {
    let normal = normalize(input.normal);

    return vec4<f32>(
        input.color * sunShading(normal, shadowFactor(input.lightSpacePosition, normal)),
        1.0
    );
}

// The trees as the sun sees them: the same instancing, without the normals and
// the colours the shadow map has no use for.
@vertex
fn vsTreeShadow(
    @location(0) localPosition: vec3<f32>,
    @location(3) instancePosition: vec3<f32>,
    @location(4) instanceScale: vec2<f32>,
) -> @builtin(position) vec4<f32> {
    let worldPosition = treeWorldPosition(localPosition, instancePosition, instanceScale);

    return Scene.lightViewProjection * vec4<f32>(worldPosition, 1.0);
}

/**
 * Turns a direction of a car's own frame into the world's. The plan measures the
 * turn counter-clockwise from east (domain/model/site-plan.ts) and the world
 * puts plan north at −Z (domain/view/world-frame.ts), so a plan turn of θ is the
 * right-handed turn of θ about the world's up axis — nose at +X, no scaling, so
 * the same rotation carries the normals.
 */
// A textured template — the loaded car asset — instanced exactly like the
// coloured cars: position and turn per instance, the palette texture sampled
// per fragment and lit by the same sun.
struct TexturedVertex {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) lightSpacePosition: vec3<f32>,
};

@group(2) @binding(0) var assetSampler: sampler;
@group(2) @binding(1) var assetTexture: texture_2d<f32>;

@vertex
fn vsTexturedCar(
    @location(0) localPosition: vec3<f32>,
    @location(1) localNormal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) instancePosition: vec3<f32>,
    @location(4) rotationDegrees: f32,
) -> TexturedVertex {
    let worldPosition = instancePosition + carRotation(localPosition, rotationDegrees);

    var output: TexturedVertex;

    output.clipPosition = worldToClip(worldPosition);
    output.normal = carRotation(localNormal, rotationDegrees);
    output.uv = uv;
    output.lightSpacePosition = toLightSpace(worldPosition, output.normal);

    return output;
}

@fragment
fn fsTextured(input: TexturedVertex) -> @location(0) vec4<f32> {
    let normal = normalize(input.normal);
    let baseColor = textureSample(assetTexture, assetSampler, input.uv).rgb;

    return vec4<f32>(
        baseColor * sunShading(normal, shadowFactor(input.lightSpacePosition, normal)),
        1.0
    );
}

fn carRotation(localDirection: vec3<f32>, rotationDegrees: f32) -> vec3<f32> {
    let angle = radians(rotationDegrees);
    let cosine = cos(angle);
    let sine = sin(angle);

    return vec3<f32>(
        localDirection.x * cosine + localDirection.z * sine,
        localDirection.y,
        -localDirection.x * sine + localDirection.z * cosine,
    );
}

// Cars: one template in metres (domain/geometry/car-mesh.ts), drawn once per
// parked car. Unlike a tree it carries no scales — every car is the same size —
// so an instance is where it stands and which way it faces.
@vertex
fn vsCar(
    @location(0) localPosition: vec3<f32>,
    @location(1) localNormal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) instancePosition: vec3<f32>,
    @location(4) rotationDegrees: f32,
) -> ColoredVertex {
    let worldPosition = instancePosition + carRotation(localPosition, rotationDegrees);

    var output: ColoredVertex;

    output.clipPosition = worldToClip(worldPosition);
    output.normal = carRotation(localNormal, rotationDegrees);
    output.color = color;
    output.lightSpacePosition = toLightSpace(worldPosition, output.normal);

    return output;
}

// The cars as the sun sees them: the same instancing, without the normals and
// the colours the shadow map has no use for.
@vertex
fn vsCarShadow(
    @location(0) localPosition: vec3<f32>,
    @location(3) instancePosition: vec3<f32>,
    @location(4) rotationDegrees: f32,
) -> @builtin(position) vec4<f32> {
    let worldPosition = instancePosition + carRotation(localPosition, rotationDegrees);

    return Scene.lightViewProjection * vec4<f32>(worldPosition, 1.0);
}
