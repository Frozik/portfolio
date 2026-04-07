const PI: f32 = 3.14159265358979323846;
const HALF: f32 = 0.5;
const DIAMOND_POINT_COUNT: u32 = 5u;
// Keep in sync with DIAMOND_SEGMENT_COUNT in chart-draw.ts
const DIAMOND_SEGMENT_COUNT: u32 = 4u;

struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    time: f32,
    sinCount: u32,
    sinPenMin: f32,
    sinPenMax: f32,
    diamondMargin: f32,
    diamondOffset: u32,
    sinYCount: u32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) joinCenter: vec2<f32>,
    @location(2) joinWidth: f32,
};

// 6 vertices for a join quad (2 triangles)
const JOIN_BASIS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(0.5, -0.5),
);

// 6 vertices for a line rectangle (2 triangles)
const RECT_BASIS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -0.5),
    vec2<f32>(1.0, -0.5),
    vec2<f32>(1.0, 0.5),
    vec2<f32>(0.0, -0.5),
    vec2<f32>(1.0, 0.5),
    vec2<f32>(0.0, 0.5),
);

// Diamond data
const DIAMOND_POSITIONS: array<vec2<f32>, 5> = array<vec2<f32>, 5>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
);

const DIAMOND_WIDTHS: array<f32, 5> = array<f32, 5>(4.0, 16.0, 4.0, 16.0, 4.0);

const DIAMOND_COLORS: array<vec4<f32>, 5> = array<vec4<f32>, 5>(
    vec4<f32>(0.0, 0.5, 1.0, 1.0),
    vec4<f32>(0.5, 1.0, 0.0, 1.0),
    vec4<f32>(1.0, 0.5, 0.0, 1.0),
    vec4<f32>(1.0, 0.0, 0.5, 1.0),
    vec4<f32>(0.0, 0.5, 1.0, 1.0),
);

fn getSinUVPoint(index: f32, count: f32) -> vec2<f32> {
    let x = (index / count - HALF) * 2.0;
    let y = sin(x * HALF * PI + U.time);
    let indexU32 = u32(index);
    let sign = select(-1.0, 1.0, (indexU32 + 1u) % 4u > 1u);
    return vec2<f32>(x, y * sign);
}

fn getSinWidth(index: f32, count: f32) -> f32 {
    return U.sinPenMin + (index / count) * U.sinPenMax;
}

fn getSinColor(uv: vec2<f32>) -> vec4<f32> {
    return vec4<f32>(HALF, (uv.x + 1.0) / 2.0, (uv.y + 1.0) / 2.0, 1.0);
}

// Sin-Y: perpendicular sine wave along the Y axis
fn getSinYUVPoint(index: f32, count: f32) -> vec2<f32> {
    let y = (index / count - HALF) * 2.0;
    let x = sin(y * HALF * PI + U.time);
    let indexU32 = u32(index);
    let sign = select(-1.0, 1.0, (indexU32 + 1u) % 4u > 1u);
    return vec2<f32>(x * sign, y);
}

fn getSinYColor(uv: vec2<f32>) -> vec4<f32> {
    return vec4<f32>((uv.y + 1.0) / 2.0, HALF, (uv.x + 1.0) / 2.0, 1.0);
}

struct SegmentData {
    pointA: vec2<f32>,
    pointB: vec2<f32>,
    widthA: f32,
    widthB: f32,
    colorA: vec4<f32>,
    colorB: vec4<f32>,
};

fn getSegmentData(instanceId: u32) -> SegmentData {
    var seg: SegmentData;

    if (instanceId < U.sinCount) {
        // Sine wave segment
        let count = f32(U.sinCount);
        let indexA = f32(instanceId);
        let indexB = f32(instanceId + 1u);

        let uvA = getSinUVPoint(indexA, count);
        let uvB = getSinUVPoint(indexB, count);

        let sizeX = U.viewport.x - 4.0 * U.sinPenMax;
        let sizeY = U.viewport.y - 4.0 * U.sinPenMax;

        seg.pointA = vec2<f32>(uvA.x * sizeX * HALF, uvA.y * sizeY * HALF);
        seg.pointB = vec2<f32>(uvB.x * sizeX * HALF, uvB.y * sizeY * HALF);
        seg.widthA = getSinWidth(indexA, count);
        seg.widthB = getSinWidth(indexB, count);
        seg.colorA = getSinColor(uvA);
        seg.colorB = getSinColor(uvB);
    } else {
        // Diamond segment
        let diamondIdx = instanceId - U.diamondOffset;

        let posA = DIAMOND_POSITIONS[diamondIdx];
        let posB = DIAMOND_POSITIONS[diamondIdx + 1u];

        let sizeX = U.viewport.x - U.diamondMargin;
        let sizeY = U.viewport.y - U.diamondMargin;

        seg.pointA = posA * vec2<f32>(sizeX * HALF, sizeY * HALF);
        seg.pointB = posB * vec2<f32>(sizeX * HALF, sizeY * HALF);
        seg.widthA = DIAMOND_WIDTHS[diamondIdx];
        seg.widthB = DIAMOND_WIDTHS[diamondIdx + 1u];
        seg.colorA = DIAMOND_COLORS[diamondIdx];
        seg.colorB = DIAMOND_COLORS[diamondIdx + 1u];
    }

    return seg;
}

fn getSinYSegmentData(instanceId: u32) -> SegmentData {
    var seg: SegmentData;

    let count = f32(U.sinYCount);
    let indexA = f32(instanceId);
    let indexB = f32(instanceId + 1u);

    let uvA = getSinYUVPoint(indexA, count);
    let uvB = getSinYUVPoint(indexB, count);

    let sizeX = U.viewport.x - 4.0 * U.sinPenMax;
    let sizeY = U.viewport.y - 4.0 * U.sinPenMax;

    seg.pointA = vec2<f32>(uvA.x * sizeX * HALF, uvA.y * sizeY * HALF);
    seg.pointB = vec2<f32>(uvB.x * sizeX * HALF, uvB.y * sizeY * HALF);
    seg.widthA = getSinWidth(indexA, count);
    seg.widthB = getSinWidth(indexB, count);
    seg.colorA = getSinYColor(uvA);
    seg.colorB = getSinYColor(uvB);

    return seg;
}

fn safeNormalize(v: vec2<f32>) -> vec2<f32> {
    let len2 = dot(v, v);
    if (len2 > 1e-20) {
        return v * inverseSqrt(len2);
    }
    return vec2<f32>(0.0, 1.0);
}

fn buildVertex(seg: SegmentData, vid: u32) -> VSOut {
    var out: VSOut;

    let JOIN_A_END: u32 = 6u;
    let JOIN_B_END: u32 = 12u;

    if (vid < JOIN_A_END) {
        // Join A (circle at pointA)
        let basis = JOIN_BASIS[vid];
        out.joinCenter = basis;
        out.joinWidth = seg.widthA;
        out.color = seg.colorA;

        let offset = basis * seg.widthA;
        out.position = U.mvp * vec4<f32>(seg.pointA + offset, 0.0, 1.0);
    } else if (vid < JOIN_B_END) {
        // Join B (circle at pointB)
        let localVid = vid - JOIN_A_END;
        let basis = JOIN_BASIS[localVid];
        out.joinCenter = basis;
        out.joinWidth = seg.widthB;
        out.color = seg.colorB;

        let offset = basis * seg.widthB;
        out.position = U.mvp * vec4<f32>(seg.pointB + offset, 0.0, 1.0);
    } else {
        // Line body rectangle
        let localVid = vid - JOIN_B_END;
        let basis = RECT_BASIS[localVid];

        out.joinCenter = vec2<f32>(0.0, 0.0);
        out.joinWidth = 0.0;

        // Direction along the segment
        let dir = seg.pointB - seg.pointA;
        let normal = safeNormalize(vec2<f32>(-dir.y, dir.x));

        // Width at this vertex depends on t (basis.x)
        let w = mix(seg.widthA, seg.widthB, basis.x);

        // Base position along the segment
        let basePos = mix(seg.pointA, seg.pointB, basis.x);
        let vertexPos = basePos + normal * (basis.y * w);

        out.color = mix(seg.colorA, seg.colorB, basis.x);
        out.position = U.mvp * vec4<f32>(vertexPos, 0.0, 1.0);
    }

    return out;
}

@vertex
fn vs(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    let seg = getSegmentData(iid);
    return buildVertex(seg, vid);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    if (in.joinWidth > 0.0 && dot(in.joinCenter, in.joinCenter) > 0.25) {
        discard;
    }
    return in.color;
}

// Sin-Y vertex shader -- uses sinYCount instances
@vertex
fn vsSinY(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    let seg = getSinYSegmentData(iid);
    return buildVertex(seg, vid);
}

// Sin-Y fragment shader -- renders opaque (alpha=1) into offscreen
@fragment
fn fsSinY(in: VSOut) -> @location(0) vec4<f32> {
    if (in.joinWidth > 0.0 && dot(in.joinCenter, in.joinCenter) > 0.25) {
        discard;
    }
    return in.color;
}
