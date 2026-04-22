import{Ct as e,J as t,K as n,T as r,V as i,Y as a,a as o,bt as s,c,i as l,q as u,s as d,t as f,ut as p,z as m}from"./c--qkC90vB.js";import{d as h}from"./c-DdjQALy_.js";import{t as g}from"./e-BeX_7gFa.js";import{t as _}from"./c-BuCug6bs.js";import{t as v}from"./c-DXBso0fK.js";import{n as y,t as b}from"./c-B-xRkKi7.js";import{n as x,t as S}from"./c-DVSDvUGo.js";var C=e(t(),1),w=2048,T=1767225600,E=.5,D=1e3,ee=.7,te=1.3,ne=.95,O=.18,re=.005,k=365*24*3600,ie=`#ccc`,ae=`rgba(50, 50, 50, 0.75)`,A=`#aaa`,oe=`#444`,se=`monospace`,ce=1024,le=2160*3600,ue=720*3600,de=168*3600,fe=[[0,k],[k/2-le/2,k/2+le/2],[k/2-ue/2,k/2+ue/2],[k/2-de/2,k/2+de/2]],j=function(e){return e[e.Hour1=3600]=`Hour1`,e[e.Hour12=43200]=`Hour12`,e[e.Day1=86400]=`Day1`,e[e.Day4=345600]=`Day4`,e[e.Day16=1382400]=`Day16`,e[e.Day64=5529600]=`Day64`,e[e.Day256=22118400]=`Day256`,e}({}),M=function(e){return e[e.Line=0]=`Line`,e[e.Candlestick=1]=`Candlestick`,e[e.Rhombus=2]=`Rhombus`,e}({}),N=f({en:{debugOverlay:{debug:`Debug`,loadingDelay:`Loading delay`}},ru:{debugOverlay:{debug:`Отладка`,loadingDelay:`Задержка загрузки`}}}),P=u(),pe=250,me=r(),F=`relative h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 transition-colors duration-200 checked:bg-brand-500`,I=`pointer-events-none absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-3`,he=(0,C.memo)(({renderer:e})=>{let[t,n]=(0,C.useState)(0),[r,i]=(0,C.useState)(!1),[a,o]=(0,C.useState)(!0);(0,C.useEffect)(()=>{if(e===null)return;let t=setInterval(()=>{n(e.renderFps),i(e.debugMode),o(e.instantLoad)},pe);return()=>clearInterval(t)},[e]);let s=h(()=>{e!==null&&(e.debugMode=!e.debugMode)}),c=h(()=>{e!==null&&(e.instantLoad=!e.instantLoad)});return(0,P.jsxs)(`div`,{className:`pointer-events-auto absolute top-1 right-1 z-10 flex select-none flex-col items-center gap-2 rounded bg-[#1a1a40]/80 px-3 py-2 font-mono text-xs text-white`,children:[(0,P.jsxs)(`span`,{className:`tabular-nums`,children:[t,` fps`]}),(0,P.jsxs)(`div`,{className:`flex w-full flex-col gap-1.5`,children:[!me&&(0,P.jsxs)(`label`,{className:`flex cursor-pointer items-center justify-between gap-2`,children:[(0,P.jsx)(`span`,{children:N.debugOverlay.debug}),(0,P.jsxs)(`span`,{className:`relative inline-flex items-center`,children:[(0,P.jsx)(`input`,{type:`checkbox`,checked:r,onChange:s,className:`peer ${F}`}),(0,P.jsx)(`span`,{className:I})]})]}),(0,P.jsxs)(`label`,{className:`flex cursor-pointer items-center justify-between gap-2`,children:[(0,P.jsx)(`span`,{children:N.debugOverlay.loadingDelay}),(0,P.jsxs)(`span`,{className:`relative inline-flex items-center`,children:[(0,P.jsx)(`input`,{type:`checkbox`,checked:!a,onChange:c,className:`peer ${F}`}),(0,P.jsx)(`span`,{className:I})]})]})]})]})}),ge=(0,C.memo)(({children:e})=>{let[t,n]=(0,C.useState)(!1),r=(0,C.useRef)(null);(0,C.useEffect)(()=>{if(a(screen.orientation)||!p(screen.orientation.lock))return;function e(){n(screen.orientation.type.startsWith(`portrait`)&&!document.fullscreenElement)}return e(),screen.orientation.addEventListener(`change`,e),document.addEventListener(`fullscreenchange`,e),()=>{screen.orientation.removeEventListener(`change`,e),document.removeEventListener(`fullscreenchange`,e);let t=r.current;a(t)||(screen.orientation.unlock(),!t.wasFullscreen&&document.fullscreenElement&&document.exitFullscreen().catch(()=>{}),r.current=null)}},[]);let i=h(async()=>{r.current={wasFullscreen:!!document.fullscreenElement,previousOrientation:screen.orientation.type};try{await document.documentElement.requestFullscreen(),await screen.orientation?.lock?.(`landscape`)}catch{}});return(0,P.jsxs)(`div`,{className:`relative h-full w-full`,children:[e,t&&(0,P.jsx)(`div`,{className:`absolute inset-0 z-20 flex items-center justify-center`,children:(0,P.jsx)(`button`,{type:`button`,onClick:i,className:`flex h-24 w-24 items-center justify-center rounded-full bg-brand-500/80 text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95`,children:(0,P.jsx)(g,{className:`h-14 w-14`})})})]})}),_e=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
const QUAD_POSITIONS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
);

struct CandlestickVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) bodyBounds: vec2<f32>,    // (bodyYMin, bodyYMax) in UV space [-0.5, 0.5]
    @location(3) quadPixelSize: vec2<f32>, // quad dimensions in pixels (width, height)
};

const CANDLE_HALF_WIDTH_PX: f32 = 5.0;
const WICK_BODY_RATIO: f32 = 0.5;
const MIN_CANDLE_RANGE: f32 = 0.0001;
const QUAD_PADDING: f32 = 1.0;

// One instance per pair of consecutive points - renders a candlestick quad
@vertex
fn vsCandlestick(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> CandlestickVSOut {
    var out: CandlestickVSOut;

    let pointA = readGlobalPoint(iid);
    let pointB = readGlobalPoint(iid + 1u);

    let dpr = max(1.0, U.lineWidth);
    let openVal = pointA.valueDelta;
    let closeVal = pointB.valueDelta;

    let bodyHi = max(openVal, closeVal);
    let bodyLo = min(openVal, closeVal);
    let bodyHeight = bodyHi - bodyLo;
    let wickExt = bodyHeight * WICK_BODY_RATIO;
    let high = bodyHi + wickExt;
    let low = bodyLo - wickExt;

    // Pixel positions for top and bottom at the same X
    let pixHigh = dataToPixel(pointA.timeDelta, high);
    let pixLow = dataToPixel(pointA.timeDelta, low);
    let centerPix = (pixHigh + pixLow) * 0.5;
    let halfHeight = abs(pixHigh.y - pixLow.y) * 0.5 + QUAD_PADDING;
    let halfWidth = CANDLE_HALF_WIDTH_PX * dpr;

    let quadPos = QUAD_POSITIONS[vid];
    let pixel = centerPix + vec2<f32>(quadPos.x * halfWidth * 2.0, quadPos.y * halfHeight * 2.0);

    // Normalize body bounds to UV space [-0.5, 0.5]
    let totalRange = max(high - low, MIN_CANDLE_RANGE);
    let bodyYMin = (bodyLo - low) / totalRange - 0.5;
    let bodyYMax = (bodyHi - low) / totalRange - 0.5;

    out.position = vec4<f32>(pixelToClip(pixel), 0.0, 1.0);
    out.color = unpackColorWgsl(pointA.packedColor);
    out.uv = quadPos;
    out.bodyBounds = vec2<f32>(bodyYMin, bodyYMax);
    out.quadPixelSize = vec2<f32>(halfWidth * 2.0, halfHeight * 2.0);

    return out;
}

const BORDER_PX: f32 = 2.0;
const WICK_HALF_WIDTH_PX: f32 = 1.5;
const CAP_HALF_WIDTH_PX: f32 = 6.0;
const CAP_HALF_HEIGHT_PX: f32 = 1.5;
const CANDLESTICK_STROKE: vec4<f32> = vec4<f32>(0.55, 0.55, 0.55, 1.0);

@fragment
fn fsCandlestick(in: CandlestickVSOut) -> @location(0) vec4<f32> {
    let pixelX = in.uv.x * in.quadPixelSize.x;
    let pixelY = in.uv.y * in.quadPixelSize.y;
    let absPixelX = abs(pixelX);

    let bodyMin = in.bodyBounds.x;
    let bodyMax = in.bodyBounds.y;

    let bodyHalfWidthPx = in.quadPixelSize.x * 0.35;
    let bodyPixelTop = bodyMax * in.quadPixelSize.y;
    let bodyPixelBot = bodyMin * in.quadPixelSize.y;

    let wickTop = in.quadPixelSize.y * 0.5;
    let wickBot = -in.quadPixelSize.y * 0.5;

    // Body region (with light border)
    if (pixelY >= bodyPixelBot && pixelY <= bodyPixelTop && absPixelX <= bodyHalfWidthPx) {
        // Border: fixed pixel width
        if (absPixelX > bodyHalfWidthPx - BORDER_PX ||
            pixelY < bodyPixelBot + BORDER_PX ||
            pixelY > bodyPixelTop - BORDER_PX) {
            return CANDLESTICK_STROKE;
        }
        return in.color;
    }

    // Wick (thin light vertical line)
    if (absPixelX <= WICK_HALF_WIDTH_PX) {
        return CANDLESTICK_STROKE;
    }

    // Caps at top and bottom of wick
    if ((abs(pixelY - wickTop) < CAP_HALF_HEIGHT_PX ||
         abs(pixelY - wickBot) < CAP_HALF_HEIGHT_PX) &&
        absPixelX <= CAP_HALF_WIDTH_PX) {
        return CANDLESTICK_STROKE;
    }

    discard;
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}
`,L=`struct Uniforms {
    viewport: vec2<f32>,
    timeRangeMin: f32,        // viewTimeStart - globalBaseTime
    timeRangeMax: f32,        // viewTimeEnd - globalBaseTime
    valueRangeMin: f32,       // viewValueMin - globalBaseValue
    valueRangeMax: f32,       // viewValueMax - globalBaseValue
    textureWidth: u32,
    lineWidth: f32,
    blockCount: u32,
    _pad: u32,
};

struct BlockDescriptor {
    textureOffset: u32,
    pointCount: u32,
    baseTimeDelta: f32,
    baseValueDelta: f32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var dataTexture: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> blocks: array<BlockDescriptor>;

struct DecodedPoint {
    timeDelta: f32,
    valueDelta: f32,
    size: f32,
    packedColor: f32,
};

fn readGlobalPoint(globalIndex: u32) -> DecodedPoint {
    var accumulated: u32 = 0u;
    for (var b: u32 = 0u; b < U.blockCount; b = b + 1u) {
        let count = blocks[b].pointCount;
        if (globalIndex < accumulated + count) {
            let localIndex = globalIndex - accumulated;
            let texOffset = blocks[b].textureOffset + localIndex;
            let row = texOffset / U.textureWidth;
            let col = texOffset % U.textureWidth;
            let texel = textureLoad(dataTexture, vec2<u32>(col, row), 0);
            var result: DecodedPoint;
            result.timeDelta = blocks[b].baseTimeDelta + texel.x;
            result.valueDelta = blocks[b].baseValueDelta + texel.y;
            result.size = texel.z;
            result.packedColor = texel.w;
            return result;
        }
        accumulated = accumulated + count;
    }
    // Fallback - should never reach
    var fallback: DecodedPoint;
    fallback.timeDelta = 0.0;
    fallback.valueDelta = 0.0;
    fallback.size = 1.0;
    fallback.packedColor = 0.0;
    return fallback;
}

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
`,ve=`// Debug shader: draws vertical lines at block boundaries.
// One instance per block. Each instance draws a 2px wide vertical line
// from top to bottom of the viewport at the block's start time.
// Uses the same Uniforms and BlockDescriptor storage buffer as main shaders.

struct DebugVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
};

const DEBUG_LINE_HALF_WIDTH_PX: f32 = 1.0;
const DEBUG_LINE_COLOR: vec4<f32> = vec4<f32>(1.0, 1.0, 0.0, 0.6);

// 6 vertices for a quad (2 triangles)
const QUAD_VERTS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0),
);

@vertex
fn vsDebugLines(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> DebugVSOut {
    var out: DebugVSOut;

    let blockTimeDelta = blocks[iid].baseTimeDelta;
    let timeRange = U.timeRangeMax - U.timeRangeMin;
    let nx = (blockTimeDelta - U.timeRangeMin) / timeRange;

    let centerPixelX = nx * U.viewport.x;
    let basis = QUAD_VERTS[vid];

    let pixelX = centerPixelX - DEBUG_LINE_HALF_WIDTH_PX + basis.x * DEBUG_LINE_HALF_WIDTH_PX * 2.0;
    let pixelY = basis.y * U.viewport.y;

    out.position = vec4<f32>(pixelToClip(vec2<f32>(pixelX, pixelY)), 0.0, 1.0);
    out.color = DEBUG_LINE_COLOR;

    return out;
}

@fragment
fn fsDebugLines(in: DebugVSOut) -> @location(0) vec4<f32> {
    return in.color;
}
`,ye=`struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) joinCenter: vec2<f32>,
    @location(2) joinWidth: f32,
};

// 6 vertices for a join quad (circle at a point)
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

const JOIN_A_END: u32 = 6u;
const JOIN_B_END: u32 = 12u;

// 18 vertices per instance: 6 join A + 6 join B + 6 rect body
@vertex
fn vs(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    var out: VSOut;

    let pointA = readGlobalPoint(iid);
    let pointB = readGlobalPoint(iid + 1u);

    let pixelA = dataToPixel(pointA.timeDelta, pointA.valueDelta);
    let pixelB = dataToPixel(pointB.timeDelta, pointB.valueDelta);

    let dpr = max(1.0, U.lineWidth);
    let widthA = pointA.size * dpr;
    let widthB = pointB.size * dpr;

    let colorA = unpackColorWgsl(pointA.packedColor);
    let colorB = unpackColorWgsl(pointB.packedColor);

    if (vid < JOIN_A_END) {
        // Join circle at point A
        let basis = JOIN_BASIS[vid];
        out.joinCenter = basis;
        out.joinWidth = widthA;
        out.color = colorA;

        let offset = basis * widthA;
        out.position = vec4<f32>(pixelToClip(pixelA + offset), 0.0, 1.0);
    } else if (vid < JOIN_B_END) {
        // Join circle at point B
        let localVid = vid - JOIN_A_END;
        let basis = JOIN_BASIS[localVid];
        out.joinCenter = basis;
        out.joinWidth = widthB;
        out.color = colorB;

        let offset = basis * widthB;
        out.position = vec4<f32>(pixelToClip(pixelB + offset), 0.0, 1.0);
    } else {
        // Line body rectangle
        let localVid = vid - JOIN_B_END;
        let basis = RECT_BASIS[localVid];

        out.joinCenter = vec2<f32>(0.0, 0.0);
        out.joinWidth = 0.0;

        let dir = pixelB - pixelA;
        let normal = safeNormalize(vec2<f32>(-dir.y, dir.x));

        let w = mix(widthA, widthB, basis.x);
        let basePixel = mix(pixelA, pixelB, basis.x);
        let offsetPixel = basePixel + normal * (basis.y * w);

        out.color = mix(colorA, colorB, basis.x);
        out.position = vec4<f32>(pixelToClip(offsetPixel), 0.0, 1.0);
    }

    return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    // Discard pixels outside the join circle
    if (in.joinWidth > 0.0 && dot(in.joinCenter, in.joinCenter) > 0.25) {
        discard;
    }
    return in.color;
}
`,be=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
const QUAD_POSITIONS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
);

struct RhombusVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) uv: vec2<f32>,
};

// One instance per point - renders a quad, rhombus shape cut in fragment shader
@vertex
fn vsRhombus(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> RhombusVSOut {
    var out: RhombusVSOut;

    let point = readGlobalPoint(iid);
    let center = dataToPixel(point.timeDelta, point.valueDelta);
    let dpr = max(1.0, U.lineWidth);
    let size = point.size * dpr * 4.0;

    let quadPos = QUAD_POSITIONS[vid];
    out.uv = quadPos; // UV in [-0.5, 0.5]

    let pixel = center + quadPos * size;

    out.position = vec4<f32>(pixelToClip(pixel), 0.0, 1.0);
    out.color = unpackColorWgsl(point.packedColor);

    return out;
}

// Rhombus test: |x| / 0.3 + |y| / 0.5 <= 1 (diamond inscribed in the quad)
const RHOMBUS_HALF_W: f32 = 0.3;
const RHOMBUS_HALF_H: f32 = 0.5;

@fragment
fn fsRhombus(in: RhombusVSOut) -> @location(0) vec4<f32> {
    if (abs(in.uv.x) / RHOMBUS_HALF_W + abs(in.uv.y) / RHOMBUS_HALF_H > 1.0) {
        discard;
    }
    return in.color;
}
`,xe=17,Se=class{available=[];acquire(e,t,n,r){let i=this.available.findIndex(e=>e.width===t&&e.height===n);if(i!==-1){let[e]=this.available.splice(i,1);return e}return e.createTexture({size:[t,n],format:r,usage:xe})}release(e){this.available.push(e)}dispose(){for(let e of this.available)e.destroy();this.available.length=0}},Ce=L+ye,we=L+_e,Te=L+be,Ee=L+ve,De=2,Oe=1e3,ke=250,Ae=5,R=`rgba(100, 160, 255, 0.6)`,je=`rgba(30, 80, 180, 0.8)`,z=1200;async function Me(){n(!a(navigator.gpu),`WebGPU is not supported`);let e=await navigator.gpu.requestAdapter();n(!a(e),`WebGPU adapter not available`);let t=await e.requestDevice(),r=new OffscreenCanvas(ce,768),i=r.getContext(`webgpu`);n(!a(i),`Failed to get WebGPU context on OffscreenCanvas`);let o=navigator.gpu.getPreferredCanvasFormat();i.configure({device:t,format:o,alphaMode:`premultiplied`,usage:18});let s=t.createShaderModule({code:Ce}),c=t.createShaderModule({code:we}),l=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]}),u={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},d=t.createPipelineLayout({bindGroupLayouts:[l]}),f=t.createRenderPipeline({layout:d,vertex:{module:s,entryPoint:`vs`},fragment:{module:s,entryPoint:`fs`,targets:[{format:o,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),p=t.createRenderPipeline({layout:d,vertex:{module:c,entryPoint:`vsCandlestick`},fragment:{module:c,entryPoint:`fsCandlestick`,targets:[{format:o,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),m=t.createShaderModule({code:Te}),h=t.createRenderPipeline({layout:d,vertex:{module:m,entryPoint:`vsRhombus`},fragment:{module:m,entryPoint:`fsRhombus`,targets:[{format:o,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),g=t.createShaderModule({code:Ee});return new Ne(t,o,l,f,p,h,t.createRenderPipeline({layout:d,vertex:{module:g,entryPoint:`vsDebugLines`},fragment:{module:g,entryPoint:`fsDebugLines`,targets:[{format:o,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),r,i)}var Ne=class{device;format;bindGroupLayout;linePipeline;candlestickPipeline;rhombusPipeline;debugPipeline;debugMode=!1;instantLoad=!0;renderFps=0;offscreen;ctx;charts=new Set;msaaManager=l(4);renderTargetPool=new Se;animationFrameId=0;lastFrameTime=0;disposed=!1;needsReconfigure=!1;renderFrameTimes=[];lastFpsUpdate=0;constructor(e,t,n,r,i,a,o,s,c){this.device=e,this.format=t,this.bindGroupLayout=n,this.linePipeline=r,this.candlestickPipeline=i,this.rhombusPipeline=a,this.debugPipeline=o,this.offscreen=s,this.ctx=c}registerChart(e){return this.charts.add(e),this.charts.size===1&&this.startAnimationLoop(),()=>{this.charts.delete(e),e.dispose(),this.charts.size===0&&this.stopAnimationLoop()}}destroy(){if(!this.disposed){this.disposed=!0,this.stopAnimationLoop();for(let e of this.charts)e.dispose();this.charts.clear(),this.msaaManager.dispose(),this.renderTargetPool.dispose(),this.device.destroy()}}getMinFrameIntervalMs(){let e;for(let t of this.charts){let n=t.fpsController.getFrameIntervalMs();(a(e)||n<e)&&(e=n)}return e??1e3/10}startAnimationLoop(){if(this.disposed)return;let e=t=>{if(this.disposed)return;for(let e of this.charts)e.fpsController.tick();let n=this.getMinFrameIntervalMs();if(t-this.lastFrameTime<n-De){this.animationFrameId=requestAnimationFrame(e);return}this.lastFrameTime=t,this.trackRenderFps(t),this.renderAllCharts(),this.animationFrameId=requestAnimationFrame(e)};this.animationFrameId=requestAnimationFrame(e)}trackRenderFps(e){let t=Math.max(Oe,this.getMinFrameIntervalMs()*3);this.renderFrameTimes.push(e);let n=e-t;for(;this.renderFrameTimes.length>0&&this.renderFrameTimes[0]<n;)this.renderFrameTimes.shift();if(e-this.lastFpsUpdate>=ke){this.lastFpsUpdate=e;let t=this.renderFrameTimes.length>1?this.renderFrameTimes[this.renderFrameTimes.length-1]-this.renderFrameTimes[0]:0;this.renderFps=t>0?Math.round((this.renderFrameTimes.length-1)/t*m):0}}stopAnimationLoop(){cancelAnimationFrame(this.animationFrameId),this.animationFrameId=0}drawLoadingBars(e){let t=e.getLoadingRegions();if(t.length===0)return;let n=e.getViewport(),r=n.timeEnd-n.timeStart;if(r<=0)return;let i=e.target2dContext,a=e.width,o=e.height,s=Ae*Math.max(1,window.devicePixelRatio),c=o-s,l=performance.now()%z/z;for(let e of t){let t=(e.timeStart-n.timeStart)/r,o=(e.timeEnd-n.timeStart)/r,u=Math.max(0,Math.floor(t*a)),d=Math.min(a,Math.ceil(o*a))-u;if(d<=0)continue;let f=s*2,p=c-f+l*f,m=i.createLinearGradient(0,p,0,p+f);m.addColorStop(0,R),m.addColorStop(.5,je),m.addColorStop(1,R),i.save(),i.beginPath(),i.rect(u,c,d,s),i.clip(),i.fillStyle=m,i.fillRect(u,p,d,f),i.restore()}}ensureMsaaView(e,t){return this.msaaManager.ensureView(this.device,this.format,e,t)}renderAllCharts(){for(let e of this.charts){e.update();let{width:t,height:n}=e;if(t===0||n===0)continue;let r=e.prepareDrawCommands();a(r)||(this.renderChart(e,r),e.renderCanvasAxes(),this.drawLoadingBars(e))}}renderChart(e,t){let{width:n,height:r}=e;(this.offscreen.width!==n||this.offscreen.height!==r||this.needsReconfigure)&&(this.offscreen.width=n,this.offscreen.height=r,this.ctx.configure({device:this.device,format:this.format,alphaMode:`premultiplied`,usage:18}),this.needsReconfigure=!1);let i=this.renderTargetPool.acquire(this.device,n,r,this.format),o=this.ensureMsaaView(n,r);if(a(o)){this.renderTargetPool.release(i);return}let s=this.device.createCommandEncoder(),c=s.beginRenderPass({colorAttachments:[{view:o,resolveTarget:i.createView(),loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});e.seriesManager.renderAll(c,t),this.debugMode&&e.seriesManager.renderDebug(c,this.debugPipeline,t),c.end();let l=this.ctx.getCurrentTexture();s.copyTextureToTexture({texture:i},{texture:l},[n,r]),this.device.queue.submit([s.finish()]),this.renderTargetPool.release(i),e.syncCanvasSize();let u=this.offscreen.transferToImageBitmap();this.needsReconfigure=!0,e.renderCanvasGrid(),e.target2dContext.drawImage(u,0,0),u.close()}},B=(0,C.createContext)(null);function V(){return(0,C.useContext)(B)}var Pe=(0,C.memo)(({children:e})=>{let[t,n]=(0,C.useState)(null);return(0,C.useEffect)(()=>{let e=!1,t;return Me().then(r=>{if(e){r.destroy();return}t=r,n(r)}),()=>{e=!0,a(t)||t.destroy()}},[]),(0,P.jsx)(B,{value:t,children:e})}),H=e(s(((e,t)=>{(function(n,r){typeof e==`object`?t.exports=r():typeof define==`function`&&define.amd?define(r):n.Alea=r()})(e,function(){return e.importState=function(t){var n=new e;return n.importState(t),n},e;function e(){return function(e){var n=0,r=0,i=0,a=1;e.length==0&&(e=[+new Date]);var o=t();n=o(` `),r=o(` `),i=o(` `);for(var s=0;s<e.length;s++)n-=o(e[s]),n<0&&(n+=1),r-=o(e[s]),r<0&&(r+=1),i-=o(e[s]),i<0&&(i+=1);o=null;var c=function(){var e=2091639*n+a*23283064365386963e-26;return n=r,r=i,i=e-(a=e|0)};return c.next=c,c.uint32=function(){return c()*4294967296},c.fract53=function(){return c()+(c()*2097152|0)*11102230246251565e-32},c.version=`Alea 0.9`,c.args=e,c.exportState=function(){return[n,r,i,a]},c.importState=function(e){n=+e[0]||0,r=+e[1]||0,i=+e[2]||0,a=+e[3]||0},c}(Array.prototype.slice.call(arguments))}function t(){var e=4022871197,t=function(t){t=t.toString();for(var n=0;n<t.length;n++){e+=t.charCodeAt(n);var r=.02519603282416938*e;e=r>>>0,r-=e,r*=e,e=r>>>0,r-=e,e+=r*4294967296}return(e>>>0)*23283064365386963e-26};return t.version=`Mash 0.9`,t}})}))(),1),U=Math.sqrt(3),W=Math.sqrt(5),Fe=.5*(U-1),G=(3-U)/6;(W-1)/4,(5-W)/20;var Ie=e=>Math.floor(e)|0,Le=new Float64Array([1,1,-1,1,1,-1,-1,-1,1,0,-1,0,1,0,-1,0,0,1,0,-1,0,1,0,-1]);function Re(e=Math.random){let t=ze(e),n=new Float64Array(t).map(e=>Le[e%12*2]),r=new Float64Array(t).map(e=>Le[e%12*2+1]);return function(e,i){let a=0,o=0,s=0,c=(e+i)*Fe,l=Ie(e+c),u=Ie(i+c),d=(l+u)*G,f=l-d,p=u-d,m=e-f,h=i-p,g,_;m>h?(g=1,_=0):(g=0,_=1);let v=m-g+G,y=h-_+G,b=m-1+2*G,x=h-1+2*G,S=l&255,C=u&255,w=.5-m*m-h*h;if(w>=0){let e=S+t[C],i=n[e],o=r[e];w*=w,a=w*w*(i*m+o*h)}let T=.5-v*v-y*y;if(T>=0){let e=S+g+t[C+_],i=n[e],a=r[e];T*=T,o=T*T*(i*v+a*y)}let E=.5-b*b-x*x;if(E>=0){let e=S+1+t[C+1],i=n[e],a=r[e];E*=E,s=E*E*(i*b+a*x)}return 70*(a+o+s)}}function ze(e){let t=new Uint8Array(512);for(let e=0;e<512/2;e++)t[e]=e;for(let n=0;n<512/2-1;n++){let r=n+~~(e()*(256-n)),i=t[n];t[n]=t[r],t[r]=i}for(let e=256;e<512;e++)t[e]=t[e-256];return t}var K=180,Be={[j.Hour1]:K,[j.Hour12]:K,[j.Day1]:K,[j.Day4]:K,[j.Day16]:K,[j.Day64]:K,[j.Day256]:K},Ve=1,He=10-Ve,Ue=7,We=.5;function Ge(e){return(e-T)/k}function Ke(e){let t=Re((0,H.default)(e));return e=>{let n=Ge(e),r=0,i=15,a=4;for(let e=0;e<6;e++)r+=i*t(n*a,e*D),i*=E,a*=2;return 100+r}}var qe=d(.2,.8,.3,1),Je=d(.9,.2,.2,1);function Ye(e,t){let n=e(Ge(t)*4,Ue*D);return Ve+Math.max(0,Math.min(1,(n+1)*We))*He}function Xe(e,t,n,r){let i=Be[n],a=(t-e)/(i-1),o=Ke(r),s=Re((0,H.default)(`${r}-size`)),c=Array(i),l=Array(i);for(let t=0;t<i;t++)c[t]=e+t*a,l[t]=o(c[t]);let u=Array(i);for(let e=0;e<i;e++){let t=l[Math.min(e+1,i-1)]>=l[e];u[e]={time:c[e],value:l[e],size:Ye(s,c[e]),color:t?qe:Je}}return u}var Ze=3;function Qe(e,t,n){let r=new ArrayBuffer(e.length*4*Float32Array.BYTES_PER_ELEMENT),i=new Float32Array(r),a=new Uint32Array(r);for(let r=0;r<e.length;r++){let o=r*4,s=e[r];i[o]=s.time-t,i[o+1]=s.value-n,i[o+2]=s.size,a[o+Ze]=tt(s.color)}return i}var q=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),$e=new Float32Array(q),et=new Uint32Array(q);function tt(e){return $e[0]=e,et[0]}var nt=1;function rt(e,t,n,r=nt){let i=n,a=Math.floor(e/i)*i-r*i,o=Math.ceil(t/i)*i+r*i,s=Math.round((o-a)/i),c=Array(s);for(let e=0;e<s;e++){let t=a+e*i;c[e]={start:t,end:t+i}}return c}var it=1e3,at=class{pendingBlocks=new Map;requestCounter=0;constructor(e,t,n,r,i,a,o,s){this.allocator=e,this.registry=t,this.seed=n,this.chartType=r,this.colorFn=i,this.sizeFn=a,this.isDebug=o,this.isInstantLoad=s}ensureBlocksForViewport(e,t,n){let r=rt(e,t,n),i=[],a=performance.now(),o=new Set;for(let e of r){let t=`${n}:${e.start}:${e.end}`;o.add(t);let r=this.registry.findCovering(n,e.start,e.end,this.chartType);if(r!==void 0){this.allocator.touch(r.slot),i.push(r),this.pendingBlocks.delete(t);continue}let s=this.pendingBlocks.get(t);if(s===void 0){this.requestCounter++;let r=this.requestCounter;this.isDebug?.()&&console.log(`>>> [#${r}] REQUEST ${M[this.chartType]} [${e.start} → ${e.end}] scale=${n}`),this.pendingBlocks.set(t,{periodStart:e.start,periodEnd:e.end,scale:n,requestTime:a});continue}if(this.isInstantLoad?.()===!0||a-s.requestTime>=it){this.pendingBlocks.delete(t);let r=this.generateBlocksForPeriod(e.start,e.end,n);if(i.push(...r),this.isDebug?.()){let t=r.reduce((e,t)=>e+t.pointCount,0);console.log(`>>> [#${this.requestCounter}] RESPONSE ${M[this.chartType]} [${e.start} → ${e.end}] ${r.length} block(s), ${t} points`)}}}for(let e of this.pendingBlocks.keys())o.has(e)||this.pendingBlocks.delete(e);return i.sort((e,t)=>e.timeStart-t.timeStart)}getLoadingRegions(){let e=performance.now(),t=[];for(let n of this.pendingBlocks.values()){let r=e-n.requestTime,i=Math.min(1,r/it);t.push({timeStart:n.periodStart,timeEnd:n.periodEnd,progress:i})}return t}generateBlocksForPeriod(e,t,n){let r=Xe(e,t,n,this.seed);if(r.length===0)return[];if(this.colorFn!==void 0||this.sizeFn!==void 0)for(let e=0;e<r.length;e++){let t=r[e];r[e]={...t,color:this.colorFn===void 0?t.color:this.colorFn(t.value,e,r),size:this.sizeFn===void 0?t.size:this.sizeFn(t.value,e,r)}}let i=[];if(r.length<=256){let a=this.createBlock(r,e,t,n);a!==null&&i.push(a)}else{let e=Math.ceil(r.length/256);for(let t=0;t<e;t++){let e=t*256,a=Math.min(e+256,r.length),o=r.slice(e,a),s=o[0].time,c=o[o.length-1].time,l=this.createBlock(o,s,c,n);l!==null&&i.push(l)}}return i}createBlock(e,t,n,r){let i=this.allocator.allocateSlot();if(i===null)return null;let a=e[0].time,o=e[0].value,s=Qe(e,a,o);this.allocator.writeSlotData(i,s,e.length);let c=new Float64Array(e.length),l=new Float64Array(e.length);for(let t=0;t<e.length;t++)c[t]=e[t].time,l[t]=e[t].value;let u={minX:0,maxX:0,minY:0,maxY:0,timeStart:t,timeEnd:n,scale:r,chartType:this.chartType,slot:i,pointCount:e.length,baseTime:a,baseValue:o,pointTimes:c,pointValues:l};return this.registry.insert(u),u}};function J(e){return e.row*8+e.slotIndex}var ot=class{tree=new y;slotMap=new Map;insert(e){e.minX=e.timeStart,e.maxX=e.timeEnd,e.minY=e.scale,e.maxY=e.scale,this.tree.insert(e),this.slotMap.set(J(e.slot),e)}remove(e){this.tree.remove(e),this.slotMap.delete(J(e.slot))}removeBySlot(e){let t=this.slotMap.get(J(e));t!==void 0&&this.remove(t)}queryVisible(e,t,n,r){let i=this.tree.search({minX:t,maxX:n,minY:e,maxY:e});return r===void 0?i:i.filter(e=>e.chartType===r)}findCovering(e,t,n,r){return this.tree.search({minX:t,maxX:n,minY:e,maxY:e}).find(e=>e.chartType===r&&e.timeStart<=t&&e.timeEnd>=n)}clear(){this.tree.clear(),this.slotMap.clear()}getEntryCount(){return this.slotMap.size}},st=[j.Hour1,j.Hour12,j.Day1,j.Day4,j.Day16,j.Day64,j.Day256];function ct(e,t){let n=t-e;for(let e of st)if(n<=e)return e;return j.Day256}function Y(e,t,n,r){let i=t-e;return i>=r-n?[n,r]:e<n?[n,n+i]:t>r?[r-i,r]:[e,t]}function lt(e,t){let n=t-e,r=(n>0?n:Math.abs(e))*.1||1;return[e-r,t+r]}function ut(e,t,n,r){let i=e.length;if(i===0)return;let a=0,o=i;for(;a<o;){let t=a+o>>1;e[t]<n?a=t+1:o=t}let s=a;for(a=s,o=i;a<o;){let t=a+o>>1;e[t]<=r?a=t+1:o=t}let c=a;if(s>=c)return;let l=1/0,u=-1/0;for(let e=s;e<c;e++){let n=t[e];n<l&&(l=n),n>u&&(u=n)}return[l,u]}function dt(e,t,n,r){let i=n*((t-e)/r);return[e-i,t-i]}function ft(e,t,n,r){let i=t-e,a=e+i*r,o=Math.max(i*n,60);return[a-o*r,a+o*(1-r)]}var pt=class{activePointers=new Map;lastPinchDistance=0;velocitySamples=[];inertiaVelocity=0;lastInertiaTimestamp=0;handlePointerDown;handlePointerMove;handlePointerUp;handlePointerCancel;handleWheel;constructor(e,t,n,r,i){this.viewport=e,this.canvas=t,this.dataMinTime=n,this.dataMaxTime=r,this.fpsController=i,this.handlePointerDown=e=>{this.activePointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),this.fpsController.raise(60),this.inertiaVelocity=0,this.velocitySamples.length=0,this.activePointers.size===1?this.canvas.style.cursor=`grabbing`:this.activePointers.size===2&&(this.lastPinchDistance=this.getPointerDistance())},this.handlePointerMove=e=>{let t=this.activePointers.get(e.pointerId);if(t===void 0)return;if(this.activePointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),this.fpsController.raise(60),this.activePointers.size===2){let e=this.getPointerDistance(),t=this.lastPinchDistance/e,n=this.getPointerCenter(),[r,i]=Y(...ft(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,t,n),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=r,this.viewport.targetTimeEnd=i,this.lastPinchDistance=e;return}if(this.activePointers.size!==1)return;let n=e.clientX-t.clientX;this.recordVelocitySample(n,e.timeStamp);let[r,i]=Y(...dt(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,n,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=r,this.viewport.viewTimeEnd=i,this.viewport.targetTimeStart=r,this.viewport.targetTimeEnd=i},this.handlePointerUp=e=>{this.activePointers.delete(e.pointerId),this.activePointers.size===0&&(this.canvas.style.cursor=`grab`,this.startInertia())},this.handlePointerCancel=e=>{this.activePointers.delete(e.pointerId),this.activePointers.size===0&&(this.canvas.style.cursor=`grab`)},this.handleWheel=e=>{e.preventDefault();let t=this.canvas.getBoundingClientRect(),n=(e.clientX-t.left)/t.width,r=e.deltaY>0?te:ee,[i,a]=Y(...ft(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,r,n),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a,this.fpsController.raise(60)}}get isInteracting(){return this.activePointers.size>0}applyInertia(){if(Math.abs(this.inertiaVelocity)<.01)return this.inertiaVelocity=0,!1;let e=performance.now(),t=e-this.lastInertiaTimestamp;this.lastInertiaTimestamp=e;let n=this.inertiaVelocity*t,[r,i]=Y(...dt(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,n,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);if(r===this.viewport.viewTimeStart&&i===this.viewport.viewTimeEnd)return this.inertiaVelocity=0,!1;let a=r-this.viewport.viewTimeStart,o=i-this.viewport.viewTimeEnd;return this.viewport.viewTimeStart=r,this.viewport.viewTimeEnd=i,this.viewport.targetTimeStart+=a,this.viewport.targetTimeEnd+=o,this.inertiaVelocity*=ne,!0}attach(){this.canvas.addEventListener(`pointerdown`,this.handlePointerDown),this.canvas.addEventListener(`pointermove`,this.handlePointerMove),this.canvas.addEventListener(`pointerup`,this.handlePointerUp),this.canvas.addEventListener(`pointercancel`,this.handlePointerCancel),this.canvas.addEventListener(`pointerleave`,this.handlePointerUp),this.canvas.addEventListener(`wheel`,this.handleWheel,{passive:!1}),this.canvas.style.cursor=`grab`}detach(){this.canvas.removeEventListener(`pointerdown`,this.handlePointerDown),this.canvas.removeEventListener(`pointermove`,this.handlePointerMove),this.canvas.removeEventListener(`pointerup`,this.handlePointerUp),this.canvas.removeEventListener(`pointercancel`,this.handlePointerCancel),this.canvas.removeEventListener(`pointerleave`,this.handlePointerUp),this.canvas.removeEventListener(`wheel`,this.handleWheel)}recordVelocitySample(e,t){this.velocitySamples.push({dx:e,timestamp:t}),this.velocitySamples.length>5&&this.velocitySamples.shift()}startInertia(){if(this.velocitySamples.length<2){this.velocitySamples.length=0;return}let e=this.velocitySamples[0],t=this.velocitySamples[this.velocitySamples.length-1].timestamp-e.timestamp;if(t<=0){this.velocitySamples.length=0;return}let n=0;for(let e of this.velocitySamples)n+=e.dx;this.inertiaVelocity=n/t,this.lastInertiaTimestamp=performance.now(),this.velocitySamples.length=0}getPointerDistance(){let e=[...this.activePointers.values()],t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}getPointerCenter(){let e=[...this.activePointers.values()],t=this.canvas.getBoundingClientRect();return((e[0].clientX+e[1].clientX)/2-t.left)/t.width}},mt=4,ht=mt*Float32Array.BYTES_PER_ELEMENT,gt=64,_t=class{device;buffer;cpuBuffer;f32View;u32View;allocator;maxBlocks;constructor(e,t,n=gt){this.device=e,this.allocator=t,this.maxBlocks=n;let r=n*ht;this.buffer=e.createBuffer({size:r,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.cpuBuffer=new ArrayBuffer(r),this.f32View=new Float32Array(this.cpuBuffer),this.u32View=new Uint32Array(this.cpuBuffer)}writeDescriptors(e,t){let n=Math.min(e.length,this.maxBlocks);if(n===0)return{totalInstances:0,globalBaseTime:0,globalBaseValue:0};let r=e[0].baseTime,i=e[0].baseValue,a=0;for(let t=0;t<n;t++){let n=e[t],o=t*mt,s=this.allocator.getTextureOffset(n.slot);this.u32View[o]=s,this.u32View[o+1]=n.pointCount,this.f32View[o+2]=n.baseTime-r,this.f32View[o+3]=n.baseValue-i,a+=n.pointCount}let o=n*ht;return this.device.queue.writeBuffer(this.buffer,0,this.cpuBuffer,0,o),{totalInstances:t?Math.max(0,a-1):a,globalBaseTime:r,globalBaseValue:i}}getBuffer(){return this.buffer}getTextureWidth(){return w}dispose(){this.buffer.destroy()}},vt=6,yt=class{device;bindGroupLayout;uniformBuffer;uniformView;descriptorBuffer;currentBindGroup=null;currentInstanceCount=0;currentBlockCount=0;constructor(e,t){this.verticesPerInstance=e,this.needsStitching=t}init(e,t,n){this.device=e,this.bindGroupLayout=t,this.uniformView=x(S(L).uniforms.U),this.uniformBuffer=this.device.createBuffer({size:this.uniformView.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.descriptorBuffer=new _t(e,n)}updateBindGroup(e){this.currentBindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:e},{binding:2,resource:{buffer:this.descriptorBuffer.getBuffer()}}]})}writeUniforms(e,t,n,r,i,a,o){if(e.length===0){this.currentInstanceCount=0,this.currentBlockCount=0;return}this.currentBlockCount=e.length;let{totalInstances:s,globalBaseTime:c,globalBaseValue:l}=this.descriptorBuffer.writeDescriptors(e,this.needsStitching);this.currentInstanceCount=s,this.uniformView.set({viewport:[t,n],timeRangeMin:r-c,timeRangeMax:i-c,valueRangeMin:a-l,valueRangeMax:o-l,textureWidth:w,lineWidth:Math.max(1,window.devicePixelRatio),blockCount:e.length}),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformView.arrayBuffer)}render(e,t,n){this.currentBindGroup===null||this.currentInstanceCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(this.verticesPerInstance,this.currentInstanceCount,0,0))}renderDebug(e,t,n){this.currentBindGroup===null||this.currentBlockCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(vt,this.currentBlockCount,0,0))}get instanceCount(){return this.currentInstanceCount}get bindGroup(){return this.currentBindGroup}dispose(){this.uniformBuffer.destroy(),this.descriptorBuffer.dispose(),this.currentBindGroup=null}},bt=class{entries=[];addSeries(e,t){this.entries.push({layer:e,pipeline:t})}initAll(e,t,n){for(let r of this.entries)r.layer.init(e,t,n)}updateBindGroups(e){for(let t of this.entries)t.layer.updateBindGroup(e)}writeAllUniforms(e,t,n,r,i,a,o){for(let s=0;s<this.entries.length;s++){let c=this.entries[s],l=e[s]??[];c.layer.writeUniforms(l,t,n,r,i,a,o)}}renderAll(e,t){for(let n of this.entries)n.layer.render(e,n.pipeline,t)}renderDebug(e,t,n){for(let r of this.entries)r.layer.renderDebug(e,t,n)}dispose(){for(let e of this.entries)e.layer.dispose()}},xt=`rgba32float`,St=class{device;maxRows;textureWidth;textureUsage;onEvict;texture;capacity;highWaterMark=0;freeSlots=[];lru;constructor(e,t=4,n=512,r=w,i){this.device=e,this.maxRows=n,this.textureWidth=r,this.onEvict=i,this.capacity=t,this.textureUsage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC,this.texture=e.createTexture({size:[r,t],format:xt,usage:this.textureUsage}),this.lru=new b({max:n*8})}allocateSlot(){if(this.freeSlots.length>0){let e=this.freeSlots.pop();return this.registerSlot(e)}let e=this.capacity*8;if(this.highWaterMark<e){let e=this.highWaterMark;return this.highWaterMark++,this.registerSlot(e)}if(this.capacity<this.maxRows){let e=Math.min(this.capacity*2,this.maxRows);this.growTexture(e);let t=this.highWaterMark;return this.highWaterMark++,this.registerSlot(t)}return this.evictAndAllocate()}writeSlotData(e,t,n){let r=e.row*this.textureWidth+e.slotIndex*256,i=r%this.textureWidth,a=Math.floor(r/this.textureWidth),o=this.textureWidth*4*Float32Array.BYTES_PER_ELEMENT,s=t.subarray(0,n*4);this.device.queue.writeTexture({texture:this.texture,origin:[i,a,0]},s,{bytesPerRow:o,rowsPerImage:1},[n,1,1])}touch(e){let t=this.flattenSlot(e);this.lru.get(t)}releaseSlot(e){let t=this.flattenSlot(e);this.lru.delete(t),this.freeSlots.push(t)}getTextureOffset(e){return e.row*this.textureWidth+e.slotIndex*256}createView(){return this.texture.createView()}getCapacity(){return this.capacity}getAllocatedSlotCount(){return this.lru.size}getHighWaterMark(){return this.highWaterMark}dispose(){this.texture.destroy(),this.lru.clear(),this.freeSlots.length=0}registerSlot(e){return this.lru.set(e,!0),this.unflattenSlot(e)}evictAndAllocate(){let e=this.lru.rkeys().next().value;if(e===void 0)return null;let t=this.unflattenSlot(e);return this.lru.delete(e),this.onEvict!==void 0&&this.onEvict(t),this.registerSlot(e)}growTexture(e){let t=this.device.createTexture({size:[this.textureWidth,e],format:xt,usage:this.textureUsage});if(this.highWaterMark>0){let e=Math.ceil(this.highWaterMark/8),n=this.device.createCommandEncoder();n.copyTextureToTexture({texture:this.texture,origin:[0,0,0]},{texture:t,origin:[0,0,0]},[this.textureWidth,e,1]),this.device.queue.submit([n.finish()])}this.texture.destroy(),this.texture=t,this.capacity=e}flattenSlot(e){return e.row*8+e.slotIndex}unflattenSlot(e){return{row:Math.floor(e/8),slotIndex:e%8}}},Ct=500,wt=class{widthCache;currentFont=``;glyphMetrics=null;constructor(e=Ct){this.widthCache=new b({max:e})}measureWidth(e,t){this.ensureFont(e);let n=this.widthCache.get(t);if(n!==void 0)return n;let r=e.measureText(t).width;return this.widthCache.set(t,r),r}getGlyphMetrics(e){if(this.ensureFont(e),this.glyphMetrics!==null)return this.glyphMetrics;let t=e.measureText(`0`),n=t.actualBoundingBoxAscent,r=t.actualBoundingBoxDescent;return this.glyphMetrics={ascent:n,descent:r,centerOffset:(n-r)/2},this.glyphMetrics}ensureFont(e){e.font!==this.currentFont&&(this.currentFont=e.font,this.widthCache.clear(),this.glyphMetrics=null)}},X=60,Z=3600,Tt=86400,Et=60,Q=24,Dt=[1,2,5],Ot=8,kt=2,At=70,jt=20,Mt=10;function $(e){let t=BigInt(Math.trunc(e))*1000000000n;return i.Instant.fromEpochNanoseconds(t)}function Nt(e,t){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}`}function Pt(e,t,n,r,i){if(e.length<=1||r<=0)return e;let a=n-t;if(a<=0)return e;let o=i+Mt,s=[],c=-1/0;for(let n of e){let e=(n.position-t)/a*r;e-c>=o&&(s.push(n),c=e)}return s}function Ft(e,t,n,r){return Pt(Bt(e,t,n),e,t,r,At)}function It(e,t){let n=[],r=$(e).toZonedDateTimeISO(`UTC`),a=$(t).toZonedDateTimeISO(`UTC`),o=r.with({day:1,hour:0,minute:0,second:0,nanosecond:0});for(i.ZonedDateTime.compare(o,r)<0&&(o=o.add({months:1}));i.ZonedDateTime.compare(o,a)<=0;)n.push({position:Number(o.epochNanoseconds/1000000000n),label:o.toPlainDate().toLocaleString(`en-US`,{month:`short`})}),o=o.add({months:1});return n}function Lt(e,t){let n=[],r=$(e).toZonedDateTimeISO(`UTC`),a=$(t).toZonedDateTimeISO(`UTC`),o=r.with({hour:0,minute:0,second:0,nanosecond:0});for(i.ZonedDateTime.compare(o,r)<0&&(o=o.add({days:1}));i.ZonedDateTime.compare(o,a)<=0;)n.push({position:Number(o.epochNanoseconds/1000000000n),label:String(o.day)}),o=o.add({days:1});return n}function Rt(e,t){let n=[],r=Math.ceil(e/Z),i=Math.floor(t/Z);for(let e=r;e<=i;e++){let t=e*Z,r=(e%Q+Q)%Q;n.push({position:t,label:Nt(r,0)})}return n}function zt(e,t){let n=[],r=Math.ceil(e/X),i=Math.floor(t/X);for(let e=r;e<=i;e++){let t=e*X,r=Math.floor(t%Tt/X),i=Math.floor(r/Et),a=r%Et;n.push({position:t,label:Nt((i%Q+Q)%Q,a)})}return n}function Bt(e,t,n){switch(n){case j.Day256:case j.Day64:return It(e,t);case j.Day16:case j.Day4:return Lt(e,t);case j.Day1:return Rt(e,t);case j.Hour12:case j.Hour1:return zt(e,t)}}function Vt(e){if(e<=0)return 1;let t=10**Math.floor(Math.log10(e)),n=e/t;for(let e of Dt)if(e>=n)return e*t;return Dt[0]*t*10}function Ht(e,t,n){let r=t-e;if(r<=0)return[{position:e,label:Ut(e,1)}];let i=Vt(r/Ot);Math.floor(r/i)<kt&&(i=Vt(r/kt));let a=Math.max(0,-Math.floor(Math.log10(i))+1),o=[],s=Math.ceil(e/i)*i;for(let n=s;n<=t+i*.01;n+=i)n>=e&&n<=t&&o.push({position:n,label:Ut(n,a)});return Pt(o,e,t,n,jt)}function Ut(e,t){return e.toFixed(t)}var Wt=50,Gt=class{cache;constructor(e=Wt){this.cache=new b({max:e})}getXTicks(e,t,n,r){let i=`x:${e}:${t}:${n}:${Math.round(r)}`,a=this.cache.get(i);if(a!==void 0)return a;let o=Ft(e,t,n,r);return this.cache.set(i,o),o}getYTicks(e,t,n){let r=`y:${e}:${t}:${Math.round(n)}`,i=this.cache.get(r);if(i!==void 0)return i;let a=Ht(e,t,n);return this.cache.set(r,a),a}},Kt=`#1a1a1a`,qt=0,Jt=200,Yt=2;function Xt(e){switch(e){case M.Line:return 18;case M.Candlestick:return 6;case M.Rhombus:return 6}}function Zt(e){switch(e){case M.Line:case M.Candlestick:return!0;case M.Rhombus:return!1}}function Qt(e,t){switch(e){case M.Line:return t.linePipeline;case M.Candlestick:return t.candlestickPipeline;case M.Rhombus:return t.rhombusPipeline}}var $t=2,en=3,tn=4,nn=class{targetCanvas;target2dContext;seriesManager;fpsController;viewport;dataMinTime;dataMaxTime;allocator;registry;dataPipelines;inputController;resizeObserver;textCache=new wt;tickCache=new Gt;canvasWidth=0;canvasHeight=0;lastTextureCapacity=0;layoutCache=null;constructor(e,t,r,i,s,c){this.targetCanvas=r;let l=r.getContext(`2d`);n(!a(l),`Failed to get 2D canvas context`),this.target2dContext=l,this.dataMinTime=T,this.dataMaxTime=T+k,this.viewport={viewTimeStart:i,viewTimeEnd:s,targetTimeStart:i,targetTimeEnd:s,viewValueMin:qt,viewValueMax:Jt},this.registry=new ot,this.allocator=new St(e.device,void 0,void 0,void 0,e=>{this.registry.removeBySlot(e)}),this.lastTextureCapacity=this.allocator.getCapacity(),this.dataPipelines=[],this.seriesManager=new bt;for(let n of t){let t=new at(this.allocator,this.registry,`${c}${n.seedSuffix}`,n.chartType,n.colorFn,n.sizeFn,()=>e.debugMode,()=>e.instantLoad);this.dataPipelines.push(t);let r=new yt(Xt(n.chartType),Zt(n.chartType)),i=Qt(n.chartType,e);this.seriesManager.addSeries(r,i)}this.seriesManager.initAll(e.device,e.bindGroupLayout,this.allocator),this.seriesManager.updateBindGroups(this.allocator.createView()),this.fpsController=new o(10),this.inputController=new pt(this.viewport,r,this.dataMinTime,this.dataMaxTime,this.fpsController),this.inputController.attach(),this.updateCanvasSize(),this.resizeObserver=new ResizeObserver(()=>{this.updateCanvasSize(),this.fpsController.raise(60)}),this.resizeObserver.observe(r)}get width(){return this.canvasWidth}get height(){return this.canvasHeight}syncCanvasSize(){let e=Math.max(1,window.devicePixelRatio),t=Math.floor(this.targetCanvas.clientWidth*e),n=Math.floor(this.targetCanvas.clientHeight*e);return this.canvasWidth=t,this.canvasHeight=n,this.targetCanvas.width!==t||this.targetCanvas.height!==n?(this.targetCanvas.width=t,this.targetCanvas.height=n,!0):!1}update(){this.updateCanvasSize(),this.inputController.applyInertia()&&this.fpsController.raise(60);let e=this.viewport.targetTimeStart-this.viewport.viewTimeStart,t=this.viewport.targetTimeEnd-this.viewport.viewTimeEnd,n=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*re;Math.abs(e)>n||Math.abs(t)>n?(this.viewport.viewTimeStart+=e*O,this.viewport.viewTimeEnd+=t*O,this.fpsController.raise(60)):(this.viewport.viewTimeStart=this.viewport.targetTimeStart,this.viewport.viewTimeEnd=this.viewport.targetTimeEnd)}prepareDrawCommands(){let e=ct(this.viewport.viewTimeStart,this.viewport.viewTimeEnd),t=this.dataPipelines.map(t=>t.ensureBlocksForViewport(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,e));if(this.getLoadingRegions().length>0&&this.fpsController.raise(60),!t.some(e=>e.reduce((e,t)=>e+t.pointCount,0)>=Yt)&&this.getLoadingRegions().length===0)return null;for(let e of t)for(let t of e)this.allocator.touch(t.slot);let n=1/0,r=-1/0;for(let e of t)for(let t of e){let e=ut(t.pointTimes,t.pointValues,this.viewport.viewTimeStart,this.viewport.viewTimeEnd);e!==void 0&&(n=Math.min(n,e[0]),r=Math.max(r,e[1]))}if(n<r){let[e,t]=lt(n,r);this.viewport.viewValueMin=e,this.viewport.viewValueMax=t}let i=this.allocator.getCapacity();i!==this.lastTextureCapacity&&(this.lastTextureCapacity=i,this.rebuildLayerBindGroups()),this.seriesManager.writeAllUniforms(t,this.canvasWidth,this.canvasHeight,this.viewport.viewTimeStart,this.viewport.viewTimeEnd,this.viewport.viewValueMin,this.viewport.viewValueMax);let a=Math.max(1,window.devicePixelRatio);return{x:Math.floor(10*a),y:Math.floor(10*a),width:Math.max(0,this.canvasWidth-Math.floor(20*a)),height:Math.max(0,this.canvasHeight-Math.floor(20*a))}}getFrameLayout(){let{viewTimeStart:e,viewTimeEnd:t,viewValueMin:n,viewValueMax:r}=this.viewport,i=Math.max(1,window.devicePixelRatio),a=this.layoutCache;if(a!==null&&a.timeStart===e&&a.timeEnd===t&&a.valueMin===n&&a.valueMax===r&&a.canvasWidth===this.canvasWidth&&a.canvasHeight===this.canvasHeight)return a;let o=10*i,s=10*i,c=this.canvasWidth-20*i,l=this.canvasHeight-20*i;if(c<=0||l<=0)return this.layoutCache=null,null;let u=ct(e,t),d=c/i,f=l/i;return this.layoutCache={timeStart:e,timeEnd:t,valueMin:n,valueMax:r,canvasWidth:this.canvasWidth,canvasHeight:this.canvasHeight,dpr:i,plotLeft:o,plotTop:s,plotWidth:c,plotHeight:l,plotRight:o+c,plotBottom:s+l,scale:u,xTicks:this.tickCache.getXTicks(e,t,u,d),yTicks:this.tickCache.getYTicks(n,r,f)},this.layoutCache}renderCanvasAxes(){let e=this.getFrameLayout();if(e===null)return;let{dpr:t,plotLeft:n,plotTop:r,plotRight:i,plotBottom:a,plotWidth:o,plotHeight:s,xTicks:c,yTicks:l}=e,u=this.target2dContext,d=e.timeEnd-e.timeStart,f=e.valueMax-e.valueMin,p=11*t,m=5*t,h=3*t,g=2*t,_=$t*t,v=en*t,y=tn*t,b=18*t,x=18*t;u.strokeStyle=A,u.lineWidth=t,u.beginPath(),u.moveTo(n,r),u.lineTo(n,a),u.lineTo(i,a),u.stroke(),u.font=`${p}px ${se}`,u.textBaseline=`alphabetic`;let{centerOffset:S}=this.textCache.getGlyphMetrics(u);for(let r of c){let s=n+(r.position-e.timeStart)/d*o;if(s<n||s>i)continue;u.strokeStyle=A,u.lineWidth=t,u.beginPath(),u.moveTo(s,a),u.lineTo(s,a-m),u.stroke();let c=this.textCache.measureWidth(u,r.label);if(s-c/2-h<n+b)continue;let l=a-m-v-p/2,f=p+g*2;u.fillStyle=ae,u.beginPath(),u.roundRect(s-c/2-h,l-f/2,c+h*2,f,_),u.fill(),u.fillStyle=ie,u.textAlign=`center`,u.fillText(r.label,s,l+S)}for(let i of l){let o=a-(i.position-e.valueMin)/f*s;if(o<r||o>a)continue;u.strokeStyle=A,u.lineWidth=t,u.beginPath(),u.moveTo(n,o),u.lineTo(n+m,o),u.stroke();let c=n+m+y,l=o,d=p+g*2;if(l+d/2>a-x)continue;let v=this.textCache.measureWidth(u,i.label);u.fillStyle=ae,u.beginPath(),u.roundRect(c-h,l-d/2,v+h*2,d,_),u.fill(),u.fillStyle=ie,u.textAlign=`start`,u.fillText(i.label,c,l+S)}}renderCanvasGrid(){let e=this.getFrameLayout();if(e===null)return;let{dpr:t,plotLeft:n,plotTop:r,plotRight:i,plotBottom:a,plotWidth:o,plotHeight:s,xTicks:c,yTicks:l}=e,u=this.target2dContext,d=e.timeEnd-e.timeStart,f=e.valueMax-e.valueMin;u.fillStyle=Kt,u.fillRect(0,0,this.canvasWidth,this.canvasHeight),u.strokeStyle=oe,u.lineWidth=t*.5,u.setLineDash([10*t,10*t]),u.beginPath();for(let t of c){let s=n+(t.position-e.timeStart)/d*o;s<n||s>i||(u.moveTo(s,r),u.lineTo(s,a))}for(let t of l){let o=a-(t.position-e.valueMin)/f*s;o<r||o>a||(u.moveTo(n,o),u.lineTo(i,o))}u.stroke(),u.setLineDash([])}getLoadingRegions(){let e=[];for(let t of this.dataPipelines)e.push(...t.getLoadingRegions());return e}getViewport(){return{timeStart:this.viewport.viewTimeStart,timeEnd:this.viewport.viewTimeEnd}}dispose(){this.resizeObserver.disconnect(),this.inputController.detach(),this.seriesManager.dispose(),this.allocator.dispose(),this.fpsController.dispose()}rebuildLayerBindGroups(){this.seriesManager.updateBindGroups(this.allocator.createView())}updateCanvasSize(){let e=Math.max(1,window.devicePixelRatio),t=Math.floor(this.targetCanvas.clientWidth*e),n=this.canvasWidth;if(this.canvasWidth=t,this.canvasHeight=Math.floor(this.targetCanvas.clientHeight*e),n>0&&t!==n){let e=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*(t/n),r=(this.viewport.viewTimeStart+this.viewport.viewTimeEnd)/2;this.viewport.viewTimeStart=r-e/2,this.viewport.viewTimeEnd=r+e/2}}},rn=(0,C.memo)(({initialTimeStart:e,initialTimeEnd:t,chartSeed:n,seriesConfigs:r})=>{let i=(0,C.useRef)(null),o=V();return(0,C.useEffect)(()=>{if(a(o)||a(i.current))return;let s=new nn(o,r,i.current,e,t,n);return o.registerChart(s)},[o,e,t,n,r]),(0,P.jsx)(`div`,{className:`relative h-full w-full bg-[#1a1a1a]`,children:(0,P.jsx)(`canvas`,{ref:i,className:`absolute inset-0 h-full w-full [touch-action:none]`})})}),an=110,on=105,sn=100,cn=95,ln=d(.9,.2,.2,1),un=d(1,.6,.1,1),dn=d(.2,.8,.3,1),fn=d(.2,.5,.9,1),pn=d(.7,.7,.7,1),mn=d(0,.5,1,1),hn=10,gn=.6,_n=d(1,.6,.1,1),vn=2,yn=4,bn=6,xn=8,Sn=10;function Cn(e){return e>an?Sn:e>on?xn:e>sn?bn:e>cn?yn:vn}function wn(e){return e>an?ln:e>on?un:e>sn?pn:e>cn?dn:fn}var Tn=[[{chartType:M.Line,seedSuffix:``,colorFn:()=>mn,sizeFn:()=>hn},{chartType:M.Candlestick,seedSuffix:`-series-2`,colorFn:(e,t,n)=>{let r=c(n[t].color);return d(r.r,r.g,r.b,gn)}}],[{chartType:M.Candlestick,seedSuffix:``}],[{chartType:M.Line,seedSuffix:``,colorFn:()=>_n,sizeFn:e=>Cn(e)}],[{chartType:M.Rhombus,seedSuffix:``,colorFn:e=>wn(e)}]],En=(0,C.memo)(()=>{let e=V();return(0,P.jsxs)(`div`,{className:`${v.fixedContainer} relative grid grid-cols-2 grid-rows-2`,children:[(0,P.jsx)(he,{renderer:e}),fe.map((e,t)=>(0,P.jsx)(rn,{initialTimeStart:T+e[0],initialTimeEnd:T+e[1],chartSeed:`chart-${t}`,seriesConfigs:Tn[t]},`${e[0]}-${e[1]}`))]})}),Dn=(0,C.memo)(()=>(0,P.jsx)(_,{className:`h-full w-full`,children:(0,P.jsx)(ge,{children:(0,P.jsx)(Pe,{children:(0,P.jsx)(En,{})})})}));export{Dn as Timeseries};