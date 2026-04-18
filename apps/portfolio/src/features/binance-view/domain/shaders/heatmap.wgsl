// Heatmap render pipeline: one instance per visible cell, 6 vertices per
// instance (quad). See common.wgsl for uniforms and layout overrides.

const COLOR_LOW: vec3<f32> = vec3<f32>(0.10, 0.80, 0.20);
const COLOR_MID: vec3<f32> = vec3<f32>(1.00, 0.90, 0.10);
const COLOR_HIGH: vec3<f32> = vec3<f32>(0.90, 0.15, 0.15);

const QUAD_OFFSETS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
);

struct VsOut {
    @builtin(position) position: vec4<f32>,
    @location(0) price: f32,
    @location(1) volume: f32,
    @location(2) isInterpolated: f32,
};

fn findBlockSlot(instanceIndex: u32) -> u32 {
    var low: u32 = 0u;
    var high: u32 = U.blockCount;
    if (high == 0u) {
        return 0u;
    }
    loop {
        if (low + 1u >= high) { break; }
        let mid = (low + high) / 2u;
        if (blocks[mid].instanceOffset <= instanceIndex) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return low;
}

@vertex
fn vsHeatmap(
    @builtin(instance_index) iid: u32,
    @builtin(vertex_index) vid: u32,
) -> VsOut {
    var out: VsOut;

    if (U.blockCount == 0u) {
        out.position = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.price = 0.0;
        out.volume = 0.0;
        out.isInterpolated = 0.0;
        return out;
    }

    let blockIdx = findBlockSlot(iid);
    let desc = blocks[blockIdx];
    let localCell = iid - desc.instanceOffset;

    if (localCell >= desc.count * SNAPSHOT_SLOTS) {
        out.position = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.price = 0.0;
        out.volume = 0.0;
        out.isInterpolated = 0.0;
        return out;
    }

    let coord = cellCoordFromLocal(desc.textureRowIndex, localCell);
    let texel = textureLoad(dataTexture, vec2<u32>(coord.col, coord.row), 0);
    let timeDeltaInBlock = texel.x;
    let price = texel.y;
    let volume = texel.z;
    let isInterpolated = texel.w;

    // Skip padding cells (volume==0) by collapsing the quad off-screen.
    if (volume <= 0.0) {
        out.position = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.price = 0.0;
        out.volume = 0.0;
        out.isInterpolated = 0.0;
        return out;
    }

    let absTimeDelta = desc.baseTimeDeltaMs + timeDeltaInBlock;
    let centerX = timeDeltaToPixelX(absTimeDelta);
    let centerY = priceToPixelY(price);

    let halfW = timeStepHalfPixels();
    let halfH = priceStepHalfPixels();

    let offset = QUAD_OFFSETS[vid];
    let pixel = vec2<f32>(centerX + offset.x * halfW, centerY + offset.y * halfH);
    out.position = vec4<f32>(pixelToClip(pixel), 0.0, 1.0);
    out.price = price;
    out.volume = volume;
    out.isInterpolated = isInterpolated;
    return out;
}

@fragment
fn fsHeatmap(in: VsOut) -> @location(0) vec4<f32> {
    let magnitude = in.price * in.volume;
    let lowBound = magnitudeMin();
    let highBound = magnitudeMax();
    let spread = max(highBound - lowBound, 1e-6);
    let t = clamp((magnitude - lowBound) / spread, 0.0, 1.0);

    var color: vec3<f32>;
    if (t < 0.5) {
        color = mix(COLOR_LOW, COLOR_MID, t * 2.0);
    } else {
        color = mix(COLOR_MID, COLOR_HIGH, (t - 0.5) * 2.0);
    }

    // Alpha rides the same magnitude ramp as the color: green cells
    // fade into the dark background, red cells stay fully opaque. The
    // pipeline uses non-premultiplied alpha blending.
    let alpha = mix(CELL_ALPHA_LOW, 1.0, t);

    // Interpolated cells (repeat-last fillers) get darkened diagonal
    // stripes in screen space so gaps are obvious without changing the
    // hue — the quantization pattern stays readable under zoom.
    if (in.isInterpolated > 0.5) {
        let stripePhase = fract((in.position.x + in.position.y) / STRIPE_PERIOD_PX);
        if (stripePhase > 0.5) {
            color = color * STRIPE_DARK_FACTOR;
        }
    }

    return vec4<f32>(color, alpha);
}
