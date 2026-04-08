import{M as e,N as t,P as n,j as r,st as i}from"./c-D2N51Ix1.js";import{t as a}from"./c-CLIWQxFX.js";import{t as o}from"./c-9Q3yUddn.js";var s=i(t(),1),c=.149,l=.149,u=.149,d=.5,f=.7,p=1e-5,m=16384,h=.5,g=.4,_=.6,v=`rgba8unorm`,y=1e3,b=`const PI: f32 = 3.14159265358979323846;
const HALF: f32 = 0.5;
const BORDER_POINT_COUNT: u32 = 5u;
// Keep in sync with BORDER_SEGMENT_COUNT in chart-draw.ts
const BORDER_SEGMENT_COUNT: u32 = 4u;

struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    time: f32,
    sinCount: u32,
    sinPenMin: f32,
    sinPenMax: f32,
    borderMargin: f32,
    borderOffset: u32,
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

// Border data
const BORDER_POSITIONS: array<vec2<f32>, 5> = array<vec2<f32>, 5>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
);

const BORDER_WIDTHS: array<f32, 5> = array<f32, 5>(4.0, 16.0, 4.0, 16.0, 4.0);

const BORDER_COLORS: array<vec4<f32>, 5> = array<vec4<f32>, 5>(
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
        // Border segment
        let borderIdx = instanceId - U.borderOffset;

        let posA = BORDER_POSITIONS[borderIdx];
        let posB = BORDER_POSITIONS[borderIdx + 1u];

        let sizeX = U.viewport.x - U.borderMargin;
        let sizeY = U.viewport.y - U.borderMargin;

        seg.pointA = posA * vec2<f32>(sizeX * HALF, sizeY * HALF);
        seg.pointB = posB * vec2<f32>(sizeX * HALF, sizeY * HALF);
        seg.widthA = BORDER_WIDTHS[borderIdx];
        seg.widthB = BORDER_WIDTHS[borderIdx + 1u];
        seg.colorA = BORDER_COLORS[borderIdx];
        seg.colorB = BORDER_COLORS[borderIdx + 1u];
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
`,x=`struct CompositeUniforms {
    opacity: f32,
};

struct CompositeVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var offscreenTex: texture_2d<f32>;
@group(0) @binding(1) var offscreenSampler: sampler;
@group(0) @binding(2) var<uniform> CU: CompositeUniforms;

// Fullscreen triangle: 3 vertices covering the entire screen
@vertex
fn vsComposite(@builtin(vertex_index) vid: u32) -> CompositeVSOut {
    var out: CompositeVSOut;

    // Generates a large triangle that covers the viewport:
    // vid=0: (-1, -1), vid=1: (3, -1), vid=2: (-1, 3)
    let x = f32(vid & 1u) * 4.0 - 1.0;
    let y = f32((vid >> 1u) & 1u) * 4.0 - 1.0;

    out.position = vec4<f32>(x, y, 0.0, 1.0);
    // Map from clip space to UV: x: [-1,1] -> [0,1], y: [-1,1] -> [1,0] (flip Y)
    out.uv = vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5);

    return out;
}

@fragment
fn fsComposite(in: CompositeVSOut) -> @location(0) vec4<f32> {
    let color = textureSample(offscreenTex, offscreenSampler, in.uv);
    // Apply layer opacity -- multiply alpha by the uniform opacity
    // Output premultiplied alpha for correct blending
    return vec4<f32>(color.rgb * CU.opacity, color.a * CU.opacity);
}
`,S=`const HALF: f32 = 0.5;
// Keep in sync with SHAPE_FADE_DURATION in chart-draw.ts
const FADE_DURATION: f32 = 0.5;
const BORDER_THICKNESS: f32 = 0.08;
const SHAPE_TYPE_COUNT: u32 = 10u;

// Shape type constants
const SHAPE_CIRCLE: u32 = 0u;
const SHAPE_SQUARE: u32 = 1u;
const SHAPE_RHOMBUS: u32 = 2u;
const SHAPE_PENTAGON: u32 = 3u;
const SHAPE_HEXAGON: u32 = 4u;
const SHAPE_STAR: u32 = 5u;
const SHAPE_TRIANGLE_UP: u32 = 6u;
const SHAPE_TRIANGLE_DOWN: u32 = 7u;
const SHAPE_TRIANGLE_LEFT: u32 = 8u;
const SHAPE_TRIANGLE_RIGHT: u32 = 9u;

// Polygon vertex arrays — precomputed from JS helper functions
const SQUARE_VERTS: array<vec2<f32>, 4> = array<vec2<f32>, 4>(
  vec2<f32>(-0.500000, -0.500000),
  vec2<f32>(-0.500000, 0.500000),
  vec2<f32>(0.500000, 0.500000),
  vec2<f32>(0.500000, -0.500000),
);
const RHOMBUS_VERTS: array<vec2<f32>, 4> = array<vec2<f32>, 4>(
  vec2<f32>(0.300000, 0.000000),
  vec2<f32>(0.000000, 0.500000),
  vec2<f32>(-0.300000, 0.000000),
  vec2<f32>(-0.000000, -0.500000),
);
const PENTAGON_VERTS: array<vec2<f32>, 5> = array<vec2<f32>, 5>(
  vec2<f32>(0.000000, 0.500000),
  vec2<f32>(-0.475528, 0.154508),
  vec2<f32>(-0.293893, -0.404508),
  vec2<f32>(0.293893, -0.404508),
  vec2<f32>(0.475528, 0.154508),
);
const HEXAGON_VERTS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
  vec2<f32>(0.000000, 0.500000),
  vec2<f32>(-0.433013, 0.250000),
  vec2<f32>(-0.433013, -0.250000),
  vec2<f32>(-0.000000, -0.500000),
  vec2<f32>(0.433013, -0.250000),
  vec2<f32>(0.433013, 0.250000),
);
const STAR_VERTS: array<vec2<f32>, 10> = array<vec2<f32>, 10>(
  vec2<f32>(0.000000, 0.500000),
  vec2<f32>(-0.117557, 0.161803),
  vec2<f32>(-0.475528, 0.154508),
  vec2<f32>(-0.190211, -0.061803),
  vec2<f32>(-0.293893, -0.404508),
  vec2<f32>(-0.000000, -0.200000),
  vec2<f32>(0.293893, -0.404508),
  vec2<f32>(0.190211, -0.061803),
  vec2<f32>(0.475528, 0.154508),
  vec2<f32>(0.117557, 0.161803),
);
const TRIANGLE_UP_VERTS: array<vec2<f32>, 3> = array<vec2<f32>, 3>(
  vec2<f32>(0.000000, 0.500000),
  vec2<f32>(-0.433013, -0.250000),
  vec2<f32>(0.433013, -0.250000),
);
const TRIANGLE_DOWN_VERTS: array<vec2<f32>, 3> = array<vec2<f32>, 3>(
  vec2<f32>(-0.000000, -0.500000),
  vec2<f32>(0.433013, 0.250000),
  vec2<f32>(-0.433013, 0.250000),
);
const TRIANGLE_LEFT_VERTS: array<vec2<f32>, 3> = array<vec2<f32>, 3>(
  vec2<f32>(-0.500000, 0.000000),
  vec2<f32>(0.250000, -0.433013),
  vec2<f32>(0.250000, 0.433013),
);
const TRIANGLE_RIGHT_VERTS: array<vec2<f32>, 3> = array<vec2<f32>, 3>(
  vec2<f32>(0.500000, 0.000000),
  vec2<f32>(-0.250000, 0.433013),
  vec2<f32>(-0.250000, -0.433013),
);

// Vertex counts for each polygon type
const SQUARE_COUNT: u32 = 4u;
const RHOMBUS_COUNT: u32 = 4u;
const PENTAGON_COUNT: u32 = 5u;
const HEXAGON_COUNT: u32 = 6u;
const STAR_COUNT: u32 = 10u;
const TRIANGLE_COUNT: u32 = 3u;

struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    time: f32,
    sinCount: u32,
    sinPenMin: f32,
    sinPenMax: f32,
    borderMargin: f32,
    borderOffset: u32,
    sinYCount: u32,
};

struct ShapeData {
    posAndSize: vec4<f32>,  // x, y, halfSize, spawnTime
    colorAndHold: vec4<f32>,  // r, g, b, holdDuration
    typeAndFill: vec4<f32>,  // shapeType, fillMode, maxOpacity, 0
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var<storage, read> shapes: array<ShapeData>;

struct ShapesVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) @interpolate(flat) color: vec3<f32>,
    @location(2) @interpolate(flat) opacity: f32,
    @location(3) @interpolate(flat) shapeType: u32,
    @location(4) @interpolate(flat) fillMode: u32,
};

// Quad corners for 2 triangles (6 vertices)
const QUAD_POSITIONS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
);

fn computeOpacity(time: f32, spawnTime: f32, holdDuration: f32) -> f32 {
    let elapsed = time - spawnTime;
    let fadeInEnd = FADE_DURATION;
    let holdEnd = FADE_DURATION + holdDuration;
    let fadeOutEnd = holdEnd + FADE_DURATION;

    if (elapsed < 0.0) {
        return 0.0;
    }
    if (elapsed < fadeInEnd) {
        return elapsed / FADE_DURATION;
    }
    if (elapsed < holdEnd) {
        return 1.0;
    }
    if (elapsed < fadeOutEnd) {
        return 1.0 - (elapsed - holdEnd) / FADE_DURATION;
    }
    return 0.0;
}

@vertex
fn vsShapes(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> ShapesVSOut {
    var out: ShapesVSOut;

    let shape = shapes[iid];
    let pos = shape.posAndSize.xy;
    let halfSize = shape.posAndSize.z;
    let spawnTime = shape.posAndSize.w;
    let holdDuration = shape.colorAndHold.w;

    let quadPos = QUAD_POSITIONS[vid];
    out.uv = quadPos;  // UV in [-0.5, 0.5]

    let worldPos = pos + quadPos * halfSize * 2.0;
    out.position = U.mvp * vec4<f32>(worldPos, 0.0, 1.0);

    out.color = shape.colorAndHold.xyz;
    let maxOpacity = shape.typeAndFill.z;
    out.opacity = computeOpacity(U.time, spawnTime, holdDuration) * maxOpacity;
    out.shapeType = u32(shape.typeAndFill.x);
    out.fillMode = u32(shape.typeAndFill.y);

    return out;
}

// Get polygon vertex by index for a given shape type
fn getPolygonVertex(shapeType: u32, index: u32) -> vec2<f32> {
    switch (shapeType) {
        case 1u: { return SQUARE_VERTS[index]; }
        case 2u: { return RHOMBUS_VERTS[index]; }
        case 3u: { return PENTAGON_VERTS[index]; }
        case 4u: { return HEXAGON_VERTS[index]; }
        case 5u: { return STAR_VERTS[index]; }
        case 6u: { return TRIANGLE_UP_VERTS[index]; }
        case 7u: { return TRIANGLE_DOWN_VERTS[index]; }
        case 8u: { return TRIANGLE_LEFT_VERTS[index]; }
        case 9u: { return TRIANGLE_RIGHT_VERTS[index]; }
        default: { return vec2<f32>(0.0, 0.0); }
    }
}

fn getPolygonVertexCount(shapeType: u32) -> u32 {
    switch (shapeType) {
        case 1u: { return SQUARE_COUNT; }
        case 2u: { return RHOMBUS_COUNT; }
        case 3u: { return PENTAGON_COUNT; }
        case 4u: { return HEXAGON_COUNT; }
        case 5u: { return STAR_COUNT; }
        case 6u, 7u, 8u, 9u: { return TRIANGLE_COUNT; }
        default: { return 0u; }
    }
}

// Ray-casting point-in-polygon test
fn pointInPolygon(p: vec2<f32>, shapeType: u32) -> bool {
    let count = getPolygonVertexCount(shapeType);
    if (count == 0u) { return false; }

    var inside = false;
    var j = count - 1u;

    for (var i = 0u; i < count; i = i + 1u) {
        let vi = getPolygonVertex(shapeType, i);
        let vj = getPolygonVertex(shapeType, j);

        if (((vi.y > p.y) != (vj.y > p.y)) &&
            (p.x < (vj.x - vi.x) * (p.y - vi.y) / (vj.y - vi.y) + vi.x)) {
            inside = !inside;
        }
        j = i;
    }

    return inside;
}

// Distance from point to nearest polygon edge
fn distToPolygonEdge(p: vec2<f32>, shapeType: u32) -> f32 {
    let count = getPolygonVertexCount(shapeType);
    if (count == 0u) { return 1e10; }

    var minDist = 1e10;
    var j = count - 1u;

    for (var i = 0u; i < count; i = i + 1u) {
        let a = getPolygonVertex(shapeType, j);
        let b = getPolygonVertex(shapeType, i);
        let ab = b - a;
        let ap = p - a;
        let t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
        let closest = a + ab * t;
        let d = length(p - closest);
        minDist = min(minDist, d);
        j = i;
    }

    return minDist;
}

// Smoothstep anti-aliasing width in UV space based on halfSize
const AA_WIDTH: f32 = 0.01;

@fragment
fn fsShapes(in: ShapesVSOut) -> @location(0) vec4<f32> {
    if (in.opacity <= 0.0) {
        discard;
    }

    let uv = in.uv;
    var alpha: f32 = 0.0;

    if (in.shapeType == SHAPE_CIRCLE) {
        let dist = length(uv);
        if (in.fillMode == 0u) {
            // Solid circle
            alpha = 1.0 - smoothstep(HALF - AA_WIDTH, HALF, dist);
        } else {
            // Hollow circle
            let outerAlpha = 1.0 - smoothstep(HALF - AA_WIDTH, HALF, dist);
            let innerRadius = HALF - BORDER_THICKNESS;
            let innerAlpha = smoothstep(innerRadius - AA_WIDTH, innerRadius, dist);
            alpha = outerAlpha * innerAlpha;
        }
    } else {
        // Polygon shapes
        let inside = pointInPolygon(uv, in.shapeType);
        let edgeDist = distToPolygonEdge(uv, in.shapeType);

        if (in.fillMode == 0u) {
            // Solid polygon
            if (inside) {
                alpha = smoothstep(0.0, AA_WIDTH, edgeDist);
            } else {
                alpha = 0.0;
            }
        } else {
            // Hollow polygon
            if (inside) {
                let outerAlpha = smoothstep(0.0, AA_WIDTH, edgeDist);
                let innerAlpha = 1.0 - smoothstep(BORDER_THICKNESS - AA_WIDTH, BORDER_THICKNESS, edgeDist);
                alpha = outerAlpha * innerAlpha;
            } else {
                alpha = 0.0;
            }
        }
    }

    if (alpha <= 0.0) {
        discard;
    }

    let finalAlpha = alpha * in.opacity;
    // Premultiplied alpha output
    return vec4<f32>(in.color * finalAlpha, finalAlpha);
}
`;function C(e,t,n,r){let i=e.createShaderModule({code:b}),a=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]}),o={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},s=e.createRenderPipeline({layout:e.createPipelineLayout({bindGroupLayouts:[a]}),vertex:{module:i,entryPoint:`vs`},fragment:{module:i,entryPoint:`fs`,targets:[{format:t,blend:o}]},primitive:{topology:`triangle-list`},multisample:{count:r}}),c=e.createRenderPipeline({layout:e.createPipelineLayout({bindGroupLayouts:[a]}),vertex:{module:i,entryPoint:`vsSinY`},fragment:{module:i,entryPoint:`fsSinY`,targets:[{format:n,blend:o}]},primitive:{topology:`triangle-list`},multisample:{count:r}}),l=e.createShaderModule({code:x}),u=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]}),d=e.createRenderPipeline({layout:e.createPipelineLayout({bindGroupLayouts:[u]}),vertex:{module:l,entryPoint:`vsComposite`},fragment:{module:l,entryPoint:`fsComposite`,targets:[{format:t,blend:o}]},primitive:{topology:`triangle-list`}}),f=e.createSampler({magFilter:`linear`,minFilter:`linear`}),p=e.createShaderModule({code:S}),m=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`read-only-storage`}}]});return{mainPipeline:s,sinYPipeline:c,compositePipeline:d,shapesPipeline:e.createRenderPipeline({layout:e.createPipelineLayout({bindGroupLayouts:[m]}),vertex:{module:p,entryPoint:`vsShapes`},fragment:{module:p,entryPoint:`fsShapes`,targets:[{format:t,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`}}),bindGroupLayout:a,compositeBindGroupLayout:u,shapesBindGroupLayout:m,compositeSampler:f}}function w(e,t){return e+Math.random()*(t-e)}function T(e){let t=Math.random(),n=Math.random(),r=Math.random(),i=(t+n+r)/3;if(i<.4){let e=g/Math.max(i,.01);t=Math.min(1,t*e),n=Math.min(1,n*e),r=Math.min(1,r*e)}return{x:0,y:0,halfSize:w(40/2,160/2),spawnTime:e,r:t,g:n,b:r,holdDuration:w(2,3),shapeType:Math.floor(Math.random()*10),fillMode:Math.random()<.5?0:1,maxOpacity:w(_,1)}}function E(e){return 2*h+e.holdDuration}function D(e,t,n){t[n]=e.x,t[n+1]=e.y,t[n+2]=e.halfSize,t[n+3]=e.spawnTime,t[n+4]=e.r,t[n+4+1]=e.g,t[n+4+2]=e.b,t[n+4+3]=e.holdDuration,t[n+8]=e.shapeType,t[n+8+1]=e.fillMode,t[n+8+2]=e.maxOpacity,t[n+8+3]=0}function O(e,t,n){let r=e/n*(t/n);return Math.min(Math.max(1,Math.round(r*p)),m)}function k(e){let t=[],n=2*h+5/2;for(let r=0;r<e;r++){let i=T(0);i.spawnTime=-(n/e)*r,t.push(i)}return t}function A(e,t,n,r,i){if(t>e.length){let a=2*h+5/2,o=t-e.length;for(let t=0;t<o;t++){let s=T(n);s.spawnTime=n-a/o*t,s.x=w(-r+s.halfSize,r-s.halfSize),s.y=w(-i+s.halfSize,i-s.halfSize),e.push(s)}}else t<e.length&&e.splice(t)}function j(e){return new Float32Array(e*48/Float32Array.BYTES_PER_ELEMENT)}function M(e,t,r,i){let a=null,o=null,s=null,c=null,l=null,u=null,d=null;return{ensureMsaaTexture(r,s){return!n(a)&&a.width===r&&a.height===s?o:(a?.destroy(),r===0||s===0?(a=null,o=null,null):(a=e.createTexture({size:[r,s],format:t,sampleCount:i,usage:GPUTextureUsage.RENDER_ATTACHMENT}),o=a.createView(),o))},ensureOffscreenTextures(t,a,o,f,p){return!n(s)&&s.width===t&&s.height===a?n(c)||n(u)||n(d)?null:{offscreenMsaaView:c,offscreenResolveView:u,compositeBindGroup:d}:(s?.destroy(),l?.destroy(),t===0||a===0?(s=null,c=null,l=null,u=null,d=null,null):(s=e.createTexture({size:[t,a],format:r,sampleCount:i,usage:GPUTextureUsage.RENDER_ATTACHMENT}),c=s.createView(),l=e.createTexture({size:[t,a],format:r,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),u=l.createView(),d=e.createBindGroup({layout:o,entries:[{binding:0,resource:u},{binding:1,resource:f},{binding:2,resource:{buffer:p}}]}),{offscreenMsaaView:c,offscreenResolveView:u,compositeBindGroup:d}))},destroy(){a?.destroy(),s?.destroy(),l?.destroy()}}}function N(e){let t=!1,n;return P(e).then(e=>{t?e():n=e}),()=>{t=!0,n?.()}}async function P(e){r(!n(navigator.gpu),`WebGPU is not supported`);let t=await navigator.gpu.requestAdapter();r(!n(t),`WebGPU adapter not available`);let i=await t.requestDevice(),a=e.getContext(`webgpu`);r(!n(a),`Failed to get WebGPU canvas context`);let s=a,p=navigator.gpu.getPreferredCanvasFormat();s.configure({device:i,format:p,alphaMode:`premultiplied`});let h=i.createBuffer({size:112,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),g=C(i,p,v,4),_=i.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});{let e=new Float32Array([f,0,0,0]);i.queue.writeBuffer(_,0,e)}let b=i.createBuffer({size:m*48,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),x=i.createBindGroup({layout:g.shapesBindGroupLayout,entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:{buffer:b}}]}),S=j(m),N=i.createBindGroup({layout:g.bindGroupLayout,entries:[{binding:0,resource:{buffer:h}}]}),P=M(i,p,v,4),F=0,I=0,L=Math.max(1,window.devicePixelRatio);function R(){L=Math.max(1,window.devicePixelRatio);let t=Math.floor(e.clientWidth*L),n=Math.floor(e.clientHeight*L);(e.width!==t||e.height!==n)&&(e.width=t,e.height=n),F=t,I=n}R();let z=k(O(F,I,L));function B(){return Math.trunc(F/20/4)*4+1}function V(){return Math.trunc(I/20/4)*4+1}function H(e){let t=F*d,n=I*d,r=o.ortho(-t,t,-n,n,-1,1),a=B(),s=V(),c=new ArrayBuffer(112),l=new Float32Array(c),u=new Uint32Array(c);l.set(r,0),l[16]=F,l[17]=I,l[18]=e,u[19]=a,l[20]=2,l[21]=20,l[22]=20,u[23]=a,u[24]=s,i.queue.writeBuffer(h,0,c)}R();let U=new ResizeObserver(()=>{R()});U.observe(e);let W=0,G=!1,K=performance.now();function q(){if(G)return;R();let e=(performance.now()-K)/y,t=B(),r=V();H(e);let a=t+4,o=P.ensureMsaaTexture(F,I),f=P.ensureOffscreenTextures(F,I,g.compositeBindGroupLayout,g.compositeSampler,_);if(n(o)||n(f)){W=requestAnimationFrame(q);return}let p=s.getCurrentTexture().createView(),m=i.createCommandEncoder();{let e=m.beginRenderPass({colorAttachments:[{view:o,resolveTarget:p,loadOp:`clear`,clearValue:{r:c,g:l,b:u,a:1},storeOp:`discard`}]});e.setPipeline(g.mainPipeline),e.setBindGroup(0,N),a>0&&e.draw(18,a,0,0),e.end()}{let e=m.beginRenderPass({colorAttachments:[{view:f.offscreenMsaaView,resolveTarget:f.offscreenResolveView,loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});e.setPipeline(g.sinYPipeline),e.setBindGroup(0,N),r>0&&e.draw(18,r,0,0),e.end()}{let e=m.beginRenderPass({colorAttachments:[{view:p,loadOp:`load`,storeOp:`store`}]});e.setPipeline(g.compositePipeline),e.setBindGroup(0,f.compositeBindGroup),e.draw(3,1,0,0),e.end()}{let t=F*d,n=I*d,r=48/Float32Array.BYTES_PER_ELEMENT,a=O(F,I,L);a!==z.length&&A(z,a,e,t,n);for(let i=0;i<z.length;i++){let a=z[i];if(e-a.spawnTime>E(a)){let r=T(e);r.x=w(-t+r.halfSize,t-r.halfSize),r.y=w(-n+r.halfSize,n-r.halfSize),z[i]=r}D(z[i],S,i*r)}i.queue.writeBuffer(b,0,S.buffer,0,z.length*48);let o=m.beginRenderPass({colorAttachments:[{view:p,loadOp:`load`,storeOp:`store`}]});o.setPipeline(g.shapesPipeline),o.setBindGroup(0,x),o.draw(6,z.length,0,0),o.end()}i.queue.submit([m.finish()]),W=requestAnimationFrame(q)}return W=requestAnimationFrame(q),()=>{G=!0,cancelAnimationFrame(W),U.disconnect(),P.destroy(),h.destroy(),_.destroy(),b.destroy(),i.destroy()}}var F=e(),I=(0,s.memo)(()=>{let e=(0,s.useRef)(null);return(0,s.useEffect)(()=>{if(e.current)return N(e.current)},[]),(0,F.jsx)(`div`,{className:a.fixedContainer,children:(0,F.jsx)(`canvas`,{ref:e,style:{width:`100%`,height:`100%`}})})});export{I as Charts};