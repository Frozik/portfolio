struct Uniforms {
    viewport: vec2<f32>,      // canvas size in pixels
    timeRangeMin: f32,        // visible time range start (delta from base)
    timeRangeMax: f32,        // visible time range end (delta from base)
    valueRangeMin: f32,       // visible value range start (delta from base)
    valueRangeMax: f32,       // visible value range end (delta from base)
    pointCount: u32,          // number of points in this draw call
    textureWidth: u32,        // TEXTURE_WIDTH constant
    lineWidth: f32,           // DPR scale factor for per-point sizes
    textureRow: u32,          // starting row in the data texture
    baseTime: f32,            // base time for delta decoding
    baseValue: f32,           // base value for delta decoding
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var dataTexture: texture_2d<f32>;

const BYTE_MASK: u32 = 0xFFu;
const SHIFT_R: u32 = 8u;
const SHIFT_G: u32 = 16u;
const SHIFT_B: u32 = 24u;
const COLOR_SCALE: f32 = 255.0;

// Layout matches packColor: [A bits 0-7] [R bits 8-15] [G bits 16-23] [B bits 24-31]
fn unpackColorWgsl(packed: f32) -> vec4<f32> {
    let bits = bitcast<u32>(packed);
    let a = f32(bits & BYTE_MASK) / COLOR_SCALE;
    let r = f32((bits >> SHIFT_R) & BYTE_MASK) / COLOR_SCALE;
    let g = f32((bits >> SHIFT_G) & BYTE_MASK) / COLOR_SCALE;
    let b = f32((bits >> SHIFT_B) & BYTE_MASK) / COLOR_SCALE;
    return vec4<f32>(r, g, b, a);
}

fn readPoint(index: u32) -> vec4<f32> {
    let row = U.textureRow + index / U.textureWidth;
    let col = index % U.textureWidth;
    return textureLoad(dataTexture, vec2<u32>(col, row), 0);
}

fn safeNormalize(v: vec2<f32>) -> vec2<f32> {
    let len2 = dot(v, v);
    if (len2 > 1e-20) {
        return v * inverseSqrt(len2);
    }
    return vec2<f32>(0.0, 1.0);
}

fn dataToPixel(timeDelta: f32, valueDelta: f32) -> vec2<f32> {
    let timeRange = U.timeRangeMax - U.timeRangeMin;
    let valueRange = U.valueRangeMax - U.valueRangeMin;

    let nx = (timeDelta - U.timeRangeMin) / timeRange;
    let ny = (valueDelta - U.valueRangeMin) / valueRange;

    return vec2<f32>(nx * U.viewport.x, ny * U.viewport.y);
}

fn pixelToClip(pixel: vec2<f32>) -> vec2<f32> {
    return (pixel / U.viewport) * 2.0 - 1.0;
}
