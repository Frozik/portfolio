import{i as e,t}from"./c-Dd_uD5pT.js";import{B as n,R as r,V as i,it as a,j as o}from"./c-C8QCGV-W.js";import{r as s}from"./c-BarNUK2b.js";import{i as c}from"./c-DP_47kS8.js";import{g as l}from"./e-CdrUW1xU.js";import{n as u,t as d}from"./c-BO8HgrYD.js";import{n as f}from"./c-BpTq7hBq.js";import{t as p}from"./c-BUVw3GsZ.js";import{i as m,n as h,r as g,t as _}from"./c-CJyDFczy.js";import{t as v}from"./c-JQa_l6qu.js";import{t as y}from"./c-DTCijewY.js";import{n as b,r as x,t as S}from"./c-CEv-LbpK.js";import{t as C}from"./c-Ch-CwG1S.js";import{n as w,t as T}from"./c-D4KnC0m8.js";var E=255,D=255,ee=126,te=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),O=new Float32Array(te),k=new Uint32Array(te);function A(e,t,n,r){let i=Math.round(r*D)&E,a=Math.round(e*D)&E,o=Math.round(t*D)&E,s=Math.min(Math.round(n*D)&E,ee);return k[0]=i|a<<8|o<<16|s<<24,O[0]}function ne(e){O[0]=e;let t=k[0];return{a:(t&E)/D,r:(t>>8&E)/D,g:(t>>16&E)/D,b:(t>>24&E)/D}}var j=e(c(),1),M=2048,N=1767225600,re=.5,ie=1e3,ae=.7,oe=1.3,se=.95,P=.18,ce=.005,F=31536e3,le=`#ccc`,ue=`rgba(50, 50, 50, 0.75)`,I=`#aaa`,de=`#444`,fe=`monospace`,pe=1024,me=[[0,F],[F/2-3888e3,19656e3],[F/2-1296e3,17064e3],[F/2-302400,16070400]],L=function(e){return e[e.Hour1=3600]=`Hour1`,e[e.Hour12=43200]=`Hour12`,e[e.Day1=86400]=`Day1`,e[e.Day4=345600]=`Day4`,e[e.Day16=1382400]=`Day16`,e[e.Day64=5529600]=`Day64`,e[e.Day256=22118400]=`Day256`,e}({}),R=function(e){return e[e.Line=0]=`Line`,e[e.Candlestick=1]=`Candlestick`,e[e.Rhombus=2]=`Rhombus`,e}({}),he=l({en:{debugOverlay:{debug:`Debug`,loadingDelay:`Loading delay`}},ru:{debugOverlay:{debug:`Отладка`,loadingDelay:`Задержка загрузки`}}}),z=n(),ge=250,_e=v(),ve=`relative h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 transition-colors duration-200 checked:bg-brand-500`,ye=`pointer-events-none absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-3`,be=(0,j.memo)(({renderer:e})=>{let[t,n]=(0,j.useState)(0),[r,i]=(0,j.useState)(!1),[s,c]=(0,j.useState)(!0);(0,j.useEffect)(()=>{if(a(e))return;let t=setInterval(()=>{n(e.renderFps),i(e.debugMode),c(e.instantLoad)},ge);return()=>clearInterval(t)},[e]);let l=o(()=>{e?.setDebugMode(!e.debugMode)}),u=o(()=>{e?.setInstantLoad(!e.instantLoad)});return(0,z.jsxs)(`div`,{className:`pointer-events-auto absolute top-1 right-1 z-10 flex select-none flex-col items-center gap-2 rounded bg-[#1a1a40]/80 px-3 py-2 font-mono text-xs text-white`,children:[(0,z.jsxs)(`span`,{className:`tabular-nums`,children:[t,` fps`]}),(0,z.jsxs)(`div`,{className:`flex w-full flex-col gap-1.5`,children:[!_e&&(0,z.jsxs)(`label`,{className:`flex cursor-pointer items-center justify-between gap-2`,children:[(0,z.jsx)(`span`,{children:he.debugOverlay.debug}),(0,z.jsxs)(`span`,{className:`relative inline-flex items-center`,children:[(0,z.jsx)(`input`,{type:`checkbox`,checked:r,onChange:l,className:`peer ${ve}`}),(0,z.jsx)(`span`,{className:ye})]})]}),(0,z.jsxs)(`label`,{className:`flex cursor-pointer items-center justify-between gap-2`,children:[(0,z.jsx)(`span`,{children:he.debugOverlay.loadingDelay}),(0,z.jsxs)(`span`,{className:`relative inline-flex items-center`,children:[(0,z.jsx)(`input`,{type:`checkbox`,checked:!s,onChange:u,className:`peer ${ve}`}),(0,z.jsx)(`span`,{className:ye})]})]})]})]})}),xe=17,Se=class{available=[];acquire(e,t,n,r){let i=this.available.findIndex(e=>e.width===t&&e.height===n);if(i!==-1){let[e]=this.available.splice(i,1);return e}for(let e of this.available)e.destroy();return this.available.length=0,e.createTexture({size:[t,n],format:r,usage:xe})}release(e){this.available.push(e)}dispose(){for(let e of this.available)e.destroy();this.available.length=0}},Ce=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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
`,we=`struct Uniforms {
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
`,Te=`// Debug shader: draws vertical lines at block boundaries.
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
`,Ee=`struct VSOut {
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
`,De=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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
`,Oe={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},B={line:{source:Ee,vertexEntry:`vs`,fragmentEntry:`fs`},candlestick:{source:Ce,vertexEntry:`vsCandlestick`,fragmentEntry:`fsCandlestick`},rhombus:{source:De,vertexEntry:`vsRhombus`,fragmentEntry:`fsRhombus`},debug:{source:Te,vertexEntry:`vsDebugLines`,fragmentEntry:`fsDebugLines`}};function ke(e,t){let n=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]}),r=e.createPipelineLayout({bindGroupLayouts:[n]}),i=n=>{let i=e.createShaderModule({code:we+n.source});return e.createRenderPipeline({layout:r,vertex:{module:i,entryPoint:n.vertexEntry},fragment:{module:i,entryPoint:n.fragmentEntry,targets:[{format:t,blend:Oe}]},primitive:{topology:`triangle-list`},multisample:{count:4}})};return{bindGroupLayout:n,linePipeline:i(B.line),candlestickPipeline:i(B.candlestick),rhombusPipeline:i(B.rhombus),debugPipeline:i(B.debug)}}var Ae=2,V=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST;async function je(){i(!a(navigator.gpu),`WebGPU is not supported`);let e=await navigator.gpu.requestAdapter();i(!a(e),`WebGPU adapter not available`);let t=await e.requestDevice(),n=new OffscreenCanvas(pe,768),r=n.getContext(`webgpu`);i(!a(r),`Failed to get WebGPU context on OffscreenCanvas`);let o=navigator.gpu.getPreferredCanvasFormat();return r.configure({device:t,format:o,alphaMode:`premultiplied`,usage:V}),new Me(t,o,ke(t,o),n,r)}var Me=class{device;format;resources;offscreen;context;debugMode=!1;instantLoad=!0;renderFps=0;charts=new Set;msaaManager=p(4);renderTargetPool=new Se;fpsMeter=new x({onUpdate:e=>{this.renderFps=e}});animationFrameId=0;lastFrameTime=0;disposed=!1;needsReconfigure=!1;constructor(e,t,n,r,i){this.device=e,this.format=t,this.resources=n,this.offscreen=r,this.context=i}setDebugMode(e){this.debugMode=e}setInstantLoad(e){this.instantLoad=e}registerChart(e){return this.charts.add(e),this.charts.size===1&&this.startAnimationLoop(),()=>{this.charts.delete(e),e.dispose(),this.charts.size===0&&this.stopAnimationLoop()}}destroy(){if(!this.disposed){this.disposed=!0,this.stopAnimationLoop();for(let e of this.charts)e.dispose();this.charts.clear(),this.msaaManager.dispose(),this.renderTargetPool.dispose(),this.device.destroy()}}getMinFrameIntervalMs(){let e;for(let t of this.charts)(a(e)||t.frameIntervalMs<e)&&(e=t.frameIntervalMs);return e??100}startAnimationLoop(){if(this.disposed)return;let e=t=>{if(this.disposed)return;for(let e of this.charts)e.tickFps();let n=this.getMinFrameIntervalMs();if(t-this.lastFrameTime<n-Ae){this.animationFrameId=requestAnimationFrame(e);return}this.lastFrameTime=t,this.fpsMeter.tick(t,n),this.renderAllCharts(),this.animationFrameId=requestAnimationFrame(e)};this.animationFrameId=requestAnimationFrame(e)}stopAnimationLoop(){cancelAnimationFrame(this.animationFrameId),this.animationFrameId=0}renderAllCharts(){for(let e of this.charts){if(e.update(),e.width===0||e.height===0)continue;let t=e.prepareFrame();a(t)||this.renderChart(e,t)}}renderChart(e,t){let{width:n,height:r}=e;(this.offscreen.width!==n||this.offscreen.height!==r||this.needsReconfigure)&&(this.offscreen.width=n,this.offscreen.height=r,this.context.configure({device:this.device,format:this.format,alphaMode:`premultiplied`,usage:V}),this.needsReconfigure=!1);let i=this.renderTargetPool.acquire(this.device,n,r,this.format),o=this.msaaManager.ensureView(this.device,this.format,n,r);if(a(o)){this.renderTargetPool.release(i);return}let s=this.device.createCommandEncoder(),c=s.beginRenderPass({colorAttachments:[{view:o,resolveTarget:i.createView(),loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});e.recordDrawCalls(c,t,this.debugMode?this.resources.debugPipeline:void 0),c.end(),s.copyTextureToTexture({texture:i},{texture:this.context.getCurrentTexture()},[n,r]),this.device.queue.submit([s.finish()]),this.renderTargetPool.release(i);let l=this.offscreen.transferToImageBitmap();this.needsReconfigure=!0,e.presentFrame(l),l.close()}},H={status:`initializing`},U=(0,j.createContext)(H);function W(){return(0,j.useContext)(U)}var Ne=(0,j.memo)(({children:e})=>{let[t,n]=(0,j.useState)(H);return(0,j.useEffect)(()=>{let e=!1,t;return je().then(r=>{if(e){r.destroy();return}t=r,n({status:`ready`,renderer:r})},e=>{n({status:`unsupported`,fail:s(e)})}),()=>{e=!0,a(t)||t.destroy()}},[]),(0,z.jsx)(U,{value:t,children:e})});function G(e){return e.row*8+e.slotIndex}var Pe=class extends _{toBBox(e){return{minX:e.timeStart,maxX:e.timeEnd,minY:e.scale,maxY:e.scale}}compareMinX(e,t){return e.timeStart-t.timeStart}compareMinY(e,t){return e.scale-t.scale}},Fe=class{tree=new Pe;slotMap=new Map;insert(e){this.tree.insert(e),this.slotMap.set(G(e.slot),e)}remove(e){this.tree.remove(e),this.slotMap.delete(G(e.slot))}removeBySlot(e){let t=this.slotMap.get(G(e));t!==void 0&&this.remove(t)}queryVisible(e,t,n,r){let i=this.tree.search({minX:t,maxX:n,minY:e,maxY:e});return r===void 0?i:i.filter(e=>e.chartType===r)}findCovering(e,t,n,r){return this.tree.search({minX:t,maxX:n,minY:e,maxY:e}).find(e=>e.chartType===r&&e.timeStart<=t&&e.timeEnd>=n)}clear(){this.tree.clear(),this.slotMap.clear()}getEntryCount(){return this.slotMap.size}};function K(e,t,n){return{left:10*n,top:10*n,width:e-20*n,height:t-20*n}}var q=60,J=3600,Ie=86400,Y=60,X=24,Le=[1,2,5],Re=8,ze=2,Be=70,Ve=20,He=10;function Z(e){let t=BigInt(Math.trunc(e))*1000000000n;return r.Instant.fromEpochNanoseconds(t)}function Ue(e,t){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}`}function We(e,t,n,r,i){if(e.length<=1||r<=0)return e;let a=n-t;if(a<=0)return e;let o=i+He,s=[],c=-1/0;for(let n of e){let e=(n.position-t)/a*r;e-c>=o&&(s.push(n),c=e)}return s}function Ge(e,t,n,r){return We(Xe(e,t,n),e,t,r,Be)}function Ke(e,t){let n=[],i=Z(e).toZonedDateTimeISO(`UTC`),a=Z(t).toZonedDateTimeISO(`UTC`),o=i.with({day:1,hour:0,minute:0,second:0,nanosecond:0});for(r.ZonedDateTime.compare(o,i)<0&&(o=o.add({months:1}));r.ZonedDateTime.compare(o,a)<=0;)n.push({position:Number(o.epochNanoseconds/1000000000n),label:o.toPlainDate().toLocaleString(`en-US`,{month:`short`})}),o=o.add({months:1});return n}function qe(e,t){let n=[],i=Z(e).toZonedDateTimeISO(`UTC`),a=Z(t).toZonedDateTimeISO(`UTC`),o=i.with({hour:0,minute:0,second:0,nanosecond:0});for(r.ZonedDateTime.compare(o,i)<0&&(o=o.add({days:1}));r.ZonedDateTime.compare(o,a)<=0;)n.push({position:Number(o.epochNanoseconds/1000000000n),label:String(o.day)}),o=o.add({days:1});return n}function Je(e,t){let n=[],r=Math.ceil(e/J),i=Math.floor(t/J);for(let e=r;e<=i;e++){let t=e*J,r=(e%X+X)%X;n.push({position:t,label:Ue(r,0)})}return n}function Ye(e,t){let n=[],r=Math.ceil(e/q),i=Math.floor(t/q);for(let e=r;e<=i;e++){let t=e*q,r=Math.floor(t%Ie/q),i=Math.floor(r/Y),a=r%Y;n.push({position:t,label:Ue((i%X+X)%X,a)})}return n}function Xe(e,t,n){switch(n){case L.Day256:case L.Day64:return Ke(e,t);case L.Day16:case L.Day4:return qe(e,t);case L.Day1:return Je(e,t);case L.Hour12:case L.Hour1:return Ye(e,t)}}function Ze(e){if(e<=0)return 1;let t=10**Math.floor(Math.log10(e)),n=e/t;for(let e of Le)if(e>=n)return e*t;return Le[0]*t*10}function Qe(e,t,n){let r=t-e;if(r<=0)return[{position:e,label:$e(e,1)}];let i=Ze(r/Re);Math.floor(r/i)<ze&&(i=Ze(r/ze));let a=Math.max(0,-Math.floor(Math.log10(i))+1),o=[],s=Math.ceil(e/i)*i;for(let n=s;n<=t+i*.01;n+=i)n>=e&&n<=t&&o.push({position:n,label:$e(n,a)});return We(o,e,t,n,Ve)}function $e(e,t){return e.toFixed(t)}var et=50,tt=class{cache;constructor(e=et){this.cache=new m({max:e})}getXTicks(e,t,n,r){let i=`x:${e}:${t}:${n}:${Math.round(r)}`,a=this.cache.get(i);if(a!==void 0)return a;let o=Ge(e,t,n,r);return this.cache.set(i,o),o}getYTicks(e,t,n){let r=`y:${e}:${t}:${Math.round(n)}`,i=this.cache.get(r);if(i!==void 0)return i;let a=Qe(e,t,n);return this.cache.set(r,a),a}},nt=[L.Hour1,L.Hour12,L.Day1,L.Day4,L.Day16,L.Day64,L.Day256];function rt(e,t){let n=t-e;for(let e of nt)if(n<=e)return e;return L.Day256}function it(e,t,n,r){let i=t-e;return i>=r-n?[n,r]:e<n?[n,n+i]:t>r?[r-i,r]:[e,t]}function at(e,t){let n=t-e,r=(n>0?n:Math.abs(e))*.1||1;return[e-r,t+r]}function ot(e,t,n,r){let i=e.length;if(i===0)return;let a=0,o=i;for(;a<o;){let t=a+o>>1;e[t]<n?a=t+1:o=t}let s=a;for(a=s,o=i;a<o;){let t=a+o>>1;e[t]<=r?a=t+1:o=t}let c=a;if(s>=c)return;let l=1/0,u=-1/0;for(let e=s;e<c;e++){let n=t[e];n<l&&(l=n),n>u&&(u=n)}return[l,u]}function st(e,t,n){let r=1/0,i=-1/0;for(let a of e)for(let e of a){let a=ot(e.pointTimes,e.pointValues,t,n);a!==void 0&&(r=Math.min(r,a[0]),i=Math.max(i,a[1]))}return r<i?[r,i]:void 0}function ct(e,t,n,r){let i=n*((t-e)/r);return[e-i,t-i]}function lt(e,t,n,r){let i=t-e,a=e+i*r,o=Math.max(i*n,60);return[a-o*r,a+o*(1-r)]}var ut=class{tickCache=new tt;layout;getLayout(e,t,n,r){let{viewTimeStart:i,viewTimeEnd:a,viewValueMin:o,viewValueMax:s}=e,c=this.layout;if(c!==void 0&&c.timeStart===i&&c.timeEnd===a&&c.valueMin===o&&c.valueMax===s&&c.canvasWidth===t&&c.canvasHeight===n)return c;let{left:l,top:u,width:d,height:f}=K(t,n,r);if(d<=0||f<=0){this.layout=void 0;return}let p=rt(i,a),m=d/r,h=f/r;return this.layout={timeStart:i,timeEnd:a,valueMin:o,valueMax:s,canvasWidth:t,canvasHeight:n,dpr:r,plotLeft:l,plotTop:u,plotWidth:d,plotHeight:f,plotRight:l+d,plotBottom:u+f,xTicks:this.tickCache.getXTicks(i,a,p,m),yTicks:this.tickCache.getYTicks(o,s,h)},this.layout}},dt=class{canvas;onWidthChange;canvasWidth=0;canvasHeight=0;constructor(e,t){this.canvas=e,this.onWidthChange=t,this.measure()}get width(){return this.canvasWidth}get height(){return this.canvasHeight}get devicePixelRatio(){return Math.max(1,window.devicePixelRatio)}measure(){let e=this.devicePixelRatio,t=Math.floor(this.canvas.clientWidth*e),n=this.canvasWidth;this.canvasWidth=t,this.canvasHeight=Math.floor(this.canvas.clientHeight*e),n>0&&t!==n&&this.onWidthChange(t,n)}syncBackingStore(){return this.canvas.width!==this.canvasWidth||this.canvas.height!==this.canvasHeight?(this.canvas.width=this.canvasWidth,this.canvas.height=this.canvasHeight,!0):!1}},ft=2,pt=class{viewport;canvas;dataMinTime;dataMaxTime;fpsController;activePointers=new Map;velocitySamples=[];lastPinchDistance=0;inertiaVelocity=0;lastInertiaTimestamp=0;constructor(e,t,n,r,i){this.viewport=e,this.canvas=t,this.dataMinTime=n,this.dataMaxTime=r,this.fpsController=i}get isInteracting(){return this.activePointers.size>0}applyInertia(){if(Math.abs(this.inertiaVelocity)<.01)return this.inertiaVelocity=0,!1;let e=performance.now(),t=this.inertiaVelocity*(e-this.lastInertiaTimestamp);this.lastInertiaTimestamp=e;let{viewTimeStart:n,viewTimeEnd:r,targetTimeStart:i,targetTimeEnd:a}=this.viewport.current,[o,s]=this.clampedPan(t);return o===n&&s===r?(this.inertiaVelocity=0,!1):(this.viewport.update({viewTimeStart:o,viewTimeEnd:s,targetTimeStart:i+(o-n),targetTimeEnd:a+(s-r)}),this.inertiaVelocity*=se,!0)}attach(){this.canvas.addEventListener(`pointerdown`,this.handlePointerDown),this.canvas.addEventListener(`pointermove`,this.handlePointerMove),this.canvas.addEventListener(`pointerup`,this.handlePointerUp),this.canvas.addEventListener(`pointercancel`,this.handlePointerCancel),this.canvas.addEventListener(`wheel`,this.handleWheel,{passive:!1}),this.canvas.style.cursor=`grab`}detach(){this.canvas.removeEventListener(`pointerdown`,this.handlePointerDown),this.canvas.removeEventListener(`pointermove`,this.handlePointerMove),this.canvas.removeEventListener(`pointerup`,this.handlePointerUp),this.canvas.removeEventListener(`pointercancel`,this.handlePointerCancel),this.canvas.removeEventListener(`wheel`,this.handleWheel)}handlePointerDown=e=>{this.canvas.setPointerCapture(e.pointerId),this.activePointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),this.fpsController.raise(60),this.inertiaVelocity=0,this.velocitySamples.length=0,this.activePointers.size===1?this.canvas.style.cursor=`grabbing`:this.activePointers.size===2&&(this.lastPinchDistance=this.getPointerDistance())};handlePointerMove=e=>{let t=this.activePointers.get(e.pointerId);if(a(t))return;if(this.activePointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),this.fpsController.raise(60),this.activePointers.size===2){this.pinch();return}if(this.activePointers.size!==1)return;let n=e.clientX-t.clientX;this.recordVelocitySample(n,e.timeStamp);let[r,i]=this.clampedPan(n);this.viewport.update({viewTimeStart:r,viewTimeEnd:i,targetTimeStart:r,targetTimeEnd:i})};handlePointerUp=e=>{this.canvas.hasPointerCapture(e.pointerId)&&this.canvas.releasePointerCapture(e.pointerId),this.activePointers.delete(e.pointerId),this.activePointers.size===0&&(this.canvas.style.cursor=`grab`,this.startInertia())};handlePointerCancel=e=>{this.activePointers.delete(e.pointerId),this.activePointers.size===0&&(this.canvas.style.cursor=`grab`)};handleWheel=e=>{e.preventDefault();let t=this.canvas.getBoundingClientRect(),n=(e.clientX-t.left)/t.width;this.zoomTarget(e.deltaY>0?oe:ae,n),this.fpsController.raise(60)};pinch(){let e=this.getPointerDistance(),t=T(this.lastPinchDistance,e);a(t)||(this.zoomTarget(t,this.getPointerCenterNormalized()),this.lastPinchDistance=e)}zoomTarget(e,t){let{targetTimeStart:n,targetTimeEnd:r}=this.viewport.current,[i,a]=it(...lt(n,r,e,t),this.dataMinTime,this.dataMaxTime);this.viewport.update({targetTimeStart:i,targetTimeEnd:a})}clampedPan(e){let{viewTimeStart:t,viewTimeEnd:n}=this.viewport.current;return it(...ct(t,n,e,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime)}recordVelocitySample(e,t){this.velocitySamples.push({deltaX:e,timestamp:t}),this.velocitySamples.length>5&&this.velocitySamples.shift()}startInertia(){let e=this.velocitySamples[0],t=this.velocitySamples[this.velocitySamples.length-1],n=this.velocitySamples.splice(0);if(n.length<ft||a(e)||a(t))return;let r=t.timestamp-e.timestamp;if(r<=0)return;let i=n.reduce((e,t)=>e+t.deltaX,0);this.inertiaVelocity=i/r,this.lastInertiaTimestamp=performance.now()}getTwoPointers(){let[e,t]=this.activePointers.values();return i(!a(e)&&!a(t),`pinch needs two active pointers`),[e,t]}getPointerDistance(){let[e,t]=this.getTwoPointers();return w(e.clientX,e.clientY,t.clientX,t.clientY)}getPointerCenterNormalized(){let[e,t]=this.getTwoPointers(),n=this.canvas.getBoundingClientRect();return((e.clientX+t.clientX)/2-n.left)/n.width}},mt=`rgba32float`,ht=class{device;textureWidth;textureUsage;onEvict;pool;texture;constructor(e,t={}){let{initialRows:n=4,maxRows:r=512,textureWidth:i=M,onEvict:a}=t;this.device=e,this.textureWidth=i,this.onEvict=a,this.textureUsage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC,this.texture=e.createTexture({size:[i,n],format:mt,usage:this.textureUsage}),this.pool=new h({initialCapacity:n*8,maxCapacity:r*8,growCapacity:g,onGrow:this.handleGrow,onEvict:this.handleEvict})}allocateSlot(){let e=this.pool.acquire();return e===void 0?void 0:this.unflattenSlot(e)}writeSlotData(e,t,n){let r=e.row*this.textureWidth+e.slotIndex*256,i=r%this.textureWidth,a=Math.floor(r/this.textureWidth),o=this.textureWidth*4*Float32Array.BYTES_PER_ELEMENT,s=t.subarray(0,n*4);this.device.queue.writeTexture({texture:this.texture,origin:[i,a,0]},s,{bytesPerRow:o,rowsPerImage:1},[n,1,1])}touch(e){this.pool.touch(this.flattenSlot(e))}releaseSlot(e){this.pool.release(this.flattenSlot(e))}getTextureOffset(e){return e.row*this.textureWidth+e.slotIndex*256}createView(){return this.texture.createView()}getCapacity(){return this.pool.capacity/8}getAllocatedSlotCount(){return this.pool.allocatedCount}getHighWaterMark(){return this.pool.highWaterMark}dispose(){this.texture.destroy(),this.pool.clear()}handleEvict=e=>{this.onEvict?.(this.unflattenSlot(e))};handleGrow=({newCapacity:e,usedSlots:t})=>{let n=e/8,r=this.device.createTexture({size:[this.textureWidth,n],format:mt,usage:this.textureUsage});if(t>0){let e=Math.ceil(t/8),n=this.device.createCommandEncoder();n.copyTextureToTexture({texture:this.texture,origin:[0,0,0]},{texture:r,origin:[0,0,0]},[this.textureWidth,e,1]),this.device.queue.submit([n.finish()])}this.texture.destroy(),this.texture=r};flattenSlot(e){return e.row*8+e.slotIndex}unflattenSlot(e){return{row:Math.floor(e/8),slotIndex:e%8}}},gt=500,_t=class{context;widthCache;currentFont=``;glyphMetrics;constructor(e=gt){let t=document.createElement(`canvas`).getContext(`2d`);i(!a(t),`2D canvas context unavailable for text measuring`),this.context=t,this.widthCache=new m({max:e})}measureWidth(e,t){this.ensureFont(t);let n=this.widthCache.get(e);if(!a(n))return n;let r=this.context.measureText(e).width;return this.widthCache.set(e,r),r}getGlyphMetrics(e){if(this.ensureFont(e),!a(this.glyphMetrics))return this.glyphMetrics;let t=this.context.measureText(`0`),n=t.actualBoundingBoxAscent,r=t.actualBoundingBoxDescent;return this.glyphMetrics={ascent:n,descent:r,centerOffset:(n-r)/2},this.glyphMetrics}ensureFont(e){e!==this.currentFont&&(this.currentFont=e,this.context.font=e,this.widthCache.clear(),this.glyphMetrics=void 0)}};function vt(e,t){let n=(t-e.timeStart)/(e.timeEnd-e.timeStart);return e.plotLeft+n*e.plotWidth}function yt(e,t){let n=(t-e.valueMin)/(e.valueMax-e.valueMin);return e.plotBottom-n*e.plotHeight}var bt=2,xt=3,St=4;function Ct(e,t){let{plotLeft:n,plotRight:r,plotBottom:i}=e,a=18*e.dpr,o=xt*e.dpr;return{ticks:e.xTicks,toPixel:t=>vt(e,t),isVisible:e=>e>=n&&e<=r,strokeTickMark:(e,n)=>{e.moveTo(n,i),e.lineTo(n,i-t.tickLength)},placeLabel:(e,r)=>{let s=e-r/2-t.bgPaddingX;if(!(s<n+a))return{boxLeft:s,centerY:i-t.tickLength-o-t.fontSize/2,textX:e,textAlign:`center`}}}}function wt(e,t){let{plotLeft:n,plotTop:r,plotBottom:i}=e,a=18*e.dpr,o=n+t.tickLength+St*e.dpr;return{ticks:e.yTicks,toPixel:t=>yt(e,t),isVisible:e=>e>=r&&e<=i,strokeTickMark:(e,r)=>{e.moveTo(n,r),e.lineTo(n+t.tickLength,r)},placeLabel:e=>{if(!(e+t.boxHeight/2>i-a))return{boxLeft:o-t.bgPaddingX,centerY:e,textX:o,textAlign:`start`}}}}function Tt(e,t,n,r,i){for(let o of t.ticks){let s=t.toPixel(o.position);if(!t.isVisible(s))continue;e.strokeStyle=I,e.lineWidth=n.lineWidth,e.beginPath(),t.strokeTickMark(e,s),e.stroke();let c=r.measureWidth(o.label,i),l=t.placeLabel(s,c);a(l)||(e.fillStyle=ue,e.beginPath(),e.roundRect(l.boxLeft,l.centerY-n.boxHeight/2,c+n.bgPaddingX*2,n.boxHeight,n.bgRadius),e.fill(),e.fillStyle=le,e.textAlign=l.textAlign,e.fillText(o.label,l.textX,l.centerY+n.glyphCenterOffset))}}function Et(e,t,n){let{dpr:r,plotLeft:i,plotTop:a,plotRight:o,plotBottom:s}=t,c=11*r,l=2*r;e.strokeStyle=I,e.lineWidth=r,e.beginPath(),e.moveTo(i,a),e.lineTo(i,s),e.lineTo(o,s),e.stroke();let u=`${c}px ${fe}`;e.font=u,e.textBaseline=`alphabetic`;let{centerOffset:d}=n.getGlyphMetrics(u),f={fontSize:c,tickLength:5*r,lineWidth:r,bgPaddingX:3*r,bgRadius:bt*r,boxHeight:c+l*2,glyphCenterOffset:d};Tt(e,Ct(t,f),f,n,u),Tt(e,wt(t,f),f,n,u)}var Dt=.5,Ot=10;function kt(e,t){let{dpr:n,plotLeft:r,plotTop:i,plotRight:a,plotBottom:o,xTicks:s,yTicks:c}=t;e.fillStyle=f,e.fillRect(0,0,t.canvasWidth,t.canvasHeight),e.strokeStyle=de,e.lineWidth=n*Dt,e.setLineDash([Ot*n,Ot*n]),e.beginPath();for(let n of s){let s=vt(t,n.position);s<r||s>a||(e.moveTo(s,i),e.lineTo(s,o))}for(let n of c){let s=yt(t,n.position);s<i||s>o||(e.moveTo(r,s),e.lineTo(a,s))}e.stroke(),e.setLineDash([])}var At=5,jt=`rgba(100, 160, 255, 0.6)`,Mt=`rgba(30, 80, 180, 0.8)`,Nt=1200,Pt=2,Ft=.5;function It(e){let{ctx:t,regions:n,timeStart:r,timeEnd:i,canvasWidth:a,canvasHeight:o,devicePixelRatio:s,nowMs:c}=e,l=i-r;if(n.length===0||l<=0)return;let u=At*Math.max(1,s),d=o-u,f=c%Nt/Nt,p=u*Pt,m=d-p+f*p;for(let e of n){let n=Math.max(0,Math.floor((e.timeStart-r)/l*a)),i=Math.min(a,Math.ceil((e.timeEnd-r)/l*a));if(i<=n)continue;let o=t.createLinearGradient(0,m,0,m+p);o.addColorStop(0,jt),o.addColorStop(Ft,Mt),o.addColorStop(1,jt),t.save(),t.beginPath(),t.rect(n,d,i-n,u),t.clip(),t.fillStyle=o,t.fillRect(n,m,i-n,p),t.restore()}}var Lt=2,Rt=class{deps;lastTextureCapacity;constructor(e){this.deps=e,this.lastTextureCapacity=e.allocator.getCapacity()}get width(){return this.deps.canvasSize.width}get height(){return this.deps.canvasSize.height}get frameIntervalMs(){return this.deps.fpsController.getFrameIntervalMs()}tickFps(){this.deps.fpsController.tick()}update(){let{canvasSize:e,inputController:t,fpsController:n,viewport:r}=this.deps;e.measure(),t.applyInertia()&&n.raise(60);let{viewTimeStart:i,viewTimeEnd:a,targetTimeStart:o,targetTimeEnd:s}=r.current,c=o-i,l=s-a,u=(a-i)*ce;Math.abs(c)>u||Math.abs(l)>u?(r.update({viewTimeStart:i+c*P,viewTimeEnd:a+l*P}),n.raise(60)):r.update({viewTimeStart:o,viewTimeEnd:s})}prepareFrame(){let{viewport:e,dataPipelines:t,fpsController:n,allocator:r,seriesManager:i,canvasSize:o}=this.deps,{viewTimeStart:s,viewTimeEnd:c}=e.current,l=rt(s,c),u=t.map(e=>e.ensureBlocksForViewport(s,c,l)),d=this.getLoadingRegions().length>0;if(d&&n.raise(60),!u.some(e=>e.reduce((e,t)=>e+t.pointCount,0)>=Lt)&&!d)return;for(let e of u.flat())r.touch(e.slot);let f=st(u,s,c);if(!a(f)){let[t,n]=at(f[0],f[1]);e.update({viewValueMin:t,viewValueMax:n})}let p=r.getCapacity();p!==this.lastTextureCapacity&&(this.lastTextureCapacity=p,i.updateBindGroups(r.createView()));let{viewValueMin:m,viewValueMax:h}=e.current;i.writeAllUniforms(u,{canvasWidth:o.width,canvasHeight:o.height,viewTimeStart:s,viewTimeEnd:c,viewValueMin:m,viewValueMax:h});let g=K(o.width,o.height,o.devicePixelRatio);return{x:Math.floor(g.left),y:Math.floor(g.top),width:Math.max(0,Math.floor(g.width)),height:Math.max(0,Math.floor(g.height))}}recordDrawCalls(e,t,n){this.deps.seriesManager.renderAll(e,t),a(n)||this.deps.seriesManager.renderDebug(e,n,t)}presentFrame(e){let{canvasSize:t,target2dContext:n,textMeasurer:r,viewport:i}=this.deps;t.syncBackingStore();let o=this.getFrameLayout();a(o)||kt(n,o),n.drawImage(e,0,0),a(o)||Et(n,o,r),It({ctx:n,regions:this.getLoadingRegions(),timeStart:i.current.viewTimeStart,timeEnd:i.current.viewTimeEnd,canvasWidth:t.width,canvasHeight:t.height,devicePixelRatio:t.devicePixelRatio,nowMs:performance.now()})}dispose(){this.deps.dispose(),this.deps.inputController.detach(),this.deps.seriesManager.dispose(),this.deps.allocator.dispose(),this.deps.fpsController.dispose()}springTimeAxis(e,t){let{viewTimeStart:n,viewTimeEnd:r}=this.deps.viewport.current,i=(r-n)*(e/t),a=(n+r)/2;this.deps.viewport.update({viewTimeStart:a-i/2,viewTimeEnd:a+i/2}),this.deps.fpsController.raise(60)}getLoadingRegions(){return this.deps.dataPipelines.flatMap(e=>e.getLoadingRegions())}getFrameLayout(){let{layoutCache:e,viewport:t,canvasSize:n}=this.deps;return e.getLayout(t.current,n.width,n.height,n.devicePixelRatio)}},zt=e(t(((e,t)=>{(function(n,r){typeof e==`object`?t.exports=r():typeof define==`function`&&define.amd?define(r):n.Alea=r()})(e,function(){return e.importState=function(t){var n=new e;return n.importState(t),n},e;function e(){return function(e){var n=0,r=0,i=0,a=1;e.length==0&&(e=[+new Date]);var o=t();n=o(` `),r=o(` `),i=o(` `);for(var s=0;s<e.length;s++)n-=o(e[s]),n<0&&(n+=1),r-=o(e[s]),r<0&&(r+=1),i-=o(e[s]),i<0&&(i+=1);o=null;var c=function(){var e=2091639*n+a*23283064365386963e-26;return n=r,r=i,i=e-(a=e|0)};return c.next=c,c.uint32=function(){return c()*4294967296},c.fract53=function(){return c()+(c()*2097152|0)*11102230246251565e-32},c.version=`Alea 0.9`,c.args=e,c.exportState=function(){return[n,r,i,a]},c.importState=function(e){n=+e[0]||0,r=+e[1]||0,i=+e[2]||0,a=+e[3]||0},c}(Array.prototype.slice.call(arguments))}function t(){var e=4022871197,t=function(t){t=t.toString();for(var n=0;n<t.length;n++){e+=t.charCodeAt(n);var r=.02519603282416938*e;e=r>>>0,r-=e,r*=e,e=r>>>0,r-=e,e+=r*4294967296}return(e>>>0)*23283064365386963e-26};return t.version=`Mash 0.9`,t}})}))(),1),Bt=Math.sqrt(3),Vt=Math.sqrt(5),Ht=.5*(Bt-1),Q=(3-Bt)/6;(Vt-1)/4,(5-Vt)/20;var Ut=e=>Math.floor(e)|0,Wt=new Float64Array([1,1,-1,1,1,-1,-1,-1,1,0,-1,0,1,0,-1,0,0,1,0,-1,0,1,0,-1]);function Gt(e=Math.random){let t=Kt(e),n=new Float64Array(t).map(e=>Wt[e%12*2]),r=new Float64Array(t).map(e=>Wt[e%12*2+1]);return function(e,i){let a=0,o=0,s=0,c=(e+i)*Ht,l=Ut(e+c),u=Ut(i+c),d=(l+u)*Q,f=l-d,p=u-d,m=e-f,h=i-p,g,_;m>h?(g=1,_=0):(g=0,_=1);let v=m-g+Q,y=h-_+Q,b=m-1+2*Q,x=h-1+2*Q,S=l&255,C=u&255,w=.5-m*m-h*h;if(w>=0){let e=S+t[C],i=n[e],o=r[e];w*=w,a=w*w*(i*m+o*h)}let T=.5-v*v-y*y;if(T>=0){let e=S+g+t[C+_],i=n[e],a=r[e];T*=T,o=T*T*(i*v+a*y)}let E=.5-b*b-x*x;if(E>=0){let e=S+1+t[C+1],i=n[e],a=r[e];E*=E,s=E*E*(i*b+a*x)}return 70*(a+o+s)}}function Kt(e){let t=new Uint8Array(512);for(let e=0;e<256;e++)t[e]=e;for(let n=0;n<255;n++){let r=n+~~(e()*(256-n)),i=t[n];t[n]=t[r],t[r]=i}for(let e=256;e<512;e++)t[e]=t[e-256];return t}var qt=180,Jt=1,Yt=9,Xt=7,Zt=.5;function Qt(e){return(e-N)/F}function $t(e){let t=Gt((0,zt.default)(e));return e=>{let n=Qt(e),r=0,i=15,a=4;for(let e=0;e<6;e++)r+=i*t(n*a,e*ie),i*=re,a*=2;return 100+r}}var en=A(.2,.8,.3,1),tn=A(.9,.2,.2,1);function nn(e,t){let n=e(Qt(t)*4,Xt*ie);return Jt+Math.max(0,Math.min(1,(n+1)*Zt))*Yt}function rn(e,t,n){let r=qt,i=(t-e)/179,a=$t(n),o=Gt((0,zt.default)(`${n}-size`)),s=Array(r),c=Array(r);for(let t=0;t<r;t++)s[t]=e+t*i,c[t]=a(s[t]);let l=Array(r);for(let e=0;e<r;e++){let t=c[Math.min(e+1,179)]>=c[e];l[e]={time:s[e],value:c[e],size:nn(o,s[e]),color:t?en:tn}}return l}var an=3;function on(e,t,n){let r=new ArrayBuffer(e.length*4*Float32Array.BYTES_PER_ELEMENT),i=new Float32Array(r),a=new Uint32Array(r);for(let r=0;r<e.length;r++){let o=r*4,s=e[r];i[o]=s.time-t,i[o+1]=s.value-n,i[o+2]=s.size,a[o+an]=un(s.color)}return i}var sn=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),cn=new Float32Array(sn),ln=new Uint32Array(sn);function un(e){return cn[0]=e,ln[0]}var dn=1;function fn(e,t,n,r=dn){let i=n,a=Math.floor(e/i)*i-r*i,o=Math.ceil(t/i)*i+r*i,s=Math.round((o-a)/i),c=Array(s);for(let e=0;e<s;e++){let t=a+e*i;c[e]={start:t,end:t+i}}return c}var $=1e3,pn=class{allocator;registry;seed;chartType;colorFn;sizeFn;isInstantLoad;pendingBlocks=new Map;constructor(e,t,n,r,i,a,o){this.allocator=e,this.registry=t,this.seed=n,this.chartType=r,this.colorFn=i,this.sizeFn=a,this.isInstantLoad=o}ensureBlocksForViewport(e,t,n){let r=fn(e,t,n),i=[],a=performance.now(),o=new Set;for(let e of r){let t=`${n}:${e.start}:${e.end}`;o.add(t);let r=this.registry.findCovering(n,e.start,e.end,this.chartType);if(r!==void 0){this.allocator.touch(r.slot),i.push(r),this.pendingBlocks.delete(t);continue}let s=this.pendingBlocks.get(t);if(s===void 0){this.pendingBlocks.set(t,{periodStart:e.start,periodEnd:e.end,scale:n,requestTime:a});continue}if(this.isInstantLoad?.()===!0||a-s.requestTime>=$){this.pendingBlocks.delete(t);let r=this.generateBlocksForPeriod(e.start,e.end,n);i.push(...r)}}for(let e of this.pendingBlocks.keys())o.has(e)||this.pendingBlocks.delete(e);return i.sort((e,t)=>e.timeStart-t.timeStart)}getLoadingRegions(){let e=performance.now(),t=[];for(let n of this.pendingBlocks.values()){let r=e-n.requestTime,i=Math.min(1,r/$);t.push({timeStart:n.periodStart,timeEnd:n.periodEnd,progress:i})}return t}generateBlocksForPeriod(e,t,n){let r=rn(e,t,this.seed);if(r.length===0)return[];if(this.colorFn!==void 0||this.sizeFn!==void 0)for(let e=0;e<r.length;e++){let t=r[e];r[e]={...t,color:this.colorFn===void 0?t.color:this.colorFn(t.value,e,r),size:this.sizeFn===void 0?t.size:this.sizeFn(t.value,e,r)}}let i=[];if(r.length<=256){let o=this.createBlock(r,e,t,n);a(o)||i.push(o)}else{let e=Math.ceil(r.length/256);for(let t=0;t<e;t++){let e=t*256,o=Math.min(e+256,r.length),s=r.slice(e,o),c=s[0].time,l=s[s.length-1].time,u=this.createBlock(s,c,l,n);a(u)||i.push(u)}}return i}createBlock(e,t,n,r){let i=this.allocator.allocateSlot();if(a(i))return;let o=e[0].time,s=e[0].value,c=on(e,o,s);this.allocator.writeSlotData(i,c,e.length);let l=new Float64Array(e.length),u=new Float64Array(e.length);for(let t=0;t<e.length;t++)l[t]=e[t].time,u[t]=e[t].value;let d={timeStart:t,timeEnd:n,scale:r,chartType:this.chartType,slot:i,pointCount:e.length,baseTime:o,baseValue:s,pointTimes:l,pointValues:u};return this.registry.insert(d),d}},mn=4,hn=mn*Float32Array.BYTES_PER_ELEMENT,gn=64,_n=class{device;buffer;cpuBuffer;f32View;u32View;allocator;maxBlocks;constructor(e,t,n=gn){this.device=e,this.allocator=t,this.maxBlocks=n;let r=n*hn;this.buffer=e.createBuffer({size:r,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.cpuBuffer=new ArrayBuffer(r),this.f32View=new Float32Array(this.cpuBuffer),this.u32View=new Uint32Array(this.cpuBuffer)}writeDescriptors(e,t){let n=Math.min(e.length,this.maxBlocks);if(n===0)return{totalInstances:0,globalBaseTime:0,globalBaseValue:0};let r=e[0].baseTime,i=e[0].baseValue,a=0;for(let t=0;t<n;t++){let n=e[t],o=t*mn,s=this.allocator.getTextureOffset(n.slot);this.u32View[o]=s,this.u32View[o+1]=n.pointCount,this.f32View[o+2]=n.baseTime-r,this.f32View[o+3]=n.baseValue-i,a+=n.pointCount}let o=n*hn;return this.device.queue.writeBuffer(this.buffer,0,this.cpuBuffer,0,o),{totalInstances:t?Math.max(0,a-1):a,globalBaseTime:r,globalBaseValue:i}}getBuffer(){return this.buffer}getTextureWidth(){return M}dispose(){this.buffer.destroy()}},vn=6,yn=class{verticesPerInstance;needsStitching;device;bindGroupLayout;uniformBuffer;uniformView;descriptorBuffer;currentBindGroup;currentInstanceCount=0;currentBlockCount=0;constructor(e,t,n,r,i){this.verticesPerInstance=r,this.needsStitching=i,this.device=e,this.bindGroupLayout=t;let a=S(we);this.uniformView=b(a.uniforms.U),this.uniformBuffer=e.createBuffer({size:this.uniformView.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.descriptorBuffer=new _n(e,n)}updateBindGroup(e){this.currentBindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:e},{binding:2,resource:{buffer:this.descriptorBuffer.getBuffer()}}]})}writeUniforms(e,t){if(e.length===0){this.currentInstanceCount=0,this.currentBlockCount=0;return}this.currentBlockCount=e.length;let{totalInstances:n,globalBaseTime:r,globalBaseValue:i}=this.descriptorBuffer.writeDescriptors(e,this.needsStitching);this.currentInstanceCount=n,this.uniformView.set({viewport:[t.canvasWidth,t.canvasHeight],timeRangeMin:t.viewTimeStart-r,timeRangeMax:t.viewTimeEnd-r,valueRangeMin:t.viewValueMin-i,valueRangeMax:t.viewValueMax-i,textureWidth:M,lineWidth:Math.max(1,window.devicePixelRatio),blockCount:e.length}),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformView.arrayBuffer)}render(e,t,n){a(this.currentBindGroup)||this.currentInstanceCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(this.verticesPerInstance,this.currentInstanceCount,0,0))}renderDebug(e,t,n){a(this.currentBindGroup)||this.currentBlockCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(vn,this.currentBlockCount,0,0))}get instanceCount(){return this.currentInstanceCount}dispose(){this.uniformBuffer.destroy(),this.descriptorBuffer.dispose(),this.currentBindGroup=void 0}},bn=class{entries=[];addSeries(e,t){this.entries.push({layer:e,pipeline:t})}updateBindGroups(e){for(let t of this.entries)t.layer.updateBindGroup(e)}writeAllUniforms(e,t){this.entries.forEach((n,r)=>{n.layer.writeUniforms(e[r]??[],t)})}renderAll(e,t){for(let n of this.entries)n.layer.render(e,n.pipeline,t)}renderDebug(e,t,n){for(let r of this.entries)r.layer.renderDebug(e,t,n)}dispose(){for(let e of this.entries)e.layer.dispose()}};function xn(e){switch(e){case R.Line:return 18;case R.Candlestick:return 6;case R.Rhombus:return 6}}function Sn(e){switch(e){case R.Line:case R.Candlestick:return!0;case R.Rhombus:return!1}}function Cn(e,t){switch(e){case R.Line:return t.linePipeline;case R.Candlestick:return t.candlestickPipeline;case R.Rhombus:return t.rhombusPipeline}}function wn({renderer:e,seriesConfigs:t,allocator:n,registry:r,seed:i}){let a=[],o=new bn;for(let s of t){a.push(new pn(n,r,`${i}${s.seedSuffix}`,s.chartType,s.colorFn,s.sizeFn,()=>e.instantLoad));let t=new yn(e.device,e.resources.bindGroupLayout,n,xn(s.chartType),Sn(s.chartType));o.addSeries(t,Cn(s.chartType,e.resources))}return o.updateBindGroups(n.createView()),{dataPipelines:a,seriesManager:o}}var Tn=class{viewport;constructor(e){this.viewport=e}get current(){return this.viewport}update(e){this.viewport={...this.viewport,...e}}},En=0,Dn=200;function On(e){let{renderer:t,seriesConfigs:n,targetCanvas:r,initialTimeStart:o,initialTimeEnd:s,seed:c}=e,l=r.getContext(`2d`);i(!a(l),`Failed to get 2D canvas context`);let u=new Tn({viewTimeStart:o,viewTimeEnd:s,targetTimeStart:o,targetTimeEnd:s,viewValueMin:En,viewValueMax:Dn}),d=new Fe,f=new ht(t.device,{onEvict:e=>d.removeBySlot(e)}),{dataPipelines:p,seriesManager:m}=wn({renderer:t,seriesConfigs:n,allocator:f,registry:d,seed:c}),h=new y(10),g=new pt(u,r,N,N+F,h);g.attach();let _,v=new dt(r,(e,t)=>{_?.springTimeAxis(e,t)}),b=new ResizeObserver(()=>{v.measure(),h.raise(60)});return b.observe(r),_=new Rt({target2dContext:l,viewport:u,canvasSize:v,inputController:g,fpsController:h,allocator:f,dataPipelines:p,seriesManager:m,textMeasurer:new _t,layoutCache:new ut,dispose:()=>b.disconnect()}),_}var kn=(0,j.memo)(({initialTimeStart:e,initialTimeEnd:t,chartSeed:n,seriesConfigs:r})=>{let i=(0,j.useRef)(null),o=W(),s=o.status===`ready`?o.renderer:void 0;return(0,j.useEffect)(()=>{let o=i.current;if(a(s)||a(o))return;let c=On({renderer:s,seriesConfigs:r,targetCanvas:o,initialTimeStart:e,initialTimeEnd:t,seed:n});return s.registerChart(c)},[s,e,t,n,r]),(0,z.jsx)(`div`,{className:`relative h-full w-full`,children:(0,z.jsx)(`canvas`,{ref:i,className:`absolute inset-0 h-full w-full [touch-action:none]`})})}),An=110,jn=105,Mn=100,Nn=95,Pn=A(.9,.2,.2,1),Fn=A(1,.6,.1,1),In=A(.2,.8,.3,1),Ln=A(.2,.5,.9,1),Rn=A(.7,.7,.7,1),zn=A(0,.5,1,1),Bn=10,Vn=.6,Hn=A(1,.6,.1,1),Un=2,Wn=4,Gn=6,Kn=8,qn=10;function Jn(e){return e>An?qn:e>jn?Kn:e>Mn?Gn:e>Nn?Wn:Un}function Yn(e){return e>An?Pn:e>jn?Fn:e>Mn?Rn:e>Nn?In:Ln}var Xn=[[{chartType:R.Line,seedSuffix:``,colorFn:()=>zn,sizeFn:()=>Bn},{chartType:R.Candlestick,seedSuffix:`-series-2`,colorFn:(e,t,n)=>{let r=ne(n[t].color);return A(r.r,r.g,r.b,Vn)}}],[{chartType:R.Candlestick,seedSuffix:``}],[{chartType:R.Line,seedSuffix:``,colorFn:()=>Hn,sizeFn:e=>Jn(e)}],[{chartType:R.Rhombus,seedSuffix:``,colorFn:e=>Yn(e)}]],Zn=(0,j.memo)(()=>{let e=W();return e.status===`unsupported`?(0,z.jsxs)(`div`,{className:`flex h-full w-full flex-col items-center justify-center gap-4`,children:[(0,z.jsx)(u,{}),(0,z.jsx)(C,{fail:e.fail})]}):(0,z.jsxs)(`div`,{className:`h-full w-full relative grid grid-cols-2 grid-rows-2`,children:[(0,z.jsx)(be,{renderer:e.status===`ready`?e.renderer:void 0}),me.map((e,t)=>(0,z.jsx)(kn,{initialTimeStart:N+e[0],initialTimeEnd:N+e[1],chartSeed:`chart-${t}`,seriesConfigs:Xn[t]},`${e[0]}-${e[1]}`))]})}),Qn=(0,j.memo)(()=>(0,z.jsx)(d,{className:`h-full w-full`,children:(0,z.jsx)(Ne,{children:(0,z.jsx)(Zn,{})})}));export{Qn as Timeseries};