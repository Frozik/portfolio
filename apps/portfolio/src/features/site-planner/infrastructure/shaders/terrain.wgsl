// The ground of the plot: one regular grid over the plot's bounding box, its
// vertices displaced by the sampled elevations. Nothing feeds it per vertex —
// a grid position is arithmetic on the vertex index plus one lookup into the
// elevations, so editing a survey mark rewrites a storage buffer and touches
// neither the pipeline nor a vertex buffer.

struct TerrainGrid {
    // Plan position of sample (0, 0) — the south-west corner of the grid.
    origin: vec2<f32>,
    cellSize: f32,
    // Samples per side; the grid holds resolution² of them.
    resolution: u32,
    minElevation: f32,
    // Floored away from zero, so level terrain cannot divide the tint by it.
    elevationSpan: f32,
};

// Where the analysis raster lies on the plan. It is carried apart from the grid
// because it is uploaded apart from it: switching the overlay must not make the
// ground look for a terrain it has not been handed.
struct AnalysisOverlay {
    // Plan position of the raster's south-west corner — half a texel out from
    // the first grid sample it colours.
    minPosition: vec2<f32>,
    // Plan extent the raster spans, floored away from zero.
    span: vec2<f32>,
    // 1 while an analysis is on, 0 otherwise: the alpha of the whole overlay.
    enabled: f32,
};

@group(0) @binding(1) var<uniform> Grid: TerrainGrid;
@group(0) @binding(4) var<uniform> Overlay: AnalysisOverlay;
// The very raster the 2D plan paints, sampled with the very same nearest rule:
// one texel is one grid sample, and the two views agree texel for texel.
@group(0) @binding(5) var overlayTexture: texture_2d<f32>;
@group(0) @binding(6) var overlaySampler: sampler;
// Row-major, sample (column, row) at `row * resolution + column` — the layout
// of `domain/terrain/heightfield.ts`, uploaded verbatim.
@group(0) @binding(2) var<storage, read> elevations: array<f32>;
// 1 where the plot covers the sample, 0 beyond its boundary.
@group(0) @binding(3) var<storage, read> plotCoverage: array<f32>;

const GROUND_LOW_COLOR = vec3<f32>(0.075, 0.110, 0.086);
const GROUND_HIGH_COLOR = vec3<f32>(0.145, 0.192, 0.157);
// Where the ground stops being the plot's. Coverage is one value per sample and
// interpolates across a triangle, so the cut lands within a cell of the boundary
// — near enough for the accent outline, draped on the boundary itself, to cover
// the difference.
const MIN_DRAWN_COVERAGE = 0.5;
// Matches PLAN_COLORS.boundaryStroke, so the plot reads the same in 2D and 3D.
const BOUNDARY_COLOR = vec3<f32>(0.376, 0.647, 0.980);
// The run of a central difference can never be shorter than one cell.
const MIN_SLOPE_RUN_METERS = 0.001;

struct TerrainVertex {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) normal: vec3<f32>,
    // 0 at the lowest sample of the terrain, 1 at the highest.
    @location(1) heightRatio: f32,
    @location(2) coverage: f32,
    @location(3) lightSpacePosition: vec3<f32>,
    // Both the grid and the raster are laid out linearly over the plan, so the
    // lookup interpolates across a triangle exactly.
    @location(4) overlayUv: vec2<f32>,
};

fn elevationAt(column: i32, row: i32) -> f32 {
    let lastIndex = i32(Grid.resolution) - 1;

    return elevations[clamp(row, 0, lastIndex) * i32(Grid.resolution) + clamp(column, 0, lastIndex)];
}

/**
 * Where the sample a vertex stands for sits in the world. Shared by the camera
 * pass and the shadow pass, so the ground can never be one shape to the eye and
 * another to the sun.
 *
 * planToWorld, and the only place it is spelled out twice: +X east, +Y up,
 * +Z south, so plan north is -Z (domain/view/world-frame.ts). The draped
 * boundary outline is lifted by that function on the CPU and drawn against
 * this surface, so a divergence here shows up immediately as a line adrift.
 */
fn terrainWorldPosition(column: i32, row: i32) -> vec3<f32> {
    return vec3<f32>(
        Grid.origin.x + f32(column) * Grid.cellSize,
        elevations[row * i32(Grid.resolution) + column],
        -(Grid.origin.y + f32(row) * Grid.cellSize),
    );
}

@vertex
fn vsTerrain(@builtin(vertex_index) vertexIndex: u32) -> TerrainVertex {
    let resolution = i32(Grid.resolution);
    let lastIndex = resolution - 1;
    let column = i32(vertexIndex) % resolution;
    let row = i32(vertexIndex) / resolution;
    let elevation = elevations[row * resolution + column];
    let worldPosition = terrainWorldPosition(column, row);

    // Central differences over the neighbouring samples, always in step with
    // the elevations because they are read from them. At the border the run
    // shortens to the one cell that exists rather than reaching past the edge.
    let east = clamp(column + 1, 0, lastIndex);
    let west = clamp(column - 1, 0, lastIndex);
    let north = clamp(row + 1, 0, lastIndex);
    let south = clamp(row - 1, 0, lastIndex);
    let eastwardRun = max(f32(east - west) * Grid.cellSize, MIN_SLOPE_RUN_METERS);
    let northwardRun = max(f32(north - south) * Grid.cellSize, MIN_SLOPE_RUN_METERS);
    let eastwardSlope = (elevationAt(east, row) - elevationAt(west, row)) / eastwardRun;
    let northwardSlope = (elevationAt(column, north) - elevationAt(column, south)) / northwardRun;

    var output: TerrainVertex;

    output.clipPosition = worldToClip(worldPosition);
    // Cross product of the two surface tangents: ground rising to the east
    // tilts the normal west, and plan north being -Z tilts a northward rise
    // towards +Z.
    output.normal = normalize(vec3<f32>(-eastwardSlope, 1.0, northwardSlope));
    output.heightRatio = clamp((elevation - Grid.minElevation) / Grid.elevationSpan, 0.0, 1.0);
    output.coverage = plotCoverage[row * resolution + column];
    output.lightSpacePosition = toLightSpace(worldPosition, output.normal);

    let planPosition = Grid.origin + vec2<f32>(f32(column), f32(row)) * Grid.cellSize;

    output.overlayUv = (planPosition - Overlay.minPosition) / Overlay.span;

    return output;
}

@fragment
fn fsTerrain(input: TerrainVertex) -> @location(0) vec4<f32> {
    // Sampled unconditionally and faded by `enabled` rather than branched on:
    // with no analysis the binding holds a single transparent texel, and a
    // texture lookup outside uniform control flow is worth avoiding — which is
    // also why it is taken before anything is dropped below.
    let overlay = textureSample(overlayTexture, overlaySampler, input.overlayUv);

    // The grid spans the plot's bounding box; only the plot itself is ground the
    // plan says anything about, so what lies beyond the boundary is dropped
    // rather than dimmed — it leaves the sky behind it, and no depth for the
    // shadow of the house to land on.
    if (input.coverage < MIN_DRAWN_COVERAGE) {
        discard;
    }

    let groundColor = mix(GROUND_LOW_COLOR, GROUND_HIGH_COLOR, input.heightRatio);
    // The analysis is a colour *of the ground*, so it goes under the light: the
    // relief and the shadows keep reading through it.
    let color = mix(groundColor, overlay.rgb, overlay.a * Overlay.enabled);
    // Interpolation across the triangle leaves the normal short of unit length.
    let normal = normalize(input.normal);

    return vec4<f32>(color * sunShading(normal, shadowFactor(input.lightSpacePosition, normal)), 1.0);
}

// The ground as the sun sees it, for the depth-only pass filling the shadow map.
// The whole grid casts, the part the camera pass discards included: the ground
// around the plot is one continuous surface with it, and a rise just outside the
// boundary has to keep shading what is inside — cutting it out would cost this
// pass a fragment stage it does not otherwise need.
@vertex
fn vsTerrainShadow(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    let resolution = i32(Grid.resolution);
    let worldPosition = terrainWorldPosition(
        i32(vertexIndex) % resolution,
        i32(vertexIndex) / resolution
    );

    return Scene.lightViewProjection * vec4<f32>(worldPosition, 1.0);
}

// The plot's boundary, draped over the terrain on the CPU and handed over as
// world-space line segments. It runs on the boundary itself while the ground is
// cut at whole cells, so it is also what dresses that cut into a clean edge —
// hence the depth test it passes without writing, over ground and sky alike.
@vertex
fn vsBoundaryOutline(@location(0) worldPosition: vec3<f32>) -> @builtin(position) vec4<f32> {
    return worldToClip(worldPosition);
}

@fragment
fn fsBoundaryOutline() -> @location(0) vec4<f32> {
    return vec4<f32>(BOUNDARY_COLOR, 1.0);
}
