// The falling-sand animation: one thread per terrain column, gravity-accelerated.
//
// The domain resolves a collapse instantly by deleting the void and sliding everything above it
// down, so the animation is the same operation spread over time: each tick the lowest void in a
// column shrinks by the distance the dirt above it has fallen, and everything above that void
// moves down with it. When the void closes, the column matches the domain's rest state exactly —
// the descent cannot drift away from the state the game is being played on.

struct CollapseParams {
    // x = the animation's gravity in wu per tick²; the rest pads out the 16-byte uniform block.
    settings: vec4<f32>,
};

@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var targetTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<storage, read_write> velocities: array<f32>;
@group(0) @binding(3) var<uniform> params: CollapseParams;

override COLLAPSE_WORKGROUP_SIZE: u32;

const DIRT_THRESHOLD: f32 = 0.5;
const NO_ROW: i32 = -1;
const AT_REST: f32 = 0.0;
const MIN_STEP: i32 = 1;

const AIR_TEXEL = vec4<f32>(0.0, 0.0, 0.0, 1.0);

struct ColumnVoid {
    // Bottom row of the lowest void with dirt above it, or NO_ROW when the column has settled.
    bottomRow: i32,
    heightTexels: i32,
};

// Scans the column from the ground up. A void only counts when dirt still rests on top of it,
// which is what keeps the sky above the surface from being mistaken for a crater.
fn findLowestVoid(column: i32, rowCount: i32) -> ColumnVoid {
    var result = ColumnVoid(NO_ROW, 0);
    var voidBottomRow = NO_ROW;
    var voidHeight = 0;

    for (var row = rowCount - 1; row >= 0; row = row - 1) {
        let texel = textureLoad(sourceTexture, vec2<i32>(column, row), 0);
        let isDirt = texel.r >= DIRT_THRESHOLD;

        if (isDirt) {
            if (voidBottomRow != NO_ROW) {
                result = ColumnVoid(voidBottomRow, voidHeight);

                return result;
            }

            continue;
        }

        if (voidBottomRow == NO_ROW) {
            voidBottomRow = row;
            voidHeight = 1;
        } else {
            voidHeight = voidHeight + 1;
        }
    }

    return result;
}

@compute @workgroup_size(COLLAPSE_WORKGROUP_SIZE)
fn collapseDirt(@builtin(global_invocation_id) id: vec3<u32>) {
    let size = textureDimensions(sourceTexture);

    if (id.x >= size.x) {
        return;
    }

    let column = i32(id.x);
    let rowCount = i32(size.y);
    let lowestVoid = findLowestVoid(column, rowCount);

    var step = 0;

    if (lowestVoid.bottomRow == NO_ROW) {
        velocities[column] = AT_REST;
    } else {
        let velocity = velocities[column] + params.settings.x;

        velocities[column] = velocity;
        // Never step past the void: the falling block has to land on the dirt below it, never
        // inside it, or the animation would eat terrain the domain still has.
        step = min(lowestVoid.heightTexels, max(MIN_STEP, i32(round(velocity))));
    }

    for (var row = 0; row < rowCount; row = row + 1) {
        var texel = AIR_TEXEL;
        // Rows below the void are settled ground; everything above it rides the fall.
        let sourceRow = select(row, row - step, row <= lowestVoid.bottomRow);

        if (sourceRow >= 0) {
            texel = textureLoad(sourceTexture, vec2<i32>(column, sourceRow), 0);
        }

        textureStore(targetTexture, vec2<i32>(column, row), texel);
    }
}
