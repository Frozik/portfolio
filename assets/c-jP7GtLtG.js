import{D as e,M as t,N as n,P as r,Y as i,at as a,j as o,st as s}from"./c-Cy9pq3c4.js";import{d as c}from"./c-C1I1Uh3g.js";import{i as l,n as u,r as d,t as f}from"./c-BhCelCM8.js";import{t as p}from"./e-BQuVzXFB.js";import{t as m}from"./c-wJEgkeeX.js";var h=s(n(),1),g=255,_=255,v=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),y=new Float32Array(v),b=new Uint32Array(v);function x(e,t,n,r){let i=Math.round(r*_)&g,a=Math.round(e*_)&g,o=Math.round(t*_)&g,s=Math.min(Math.round(n*_)&g,126);return b[0]=i|a<<8|o<<16|s<<24,y[0]}function S(e){y[0]=e;let t=b[0];return{a:(t&g)/_,r:(t>>8&g)/_,g:(t>>16&g)/_,b:(t>>24&g)/_}}var C=2048,w=1767225600,T=.5,E=1e3,ee=1e3,te=.7,ne=1.3,re=.18,ie=.005,D=365*24*3600,O=`#ccc`,ae=`rgba(50, 50, 50, 0.75)`,k=`#aaa`,oe=`#444`,se=`monospace`,ce=1024,le=2160*3600,ue=720*3600,de=168*3600,fe=[[0,D],[D/2-le/2,D/2+le/2],[D/2-ue/2,D/2+ue/2],[D/2-de/2,D/2+de/2]],A=function(e){return e[e.Hour1=3600]=`Hour1`,e[e.Hour12=43200]=`Hour12`,e[e.Day1=86400]=`Day1`,e[e.Day4=345600]=`Day4`,e[e.Day16=1382400]=`Day16`,e[e.Day64=5529600]=`Day64`,e[e.Day256=22118400]=`Day256`,e}({}),j=function(e){return e[e.Line=0]=`Line`,e[e.Candlestick=1]=`Candlestick`,e[e.Rhombus=2]=`Rhombus`,e}({}),M=t(),pe=250,me=window.location.hostname.endsWith(`github.io`),he=`relative h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 transition-colors duration-200 checked:bg-brand-500`,ge=`pointer-events-none absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-3`,_e=(0,h.memo)(({renderer:e,onDebugChange:t,onInstantLoadChange:n})=>{let[r,i]=(0,h.useState)(0),[a,o]=(0,h.useState)(!1),[s,l]=(0,h.useState)(!1);(0,h.useEffect)(()=>{if(e===null)return;let t=setInterval(()=>{i(e.renderFps)},pe);return()=>clearInterval(t)},[e]);let u=c(()=>{let e=!a;o(e),t(e)}),d=c(()=>{let e=!s;l(e),n(e)});return(0,M.jsxs)(`div`,{className:`pointer-events-auto absolute top-1 right-1 z-10 flex select-none flex-col items-center gap-2 rounded bg-[#1a1a40]/80 px-3 py-2 font-mono text-xs text-white`,children:[(0,M.jsxs)(`span`,{className:`tabular-nums`,children:[r,` fps`]}),(0,M.jsxs)(`div`,{className:`flex w-full flex-col gap-1.5`,children:[!me&&(0,M.jsxs)(`label`,{className:`flex cursor-pointer items-center justify-between gap-2`,children:[(0,M.jsx)(`span`,{children:`Debug`}),(0,M.jsxs)(`span`,{className:`relative inline-flex items-center`,children:[(0,M.jsx)(`input`,{type:`checkbox`,checked:a,onChange:u,className:`peer ${he}`}),(0,M.jsx)(`span`,{className:ge})]})]}),(0,M.jsxs)(`label`,{className:`flex cursor-pointer items-center justify-between gap-2`,children:[(0,M.jsx)(`span`,{children:`Instant loading`}),(0,M.jsxs)(`span`,{className:`relative inline-flex items-center`,children:[(0,M.jsx)(`input`,{type:`checkbox`,checked:s,onChange:d,className:`peer ${he}`}),(0,M.jsx)(`span`,{className:ge})]})]})]})]})}),ve=(0,h.memo)(({children:e})=>{let[t,n]=(0,h.useState)(!1),a=(0,h.useRef)(null);(0,h.useEffect)(()=>{if(r(screen.orientation)||!i(screen.orientation.lock))return;function e(){n(screen.orientation.type.startsWith(`portrait`)&&!document.fullscreenElement)}return e(),screen.orientation.addEventListener(`change`,e),document.addEventListener(`fullscreenchange`,e),()=>{screen.orientation.removeEventListener(`change`,e),document.removeEventListener(`fullscreenchange`,e);let t=a.current;r(t)||(screen.orientation.unlock(),!t.wasFullscreen&&document.fullscreenElement&&document.exitFullscreen().catch(()=>{}),a.current=null)}},[]);let o=c(async()=>{a.current={wasFullscreen:!!document.fullscreenElement,previousOrientation:screen.orientation.type};try{await document.documentElement.requestFullscreen(),await screen.orientation?.lock?.(`landscape`)}catch{}});return(0,M.jsxs)(`div`,{className:`relative h-full w-full`,children:[e,t&&(0,M.jsx)(`div`,{className:`absolute inset-0 z-20 flex items-center justify-center`,children:(0,M.jsx)(`button`,{type:`button`,onClick:o,className:`flex h-24 w-24 items-center justify-center rounded-full bg-brand-500/80 text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95`,children:(0,M.jsx)(p,{className:`h-14 w-14`})})})]})}),N=function(e){return e[e.Idle=5]=`Idle`,e[e.Resize=60]=`Resize`,e[e.ZoomAnimation=60]=`ZoomAnimation`,e[e.Interaction=60]=`Interaction`,e}({}),ye=500,be=class{activeLevels=new Map;fallbackFps;constructor(e=N.Idle){this.fallbackFps=e}raise(e){let t=this.activeLevels.get(e);t!==void 0&&clearTimeout(t);let n=setTimeout(()=>{this.activeLevels.delete(e)},ye);this.activeLevels.set(e,n)}getFrameIntervalMs(){return ee/this.getCurrentFps()}getCurrentFps(){if(this.activeLevels.size===0)return this.fallbackFps;let e=0;for(let t of this.activeLevels.keys())t>e&&(e=t);return e}dispose(){for(let e of this.activeLevels.values())clearTimeout(e);this.activeLevels.clear()}},xe=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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
`,P=`struct Uniforms {
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
`,Se=`// Debug shader: draws vertical lines at block boundaries.
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
`,Ce=`struct VSOut {
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
`,we=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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
`,Te=17,Ee=class{available=[];acquire(e,t,n,r){let i=this.available.findIndex(e=>e.width===t&&e.height===n);if(i!==-1){let[e]=this.available.splice(i,1);return e}return e.createTexture({size:[t,n],format:r,usage:Te})}release(e){this.available.push(e)}dispose(){for(let e of this.available)e.destroy();this.available.length=0}},De=P+Ce,Oe=P+xe,ke=P+we,Ae=P+Se,je=5,Me=`rgba(100, 160, 255, 0.6)`,Ne=`rgba(30, 80, 180, 0.8)`,Pe=1200;async function Fe(){o(!r(navigator.gpu),`WebGPU is not supported`);let e=await navigator.gpu.requestAdapter();o(!r(e),`WebGPU adapter not available`);let t=await e.requestDevice(),n=new OffscreenCanvas(ce,768),i=n.getContext(`webgpu`);o(!r(i),`Failed to get WebGPU context on OffscreenCanvas`);let a=navigator.gpu.getPreferredCanvasFormat();i.configure({device:t,format:a,alphaMode:`premultiplied`,usage:18});let s=t.createShaderModule({code:De}),c=t.createShaderModule({code:Oe}),l=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]}),u={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},d=t.createPipelineLayout({bindGroupLayouts:[l]}),f=t.createRenderPipeline({layout:d,vertex:{module:s,entryPoint:`vs`},fragment:{module:s,entryPoint:`fs`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),p=t.createRenderPipeline({layout:d,vertex:{module:c,entryPoint:`vsCandlestick`},fragment:{module:c,entryPoint:`fsCandlestick`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),m=t.createShaderModule({code:ke}),h=t.createRenderPipeline({layout:d,vertex:{module:m,entryPoint:`vsRhombus`},fragment:{module:m,entryPoint:`fsRhombus`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),g=t.createShaderModule({code:Ae});return new Ie(t,a,l,f,p,h,t.createRenderPipeline({layout:d,vertex:{module:g,entryPoint:`vsDebugLines`},fragment:{module:g,entryPoint:`fsDebugLines`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),n,i)}var Ie=class{device;format;bindGroupLayout;linePipeline;candlestickPipeline;rhombusPipeline;debugPipeline;debugMode=!1;instantLoad=!1;renderFps=0;offscreen;ctx;charts=new Set;msaaManager=l(4);renderTargetPool=new Ee;animationFrameId=0;lastFrameTime=0;disposed=!1;needsReconfigure=!1;renderFrameTimes=[];lastFpsUpdate=0;constructor(e,t,n,r,i,a,o,s,c){this.device=e,this.format=t,this.bindGroupLayout=n,this.linePipeline=r,this.candlestickPipeline=i,this.rhombusPipeline=a,this.debugPipeline=o,this.offscreen=s,this.ctx=c}registerChart(e){return this.charts.add(e),this.charts.size===1&&this.startAnimationLoop(),()=>{this.charts.delete(e),e.dispose(),this.charts.size===0&&this.stopAnimationLoop()}}destroy(){if(!this.disposed){this.disposed=!0,this.stopAnimationLoop();for(let e of this.charts)e.dispose();this.charts.clear(),this.msaaManager.dispose(),this.renderTargetPool.dispose(),this.device.destroy()}}getMinFrameIntervalMs(){let e;for(let t of this.charts){let n=t.fpsController.getFrameIntervalMs();(r(e)||n<e)&&(e=n)}return e??1e3/N.Idle}startAnimationLoop(){if(this.disposed)return;let e=t=>{if(this.disposed)return;let n=this.getMinFrameIntervalMs();if(t-this.lastFrameTime<n){this.animationFrameId=requestAnimationFrame(e);return}this.lastFrameTime=t,this.trackRenderFps(t),this.renderAllCharts(),this.animationFrameId=requestAnimationFrame(e)};this.animationFrameId=requestAnimationFrame(e)}trackRenderFps(e){this.renderFrameTimes.push(e);let t=e-1e3;for(;this.renderFrameTimes.length>0&&this.renderFrameTimes[0]<t;)this.renderFrameTimes.shift();if(e-this.lastFpsUpdate>=250){this.lastFpsUpdate=e;let t=this.renderFrameTimes.length>1?this.renderFrameTimes[this.renderFrameTimes.length-1]-this.renderFrameTimes[0]:0;this.renderFps=t>0?Math.round((this.renderFrameTimes.length-1)/t*ee):0}}stopAnimationLoop(){cancelAnimationFrame(this.animationFrameId),this.animationFrameId=0}drawLoadingBars(e){let t=e.getLoadingRegions();if(t.length===0)return;let n=e.getViewport(),r=n.timeEnd-n.timeStart;if(r<=0)return;let i=e.target2dContext,a=e.width,o=e.height,s=je*Math.max(1,window.devicePixelRatio),c=o-s,l=performance.now()%Pe/Pe;for(let e of t){let t=(e.timeStart-n.timeStart)/r,o=(e.timeEnd-n.timeStart)/r,u=Math.max(0,Math.floor(t*a)),d=Math.min(a,Math.ceil(o*a))-u;if(d<=0)continue;let f=s*2,p=c-f+l*f,m=i.createLinearGradient(0,p,0,p+f);m.addColorStop(0,Me),m.addColorStop(.5,Ne),m.addColorStop(1,Me),i.save(),i.beginPath(),i.rect(u,c,d,s),i.clip(),i.fillStyle=m,i.fillRect(u,p,d,f),i.restore()}}ensureMsaaView(e,t){return this.msaaManager.ensureView(this.device,this.format,e,t)}renderAllCharts(){for(let e of this.charts){e.update();let{width:t,height:n}=e;if(t===0||n===0)continue;let i=e.prepareDrawCommands();r(i)||(this.renderChart(e,i),e.renderCanvasAxes(),this.drawLoadingBars(e))}}renderChart(e,t){let{width:n,height:i}=e;(this.offscreen.width!==n||this.offscreen.height!==i||this.needsReconfigure)&&(this.offscreen.width=n,this.offscreen.height=i,this.ctx.configure({device:this.device,format:this.format,alphaMode:`premultiplied`,usage:18}),this.needsReconfigure=!1);let a=this.renderTargetPool.acquire(this.device,n,i,this.format),o=this.ensureMsaaView(n,i);if(r(o)){this.renderTargetPool.release(a);return}let s=this.device.createCommandEncoder(),c=s.beginRenderPass({colorAttachments:[{view:o,resolveTarget:a.createView(),loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});e.seriesManager.renderAll(c,t),this.debugMode&&e.seriesManager.renderDebug(c,this.debugPipeline,t),c.end();let l=this.ctx.getCurrentTexture();s.copyTextureToTexture({texture:a},{texture:l},[n,i]),this.device.queue.submit([s.finish()]),this.renderTargetPool.release(a),e.syncCanvasSize();let u=this.offscreen.transferToImageBitmap();this.needsReconfigure=!0,e.renderCanvasGrid(),e.target2dContext.drawImage(u,0,0),u.close()}},Le=(0,h.createContext)(null);function Re(){return(0,h.useContext)(Le)}var ze=(0,h.memo)(({children:e})=>{let[t,n]=(0,h.useState)(null);return(0,h.useEffect)(()=>{let e=!1,t;return Fe().then(r=>{if(e){r.destroy();return}t=r,n(r)}),()=>{e=!0,r(t)||t.destroy()}},[]),(0,M.jsx)(Le,{value:t,children:e})}),F=60,I=3600,Be=86400,Ve=60,L=24,He=[1,2,5],Ue=8,We=2,Ge=70,Ke=20,qe=10;function R(t){let n=BigInt(Math.trunc(t))*1000000000n;return e.Instant.fromEpochNanoseconds(n)}function Je(e,t){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}`}function Ye(e,t,n,r,i){if(e.length<=1||r<=0)return e;let a=n-t;if(a<=0)return e;let o=i+qe,s=[],c=-1/0;for(let n of e){let e=(n.position-t)/a*r;e-c>=o&&(s.push(n),c=e)}return s}function Xe(e,t,n,r){return Ye(tt(e,t,n),e,t,r,Ge)}function Ze(t,n){let r=[],i=R(t).toZonedDateTimeISO(`UTC`),a=R(n).toZonedDateTimeISO(`UTC`),o=i.with({day:1,hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(o,i)<0&&(o=o.add({months:1}));e.ZonedDateTime.compare(o,a)<=0;)r.push({position:Number(o.epochNanoseconds/1000000000n),label:o.toPlainDate().toLocaleString(`en-US`,{month:`short`})}),o=o.add({months:1});return r}function Qe(t,n){let r=[],i=R(t).toZonedDateTimeISO(`UTC`),a=R(n).toZonedDateTimeISO(`UTC`),o=i.with({hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(o,i)<0&&(o=o.add({days:1}));e.ZonedDateTime.compare(o,a)<=0;)r.push({position:Number(o.epochNanoseconds/1000000000n),label:String(o.day)}),o=o.add({days:1});return r}function $e(e,t){let n=[],r=Math.ceil(e/I),i=Math.floor(t/I);for(let e=r;e<=i;e++){let t=e*I,r=(e%L+L)%L;n.push({position:t,label:Je(r,0)})}return n}function et(e,t){let n=[],r=Math.ceil(e/F),i=Math.floor(t/F);for(let e=r;e<=i;e++){let t=e*F,r=Math.floor(t%Be/F),i=Math.floor(r/Ve),a=r%Ve;n.push({position:t,label:Je((i%L+L)%L,a)})}return n}function tt(e,t,n){switch(n){case A.Day256:case A.Day64:return Ze(e,t);case A.Day16:case A.Day4:return Qe(e,t);case A.Day1:return $e(e,t);case A.Hour12:case A.Hour1:return et(e,t)}}function nt(e){if(e<=0)return 1;let t=10**Math.floor(Math.log10(e)),n=e/t;for(let e of He)if(e>=n)return e*t;return He[0]*t*10}function rt(e,t,n){let r=t-e;if(r<=0)return[{position:e,label:it(e,1)}];let i=nt(r/Ue);Math.floor(r/i)<We&&(i=nt(r/We));let a=Math.max(0,-Math.floor(Math.log10(i))+1),o=[],s=Math.ceil(e/i)*i;for(let n=s;n<=t+i*.01;n+=i)n>=e&&n<=t&&o.push({position:n,label:it(n,a)});return Ye(o,e,t,n,Ke)}function it(e,t){return e.toFixed(t)}var at=s(a(((e,t)=>{(function(n,r){typeof e==`object`?t.exports=r():typeof define==`function`&&define.amd?define(r):n.Alea=r()})(e,function(){return e.importState=function(t){var n=new e;return n.importState(t),n},e;function e(){return function(e){var n=0,r=0,i=0,a=1;e.length==0&&(e=[+new Date]);var o=t();n=o(` `),r=o(` `),i=o(` `);for(var s=0;s<e.length;s++)n-=o(e[s]),n<0&&(n+=1),r-=o(e[s]),r<0&&(r+=1),i-=o(e[s]),i<0&&(i+=1);o=null;var c=function(){var e=2091639*n+a*23283064365386963e-26;return n=r,r=i,i=e-(a=e|0)};return c.next=c,c.uint32=function(){return c()*4294967296},c.fract53=function(){return c()+(c()*2097152|0)*11102230246251565e-32},c.version=`Alea 0.9`,c.args=e,c.exportState=function(){return[n,r,i,a]},c.importState=function(e){n=+e[0]||0,r=+e[1]||0,i=+e[2]||0,a=+e[3]||0},c}(Array.prototype.slice.call(arguments))}function t(){var e=4022871197,t=function(t){t=t.toString();for(var n=0;n<t.length;n++){e+=t.charCodeAt(n);var r=.02519603282416938*e;e=r>>>0,r-=e,r*=e,e=r>>>0,r-=e,e+=r*4294967296}return(e>>>0)*23283064365386963e-26};return t.version=`Mash 0.9`,t}})}))(),1),ot=Math.sqrt(3),z=Math.sqrt(5),st=.5*(ot-1),B=(3-ot)/6;(z-1)/4,(5-z)/20;var ct=e=>Math.floor(e)|0,lt=new Float64Array([1,1,-1,1,1,-1,-1,-1,1,0,-1,0,1,0,-1,0,0,1,0,-1,0,1,0,-1]);function ut(e=Math.random){let t=dt(e),n=new Float64Array(t).map(e=>lt[e%12*2]),r=new Float64Array(t).map(e=>lt[e%12*2+1]);return function(e,i){let a=0,o=0,s=0,c=(e+i)*st,l=ct(e+c),u=ct(i+c),d=(l+u)*B,f=l-d,p=u-d,m=e-f,h=i-p,g,_;m>h?(g=1,_=0):(g=0,_=1);let v=m-g+B,y=h-_+B,b=m-1+2*B,x=h-1+2*B,S=l&255,C=u&255,w=.5-m*m-h*h;if(w>=0){let e=S+t[C],i=n[e],o=r[e];w*=w,a=w*w*(i*m+o*h)}let T=.5-v*v-y*y;if(T>=0){let e=S+g+t[C+_],i=n[e],a=r[e];T*=T,o=T*T*(i*v+a*y)}let E=.5-b*b-x*x;if(E>=0){let e=S+1+t[C+1],i=n[e],a=r[e];E*=E,s=E*E*(i*b+a*x)}return 70*(a+o+s)}}function dt(e){let t=new Uint8Array(512);for(let e=0;e<512/2;e++)t[e]=e;for(let n=0;n<512/2-1;n++){let r=n+~~(e()*(256-n)),i=t[n];t[n]=t[r],t[r]=i}for(let e=256;e<512;e++)t[e]=t[e-256];return t}var V=180,ft={[A.Hour1]:V,[A.Hour12]:V,[A.Day1]:V,[A.Day4]:V,[A.Day16]:V,[A.Day64]:V,[A.Day256]:V},pt=1,mt=10-pt,ht=7,gt=.5;function _t(e){return(e-w)/D}function vt(e){let t=ut((0,at.default)(e));return e=>{let n=_t(e),r=0,i=15,a=4;for(let e=0;e<6;e++)r+=i*t(n*a,e*E),i*=T,a*=2;return 100+r}}var yt=x(.2,.8,.3,1),bt=x(.9,.2,.2,1);function xt(e,t){let n=e(_t(t)*4,ht*E);return pt+Math.max(0,Math.min(1,(n+1)*gt))*mt}function St(e,t,n,r){let i=ft[n],a=(t-e)/(i-1),o=vt(r),s=ut((0,at.default)(`${r}-size`)),c=Array(i),l=Array(i);for(let t=0;t<i;t++)c[t]=e+t*a,l[t]=o(c[t]);let u=Array(i);for(let e=0;e<i;e++){let t=l[Math.min(e+1,i-1)]>=l[e];u[e]={time:c[e],value:l[e],size:xt(s,c[e]),color:t?yt:bt}}return u}var Ct=3;function wt(e,t,n){let r=new ArrayBuffer(e.length*4*Float32Array.BYTES_PER_ELEMENT),i=new Float32Array(r),a=new Uint32Array(r);for(let r=0;r<e.length;r++){let o=r*4,s=e[r];i[o]=s.time-t,i[o+1]=s.value-n,i[o+2]=s.size,a[o+Ct]=Ot(s.color)}return i}var Tt=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),Et=new Float32Array(Tt),Dt=new Uint32Array(Tt);function Ot(e){return Et[0]=e,Dt[0]}var kt=1;function At(e,t,n,r=kt){let i=n,a=Math.floor(e/i)*i-r*i,o=Math.ceil(t/i)*i+r*i,s=Math.round((o-a)/i),c=Array(s);for(let e=0;e<s;e++){let t=a+e*i;c[e]={start:t,end:t+i}}return c}var jt=1e3,Mt=class{pendingBlocks=new Map;requestCounter=0;constructor(e,t,n,r,i,a,o,s){this.allocator=e,this.registry=t,this.seed=n,this.chartType=r,this.colorFn=i,this.sizeFn=a,this.isDebug=o,this.isInstantLoad=s}ensureBlocksForViewport(e,t,n){let r=At(e,t,n),i=[],a=performance.now(),o=new Set;for(let e of r){let t=`${n}:${e.start}:${e.end}`;o.add(t);let r=this.registry.findCovering(n,e.start,e.end,this.chartType);if(r!==void 0){this.allocator.touch(r.slot),i.push(r),this.pendingBlocks.delete(t);continue}let s=this.pendingBlocks.get(t);if(s===void 0){this.requestCounter++;let r=this.requestCounter;this.isDebug?.()&&console.log(`>>> [#${r}] REQUEST ${j[this.chartType]} [${e.start} → ${e.end}] scale=${n}`),this.pendingBlocks.set(t,{periodStart:e.start,periodEnd:e.end,scale:n,requestTime:a});continue}if(this.isInstantLoad?.()===!0||a-s.requestTime>=jt){this.pendingBlocks.delete(t);let r=this.generateBlocksForPeriod(e.start,e.end,n);if(i.push(...r),this.isDebug?.()){let t=r.reduce((e,t)=>e+t.pointCount,0);console.log(`>>> [#${this.requestCounter}] RESPONSE ${j[this.chartType]} [${e.start} → ${e.end}] ${r.length} block(s), ${t} points`)}}}for(let e of this.pendingBlocks.keys())o.has(e)||this.pendingBlocks.delete(e);return i.sort((e,t)=>e.timeStart-t.timeStart)}getLoadingRegions(){let e=performance.now(),t=[];for(let n of this.pendingBlocks.values()){let r=e-n.requestTime,i=Math.min(1,r/jt);t.push({timeStart:n.periodStart,timeEnd:n.periodEnd,progress:i})}return t}generateBlocksForPeriod(e,t,n){let r=St(e,t,n,this.seed);if(r.length===0)return[];if(this.colorFn!==void 0||this.sizeFn!==void 0)for(let e=0;e<r.length;e++){let t=r[e];r[e]={...t,color:this.colorFn===void 0?t.color:this.colorFn(t.value,e,r),size:this.sizeFn===void 0?t.size:this.sizeFn(t.value,e,r)}}let i=[];if(r.length<=256){let a=this.createBlock(r,e,t,n);a!==null&&i.push(a)}else{let e=Math.ceil(r.length/256);for(let t=0;t<e;t++){let e=t*256,a=Math.min(e+256,r.length),o=r.slice(e,a),s=o[0].time,c=o[o.length-1].time,l=this.createBlock(o,s,c,n);l!==null&&i.push(l)}}return i}createBlock(e,t,n,r){let i=this.allocator.allocateSlot();if(i===null)return null;let a=e[0].time,o=e[0].value,s=wt(e,a,o);this.allocator.writeSlotData(i,s,e.length);let c=new Float64Array(e.length),l=new Float64Array(e.length);for(let t=0;t<e.length;t++)c[t]=e[t].time,l[t]=e[t].value;let u={minX:0,maxX:0,minY:0,maxY:0,timeStart:t,timeEnd:n,scale:r,chartType:this.chartType,slot:i,pointCount:e.length,baseTime:a,baseValue:o,pointTimes:c,pointValues:l};return this.registry.insert(u),u}};function Nt(e,t,n=0,r=e.length-1,i=Pt){for(;r>n;){if(r-n>600){let a=r-n+1,o=t-n+1,s=Math.log(a),c=.5*Math.exp(2*s/3),l=.5*Math.sqrt(s*c*(a-c)/a)*(o-a/2<0?-1:1);Nt(e,t,Math.max(n,Math.floor(t-o*c/a+l)),Math.min(r,Math.floor(t+(a-o)*c/a+l)),i)}let a=e[t],o=n,s=r;for(H(e,n,t),i(e[r],a)>0&&H(e,n,r);o<s;){for(H(e,o,s),o++,s--;i(e[o],a)<0;)o++;for(;i(e[s],a)>0;)s--}i(e[n],a)===0?H(e,n,s):(s++,H(e,s,r)),s<=t&&(n=s+1),t<=s&&(r=s-1)}}function H(e,t,n){let r=e[t];e[t]=e[n],e[n]=r}function Pt(e,t){return e<t?-1:e>t?1:0}var Ft=class{constructor(e=9){this._maxEntries=Math.max(4,e),this._minEntries=Math.max(2,Math.ceil(this._maxEntries*.4)),this.clear()}all(){return this._all(this.data,[])}search(e){let t=this.data,n=[];if(!Y(e,t))return n;let r=this.toBBox,i=[];for(;t;){for(let a=0;a<t.children.length;a++){let o=t.children[a],s=t.leaf?r(o):o;Y(e,s)&&(t.leaf?n.push(o):J(e,s)?this._all(o,n):i.push(o))}t=i.pop()}return n}collides(e){let t=this.data;if(!Y(e,t))return!1;let n=[];for(;t;){for(let r=0;r<t.children.length;r++){let i=t.children[r],a=t.leaf?this.toBBox(i):i;if(Y(e,a)){if(t.leaf||J(e,a))return!0;n.push(i)}}t=n.pop()}return!1}load(e){if(!(e&&e.length))return this;if(e.length<this._minEntries){for(let t=0;t<e.length;t++)this.insert(e[t]);return this}let t=this._build(e.slice(),0,e.length-1,0);if(!this.data.children.length)this.data=t;else if(this.data.height===t.height)this._splitRoot(this.data,t);else{if(this.data.height<t.height){let e=this.data;this.data=t,t=e}this._insert(t,this.data.height-t.height-1,!0)}return this}insert(e){return e&&this._insert(e,this.data.height-1),this}clear(){return this.data=X([]),this}remove(e,t){if(!e)return this;let n=this.data,r=this.toBBox(e),i=[],a=[],o,s,c;for(;n||i.length;){if(n||(n=i.pop(),s=i[i.length-1],o=a.pop(),c=!0),n.leaf){let r=It(e,n.children,t);if(r!==-1)return n.children.splice(r,1),i.push(n),this._condense(i),this}!c&&!n.leaf&&J(n,r)?(i.push(n),a.push(o),o=0,s=n,n=n.children[0]):s?(o++,n=s.children[o],c=!1):n=null}return this}toBBox(e){return e}compareMinX(e,t){return e.minX-t.minX}compareMinY(e,t){return e.minY-t.minY}toJSON(){return this.data}fromJSON(e){return this.data=e,this}_all(e,t){let n=[];for(;e;)e.leaf?t.push(...e.children):n.push(...e.children),e=n.pop();return t}_build(e,t,n,r){let i=n-t+1,a=this._maxEntries,o;if(i<=a)return o=X(e.slice(t,n+1)),U(o,this.toBBox),o;r||(r=Math.ceil(Math.log(i)/Math.log(a)),a=Math.ceil(i/a**(r-1))),o=X([]),o.leaf=!1,o.height=r;let s=Math.ceil(i/a),c=s*Math.ceil(Math.sqrt(a));Vt(e,t,n,c,this.compareMinX);for(let i=t;i<=n;i+=c){let t=Math.min(i+c-1,n);Vt(e,i,t,s,this.compareMinY);for(let n=i;n<=t;n+=s){let i=Math.min(n+s-1,t);o.children.push(this._build(e,n,i,r-1))}}return U(o,this.toBBox),o}_chooseSubtree(e,t,n,r){for(;r.push(t),!(t.leaf||r.length-1===n);){let n=1/0,r=1/0,i;for(let a=0;a<t.children.length;a++){let o=t.children[a],s=K(o),c=zt(e,o)-s;c<r?(r=c,n=s<n?s:n,i=o):c===r&&s<n&&(n=s,i=o)}t=i||t.children[0]}return t}_insert(e,t,n){let r=n?e:this.toBBox(e),i=[],a=this._chooseSubtree(r,this.data,t,i);for(a.children.push(e),G(a,r);t>=0&&i[t].children.length>this._maxEntries;)this._split(i,t),t--;this._adjustParentBBoxes(r,i,t)}_split(e,t){let n=e[t],r=n.children.length,i=this._minEntries;this._chooseSplitAxis(n,i,r);let a=this._chooseSplitIndex(n,i,r),o=X(n.children.splice(a,n.children.length-a));o.height=n.height,o.leaf=n.leaf,U(n,this.toBBox),U(o,this.toBBox),t?e[t-1].children.push(o):this._splitRoot(n,o)}_splitRoot(e,t){this.data=X([e,t]),this.data.height=e.height+1,this.data.leaf=!1,U(this.data,this.toBBox)}_chooseSplitIndex(e,t,n){let r,i=1/0,a=1/0;for(let o=t;o<=n-t;o++){let t=W(e,0,o,this.toBBox),s=W(e,o,n,this.toBBox),c=Bt(t,s),l=K(t)+K(s);c<i?(i=c,r=o,a=l<a?l:a):c===i&&l<a&&(a=l,r=o)}return r||n-t}_chooseSplitAxis(e,t,n){let r=e.leaf?this.compareMinX:Lt,i=e.leaf?this.compareMinY:Rt;this._allDistMargin(e,t,n,r)<this._allDistMargin(e,t,n,i)&&e.children.sort(r)}_allDistMargin(e,t,n,r){e.children.sort(r);let i=this.toBBox,a=W(e,0,t,i),o=W(e,n-t,n,i),s=q(a)+q(o);for(let r=t;r<n-t;r++){let t=e.children[r];G(a,e.leaf?i(t):t),s+=q(a)}for(let r=n-t-1;r>=t;r--){let t=e.children[r];G(o,e.leaf?i(t):t),s+=q(o)}return s}_adjustParentBBoxes(e,t,n){for(let r=n;r>=0;r--)G(t[r],e)}_condense(e){for(let t=e.length-1,n;t>=0;t--)e[t].children.length===0?t>0?(n=e[t-1].children,n.splice(n.indexOf(e[t]),1)):this.clear():U(e[t],this.toBBox)}};function It(e,t,n){if(!n)return t.indexOf(e);for(let r=0;r<t.length;r++)if(n(e,t[r]))return r;return-1}function U(e,t){W(e,0,e.children.length,t,e)}function W(e,t,n,r,i){i||=X(null),i.minX=1/0,i.minY=1/0,i.maxX=-1/0,i.maxY=-1/0;for(let a=t;a<n;a++){let t=e.children[a];G(i,e.leaf?r(t):t)}return i}function G(e,t){return e.minX=Math.min(e.minX,t.minX),e.minY=Math.min(e.minY,t.minY),e.maxX=Math.max(e.maxX,t.maxX),e.maxY=Math.max(e.maxY,t.maxY),e}function Lt(e,t){return e.minX-t.minX}function Rt(e,t){return e.minY-t.minY}function K(e){return(e.maxX-e.minX)*(e.maxY-e.minY)}function q(e){return e.maxX-e.minX+(e.maxY-e.minY)}function zt(e,t){return(Math.max(t.maxX,e.maxX)-Math.min(t.minX,e.minX))*(Math.max(t.maxY,e.maxY)-Math.min(t.minY,e.minY))}function Bt(e,t){let n=Math.max(e.minX,t.minX),r=Math.max(e.minY,t.minY),i=Math.min(e.maxX,t.maxX),a=Math.min(e.maxY,t.maxY);return Math.max(0,i-n)*Math.max(0,a-r)}function J(e,t){return e.minX<=t.minX&&e.minY<=t.minY&&t.maxX<=e.maxX&&t.maxY<=e.maxY}function Y(e,t){return t.minX<=e.maxX&&t.minY<=e.maxY&&t.maxX>=e.minX&&t.maxY>=e.minY}function X(e){return{children:e,height:1,leaf:!0,minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0}}function Vt(e,t,n,r,i){let a=[t,n];for(;a.length;){if(n=a.pop(),t=a.pop(),n-t<=r)continue;let o=t+Math.ceil((n-t)/r/2)*r;Nt(e,o,t,n,i),a.push(t,o,o,n)}}function Z(e){return e.row*8+e.slotIndex}var Ht=class{tree=new Ft;slotMap=new Map;insert(e){e.minX=e.timeStart,e.maxX=e.timeEnd,e.minY=e.scale,e.maxY=e.scale,this.tree.insert(e),this.slotMap.set(Z(e.slot),e)}remove(e){this.tree.remove(e),this.slotMap.delete(Z(e.slot))}removeBySlot(e){let t=this.slotMap.get(Z(e));t!==void 0&&this.remove(t)}queryVisible(e,t,n,r){let i=this.tree.search({minX:t,maxX:n,minY:e,maxY:e});return r===void 0?i:i.filter(e=>e.chartType===r)}findCovering(e,t,n,r){return this.tree.search({minX:t,maxX:n,minY:e,maxY:e}).find(e=>e.chartType===r&&e.timeStart<=t&&e.timeEnd>=n)}clear(){this.tree.clear(),this.slotMap.clear()}getEntryCount(){return this.slotMap.size}},Ut=[A.Hour1,A.Hour12,A.Day1,A.Day4,A.Day16,A.Day64,A.Day256];function Q(e,t){let n=t-e;for(let e of Ut)if(n<=e)return e;return A.Day256}function $(e,t,n,r){let i=t-e;return i>=r-n?[n,r]:e<n?[n,n+i]:t>r?[r-i,r]:[e,t]}function Wt(e,t){let n=t-e,r=(n>0?n:Math.abs(e))*.1||1;return[e-r,t+r]}function Gt(e,t,n,r){let i=e.length;if(i===0)return;let a=0,o=i;for(;a<o;){let t=a+o>>1;e[t]<n?a=t+1:o=t}let s=a;for(a=s,o=i;a<o;){let t=a+o>>1;e[t]<=r?a=t+1:o=t}let c=a;if(s>=c)return;let l=1/0,u=-1/0;for(let e=s;e<c;e++){let n=t[e];n<l&&(l=n),n>u&&(u=n)}return[l,u]}function Kt(e,t,n,r){let i=n*((t-e)/r);return[e-i,t-i]}function qt(e,t,n,r){let i=t-e,a=e+i*r,o=Math.max(i*n,60);return[a-o*r,a+o*(1-r)]}var Jt=class{isDragging=!1;lastMouseX=0;isTouching=!1;lastTouchX=0;lastPinchDistance=0;handleMouseDown;handleMouseMove;handleMouseUp;handleWheel;handleTouchStart;handleTouchMove;handleTouchEnd;constructor(e,t,n,r,i){this.viewport=e,this.canvas=t,this.dataMinTime=n,this.dataMaxTime=r,this.fpsController=i,this.handleMouseDown=e=>{this.isDragging=!0,this.lastMouseX=e.clientX,this.canvas.style.cursor=`grabbing`,this.fpsController.raise(N.Interaction)},this.handleMouseMove=e=>{if(!this.isDragging)return;let t=e.clientX-this.lastMouseX;this.lastMouseX=e.clientX;let[n,r]=$(...Kt(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,t,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=n,this.viewport.viewTimeEnd=r,this.viewport.targetTimeStart=n,this.viewport.targetTimeEnd=r,this.fpsController.raise(N.Interaction)},this.handleMouseUp=()=>{this.isDragging=!1,this.canvas.style.cursor=`grab`},this.handleWheel=e=>{e.preventDefault();let t=this.canvas.getBoundingClientRect(),n=(e.clientX-t.left)/t.width,r=e.deltaY>0?ne:te,[i,a]=$(...qt(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,r,n),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a,this.fpsController.raise(N.Interaction)},this.handleTouchStart=e=>{this.fpsController.raise(N.Interaction),e.touches.length===1?(this.isTouching=!0,this.lastTouchX=e.touches[0].clientX):e.touches.length===2&&(this.isTouching=!1,this.lastPinchDistance=this.getTouchDistance(e))},this.handleTouchMove=e=>{if(e.preventDefault(),this.fpsController.raise(N.Interaction),e.touches.length===2){let t=this.getTouchDistance(e),n=this.lastPinchDistance/t,r=this.getTouchCenter(e),[i,a]=$(...qt(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,n,r),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a,this.lastPinchDistance=t;return}if(!this.isTouching||e.touches.length!==1)return;let t=e.touches[0].clientX-this.lastTouchX;this.lastTouchX=e.touches[0].clientX;let[n,r]=$(...Kt(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,t,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=n,this.viewport.viewTimeEnd=r,this.viewport.targetTimeStart=n,this.viewport.targetTimeEnd=r},this.handleTouchEnd=e=>{e.touches.length===0?this.isTouching=!1:e.touches.length===1&&(this.isTouching=!0,this.lastTouchX=e.touches[0].clientX)}}get isInteracting(){return this.isDragging||this.isTouching}attach(){this.canvas.addEventListener(`mousedown`,this.handleMouseDown),this.canvas.addEventListener(`mousemove`,this.handleMouseMove),this.canvas.addEventListener(`mouseup`,this.handleMouseUp),this.canvas.addEventListener(`mouseleave`,this.handleMouseUp),this.canvas.addEventListener(`wheel`,this.handleWheel,{passive:!1}),this.canvas.addEventListener(`touchstart`,this.handleTouchStart,{passive:!0}),this.canvas.addEventListener(`touchmove`,this.handleTouchMove,{passive:!1}),this.canvas.addEventListener(`touchend`,this.handleTouchEnd),this.canvas.style.cursor=`grab`}detach(){this.canvas.removeEventListener(`mousedown`,this.handleMouseDown),this.canvas.removeEventListener(`mousemove`,this.handleMouseMove),this.canvas.removeEventListener(`mouseup`,this.handleMouseUp),this.canvas.removeEventListener(`mouseleave`,this.handleMouseUp),this.canvas.removeEventListener(`wheel`,this.handleWheel),this.canvas.removeEventListener(`touchstart`,this.handleTouchStart),this.canvas.removeEventListener(`touchmove`,this.handleTouchMove),this.canvas.removeEventListener(`touchend`,this.handleTouchEnd)}getTouchDistance(e){let t=e.touches[0].clientX-e.touches[1].clientX,n=e.touches[0].clientY-e.touches[1].clientY;return Math.sqrt(t*t+n*n)}getTouchCenter(e){let t=this.canvas.getBoundingClientRect();return((e.touches[0].clientX+e.touches[1].clientX)/2-t.left)/t.width}},Yt=4,Xt=Yt*Float32Array.BYTES_PER_ELEMENT,Zt=64,Qt=class{device;buffer;cpuBuffer;f32View;u32View;allocator;maxBlocks;constructor(e,t,n=Zt){this.device=e,this.allocator=t,this.maxBlocks=n;let r=n*Xt;this.buffer=e.createBuffer({size:r,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.cpuBuffer=new ArrayBuffer(r),this.f32View=new Float32Array(this.cpuBuffer),this.u32View=new Uint32Array(this.cpuBuffer)}writeDescriptors(e,t){let n=Math.min(e.length,this.maxBlocks);if(n===0)return{totalInstances:0,globalBaseTime:0,globalBaseValue:0};let r=e[0].baseTime,i=e[0].baseValue,a=0;for(let t=0;t<n;t++){let n=e[t],o=t*Yt,s=this.allocator.getTextureOffset(n.slot);this.u32View[o]=s,this.u32View[o+1]=n.pointCount,this.f32View[o+2]=n.baseTime-r,this.f32View[o+3]=n.baseValue-i,a+=n.pointCount}let o=n*Xt;return this.device.queue.writeBuffer(this.buffer,0,this.cpuBuffer,0,o),{totalInstances:t?Math.max(0,a-1):a,globalBaseTime:r,globalBaseValue:i}}getBuffer(){return this.buffer}getTextureWidth(){return C}dispose(){this.buffer.destroy()}},$t=6,en=class{device;bindGroupLayout;uniformBuffer;uniformView;descriptorBuffer;currentBindGroup=null;currentInstanceCount=0;currentBlockCount=0;constructor(e,t){this.verticesPerInstance=e,this.needsStitching=t}init(e,t,n){this.device=e,this.bindGroupLayout=t,this.uniformView=u(f(P).uniforms.U),this.uniformBuffer=this.device.createBuffer({size:this.uniformView.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.descriptorBuffer=new Qt(e,n)}updateBindGroup(e){this.currentBindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:e},{binding:2,resource:{buffer:this.descriptorBuffer.getBuffer()}}]})}writeUniforms(e,t,n,r,i,a,o){if(e.length===0){this.currentInstanceCount=0,this.currentBlockCount=0;return}this.currentBlockCount=e.length;let{totalInstances:s,globalBaseTime:c,globalBaseValue:l}=this.descriptorBuffer.writeDescriptors(e,this.needsStitching);this.currentInstanceCount=s,this.uniformView.set({viewport:[t,n],timeRangeMin:r-c,timeRangeMax:i-c,valueRangeMin:a-l,valueRangeMax:o-l,textureWidth:C,lineWidth:Math.max(1,window.devicePixelRatio),blockCount:e.length}),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformView.arrayBuffer)}render(e,t,n){this.currentBindGroup===null||this.currentInstanceCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(this.verticesPerInstance,this.currentInstanceCount,0,0))}renderDebug(e,t,n){this.currentBindGroup===null||this.currentBlockCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw($t,this.currentBlockCount,0,0))}get instanceCount(){return this.currentInstanceCount}get bindGroup(){return this.currentBindGroup}dispose(){this.uniformBuffer.destroy(),this.descriptorBuffer.dispose(),this.currentBindGroup=null}},tn=class{entries=[];addSeries(e,t){this.entries.push({layer:e,pipeline:t})}initAll(e,t,n){for(let r of this.entries)r.layer.init(e,t,n)}updateBindGroups(e){for(let t of this.entries)t.layer.updateBindGroup(e)}writeAllUniforms(e,t,n,r,i,a,o){for(let s=0;s<this.entries.length;s++){let c=this.entries[s],l=e[s]??[];c.layer.writeUniforms(l,t,n,r,i,a,o)}}renderAll(e,t){for(let n of this.entries)n.layer.render(e,n.pipeline,t)}renderDebug(e,t,n){for(let r of this.entries)r.layer.renderDebug(e,t,n)}dispose(){for(let e of this.entries)e.layer.dispose()}},nn=`rgba32float`,rn=class{device;maxRows;textureWidth;textureUsage;onEvict;texture;capacity;highWaterMark=0;usageCounter=0;freeSlots=[];slotMetadata=new Map;constructor(e,t=4,n=512,r=C,i){this.device=e,this.maxRows=n,this.textureWidth=r,this.onEvict=i,this.capacity=t,this.textureUsage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC,this.texture=e.createTexture({size:[r,t],format:nn,usage:this.textureUsage})}allocateSlot(){if(this.freeSlots.length>0){let e=this.freeSlots.pop();return this.registerSlot(e)}let e=this.capacity*8;if(this.highWaterMark<e){let e=this.highWaterMark;return this.highWaterMark++,this.registerSlot(e)}if(this.capacity<this.maxRows){let e=Math.min(this.capacity*2,this.maxRows);this.growTexture(e);let t=this.highWaterMark;return this.highWaterMark++,this.registerSlot(t)}return this.evictAndAllocate()}writeSlotData(e,t,n){let r=e.row*this.textureWidth+e.slotIndex*256,i=r%this.textureWidth,a=Math.floor(r/this.textureWidth),o=this.textureWidth*4*Float32Array.BYTES_PER_ELEMENT,s=t.subarray(0,n*4);this.device.queue.writeTexture({texture:this.texture,origin:[i,a,0]},s,{bytesPerRow:o,rowsPerImage:1},[n,1,1])}touch(e){let t=this.flattenSlot(e),n=this.slotMetadata.get(t);n!==void 0&&(this.usageCounter++,n.lastUsed=this.usageCounter)}releaseSlot(e){let t=this.flattenSlot(e);this.slotMetadata.delete(t),this.freeSlots.push(t)}getTextureOffset(e){return e.row*this.textureWidth+e.slotIndex*256}createView(){return this.texture.createView()}getCapacity(){return this.capacity}getAllocatedSlotCount(){return this.slotMetadata.size}getHighWaterMark(){return this.highWaterMark}dispose(){this.texture.destroy(),this.slotMetadata.clear(),this.freeSlots.length=0}registerSlot(e){return this.usageCounter++,this.slotMetadata.set(e,{lastUsed:this.usageCounter}),this.unflattenSlot(e)}evictAndAllocate(){let e=-1,t=1/0;for(let[n,r]of this.slotMetadata)r.lastUsed<t&&(t=r.lastUsed,e=n);if(e===-1)return null;let n=this.unflattenSlot(e);return this.slotMetadata.delete(e),this.onEvict!==void 0&&this.onEvict(n),this.registerSlot(e)}growTexture(e){let t=this.device.createTexture({size:[this.textureWidth,e],format:nn,usage:this.textureUsage});if(this.highWaterMark>0){let e=Math.ceil(this.highWaterMark/8),n=this.device.createCommandEncoder();n.copyTextureToTexture({texture:this.texture,origin:[0,0,0]},{texture:t,origin:[0,0,0]},[this.textureWidth,e,1]),this.device.queue.submit([n.finish()])}this.texture.destroy(),this.texture=t,this.capacity=e}flattenSlot(e){return e.row*8+e.slotIndex}unflattenSlot(e){return{row:Math.floor(e/8),slotIndex:e%8}}},an=`#1a1a1a`,on=0,sn=200,cn=2;function ln(e){switch(e){case j.Line:return 18;case j.Candlestick:return 6;case j.Rhombus:return 6}}function un(e){switch(e){case j.Line:case j.Candlestick:return!0;case j.Rhombus:return!1}}function dn(e,t){switch(e){case j.Line:return t.linePipeline;case j.Candlestick:return t.candlestickPipeline;case j.Rhombus:return t.rhombusPipeline}}var fn=2,pn=.6,mn=3,hn=4,gn=class{targetCanvas;target2dContext;seriesManager;fpsController;viewport;dataMinTime;dataMaxTime;allocator;registry;dataPipelines;inputController;resizeObserver;canvasWidth=0;canvasHeight=0;lastTextureCapacity=0;constructor(e,t,n,i,a,s){this.targetCanvas=n;let c=n.getContext(`2d`);o(!r(c),`Failed to get 2D canvas context`),this.target2dContext=c,this.dataMinTime=w,this.dataMaxTime=w+D,this.viewport={viewTimeStart:i,viewTimeEnd:a,targetTimeStart:i,targetTimeEnd:a,viewValueMin:on,viewValueMax:sn},this.registry=new Ht,this.allocator=new rn(e.device,void 0,void 0,void 0,e=>{this.registry.removeBySlot(e)}),this.lastTextureCapacity=this.allocator.getCapacity(),this.dataPipelines=[],this.seriesManager=new tn;for(let n of t){let t=new Mt(this.allocator,this.registry,`${s}${n.seedSuffix}`,n.chartType,n.colorFn,n.sizeFn,()=>e.debugMode,()=>e.instantLoad);this.dataPipelines.push(t);let r=new en(ln(n.chartType),un(n.chartType)),i=dn(n.chartType,e);this.seriesManager.addSeries(r,i)}this.seriesManager.initAll(e.device,e.bindGroupLayout,this.allocator),this.seriesManager.updateBindGroups(this.allocator.createView()),this.fpsController=new be,this.inputController=new Jt(this.viewport,n,this.dataMinTime,this.dataMaxTime,this.fpsController),this.inputController.attach(),this.updateCanvasSize(),this.resizeObserver=new ResizeObserver(()=>{this.updateCanvasSize(),this.fpsController.raise(N.Resize)}),this.resizeObserver.observe(n)}get width(){return this.canvasWidth}get height(){return this.canvasHeight}syncCanvasSize(){let e=Math.max(1,window.devicePixelRatio),t=Math.floor(this.targetCanvas.clientWidth*e),n=Math.floor(this.targetCanvas.clientHeight*e);return this.canvasWidth=t,this.canvasHeight=n,this.targetCanvas.width!==t||this.targetCanvas.height!==n?(this.targetCanvas.width=t,this.targetCanvas.height=n,!0):!1}update(){this.updateCanvasSize();let e=this.viewport.targetTimeStart-this.viewport.viewTimeStart,t=this.viewport.targetTimeEnd-this.viewport.viewTimeEnd,n=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*ie;Math.abs(e)>n||Math.abs(t)>n?(this.viewport.viewTimeStart+=e*re,this.viewport.viewTimeEnd+=t*re,this.fpsController.raise(N.ZoomAnimation)):(this.viewport.viewTimeStart=this.viewport.targetTimeStart,this.viewport.viewTimeEnd=this.viewport.targetTimeEnd)}prepareDrawCommands(){let e=Q(this.viewport.viewTimeStart,this.viewport.viewTimeEnd),t=this.dataPipelines.map(t=>t.ensureBlocksForViewport(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,e));if(this.getLoadingRegions().length>0&&this.fpsController.raise(N.ZoomAnimation),!t.some(e=>e.reduce((e,t)=>e+t.pointCount,0)>=cn)&&this.getLoadingRegions().length===0)return null;for(let e of t)for(let t of e)this.allocator.touch(t.slot);let n=1/0,r=-1/0;for(let e of t)for(let t of e){let e=Gt(t.pointTimes,t.pointValues,this.viewport.viewTimeStart,this.viewport.viewTimeEnd);e!==void 0&&(n=Math.min(n,e[0]),r=Math.max(r,e[1]))}if(n<r){let[e,t]=Wt(n,r);this.viewport.viewValueMin=e,this.viewport.viewValueMax=t}let i=this.allocator.getCapacity();i!==this.lastTextureCapacity&&(this.lastTextureCapacity=i,this.rebuildLayerBindGroups()),this.seriesManager.writeAllUniforms(t,this.canvasWidth,this.canvasHeight,this.viewport.viewTimeStart,this.viewport.viewTimeEnd,this.viewport.viewValueMin,this.viewport.viewValueMax);let a=Math.max(1,window.devicePixelRatio);return{x:Math.floor(10*a),y:Math.floor(10*a),width:Math.max(0,this.canvasWidth-Math.floor(20*a)),height:Math.max(0,this.canvasHeight-Math.floor(20*a))}}renderCanvasAxes(){let{viewTimeStart:e,viewTimeEnd:t,viewValueMin:n,viewValueMax:r}=this.viewport,i=Math.max(1,window.devicePixelRatio),a=this.target2dContext,o=10*i,s=10*i,c=this.canvasWidth-20*i,l=this.canvasHeight-20*i,u=o+c,d=s+l;if(c<=0||l<=0)return;let f=11*i,p=5*i,m=3*i,h=2*i,g=fn*i,_=mn*i,v=hn*i,y=18*i,b=18*i,x=f*pn;a.strokeStyle=k,a.lineWidth=i,a.beginPath(),a.moveTo(o,s),a.lineTo(o,d),a.lineTo(u,d),a.stroke(),a.font=`${f}px ${se}`;let S=t-e,C=r-n,w=Xe(e,t,Q(e,t),c/i);for(let t of w){let n=o+(t.position-e)/S*c;if(n<o||n>u)continue;a.strokeStyle=k,a.lineWidth=i,a.beginPath(),a.moveTo(n,d),a.lineTo(n,d-p),a.stroke();let r=t.label.length*x;if(n-r/2-m<o+y)continue;let s=d-p-_;a.fillStyle=ae,a.beginPath(),a.roundRect(n-r/2-m,s-f+h,r+m*2,f+h*2,g),a.fill(),a.fillStyle=O,a.textAlign=`center`,a.textBaseline=`alphabetic`,a.fillText(t.label,n,s)}let T=rt(n,r,l/i);for(let e of T){let t=d-(e.position-n)/C*l;if(t<s||t>d)continue;a.strokeStyle=k,a.lineWidth=i,a.beginPath(),a.moveTo(o,t),a.lineTo(o+p,t),a.stroke();let r=o+p+v,c=t+f/3;if(c+h>d-b)continue;let u=e.label.length*x;a.fillStyle=ae,a.beginPath(),a.roundRect(r-m,c-f+h,u+m*2,f+h*2,g),a.fill(),a.fillStyle=O,a.textAlign=`start`,a.textBaseline=`alphabetic`,a.fillText(e.label,r,c)}}renderCanvasGrid(){let{viewTimeStart:e,viewTimeEnd:t,viewValueMin:n,viewValueMax:r}=this.viewport,i=Math.max(1,window.devicePixelRatio),a=this.target2dContext,o=10*i,s=10*i,c=this.canvasWidth-20*i,l=this.canvasHeight-20*i,u=o+c,d=s+l;if(c<=0||l<=0)return;a.fillStyle=an,a.fillRect(0,0,this.canvasWidth,this.canvasHeight);let f=t-e,p=r-n;a.strokeStyle=oe,a.lineWidth=i*.5,a.setLineDash([10*i,10*i]),a.beginPath();let m=Xe(e,t,Q(e,t),c/i);for(let t of m){let n=o+(t.position-e)/f*c;n<o||n>u||(a.moveTo(n,s),a.lineTo(n,d))}let h=rt(n,r,l/i);for(let e of h){let t=d-(e.position-n)/p*l;t<s||t>d||(a.moveTo(o,t),a.lineTo(u,t))}a.stroke(),a.setLineDash([])}getLoadingRegions(){let e=[];for(let t of this.dataPipelines)e.push(...t.getLoadingRegions());return e}getViewport(){return{timeStart:this.viewport.viewTimeStart,timeEnd:this.viewport.viewTimeEnd}}dispose(){this.resizeObserver.disconnect(),this.inputController.detach(),this.seriesManager.dispose(),this.allocator.dispose(),this.fpsController.dispose()}rebuildLayerBindGroups(){this.seriesManager.updateBindGroups(this.allocator.createView())}updateCanvasSize(){let e=Math.max(1,window.devicePixelRatio),t=Math.floor(this.targetCanvas.clientWidth*e),n=this.canvasWidth;if(this.canvasWidth=t,this.canvasHeight=Math.floor(this.targetCanvas.clientHeight*e),n>0&&t!==n){let e=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*(t/n),r=(this.viewport.viewTimeStart+this.viewport.viewTimeEnd)/2;this.viewport.viewTimeStart=r-e/2,this.viewport.viewTimeEnd=r+e/2}}},_n=(0,h.memo)(({initialTimeStart:e,initialTimeEnd:t,chartSeed:n,seriesConfigs:i})=>{let a=(0,h.useRef)(null),o=Re();return(0,h.useEffect)(()=>{if(r(o)||r(a.current))return;let s=new gn(o,i,a.current,e,t,n);return o.registerChart(s)},[o,e,t,n,i]),(0,M.jsx)(`div`,{className:`relative h-full w-full bg-[#1a1a1a]`,children:(0,M.jsx)(`canvas`,{ref:a,className:`absolute inset-0 h-full w-full`})})}),vn=110,yn=105,bn=100,xn=95,Sn=x(.9,.2,.2,1),Cn=x(1,.6,.1,1),wn=x(.2,.8,.3,1),Tn=x(.2,.5,.9,1),En=x(.7,.7,.7,1),Dn=x(0,.5,1,1),On=10,kn=.6,An=x(1,.6,.1,1),jn=2,Mn=4,Nn=6,Pn=8,Fn=10;function In(e){return e>vn?Fn:e>yn?Pn:e>bn?Nn:e>xn?Mn:jn}function Ln(e){return e>vn?Sn:e>yn?Cn:e>bn?En:e>xn?wn:Tn}var Rn=[[{chartType:j.Line,seedSuffix:``,colorFn:()=>Dn,sizeFn:()=>On},{chartType:j.Candlestick,seedSuffix:`-series-2`,colorFn:(e,t,n)=>{let r=S(n[t].color);return x(r.r,r.g,r.b,kn)}}],[{chartType:j.Candlestick,seedSuffix:``}],[{chartType:j.Line,seedSuffix:``,colorFn:()=>An,sizeFn:e=>In(e)}],[{chartType:j.Rhombus,seedSuffix:``,colorFn:e=>Ln(e)}]],zn=(0,h.memo)(()=>{let e=Re(),t=c(t=>{e&&(e.debugMode=t)}),n=c(t=>{e&&(e.instantLoad=t)});return(0,M.jsxs)(`div`,{className:`${m.fixedContainer} relative grid grid-cols-2 grid-rows-2`,children:[(0,M.jsx)(_e,{renderer:e,onDebugChange:t,onInstantLoadChange:n}),fe.map((e,t)=>(0,M.jsx)(_n,{initialTimeStart:w+e[0],initialTimeEnd:w+e[1],chartSeed:`chart-${t}`,seriesConfigs:Rn[t]},`${e[0]}-${e[1]}`))]})}),Bn=(0,h.memo)(()=>(0,M.jsx)(d,{className:`h-full w-full`,children:(0,M.jsx)(ve,{children:(0,M.jsx)(ze,{children:(0,M.jsx)(zn,{})})})}));export{Bn as Timeseries};