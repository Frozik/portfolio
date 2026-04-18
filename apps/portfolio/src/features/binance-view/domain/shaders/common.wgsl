// Shared WGSL: Heatmap uniforms, block descriptors, data-texture binding
// and tiny helpers for mapping (timeDelta, price) to clip space.
//
// Layout constants are injected via pipeline `constants` (WGSL `override`)
// so the same shader module works for both 16384- and 8192-wide textures.
//
// Bindings (group 0) — must match createBindGroupLayout in heatmap-layer.ts:
//   0: uniform         HeatmapUniforms
//   1: texture_2d<f32> dataTexture            (rgba32float, unfilterable-float)
//   2: storage(ro)     array<BlockDescriptor>

override SNAPSHOT_SLOTS: u32 = 128u;
override SNAPSHOTS_PER_ROW: u32 = 128u;
override ROWS_PER_BLOCK: u32 = 1u;

// Diagonal stripe overlay used to mark interpolated (repeat-last) cells.
// The period is measured in device pixels so the pattern stays stable
// regardless of zoom; darken factor < 1.0 scales the base heatmap color.
override STRIPE_PERIOD_PX: f32 = 8.0;
override STRIPE_DARK_FACTOR: f32 = 0.45;

// Alpha modulation by magnitude: low-magnitude (green) cells fade into
// the background, high-magnitude (red) cells stay fully opaque.
override CELL_ALPHA_LOW: f32 = 0.35;

struct HeatmapUniforms {
    viewport: vec2<f32>,
    viewTimeStartDeltaMs: f32,
    viewTimeEndDeltaMs: f32,
    timeStepMs: f32,
    priceStep: f32,
    priceMinValue: f32,
    priceMaxValue: f32,
    magnitudeMinValue: f32,
    magnitudeMaxValue: f32,
    blockCount: u32,
    // Width of the plot area in device pixels. `viewport.x` covers the
    // full canvas (for pixel→clip mapping); `plotWidthPx` excludes the
    // right-hand Y-axis panel so heatmap cells only occupy the plot area.
    plotWidthPx: f32,
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
    _pad4: u32,
};

struct BlockDescriptor {
    textureRowIndex: u32,
    count: u32,
    instanceOffset: u32,
    baseTimeDeltaMs: f32,
};

@group(0) @binding(0) var<uniform> U: HeatmapUniforms;
@group(0) @binding(1) var dataTexture: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> blocks: array<BlockDescriptor>;

fn priceMin() -> f32 { return U.priceMinValue; }
fn priceMax() -> f32 { return U.priceMaxValue; }
fn magnitudeMin() -> f32 { return U.magnitudeMinValue; }
fn magnitudeMax() -> f32 { return U.magnitudeMaxValue; }

struct CellCoord {
    col: u32,
    row: u32,
    snapshotInBlock: u32,
    levelIndex: u32,
};

fn cellCoordFromLocal(blockSlot: u32, localCellIndex: u32) -> CellCoord {
    let snapshotInBlock = localCellIndex / SNAPSHOT_SLOTS;
    let levelIndex = localCellIndex % SNAPSHOT_SLOTS;
    let rowInBlock = snapshotInBlock / SNAPSHOTS_PER_ROW;
    let snapshotColumn = snapshotInBlock % SNAPSHOTS_PER_ROW;
    var coord: CellCoord;
    coord.col = snapshotColumn * SNAPSHOT_SLOTS + levelIndex;
    coord.row = blockSlot * ROWS_PER_BLOCK + rowInBlock;
    coord.snapshotInBlock = snapshotInBlock;
    coord.levelIndex = levelIndex;
    return coord;
}

fn timeDeltaToPixelX(timeDeltaMs: f32) -> f32 {
    let range = U.viewTimeEndDeltaMs - U.viewTimeStartDeltaMs;
    let normalized = (timeDeltaMs - U.viewTimeStartDeltaMs) / range;
    return normalized * U.plotWidthPx;
}

fn priceToPixelY(price: f32) -> f32 {
    let range = priceMax() - priceMin();
    let normalized = (price - priceMin()) / range;
    // Flip so higher prices are at the top of the canvas.
    return (1.0 - normalized) * U.viewport.y;
}

fn pixelToClip(pixel: vec2<f32>) -> vec2<f32> {
    let clip = (pixel / U.viewport) * 2.0 - 1.0;
    // Flip Y so (0,0) is top-left in pixel space.
    return vec2<f32>(clip.x, -clip.y);
}

// Cells tile edge-to-edge without overdraw: the previous 0.5 px
// overlap was safe only while alpha was always 1.0 (opaque neighbour
// covered the seam). With magnitude-driven alpha < 1 the overlap
// strip gets double-blended and shows up as a visible brighter grid
// at every cell boundary. The tiny MSAA sub-pixel transparency at
// exact cell edges is preferable to that double-bright artefact.
fn timeStepHalfPixels() -> f32 {
    let range = U.viewTimeEndDeltaMs - U.viewTimeStartDeltaMs;
    return 0.5 * U.timeStepMs / range * U.plotWidthPx;
}

fn priceStepHalfPixels() -> f32 {
    let range = priceMax() - priceMin();
    return 0.5 * U.priceStep / range * U.viewport.y;
}
