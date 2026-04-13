const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/c-C14G9XZs.js","assets/c-BlVx34DW.js"])))=>i.map(i=>d[i]);
import{r as e,t}from"./c-BlVx34DW.js";import{F as n,I as r,N as i,P as a,Z as o,k as s,t as c}from"./c-CE-6D_Ho.js";import{d as l,lt as u}from"./c-C5H0VhIF.js";import{n as d,t as f}from"./c-Dhbp9WuA.js";import{t as p}from"./e-kkjHX3gK.js";import{t as m}from"./c-79FAfWPB.js";import{n as h,t as g}from"./c-Br0-WPhW.js";var _=e(n(),1),v=255,y=255,b=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),x=new Float32Array(b),S=new Uint32Array(b);function C(e,t,n,r){let i=Math.round(r*y)&v,a=Math.round(e*y)&v,o=Math.round(t*y)&v,s=Math.min(Math.round(n*y)&v,126);return S[0]=i|a<<8|o<<16|s<<24,x[0]}function w(e){x[0]=e;let t=S[0];return{a:(t&v)/y,r:(t>>8&v)/y,g:(t>>16&v)/y,b:(t>>24&v)/y}}var T=2048,E=1767225600,ee=.5,te=1e3,ne=1e3,re=.7,ie=1.3,ae=.18,oe=.005,D=365*24*3600,se=`#ccc`,ce=`rgba(50, 50, 50, 0.75)`,le=`#aaa`,ue=`#444`,de=`monospace`,fe=1024,pe=2160*3600,me=720*3600,he=168*3600,ge=[[0,D],[D/2-pe/2,D/2+pe/2],[D/2-me/2,D/2+me/2],[D/2-he/2,D/2+he/2]],O=function(e){return e[e.Hour1=3600]=`Hour1`,e[e.Hour12=43200]=`Hour12`,e[e.Day1=86400]=`Day1`,e[e.Day4=345600]=`Day4`,e[e.Day16=1382400]=`Day16`,e[e.Day64=5529600]=`Day64`,e[e.Day256=22118400]=`Day256`,e}({}),k=function(e){return e[e.Line=0]=`Line`,e[e.Candlestick=1]=`Candlestick`,e[e.Rhombus=2]=`Rhombus`,e}({}),_e=c({en:{debugOverlay:{debug:`Debug`,loadingDelay:`Loading delay`}},ru:{debugOverlay:{debug:`Отладка`,loadingDelay:`Задержка загрузки`}}}),A=a(),ve=250,ye=window.location.hostname.endsWith(`github.io`),be=`relative h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 transition-colors duration-200 checked:bg-brand-500`,xe=`pointer-events-none absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-3`,Se=(0,_.memo)(({renderer:e})=>{let[t,n]=(0,_.useState)(0),[r,i]=(0,_.useState)(!1),[a,o]=(0,_.useState)(!0);(0,_.useEffect)(()=>{if(e===null)return;let t=setInterval(()=>{n(e.renderFps),i(e.debugMode),o(e.instantLoad)},ve);return()=>clearInterval(t)},[e]);let s=l(()=>{e!==null&&(e.debugMode=!e.debugMode)}),c=l(()=>{e!==null&&(e.instantLoad=!e.instantLoad)});return(0,A.jsxs)(`div`,{className:`pointer-events-auto absolute top-1 right-1 z-10 flex select-none flex-col items-center gap-2 rounded bg-[#1a1a40]/80 px-3 py-2 font-mono text-xs text-white`,children:[(0,A.jsxs)(`span`,{className:`tabular-nums`,children:[t,` fps`]}),(0,A.jsxs)(`div`,{className:`flex w-full flex-col gap-1.5`,children:[!ye&&(0,A.jsxs)(`label`,{className:`flex cursor-pointer items-center justify-between gap-2`,children:[(0,A.jsx)(`span`,{children:_e.debugOverlay.debug}),(0,A.jsxs)(`span`,{className:`relative inline-flex items-center`,children:[(0,A.jsx)(`input`,{type:`checkbox`,checked:r,onChange:s,className:`peer ${be}`}),(0,A.jsx)(`span`,{className:xe})]})]}),(0,A.jsxs)(`label`,{className:`flex cursor-pointer items-center justify-between gap-2`,children:[(0,A.jsx)(`span`,{children:_e.debugOverlay.loadingDelay}),(0,A.jsxs)(`span`,{className:`relative inline-flex items-center`,children:[(0,A.jsx)(`input`,{type:`checkbox`,checked:!a,onChange:c,className:`peer ${be}`}),(0,A.jsx)(`span`,{className:xe})]})]})]})]})}),Ce=(0,_.memo)(({children:e})=>{let[t,n]=(0,_.useState)(!1),i=(0,_.useRef)(null);(0,_.useEffect)(()=>{if(r(screen.orientation)||!o(screen.orientation.lock))return;function e(){n(screen.orientation.type.startsWith(`portrait`)&&!document.fullscreenElement)}return e(),screen.orientation.addEventListener(`change`,e),document.addEventListener(`fullscreenchange`,e),()=>{screen.orientation.removeEventListener(`change`,e),document.removeEventListener(`fullscreenchange`,e);let t=i.current;r(t)||(screen.orientation.unlock(),!t.wasFullscreen&&document.fullscreenElement&&document.exitFullscreen().catch(()=>{}),i.current=null)}},[]);let a=l(async()=>{i.current={wasFullscreen:!!document.fullscreenElement,previousOrientation:screen.orientation.type};try{await document.documentElement.requestFullscreen(),await screen.orientation?.lock?.(`landscape`)}catch{}});return(0,A.jsxs)(`div`,{className:`relative h-full w-full`,children:[e,t&&(0,A.jsx)(`div`,{className:`absolute inset-0 z-20 flex items-center justify-center`,children:(0,A.jsx)(`button`,{type:`button`,onClick:a,className:`flex h-24 w-24 items-center justify-center rounded-full bg-brand-500/80 text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95`,children:(0,A.jsx)(p,{className:`h-14 w-14`})})})]})}),j=function(e){return e[e.Idle=1]=`Idle`,e[e.Resize=60]=`Resize`,e[e.ZoomAnimation=60]=`ZoomAnimation`,e[e.Interaction=60]=`Interaction`,e}({}),we=500,Te=class{activeLevels=new Map;fallbackFps;constructor(e=j.Idle){this.fallbackFps=e}raise(e){let t=this.activeLevels.get(e);t!==void 0&&clearTimeout(t);let n=setTimeout(()=>{this.activeLevels.delete(e)},we);this.activeLevels.set(e,n)}getFrameIntervalMs(){return ne/this.getCurrentFps()}getCurrentFps(){if(this.activeLevels.size===0)return this.fallbackFps;let e=0;for(let t of this.activeLevels.keys())t>e&&(e=t);return e}dispose(){for(let e of this.activeLevels.values())clearTimeout(e);this.activeLevels.clear()}},Ee=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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
`,M=`struct Uniforms {
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
`,De=`// Debug shader: draws vertical lines at block boundaries.
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
`,Oe=`struct VSOut {
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
`,ke=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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
`,Ae=17,je=class{available=[];acquire(e,t,n,r){let i=this.available.findIndex(e=>e.width===t&&e.height===n);if(i!==-1){let[e]=this.available.splice(i,1);return e}return e.createTexture({size:[t,n],format:r,usage:Ae})}release(e){this.available.push(e)}dispose(){for(let e of this.available)e.destroy();this.available.length=0}},Me=M+Oe,Ne=M+Ee,Pe=M+ke,Fe=M+De,Ie=2,Le=1e3,Re=250,ze=5,Be=`rgba(100, 160, 255, 0.6)`,Ve=`rgba(30, 80, 180, 0.8)`,He=1200;async function Ue(){i(!r(navigator.gpu),`WebGPU is not supported`);let e=await navigator.gpu.requestAdapter();i(!r(e),`WebGPU adapter not available`);let t=await e.requestDevice(),n=new OffscreenCanvas(fe,768),a=n.getContext(`webgpu`);i(!r(a),`Failed to get WebGPU context on OffscreenCanvas`);let o=navigator.gpu.getPreferredCanvasFormat();a.configure({device:t,format:o,alphaMode:`premultiplied`,usage:18});let s=t.createShaderModule({code:Me}),c=t.createShaderModule({code:Ne}),l=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]}),u={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},d=t.createPipelineLayout({bindGroupLayouts:[l]}),f=t.createRenderPipeline({layout:d,vertex:{module:s,entryPoint:`vs`},fragment:{module:s,entryPoint:`fs`,targets:[{format:o,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),p=t.createRenderPipeline({layout:d,vertex:{module:c,entryPoint:`vsCandlestick`},fragment:{module:c,entryPoint:`fsCandlestick`,targets:[{format:o,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),m=t.createShaderModule({code:Pe}),h=t.createRenderPipeline({layout:d,vertex:{module:m,entryPoint:`vsRhombus`},fragment:{module:m,entryPoint:`fsRhombus`,targets:[{format:o,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),g=t.createShaderModule({code:Fe});return new We(t,o,l,f,p,h,t.createRenderPipeline({layout:d,vertex:{module:g,entryPoint:`vsDebugLines`},fragment:{module:g,entryPoint:`fsDebugLines`,targets:[{format:o,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),n,a)}var We=class{device;format;bindGroupLayout;linePipeline;candlestickPipeline;rhombusPipeline;debugPipeline;debugMode=!1;instantLoad=!0;renderFps=0;offscreen;ctx;charts=new Set;msaaManager=d(4);renderTargetPool=new je;animationFrameId=0;lastFrameTime=0;disposed=!1;needsReconfigure=!1;renderFrameTimes=[];lastFpsUpdate=0;constructor(e,t,n,r,i,a,o,s,c){this.device=e,this.format=t,this.bindGroupLayout=n,this.linePipeline=r,this.candlestickPipeline=i,this.rhombusPipeline=a,this.debugPipeline=o,this.offscreen=s,this.ctx=c}registerChart(e){return this.charts.add(e),this.charts.size===1&&this.startAnimationLoop(),()=>{this.charts.delete(e),e.dispose(),this.charts.size===0&&this.stopAnimationLoop()}}destroy(){if(!this.disposed){this.disposed=!0,this.stopAnimationLoop();for(let e of this.charts)e.dispose();this.charts.clear(),this.msaaManager.dispose(),this.renderTargetPool.dispose(),this.device.destroy()}}getMinFrameIntervalMs(){let e;for(let t of this.charts){let n=t.fpsController.getFrameIntervalMs();(r(e)||n<e)&&(e=n)}return e??1e3/j.Idle}startAnimationLoop(){if(this.disposed)return;let e=t=>{if(this.disposed)return;let n=this.getMinFrameIntervalMs();if(t-this.lastFrameTime<n-Ie){this.animationFrameId=requestAnimationFrame(e);return}this.lastFrameTime=t,this.trackRenderFps(t),this.renderAllCharts(),this.animationFrameId=requestAnimationFrame(e)};this.animationFrameId=requestAnimationFrame(e)}trackRenderFps(e){let t=Math.max(Le,this.getMinFrameIntervalMs()*3);this.renderFrameTimes.push(e);let n=e-t;for(;this.renderFrameTimes.length>0&&this.renderFrameTimes[0]<n;)this.renderFrameTimes.shift();if(e-this.lastFpsUpdate>=Re){this.lastFpsUpdate=e;let t=this.renderFrameTimes.length>1?this.renderFrameTimes[this.renderFrameTimes.length-1]-this.renderFrameTimes[0]:0;this.renderFps=t>0?Math.round((this.renderFrameTimes.length-1)/t*ne):0}}stopAnimationLoop(){cancelAnimationFrame(this.animationFrameId),this.animationFrameId=0}drawLoadingBars(e){let t=e.getLoadingRegions();if(t.length===0)return;let n=e.getViewport(),r=n.timeEnd-n.timeStart;if(r<=0)return;let i=e.target2dContext,a=e.width,o=e.height,s=ze*Math.max(1,window.devicePixelRatio),c=o-s,l=performance.now()%He/He;for(let e of t){let t=(e.timeStart-n.timeStart)/r,o=(e.timeEnd-n.timeStart)/r,u=Math.max(0,Math.floor(t*a)),d=Math.min(a,Math.ceil(o*a))-u;if(d<=0)continue;let f=s*2,p=c-f+l*f,m=i.createLinearGradient(0,p,0,p+f);m.addColorStop(0,Be),m.addColorStop(.5,Ve),m.addColorStop(1,Be),i.save(),i.beginPath(),i.rect(u,c,d,s),i.clip(),i.fillStyle=m,i.fillRect(u,p,d,f),i.restore()}}ensureMsaaView(e,t){return this.msaaManager.ensureView(this.device,this.format,e,t)}renderAllCharts(){for(let e of this.charts){e.update();let{width:t,height:n}=e;if(t===0||n===0)continue;let i=e.prepareDrawCommands();r(i)||(this.renderChart(e,i),e.renderCanvasAxes(),this.drawLoadingBars(e))}}renderChart(e,t){let{width:n,height:i}=e;(this.offscreen.width!==n||this.offscreen.height!==i||this.needsReconfigure)&&(this.offscreen.width=n,this.offscreen.height=i,this.ctx.configure({device:this.device,format:this.format,alphaMode:`premultiplied`,usage:18}),this.needsReconfigure=!1);let a=this.renderTargetPool.acquire(this.device,n,i,this.format),o=this.ensureMsaaView(n,i);if(r(o)){this.renderTargetPool.release(a);return}let s=this.device.createCommandEncoder(),c=s.beginRenderPass({colorAttachments:[{view:o,resolveTarget:a.createView(),loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});e.seriesManager.renderAll(c,t),this.debugMode&&e.seriesManager.renderDebug(c,this.debugPipeline,t),c.end();let l=this.ctx.getCurrentTexture();s.copyTextureToTexture({texture:a},{texture:l},[n,i]),this.device.queue.submit([s.finish()]),this.renderTargetPool.release(a),e.syncCanvasSize();let u=this.offscreen.transferToImageBitmap();this.needsReconfigure=!0,e.renderCanvasGrid(),e.target2dContext.drawImage(u,0,0),u.close()}},Ge=(0,_.createContext)(null);function Ke(){return(0,_.useContext)(Ge)}var qe=(0,_.memo)(({children:e})=>{let[t,n]=(0,_.useState)(null);return(0,_.useEffect)(()=>{let e=!1,t;return Ue().then(r=>{if(e){r.destroy();return}t=r,n(r)}),()=>{e=!0,r(t)||t.destroy()}},[]),(0,A.jsx)(Ge,{value:t,children:e})}),Je=e(t(((e,t)=>{(function(n,r){typeof e==`object`?t.exports=r():typeof define==`function`&&define.amd?define(r):n.Alea=r()})(e,function(){return e.importState=function(t){var n=new e;return n.importState(t),n},e;function e(){return function(e){var n=0,r=0,i=0,a=1;e.length==0&&(e=[+new Date]);var o=t();n=o(` `),r=o(` `),i=o(` `);for(var s=0;s<e.length;s++)n-=o(e[s]),n<0&&(n+=1),r-=o(e[s]),r<0&&(r+=1),i-=o(e[s]),i<0&&(i+=1);o=null;var c=function(){var e=2091639*n+a*23283064365386963e-26;return n=r,r=i,i=e-(a=e|0)};return c.next=c,c.uint32=function(){return c()*4294967296},c.fract53=function(){return c()+(c()*2097152|0)*11102230246251565e-32},c.version=`Alea 0.9`,c.args=e,c.exportState=function(){return[n,r,i,a]},c.importState=function(e){n=+e[0]||0,r=+e[1]||0,i=+e[2]||0,a=+e[3]||0},c}(Array.prototype.slice.call(arguments))}function t(){var e=4022871197,t=function(t){t=t.toString();for(var n=0;n<t.length;n++){e+=t.charCodeAt(n);var r=.02519603282416938*e;e=r>>>0,r-=e,r*=e,e=r>>>0,r-=e,e+=r*4294967296}return(e>>>0)*23283064365386963e-26};return t.version=`Mash 0.9`,t}})}))(),1),Ye=Math.sqrt(3),Xe=Math.sqrt(5),Ze=.5*(Ye-1),N=(3-Ye)/6;(Xe-1)/4,(5-Xe)/20;var Qe=e=>Math.floor(e)|0,$e=new Float64Array([1,1,-1,1,1,-1,-1,-1,1,0,-1,0,1,0,-1,0,0,1,0,-1,0,1,0,-1]);function et(e=Math.random){let t=tt(e),n=new Float64Array(t).map(e=>$e[e%12*2]),r=new Float64Array(t).map(e=>$e[e%12*2+1]);return function(e,i){let a=0,o=0,s=0,c=(e+i)*Ze,l=Qe(e+c),u=Qe(i+c),d=(l+u)*N,f=l-d,p=u-d,m=e-f,h=i-p,g,_;m>h?(g=1,_=0):(g=0,_=1);let v=m-g+N,y=h-_+N,b=m-1+2*N,x=h-1+2*N,S=l&255,C=u&255,w=.5-m*m-h*h;if(w>=0){let e=S+t[C],i=n[e],o=r[e];w*=w,a=w*w*(i*m+o*h)}let T=.5-v*v-y*y;if(T>=0){let e=S+g+t[C+_],i=n[e],a=r[e];T*=T,o=T*T*(i*v+a*y)}let E=.5-b*b-x*x;if(E>=0){let e=S+1+t[C+1],i=n[e],a=r[e];E*=E,s=E*E*(i*b+a*x)}return 70*(a+o+s)}}function tt(e){let t=new Uint8Array(512);for(let e=0;e<512/2;e++)t[e]=e;for(let n=0;n<512/2-1;n++){let r=n+~~(e()*(256-n)),i=t[n];t[n]=t[r],t[r]=i}for(let e=256;e<512;e++)t[e]=t[e-256];return t}var P=180,nt={[O.Hour1]:P,[O.Hour12]:P,[O.Day1]:P,[O.Day4]:P,[O.Day16]:P,[O.Day64]:P,[O.Day256]:P},rt=1,it=10-rt,at=7,ot=.5;function st(e){return(e-E)/D}function ct(e){let t=et((0,Je.default)(e));return e=>{let n=st(e),r=0,i=15,a=4;for(let e=0;e<6;e++)r+=i*t(n*a,e*te),i*=ee,a*=2;return 100+r}}var lt=C(.2,.8,.3,1),ut=C(.9,.2,.2,1);function dt(e,t){let n=e(st(t)*4,at*te);return rt+Math.max(0,Math.min(1,(n+1)*ot))*it}function ft(e,t,n,r){let i=nt[n],a=(t-e)/(i-1),o=ct(r),s=et((0,Je.default)(`${r}-size`)),c=Array(i),l=Array(i);for(let t=0;t<i;t++)c[t]=e+t*a,l[t]=o(c[t]);let u=Array(i);for(let e=0;e<i;e++){let t=l[Math.min(e+1,i-1)]>=l[e];u[e]={time:c[e],value:l[e],size:dt(s,c[e]),color:t?lt:ut}}return u}var pt=3;function mt(e,t,n){let r=new ArrayBuffer(e.length*4*Float32Array.BYTES_PER_ELEMENT),i=new Float32Array(r),a=new Uint32Array(r);for(let r=0;r<e.length;r++){let o=r*4,s=e[r];i[o]=s.time-t,i[o+1]=s.value-n,i[o+2]=s.size,a[o+pt]=vt(s.color)}return i}var ht=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),gt=new Float32Array(ht),_t=new Uint32Array(ht);function vt(e){return gt[0]=e,_t[0]}var yt=1;function bt(e,t,n,r=yt){let i=n,a=Math.floor(e/i)*i-r*i,o=Math.ceil(t/i)*i+r*i,s=Math.round((o-a)/i),c=Array(s);for(let e=0;e<s;e++){let t=a+e*i;c[e]={start:t,end:t+i}}return c}var xt=1e3,St=class{pendingBlocks=new Map;requestCounter=0;constructor(e,t,n,r,i,a,o,s){this.allocator=e,this.registry=t,this.seed=n,this.chartType=r,this.colorFn=i,this.sizeFn=a,this.isDebug=o,this.isInstantLoad=s}ensureBlocksForViewport(e,t,n){let r=bt(e,t,n),i=[],a=performance.now(),o=new Set;for(let e of r){let t=`${n}:${e.start}:${e.end}`;o.add(t);let r=this.registry.findCovering(n,e.start,e.end,this.chartType);if(r!==void 0){this.allocator.touch(r.slot),i.push(r),this.pendingBlocks.delete(t);continue}let s=this.pendingBlocks.get(t);if(s===void 0){this.requestCounter++;let r=this.requestCounter;this.isDebug?.()&&console.log(`>>> [#${r}] REQUEST ${k[this.chartType]} [${e.start} → ${e.end}] scale=${n}`),this.pendingBlocks.set(t,{periodStart:e.start,periodEnd:e.end,scale:n,requestTime:a});continue}if(this.isInstantLoad?.()===!0||a-s.requestTime>=xt){this.pendingBlocks.delete(t);let r=this.generateBlocksForPeriod(e.start,e.end,n);if(i.push(...r),this.isDebug?.()){let t=r.reduce((e,t)=>e+t.pointCount,0);console.log(`>>> [#${this.requestCounter}] RESPONSE ${k[this.chartType]} [${e.start} → ${e.end}] ${r.length} block(s), ${t} points`)}}}for(let e of this.pendingBlocks.keys())o.has(e)||this.pendingBlocks.delete(e);return i.sort((e,t)=>e.timeStart-t.timeStart)}getLoadingRegions(){let e=performance.now(),t=[];for(let n of this.pendingBlocks.values()){let r=e-n.requestTime,i=Math.min(1,r/xt);t.push({timeStart:n.periodStart,timeEnd:n.periodEnd,progress:i})}return t}generateBlocksForPeriod(e,t,n){let r=ft(e,t,n,this.seed);if(r.length===0)return[];if(this.colorFn!==void 0||this.sizeFn!==void 0)for(let e=0;e<r.length;e++){let t=r[e];r[e]={...t,color:this.colorFn===void 0?t.color:this.colorFn(t.value,e,r),size:this.sizeFn===void 0?t.size:this.sizeFn(t.value,e,r)}}let i=[];if(r.length<=256){let a=this.createBlock(r,e,t,n);a!==null&&i.push(a)}else{let e=Math.ceil(r.length/256);for(let t=0;t<e;t++){let e=t*256,a=Math.min(e+256,r.length),o=r.slice(e,a),s=o[0].time,c=o[o.length-1].time,l=this.createBlock(o,s,c,n);l!==null&&i.push(l)}}return i}createBlock(e,t,n,r){let i=this.allocator.allocateSlot();if(i===null)return null;let a=e[0].time,o=e[0].value,s=mt(e,a,o);this.allocator.writeSlotData(i,s,e.length);let c=new Float64Array(e.length),l=new Float64Array(e.length);for(let t=0;t<e.length;t++)c[t]=e[t].time,l[t]=e[t].value;let u={minX:0,maxX:0,minY:0,maxY:0,timeStart:t,timeEnd:n,scale:r,chartType:this.chartType,slot:i,pointCount:e.length,baseTime:a,baseValue:o,pointTimes:c,pointValues:l};return this.registry.insert(u),u}};function Ct(e,t,n=0,r=e.length-1,i=wt){for(;r>n;){if(r-n>600){let a=r-n+1,o=t-n+1,s=Math.log(a),c=.5*Math.exp(2*s/3),l=.5*Math.sqrt(s*c*(a-c)/a)*(o-a/2<0?-1:1);Ct(e,t,Math.max(n,Math.floor(t-o*c/a+l)),Math.min(r,Math.floor(t+(a-o)*c/a+l)),i)}let a=e[t],o=n,s=r;for(F(e,n,t),i(e[r],a)>0&&F(e,n,r);o<s;){for(F(e,o,s),o++,s--;i(e[o],a)<0;)o++;for(;i(e[s],a)>0;)s--}i(e[n],a)===0?F(e,n,s):(s++,F(e,s,r)),s<=t&&(n=s+1),t<=s&&(r=s-1)}}function F(e,t,n){let r=e[t];e[t]=e[n],e[n]=r}function wt(e,t){return e<t?-1:e>t?1:0}var Tt=class{constructor(e=9){this._maxEntries=Math.max(4,e),this._minEntries=Math.max(2,Math.ceil(this._maxEntries*.4)),this.clear()}all(){return this._all(this.data,[])}search(e){let t=this.data,n=[];if(!H(e,t))return n;let r=this.toBBox,i=[];for(;t;){for(let a=0;a<t.children.length;a++){let o=t.children[a],s=t.leaf?r(o):o;H(e,s)&&(t.leaf?n.push(o):V(e,s)?this._all(o,n):i.push(o))}t=i.pop()}return n}collides(e){let t=this.data;if(!H(e,t))return!1;let n=[];for(;t;){for(let r=0;r<t.children.length;r++){let i=t.children[r],a=t.leaf?this.toBBox(i):i;if(H(e,a)){if(t.leaf||V(e,a))return!0;n.push(i)}}t=n.pop()}return!1}load(e){if(!(e&&e.length))return this;if(e.length<this._minEntries){for(let t=0;t<e.length;t++)this.insert(e[t]);return this}let t=this._build(e.slice(),0,e.length-1,0);if(!this.data.children.length)this.data=t;else if(this.data.height===t.height)this._splitRoot(this.data,t);else{if(this.data.height<t.height){let e=this.data;this.data=t,t=e}this._insert(t,this.data.height-t.height-1,!0)}return this}insert(e){return e&&this._insert(e,this.data.height-1),this}clear(){return this.data=U([]),this}remove(e,t){if(!e)return this;let n=this.data,r=this.toBBox(e),i=[],a=[],o,s,c;for(;n||i.length;){if(n||(n=i.pop(),s=i[i.length-1],o=a.pop(),c=!0),n.leaf){let r=Et(e,n.children,t);if(r!==-1)return n.children.splice(r,1),i.push(n),this._condense(i),this}!c&&!n.leaf&&V(n,r)?(i.push(n),a.push(o),o=0,s=n,n=n.children[0]):s?(o++,n=s.children[o],c=!1):n=null}return this}toBBox(e){return e}compareMinX(e,t){return e.minX-t.minX}compareMinY(e,t){return e.minY-t.minY}toJSON(){return this.data}fromJSON(e){return this.data=e,this}_all(e,t){let n=[];for(;e;)e.leaf?t.push(...e.children):n.push(...e.children),e=n.pop();return t}_build(e,t,n,r){let i=n-t+1,a=this._maxEntries,o;if(i<=a)return o=U(e.slice(t,n+1)),I(o,this.toBBox),o;r||(r=Math.ceil(Math.log(i)/Math.log(a)),a=Math.ceil(i/a**(r-1))),o=U([]),o.leaf=!1,o.height=r;let s=Math.ceil(i/a),c=s*Math.ceil(Math.sqrt(a));jt(e,t,n,c,this.compareMinX);for(let i=t;i<=n;i+=c){let t=Math.min(i+c-1,n);jt(e,i,t,s,this.compareMinY);for(let n=i;n<=t;n+=s){let i=Math.min(n+s-1,t);o.children.push(this._build(e,n,i,r-1))}}return I(o,this.toBBox),o}_chooseSubtree(e,t,n,r){for(;r.push(t),!(t.leaf||r.length-1===n);){let n=1/0,r=1/0,i;for(let a=0;a<t.children.length;a++){let o=t.children[a],s=z(o),c=kt(e,o)-s;c<r?(r=c,n=s<n?s:n,i=o):c===r&&s<n&&(n=s,i=o)}t=i||t.children[0]}return t}_insert(e,t,n){let r=n?e:this.toBBox(e),i=[],a=this._chooseSubtree(r,this.data,t,i);for(a.children.push(e),R(a,r);t>=0&&i[t].children.length>this._maxEntries;)this._split(i,t),t--;this._adjustParentBBoxes(r,i,t)}_split(e,t){let n=e[t],r=n.children.length,i=this._minEntries;this._chooseSplitAxis(n,i,r);let a=this._chooseSplitIndex(n,i,r),o=U(n.children.splice(a,n.children.length-a));o.height=n.height,o.leaf=n.leaf,I(n,this.toBBox),I(o,this.toBBox),t?e[t-1].children.push(o):this._splitRoot(n,o)}_splitRoot(e,t){this.data=U([e,t]),this.data.height=e.height+1,this.data.leaf=!1,I(this.data,this.toBBox)}_chooseSplitIndex(e,t,n){let r,i=1/0,a=1/0;for(let o=t;o<=n-t;o++){let t=L(e,0,o,this.toBBox),s=L(e,o,n,this.toBBox),c=At(t,s),l=z(t)+z(s);c<i?(i=c,r=o,a=l<a?l:a):c===i&&l<a&&(a=l,r=o)}return r||n-t}_chooseSplitAxis(e,t,n){let r=e.leaf?this.compareMinX:Dt,i=e.leaf?this.compareMinY:Ot;this._allDistMargin(e,t,n,r)<this._allDistMargin(e,t,n,i)&&e.children.sort(r)}_allDistMargin(e,t,n,r){e.children.sort(r);let i=this.toBBox,a=L(e,0,t,i),o=L(e,n-t,n,i),s=B(a)+B(o);for(let r=t;r<n-t;r++){let t=e.children[r];R(a,e.leaf?i(t):t),s+=B(a)}for(let r=n-t-1;r>=t;r--){let t=e.children[r];R(o,e.leaf?i(t):t),s+=B(o)}return s}_adjustParentBBoxes(e,t,n){for(let r=n;r>=0;r--)R(t[r],e)}_condense(e){for(let t=e.length-1,n;t>=0;t--)e[t].children.length===0?t>0?(n=e[t-1].children,n.splice(n.indexOf(e[t]),1)):this.clear():I(e[t],this.toBBox)}};function Et(e,t,n){if(!n)return t.indexOf(e);for(let r=0;r<t.length;r++)if(n(e,t[r]))return r;return-1}function I(e,t){L(e,0,e.children.length,t,e)}function L(e,t,n,r,i){i||=U(null),i.minX=1/0,i.minY=1/0,i.maxX=-1/0,i.maxY=-1/0;for(let a=t;a<n;a++){let t=e.children[a];R(i,e.leaf?r(t):t)}return i}function R(e,t){return e.minX=Math.min(e.minX,t.minX),e.minY=Math.min(e.minY,t.minY),e.maxX=Math.max(e.maxX,t.maxX),e.maxY=Math.max(e.maxY,t.maxY),e}function Dt(e,t){return e.minX-t.minX}function Ot(e,t){return e.minY-t.minY}function z(e){return(e.maxX-e.minX)*(e.maxY-e.minY)}function B(e){return e.maxX-e.minX+(e.maxY-e.minY)}function kt(e,t){return(Math.max(t.maxX,e.maxX)-Math.min(t.minX,e.minX))*(Math.max(t.maxY,e.maxY)-Math.min(t.minY,e.minY))}function At(e,t){let n=Math.max(e.minX,t.minX),r=Math.max(e.minY,t.minY),i=Math.min(e.maxX,t.maxX),a=Math.min(e.maxY,t.maxY);return Math.max(0,i-n)*Math.max(0,a-r)}function V(e,t){return e.minX<=t.minX&&e.minY<=t.minY&&t.maxX<=e.maxX&&t.maxY<=e.maxY}function H(e,t){return t.minX<=e.maxX&&t.minY<=e.maxY&&t.maxX>=e.minX&&t.maxY>=e.minY}function U(e){return{children:e,height:1,leaf:!0,minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0}}function jt(e,t,n,r,i){let a=[t,n];for(;a.length;){if(n=a.pop(),t=a.pop(),n-t<=r)continue;let o=t+Math.ceil((n-t)/r/2)*r;Ct(e,o,t,n,i),a.push(t,o,o,n)}}function W(e){return e.row*8+e.slotIndex}var Mt=class{tree=new Tt;slotMap=new Map;insert(e){e.minX=e.timeStart,e.maxX=e.timeEnd,e.minY=e.scale,e.maxY=e.scale,this.tree.insert(e),this.slotMap.set(W(e.slot),e)}remove(e){this.tree.remove(e),this.slotMap.delete(W(e.slot))}removeBySlot(e){let t=this.slotMap.get(W(e));t!==void 0&&this.remove(t)}queryVisible(e,t,n,r){let i=this.tree.search({minX:t,maxX:n,minY:e,maxY:e});return r===void 0?i:i.filter(e=>e.chartType===r)}findCovering(e,t,n,r){return this.tree.search({minX:t,maxX:n,minY:e,maxY:e}).find(e=>e.chartType===r&&e.timeStart<=t&&e.timeEnd>=n)}clear(){this.tree.clear(),this.slotMap.clear()}getEntryCount(){return this.slotMap.size}},Nt=[O.Hour1,O.Hour12,O.Day1,O.Day4,O.Day16,O.Day64,O.Day256];function Pt(e,t){let n=t-e;for(let e of Nt)if(n<=e)return e;return O.Day256}function G(e,t,n,r){let i=t-e;return i>=r-n?[n,r]:e<n?[n,n+i]:t>r?[r-i,r]:[e,t]}function Ft(e,t){let n=t-e,r=(n>0?n:Math.abs(e))*.1||1;return[e-r,t+r]}function It(e,t,n,r){let i=e.length;if(i===0)return;let a=0,o=i;for(;a<o;){let t=a+o>>1;e[t]<n?a=t+1:o=t}let s=a;for(a=s,o=i;a<o;){let t=a+o>>1;e[t]<=r?a=t+1:o=t}let c=a;if(s>=c)return;let l=1/0,u=-1/0;for(let e=s;e<c;e++){let n=t[e];n<l&&(l=n),n>u&&(u=n)}return[l,u]}function Lt(e,t,n,r){let i=n*((t-e)/r);return[e-i,t-i]}function Rt(e,t,n,r){let i=t-e,a=e+i*r,o=Math.max(i*n,60);return[a-o*r,a+o*(1-r)]}var zt=class{activePointers=new Map;lastPinchDistance=0;handlePointerDown;handlePointerMove;handlePointerUp;handlePointerCancel;handleWheel;constructor(e,t,n,r,i){this.viewport=e,this.canvas=t,this.dataMinTime=n,this.dataMaxTime=r,this.fpsController=i,this.handlePointerDown=e=>{this.activePointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),this.fpsController.raise(j.Interaction),this.activePointers.size===1?this.canvas.style.cursor=`grabbing`:this.activePointers.size===2&&(this.lastPinchDistance=this.getPointerDistance())},this.handlePointerMove=e=>{let t=this.activePointers.get(e.pointerId);if(t===void 0)return;if(this.activePointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),this.fpsController.raise(j.Interaction),this.activePointers.size===2){let e=this.getPointerDistance(),t=this.lastPinchDistance/e,n=this.getPointerCenter(),[r,i]=G(...Rt(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,t,n),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=r,this.viewport.targetTimeEnd=i,this.lastPinchDistance=e;return}if(this.activePointers.size!==1)return;let n=e.clientX-t.clientX,[r,i]=G(...Lt(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,n,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=r,this.viewport.viewTimeEnd=i,this.viewport.targetTimeStart=r,this.viewport.targetTimeEnd=i},this.handlePointerUp=e=>{this.activePointers.delete(e.pointerId),this.activePointers.size===0&&(this.canvas.style.cursor=`grab`)},this.handlePointerCancel=e=>{this.activePointers.delete(e.pointerId),this.activePointers.size===0&&(this.canvas.style.cursor=`grab`)},this.handleWheel=e=>{e.preventDefault();let t=this.canvas.getBoundingClientRect(),n=(e.clientX-t.left)/t.width,r=e.deltaY>0?ie:re,[i,a]=G(...Rt(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,r,n),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a,this.fpsController.raise(j.Interaction)}}get isInteracting(){return this.activePointers.size>0}attach(){this.canvas.addEventListener(`pointerdown`,this.handlePointerDown),this.canvas.addEventListener(`pointermove`,this.handlePointerMove),this.canvas.addEventListener(`pointerup`,this.handlePointerUp),this.canvas.addEventListener(`pointercancel`,this.handlePointerCancel),this.canvas.addEventListener(`pointerleave`,this.handlePointerUp),this.canvas.addEventListener(`wheel`,this.handleWheel,{passive:!1}),this.canvas.style.cursor=`grab`}detach(){this.canvas.removeEventListener(`pointerdown`,this.handlePointerDown),this.canvas.removeEventListener(`pointermove`,this.handlePointerMove),this.canvas.removeEventListener(`pointerup`,this.handlePointerUp),this.canvas.removeEventListener(`pointercancel`,this.handlePointerCancel),this.canvas.removeEventListener(`pointerleave`,this.handlePointerUp),this.canvas.removeEventListener(`wheel`,this.handleWheel)}getPointerDistance(){let e=[...this.activePointers.values()],t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}getPointerCenter(){let e=[...this.activePointers.values()],t=this.canvas.getBoundingClientRect();return((e[0].clientX+e[1].clientX)/2-t.left)/t.width}},Bt=4,Vt=Bt*Float32Array.BYTES_PER_ELEMENT,Ht=64,Ut=class{device;buffer;cpuBuffer;f32View;u32View;allocator;maxBlocks;constructor(e,t,n=Ht){this.device=e,this.allocator=t,this.maxBlocks=n;let r=n*Vt;this.buffer=e.createBuffer({size:r,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.cpuBuffer=new ArrayBuffer(r),this.f32View=new Float32Array(this.cpuBuffer),this.u32View=new Uint32Array(this.cpuBuffer)}writeDescriptors(e,t){let n=Math.min(e.length,this.maxBlocks);if(n===0)return{totalInstances:0,globalBaseTime:0,globalBaseValue:0};let r=e[0].baseTime,i=e[0].baseValue,a=0;for(let t=0;t<n;t++){let n=e[t],o=t*Bt,s=this.allocator.getTextureOffset(n.slot);this.u32View[o]=s,this.u32View[o+1]=n.pointCount,this.f32View[o+2]=n.baseTime-r,this.f32View[o+3]=n.baseValue-i,a+=n.pointCount}let o=n*Vt;return this.device.queue.writeBuffer(this.buffer,0,this.cpuBuffer,0,o),{totalInstances:t?Math.max(0,a-1):a,globalBaseTime:r,globalBaseValue:i}}getBuffer(){return this.buffer}getTextureWidth(){return T}dispose(){this.buffer.destroy()}},Wt=6,Gt=class{device;bindGroupLayout;uniformBuffer;uniformView;descriptorBuffer;currentBindGroup=null;currentInstanceCount=0;currentBlockCount=0;constructor(e,t){this.verticesPerInstance=e,this.needsStitching=t}init(e,t,n){this.device=e,this.bindGroupLayout=t,this.uniformView=h(g(M).uniforms.U),this.uniformBuffer=this.device.createBuffer({size:this.uniformView.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.descriptorBuffer=new Ut(e,n)}updateBindGroup(e){this.currentBindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:e},{binding:2,resource:{buffer:this.descriptorBuffer.getBuffer()}}]})}writeUniforms(e,t,n,r,i,a,o){if(e.length===0){this.currentInstanceCount=0,this.currentBlockCount=0;return}this.currentBlockCount=e.length;let{totalInstances:s,globalBaseTime:c,globalBaseValue:l}=this.descriptorBuffer.writeDescriptors(e,this.needsStitching);this.currentInstanceCount=s,this.uniformView.set({viewport:[t,n],timeRangeMin:r-c,timeRangeMax:i-c,valueRangeMin:a-l,valueRangeMax:o-l,textureWidth:T,lineWidth:Math.max(1,window.devicePixelRatio),blockCount:e.length}),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformView.arrayBuffer)}render(e,t,n){this.currentBindGroup===null||this.currentInstanceCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(this.verticesPerInstance,this.currentInstanceCount,0,0))}renderDebug(e,t,n){this.currentBindGroup===null||this.currentBlockCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(Wt,this.currentBlockCount,0,0))}get instanceCount(){return this.currentInstanceCount}get bindGroup(){return this.currentBindGroup}dispose(){this.uniformBuffer.destroy(),this.descriptorBuffer.dispose(),this.currentBindGroup=null}},Kt=class{entries=[];addSeries(e,t){this.entries.push({layer:e,pipeline:t})}initAll(e,t,n){for(let r of this.entries)r.layer.init(e,t,n)}updateBindGroups(e){for(let t of this.entries)t.layer.updateBindGroup(e)}writeAllUniforms(e,t,n,r,i,a,o){for(let s=0;s<this.entries.length;s++){let c=this.entries[s],l=e[s]??[];c.layer.writeUniforms(l,t,n,r,i,a,o)}}renderAll(e,t){for(let n of this.entries)n.layer.render(e,n.pipeline,t)}renderDebug(e,t,n){for(let r of this.entries)r.layer.renderDebug(e,t,n)}dispose(){for(let e of this.entries)e.layer.dispose()}},qt={hasSubscribers:!1},K=qt,q=qt;u(()=>import(`./c-C14G9XZs.js`).then(t=>e(t.t(),1)).then(e=>{K=e.channel(`lru-cache:metrics`),q=e.tracingChannel(`lru-cache`)}),__vite__mapDeps([0,1])).catch(()=>{});var J=()=>K.hasSubscribers||q.hasSubscribers,Jt=typeof performance==`object`&&performance&&typeof performance.now==`function`?performance:Date,Yt=new Set,Xt=typeof process==`object`&&process?process:{},Zt=(e,t,n,r)=>{typeof Xt.emitWarning==`function`?Xt.emitWarning(e,t,n,r):console.error(`[${n}] ${t}: ${e}`)},Qt=e=>!Yt.has(e),Y=e=>!!e&&e===Math.floor(e)&&e>0&&isFinite(e),$t=e=>Y(e)?e<=2**8?Uint8Array:e<=2**16?Uint16Array:e<=2**32?Uint32Array:e<=2**53-1?X:null:null,X=class extends Array{constructor(e){super(e),this.fill(0)}},en=class e{heap;length;static#e=!1;static create(t){let n=$t(t);if(!n)return[];e.#e=!0;let r=new e(t,n);return e.#e=!1,r}constructor(t,n){if(!e.#e)throw TypeError(`instantiate Stack using Stack.create(n)`);this.heap=new n(t),this.length=0}push(e){this.heap[this.length++]=e}pop(){return this.heap[--this.length]}},tn=class e{#e;#t;#n;#r;#i;#a;#o;#s;get perf(){return this.#s}ttl;ttlResolution;ttlAutopurge;updateAgeOnGet;updateAgeOnHas;allowStale;noDisposeOnSet;noUpdateTTL;maxEntrySize;sizeCalculation;noDeleteOnFetchRejection;noDeleteOnStaleGet;allowStaleOnFetchAbort;allowStaleOnFetchRejection;ignoreFetchAbort;#c;#l;#u;#d;#f;#p;#m;#h;#g;#_;#v;#y;#b;#x;#S;#C;#w;#T;#E;static unsafeExposeInternals(e){return{starts:e.#b,ttls:e.#x,autopurgeTimers:e.#S,sizes:e.#y,keyMap:e.#u,keyList:e.#d,valList:e.#f,next:e.#p,prev:e.#m,get head(){return e.#h},get tail(){return e.#g},free:e.#_,isBackgroundFetch:t=>e.#W(t),backgroundFetch:(t,n,r,i)=>e.#U(t,n,r,i),moveToTail:t=>e.#X(t),indexes:t=>e.#I(t),rindexes:t=>e.#L(t),isStale:t=>e.#j(t)}}get max(){return this.#e}get maxSize(){return this.#t}get calculatedSize(){return this.#l}get size(){return this.#c}get fetchMethod(){return this.#a}get memoMethod(){return this.#o}get dispose(){return this.#n}get onInsert(){return this.#r}get disposeAfter(){return this.#i}constructor(t){let{max:n=0,ttl:r,ttlResolution:i=1,ttlAutopurge:a,updateAgeOnGet:o,updateAgeOnHas:s,allowStale:c,dispose:l,onInsert:u,disposeAfter:d,noDisposeOnSet:f,noUpdateTTL:p,maxSize:m=0,maxEntrySize:h=0,sizeCalculation:g,fetchMethod:_,memoMethod:v,noDeleteOnFetchRejection:y,noDeleteOnStaleGet:b,allowStaleOnFetchRejection:x,allowStaleOnFetchAbort:S,ignoreFetchAbort:C,perf:w}=t;if(w!==void 0&&typeof w?.now!=`function`)throw TypeError(`perf option must have a now() method if specified`);if(this.#s=w??Jt,n!==0&&!Y(n))throw TypeError(`max option must be a nonnegative integer`);let T=n?$t(n):Array;if(!T)throw Error(`invalid max value: `+n);if(this.#e=n,this.#t=m,this.maxEntrySize=h||this.#t,this.sizeCalculation=g,this.sizeCalculation){if(!this.#t&&!this.maxEntrySize)throw TypeError(`cannot set sizeCalculation without setting maxSize or maxEntrySize`);if(typeof this.sizeCalculation!=`function`)throw TypeError(`sizeCalculation set to non-function`)}if(v!==void 0&&typeof v!=`function`)throw TypeError(`memoMethod must be a function if defined`);if(this.#o=v,_!==void 0&&typeof _!=`function`)throw TypeError(`fetchMethod must be a function if specified`);if(this.#a=_,this.#w=!!_,this.#u=new Map,this.#d=Array.from({length:n}).fill(void 0),this.#f=Array.from({length:n}).fill(void 0),this.#p=new T(n),this.#m=new T(n),this.#h=0,this.#g=0,this.#_=en.create(n),this.#c=0,this.#l=0,typeof l==`function`&&(this.#n=l),typeof u==`function`&&(this.#r=u),typeof d==`function`?(this.#i=d,this.#v=[]):(this.#i=void 0,this.#v=void 0),this.#C=!!this.#n,this.#E=!!this.#r,this.#T=!!this.#i,this.noDisposeOnSet=!!f,this.noUpdateTTL=!!p,this.noDeleteOnFetchRejection=!!y,this.allowStaleOnFetchRejection=!!x,this.allowStaleOnFetchAbort=!!S,this.ignoreFetchAbort=!!C,this.maxEntrySize!==0){if(this.#t!==0&&!Y(this.#t))throw TypeError(`maxSize must be a positive integer if specified`);if(!Y(this.maxEntrySize))throw TypeError(`maxEntrySize must be a positive integer if specified`);this.#M()}if(this.allowStale=!!c,this.noDeleteOnStaleGet=!!b,this.updateAgeOnGet=!!o,this.updateAgeOnHas=!!s,this.ttlResolution=Y(i)||i===0?i:1,this.ttlAutopurge=!!a,this.ttl=r||0,this.ttl){if(!Y(this.ttl))throw TypeError(`ttl must be a positive integer if specified`);this.#D()}if(this.#e===0&&this.ttl===0&&this.#t===0)throw TypeError(`At least one of max, maxSize, or ttl is required`);if(!this.ttlAutopurge&&!this.#e&&!this.#t){let t=`LRU_CACHE_UNBOUNDED`;Qt(t)&&(Yt.add(t),Zt(`TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.`,`UnboundedCacheWarning`,t,e))}}getRemainingTTL(e){return this.#u.has(e)?1/0:0}#D(){let e=new X(this.#e),t=new X(this.#e);this.#x=e,this.#b=t;let n=this.ttlAutopurge?Array.from({length:this.#e}):void 0;this.#S=n,this.#A=(n,i,a=this.#s.now())=>{t[n]=i===0?0:a,e[n]=i,r(n,i)},this.#O=n=>{t[n]=e[n]===0?0:this.#s.now(),r(n,e[n])};let r=this.ttlAutopurge?(e,t)=>{if(n?.[e]&&(clearTimeout(n[e]),n[e]=void 0),t&&t!==0&&n){let r=setTimeout(()=>{this.#j(e)&&this.#Z(this.#d[e],`expire`)},t+1);r.unref&&r.unref(),n[e]=r}}:()=>{};this.#k=(n,r)=>{if(e[r]){let o=e[r],s=t[r];if(!o||!s)return;n.ttl=o,n.start=s,n.now=i||a(),n.remainingTTL=o-(n.now-s)}};let i=0,a=()=>{let e=this.#s.now();if(this.ttlResolution>0){i=e;let t=setTimeout(()=>i=0,this.ttlResolution);t.unref&&t.unref()}return e};this.getRemainingTTL=n=>{let r=this.#u.get(n);if(r===void 0)return 0;let o=e[r],s=t[r];return!o||!s?1/0:o-((i||a())-s)},this.#j=n=>{let r=t[n],o=e[n];return!!o&&!!r&&(i||a())-r>o}}#O=()=>{};#k=()=>{};#A=()=>{};#j=()=>!1;#M(){let e=new X(this.#e);this.#l=0,this.#y=e,this.#N=t=>{this.#l-=e[t],e[t]=0},this.#F=(e,t,n,r)=>{if(this.#W(t))return 0;if(!Y(n))if(r){if(typeof r!=`function`)throw TypeError(`sizeCalculation must be a function`);if(n=r(t,e),!Y(n))throw TypeError(`sizeCalculation return invalid (expect positive integer)`)}else throw TypeError(`invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.`);return n},this.#P=(t,n,r)=>{if(e[t]=n,this.#t){let n=this.#t-e[t];for(;this.#l>n;)this.#B(!0)}this.#l+=e[t],r&&(r.entrySize=n,r.totalCalculatedSize=this.#l)}}#N=e=>{};#P=(e,t,n)=>{};#F=(e,t,n,r)=>{if(n||r)throw TypeError(`cannot set size without setting maxSize or maxEntrySize on cache`);return 0};*#I({allowStale:e=this.allowStale}={}){if(this.#c)for(let t=this.#g;this.#R(t)&&((e||!this.#j(t))&&(yield t),t!==this.#h);)t=this.#m[t]}*#L({allowStale:e=this.allowStale}={}){if(this.#c)for(let t=this.#h;this.#R(t)&&((e||!this.#j(t))&&(yield t),t!==this.#g);)t=this.#p[t]}#R(e){return e!==void 0&&this.#u.get(this.#d[e])===e}*entries(){for(let e of this.#I())this.#f[e]!==void 0&&this.#d[e]!==void 0&&!this.#W(this.#f[e])&&(yield[this.#d[e],this.#f[e]])}*rentries(){for(let e of this.#L())this.#f[e]!==void 0&&this.#d[e]!==void 0&&!this.#W(this.#f[e])&&(yield[this.#d[e],this.#f[e]])}*keys(){for(let e of this.#I()){let t=this.#d[e];t!==void 0&&!this.#W(this.#f[e])&&(yield t)}}*rkeys(){for(let e of this.#L()){let t=this.#d[e];t!==void 0&&!this.#W(this.#f[e])&&(yield t)}}*values(){for(let e of this.#I())this.#f[e]!==void 0&&!this.#W(this.#f[e])&&(yield this.#f[e])}*rvalues(){for(let e of this.#L())this.#f[e]!==void 0&&!this.#W(this.#f[e])&&(yield this.#f[e])}[Symbol.iterator](){return this.entries()}[Symbol.toStringTag]=`LRUCache`;find(e,t={}){for(let n of this.#I()){let r=this.#f[n],i=this.#W(r)?r.__staleWhileFetching:r;if(i!==void 0&&e(i,this.#d[n],this))return this.#J(this.#d[n],t)}}forEach(e,t=this){for(let n of this.#I()){let r=this.#f[n],i=this.#W(r)?r.__staleWhileFetching:r;i!==void 0&&e.call(t,i,this.#d[n],this)}}rforEach(e,t=this){for(let n of this.#L()){let r=this.#f[n],i=this.#W(r)?r.__staleWhileFetching:r;i!==void 0&&e.call(t,i,this.#d[n],this)}}purgeStale(){let e=!1;for(let t of this.#L({allowStale:!0}))this.#j(t)&&(this.#Z(this.#d[t],`expire`),e=!0);return e}info(e){let t=this.#u.get(e);if(t===void 0)return;let n=this.#f[t],r=this.#W(n)?n.__staleWhileFetching:n;if(r===void 0)return;let i={value:r};if(this.#x&&this.#b){let e=this.#x[t],n=this.#b[t];e&&n&&(i.ttl=e-(this.#s.now()-n),i.start=Date.now())}return this.#y&&(i.size=this.#y[t]),i}dump(){let e=[];for(let t of this.#I({allowStale:!0})){let n=this.#d[t],r=this.#f[t],i=this.#W(r)?r.__staleWhileFetching:r;if(i===void 0||n===void 0)continue;let a={value:i};if(this.#x&&this.#b){a.ttl=this.#x[t];let e=this.#s.now()-this.#b[t];a.start=Math.floor(Date.now()-e)}this.#y&&(a.size=this.#y[t]),e.unshift([n,a])}return e}load(e){this.clear();for(let[t,n]of e){if(n.start){let e=Date.now()-n.start;n.start=this.#s.now()-e}this.#z(t,n.value,n)}}set(e,t,n={}){let{status:r=K.hasSubscribers?{}:void 0}=n;n.status=r,r&&(r.op=`set`,r.key=e,t!==void 0&&(r.value=t));let i=this.#z(e,t,n);return r&&K.hasSubscribers&&K.publish(r),i}#z(e,t,n={}){let{ttl:r=this.ttl,start:i,noDisposeOnSet:a=this.noDisposeOnSet,sizeCalculation:o=this.sizeCalculation,status:s}=n;if(t===void 0)return s&&(s.set=`deleted`),this.delete(e),this;let{noUpdateTTL:c=this.noUpdateTTL}=n;s&&!this.#W(t)&&(s.value=t);let l=this.#F(e,t,n.size||0,o,s);if(this.maxEntrySize&&l>this.maxEntrySize)return this.#Z(e,`set`),s&&(s.set=`miss`,s.maxEntrySizeExceeded=!0),this;let u=this.#c===0?void 0:this.#u.get(e);if(u===void 0)u=this.#c===0?this.#g:this.#_.length===0?this.#c===this.#e?this.#B(!1):this.#c:this.#_.pop(),this.#d[u]=e,this.#f[u]=t,this.#u.set(e,u),this.#p[this.#g]=u,this.#m[u]=this.#g,this.#g=u,this.#c++,this.#P(u,l,s),s&&(s.set=`add`),c=!1,this.#E&&this.#r?.(t,e,`add`);else{this.#X(u);let n=this.#f[u];if(t!==n){if(this.#w&&this.#W(n)){n.__abortController.abort(Error(`replaced`));let{__staleWhileFetching:t}=n;t!==void 0&&!a&&(this.#C&&this.#n?.(t,e,`set`),this.#T&&this.#v?.push([t,e,`set`]))}else a||(this.#C&&this.#n?.(n,e,`set`),this.#T&&this.#v?.push([n,e,`set`]));if(this.#N(u),this.#P(u,l,s),this.#f[u]=t,s){s.set=`replace`;let e=n&&this.#W(n)?n.__staleWhileFetching:n;e!==void 0&&(s.oldValue=e)}}else s&&(s.set=`update`);this.#E&&this.onInsert?.(t,e,t===n?`update`:`replace`)}if(r!==0&&!this.#x&&this.#D(),this.#x&&(c||this.#A(u,r,i),s&&this.#k(s,u)),!a&&this.#T&&this.#v){let e=this.#v,t;for(;t=e?.shift();)this.#i?.(...t)}return this}pop(){try{for(;this.#c;){let e=this.#f[this.#h];if(this.#B(!0),this.#W(e)){if(e.__staleWhileFetching)return e.__staleWhileFetching}else if(e!==void 0)return e}}finally{if(this.#T&&this.#v){let e=this.#v,t;for(;t=e?.shift();)this.#i?.(...t)}}}#B(e){let t=this.#h,n=this.#d[t],r=this.#f[t];return this.#w&&this.#W(r)?r.__abortController.abort(Error(`evicted`)):(this.#C||this.#T)&&(this.#C&&this.#n?.(r,n,`evict`),this.#T&&this.#v?.push([r,n,`evict`])),this.#N(t),this.#S?.[t]&&(clearTimeout(this.#S[t]),this.#S[t]=void 0),e&&(this.#d[t]=void 0,this.#f[t]=void 0,this.#_.push(t)),this.#c===1?(this.#h=this.#g=0,this.#_.length=0):this.#h=this.#p[t],this.#u.delete(n),this.#c--,t}has(e,t={}){let{status:n=K.hasSubscribers?{}:void 0}=t;t.status=n,n&&(n.op=`has`,n.key=e);let r=this.#V(e,t);return K.hasSubscribers&&K.publish(n),r}#V(e,t={}){let{updateAgeOnHas:n=this.updateAgeOnHas,status:r}=t,i=this.#u.get(e);if(i!==void 0){let e=this.#f[i];if(this.#W(e)&&e.__staleWhileFetching===void 0)return!1;if(this.#j(i))r&&(r.has=`stale`,this.#k(r,i));else return n&&this.#O(i),r&&(r.has=`hit`,this.#k(r,i)),!0}else r&&(r.has=`miss`);return!1}peek(e,t={}){let{status:n=J()?{}:void 0}=t;n&&(n.op=`peek`,n.key=e),t.status=n;let r=this.#H(e,t);return K.hasSubscribers&&K.publish(n),r}#H(e,t){let{status:n,allowStale:r=this.allowStale}=t,i=this.#u.get(e);if(i===void 0||!r&&this.#j(i)){n&&(n.peek=i===void 0?`miss`:`stale`);return}let a=this.#f[i],o=this.#W(a)?a.__staleWhileFetching:a;return n&&(o===void 0?n.peek=`miss`:(n.peek=`hit`,n.value=o)),o}#U(e,t,n,r){let i=t===void 0?void 0:this.#f[t];if(this.#W(i))return i;let a=new AbortController,{signal:o}=n;o?.addEventListener(`abort`,()=>a.abort(o.reason),{signal:a.signal});let s={signal:a.signal,options:n,context:r},c=(r,i=!1)=>{let{aborted:o}=a.signal,c=n.ignoreFetchAbort&&r!==void 0,l=n.ignoreFetchAbort||!!(n.allowStaleOnFetchAbort&&r!==void 0);if(n.status&&(o&&!i?(n.status.fetchAborted=!0,n.status.fetchError=a.signal.reason,c&&(n.status.fetchAbortIgnored=!0)):n.status.fetchResolved=!0),o&&!c&&!i)return u(a.signal.reason,l);let d=f,p=this.#f[t];return(p===f||p===void 0&&c&&i)&&(r===void 0?d.__staleWhileFetching===void 0?this.#Z(e,`fetch`):this.#f[t]=d.__staleWhileFetching:(n.status&&(n.status.fetchUpdated=!0),this.#z(e,r,s.options))),r},l=e=>(n.status&&(n.status.fetchRejected=!0,n.status.fetchError=e),u(e,!1)),u=(r,i)=>{let{aborted:o}=a.signal,s=o&&n.allowStaleOnFetchAbort,c=s||n.allowStaleOnFetchRejection,l=c||n.noDeleteOnFetchRejection,u=f;if(this.#f[t]===f&&(!l||!i&&u.__staleWhileFetching===void 0?this.#Z(e,`fetch`):s||(this.#f[t]=u.__staleWhileFetching)),c)return n.status&&u.__staleWhileFetching!==void 0&&(n.status.returnedStale=!0),u.__staleWhileFetching;if(u.__returned===u)throw r},d=(t,r)=>{let o=this.#a?.(e,i,s);o&&o instanceof Promise&&o.then(e=>t(e===void 0?void 0:e),r),a.signal.addEventListener(`abort`,()=>{(!n.ignoreFetchAbort||n.allowStaleOnFetchAbort)&&(t(void 0),n.allowStaleOnFetchAbort&&(t=e=>c(e,!0)))})};n.status&&(n.status.fetchDispatched=!0);let f=new Promise(d).then(c,l),p=Object.assign(f,{__abortController:a,__staleWhileFetching:i,__returned:void 0});return t===void 0?(this.#z(e,p,{...s.options,status:void 0}),t=this.#u.get(e)):this.#f[t]=p,p}#W(e){if(!this.#w)return!1;let t=e;return!!t&&t instanceof Promise&&t.hasOwnProperty(`__staleWhileFetching`)&&t.__abortController instanceof AbortController}fetch(e,t={}){let n=q.hasSubscribers,{status:r=J()?{}:void 0}=t;t.status=r,r&&t.context&&(r.context=t.context);let i=this.#G(e,t);return r&&J()&&n&&(r.trace=!0,q.tracePromise(()=>i,r).catch(()=>{})),i}async#G(e,t={}){let{allowStale:n=this.allowStale,updateAgeOnGet:r=this.updateAgeOnGet,noDeleteOnStaleGet:i=this.noDeleteOnStaleGet,ttl:a=this.ttl,noDisposeOnSet:o=this.noDisposeOnSet,size:s=0,sizeCalculation:c=this.sizeCalculation,noUpdateTTL:l=this.noUpdateTTL,noDeleteOnFetchRejection:u=this.noDeleteOnFetchRejection,allowStaleOnFetchRejection:d=this.allowStaleOnFetchRejection,ignoreFetchAbort:f=this.ignoreFetchAbort,allowStaleOnFetchAbort:p=this.allowStaleOnFetchAbort,context:m,forceRefresh:h=!1,status:g,signal:_}=t;if(g&&(g.op=`fetch`,g.key=e,h&&(g.forceRefresh=!0)),!this.#w)return g&&(g.fetch=`get`),this.#J(e,{allowStale:n,updateAgeOnGet:r,noDeleteOnStaleGet:i,status:g});let v={allowStale:n,updateAgeOnGet:r,noDeleteOnStaleGet:i,ttl:a,noDisposeOnSet:o,size:s,sizeCalculation:c,noUpdateTTL:l,noDeleteOnFetchRejection:u,allowStaleOnFetchRejection:d,allowStaleOnFetchAbort:p,ignoreFetchAbort:f,status:g,signal:_},y=this.#u.get(e);if(y===void 0){g&&(g.fetch=`miss`);let t=this.#U(e,y,v,m);return t.__returned=t}else{let t=this.#f[y];if(this.#W(t)){let e=n&&t.__staleWhileFetching!==void 0;return g&&(g.fetch=`inflight`,e&&(g.returnedStale=!0)),e?t.__staleWhileFetching:t.__returned=t}let i=this.#j(y);if(!h&&!i)return g&&(g.fetch=`hit`),this.#X(y),r&&this.#O(y),g&&this.#k(g,y),t;let a=this.#U(e,y,v,m),o=a.__staleWhileFetching!==void 0&&n;return g&&(g.fetch=i?`stale`:`refresh`,o&&i&&(g.returnedStale=!0)),o?a.__staleWhileFetching:a.__returned=a}}forceFetch(e,t={}){let n=q.hasSubscribers,{status:r=J()?{}:void 0}=t;t.status=r,r&&t.context&&(r.context=t.context);let i=this.#K(e,t);return r&&J()&&n&&(r.trace=!0,q.tracePromise(()=>i,r).catch(()=>{})),i}async#K(e,t={}){let n=await this.#G(e,t);if(n===void 0)throw Error(`fetch() returned undefined`);return n}memo(e,t={}){let{status:n=K.hasSubscribers?{}:void 0}=t;t.status=n,n&&(n.op=`memo`,n.key=e,t.context&&(n.context=t.context));let r=this.#q(e,t);return n&&(n.value=r),K.hasSubscribers&&K.publish(n),r}#q(e,t={}){let n=this.#o;if(!n)throw Error(`no memoMethod provided to constructor`);let{context:r,status:i,forceRefresh:a,...o}=t;i&&a&&(i.forceRefresh=!0);let s=this.#J(e,o),c=a||s===void 0;if(i&&(i.memo=c?`miss`:`hit`,c||(i.value=s)),!c)return s;let l=n(e,s,{options:o,context:r});return i&&(i.value=l),this.#z(e,l,o),l}get(e,t={}){let{status:n=K.hasSubscribers?{}:void 0}=t;t.status=n,n&&(n.op=`get`,n.key=e);let r=this.#J(e,t);return n&&(r!==void 0&&(n.value=r),K.hasSubscribers&&K.publish(n)),r}#J(e,t={}){let{allowStale:n=this.allowStale,updateAgeOnGet:r=this.updateAgeOnGet,noDeleteOnStaleGet:i=this.noDeleteOnStaleGet,status:a}=t,o=this.#u.get(e);if(o===void 0){a&&(a.get=`miss`);return}let s=this.#f[o],c=this.#W(s);return a&&this.#k(a,o),this.#j(o)?c?(a&&(a.get=`stale-fetching`),n&&s.__staleWhileFetching!==void 0?(a&&(a.returnedStale=!0),s.__staleWhileFetching):void 0):(i||this.#Z(e,`expire`),a&&(a.get=`stale`),n?(a&&(a.returnedStale=!0),s):void 0):(a&&(a.get=c?`fetching`:`hit`),this.#X(o),r&&this.#O(o),c?s.__staleWhileFetching:s)}#Y(e,t){this.#m[t]=e,this.#p[e]=t}#X(e){e!==this.#g&&(e===this.#h?this.#h=this.#p[e]:this.#Y(this.#m[e],this.#p[e]),this.#Y(this.#g,e),this.#g=e)}delete(e){return this.#Z(e,`delete`)}#Z(e,t){K.hasSubscribers&&K.publish({op:`delete`,delete:t,key:e});let n=!1;if(this.#c!==0){let r=this.#u.get(e);if(r!==void 0)if(this.#S?.[r]&&(clearTimeout(this.#S?.[r]),this.#S[r]=void 0),n=!0,this.#c===1)this.#Q(t);else{this.#N(r);let n=this.#f[r];if(this.#W(n)?n.__abortController.abort(Error(`deleted`)):(this.#C||this.#T)&&(this.#C&&this.#n?.(n,e,t),this.#T&&this.#v?.push([n,e,t])),this.#u.delete(e),this.#d[r]=void 0,this.#f[r]=void 0,r===this.#g)this.#g=this.#m[r];else if(r===this.#h)this.#h=this.#p[r];else{let e=this.#m[r];this.#p[e]=this.#p[r];let t=this.#p[r];this.#m[t]=this.#m[r]}this.#c--,this.#_.push(r)}}if(this.#T&&this.#v?.length){let e=this.#v,t;for(;t=e?.shift();)this.#i?.(...t)}return n}clear(){return this.#Q(`delete`)}#Q(e){for(let t of this.#L({allowStale:!0})){let n=this.#f[t];if(this.#W(n))n.__abortController.abort(Error(`deleted`));else{let r=this.#d[t];this.#C&&this.#n?.(n,r,e),this.#T&&this.#v?.push([n,r,e])}}if(this.#u.clear(),this.#f.fill(void 0),this.#d.fill(void 0),this.#x&&this.#b){this.#x.fill(0),this.#b.fill(0);for(let e of this.#S??[])e!==void 0&&clearTimeout(e);this.#S?.fill(void 0)}if(this.#y&&this.#y.fill(0),this.#h=0,this.#g=0,this.#_.length=0,this.#l=0,this.#c=0,this.#T&&this.#v){let e=this.#v,t;for(;t=e?.shift();)this.#i?.(...t)}}},nn=`rgba32float`,rn=class{device;maxRows;textureWidth;textureUsage;onEvict;texture;capacity;highWaterMark=0;freeSlots=[];lru;constructor(e,t=4,n=512,r=T,i){this.device=e,this.maxRows=n,this.textureWidth=r,this.onEvict=i,this.capacity=t,this.textureUsage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC,this.texture=e.createTexture({size:[r,t],format:nn,usage:this.textureUsage}),this.lru=new tn({max:n*8})}allocateSlot(){if(this.freeSlots.length>0){let e=this.freeSlots.pop();return this.registerSlot(e)}let e=this.capacity*8;if(this.highWaterMark<e){let e=this.highWaterMark;return this.highWaterMark++,this.registerSlot(e)}if(this.capacity<this.maxRows){let e=Math.min(this.capacity*2,this.maxRows);this.growTexture(e);let t=this.highWaterMark;return this.highWaterMark++,this.registerSlot(t)}return this.evictAndAllocate()}writeSlotData(e,t,n){let r=e.row*this.textureWidth+e.slotIndex*256,i=r%this.textureWidth,a=Math.floor(r/this.textureWidth),o=this.textureWidth*4*Float32Array.BYTES_PER_ELEMENT,s=t.subarray(0,n*4);this.device.queue.writeTexture({texture:this.texture,origin:[i,a,0]},s,{bytesPerRow:o,rowsPerImage:1},[n,1,1])}touch(e){let t=this.flattenSlot(e);this.lru.get(t)}releaseSlot(e){let t=this.flattenSlot(e);this.lru.delete(t),this.freeSlots.push(t)}getTextureOffset(e){return e.row*this.textureWidth+e.slotIndex*256}createView(){return this.texture.createView()}getCapacity(){return this.capacity}getAllocatedSlotCount(){return this.lru.size}getHighWaterMark(){return this.highWaterMark}dispose(){this.texture.destroy(),this.lru.clear(),this.freeSlots.length=0}registerSlot(e){return this.lru.set(e,!0),this.unflattenSlot(e)}evictAndAllocate(){let e=this.lru.rkeys().next().value;if(e===void 0)return null;let t=this.unflattenSlot(e);return this.lru.delete(e),this.onEvict!==void 0&&this.onEvict(t),this.registerSlot(e)}growTexture(e){let t=this.device.createTexture({size:[this.textureWidth,e],format:nn,usage:this.textureUsage});if(this.highWaterMark>0){let e=Math.ceil(this.highWaterMark/8),n=this.device.createCommandEncoder();n.copyTextureToTexture({texture:this.texture,origin:[0,0,0]},{texture:t,origin:[0,0,0]},[this.textureWidth,e,1]),this.device.queue.submit([n.finish()])}this.texture.destroy(),this.texture=t,this.capacity=e}flattenSlot(e){return e.row*8+e.slotIndex}unflattenSlot(e){return{row:Math.floor(e/8),slotIndex:e%8}}},an=500,on=class{widthCache;currentFont=``;glyphMetrics=null;constructor(e=an){this.widthCache=new tn({max:e})}measureWidth(e,t){this.ensureFont(e);let n=this.widthCache.get(t);if(n!==void 0)return n;let r=e.measureText(t).width;return this.widthCache.set(t,r),r}getGlyphMetrics(e){if(this.ensureFont(e),this.glyphMetrics!==null)return this.glyphMetrics;let t=e.measureText(`0`),n=t.actualBoundingBoxAscent,r=t.actualBoundingBoxDescent;return this.glyphMetrics={ascent:n,descent:r,centerOffset:(n-r)/2},this.glyphMetrics}ensureFont(e){e.font!==this.currentFont&&(this.currentFont=e.font,this.widthCache.clear(),this.glyphMetrics=null)}},Z=60,sn=3600,cn=86400,ln=60,Q=24,un=[1,2,5],dn=8,fn=2,pn=70,mn=20,hn=10;function $(e){let t=BigInt(Math.trunc(e))*1000000000n;return s.Instant.fromEpochNanoseconds(t)}function gn(e,t){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}`}function _n(e,t,n,r,i){if(e.length<=1||r<=0)return e;let a=n-t;if(a<=0)return e;let o=i+hn,s=[],c=-1/0;for(let n of e){let e=(n.position-t)/a*r;e-c>=o&&(s.push(n),c=e)}return s}function vn(e,t,n,r){return _n(Cn(e,t,n),e,t,r,pn)}function yn(e,t){let n=[],r=$(e).toZonedDateTimeISO(`UTC`),i=$(t).toZonedDateTimeISO(`UTC`),a=r.with({day:1,hour:0,minute:0,second:0,nanosecond:0});for(s.ZonedDateTime.compare(a,r)<0&&(a=a.add({months:1}));s.ZonedDateTime.compare(a,i)<=0;)n.push({position:Number(a.epochNanoseconds/1000000000n),label:a.toPlainDate().toLocaleString(`en-US`,{month:`short`})}),a=a.add({months:1});return n}function bn(e,t){let n=[],r=$(e).toZonedDateTimeISO(`UTC`),i=$(t).toZonedDateTimeISO(`UTC`),a=r.with({hour:0,minute:0,second:0,nanosecond:0});for(s.ZonedDateTime.compare(a,r)<0&&(a=a.add({days:1}));s.ZonedDateTime.compare(a,i)<=0;)n.push({position:Number(a.epochNanoseconds/1000000000n),label:String(a.day)}),a=a.add({days:1});return n}function xn(e,t){let n=[],r=Math.ceil(e/sn),i=Math.floor(t/sn);for(let e=r;e<=i;e++){let t=e*sn,r=(e%Q+Q)%Q;n.push({position:t,label:gn(r,0)})}return n}function Sn(e,t){let n=[],r=Math.ceil(e/Z),i=Math.floor(t/Z);for(let e=r;e<=i;e++){let t=e*Z,r=Math.floor(t%cn/Z),i=Math.floor(r/ln),a=r%ln;n.push({position:t,label:gn((i%Q+Q)%Q,a)})}return n}function Cn(e,t,n){switch(n){case O.Day256:case O.Day64:return yn(e,t);case O.Day16:case O.Day4:return bn(e,t);case O.Day1:return xn(e,t);case O.Hour12:case O.Hour1:return Sn(e,t)}}function wn(e){if(e<=0)return 1;let t=10**Math.floor(Math.log10(e)),n=e/t;for(let e of un)if(e>=n)return e*t;return un[0]*t*10}function Tn(e,t,n){let r=t-e;if(r<=0)return[{position:e,label:En(e,1)}];let i=wn(r/dn);Math.floor(r/i)<fn&&(i=wn(r/fn));let a=Math.max(0,-Math.floor(Math.log10(i))+1),o=[],s=Math.ceil(e/i)*i;for(let n=s;n<=t+i*.01;n+=i)n>=e&&n<=t&&o.push({position:n,label:En(n,a)});return _n(o,e,t,n,mn)}function En(e,t){return e.toFixed(t)}var Dn=50,On=class{cache;constructor(e=Dn){this.cache=new tn({max:e})}getXTicks(e,t,n,r){let i=`x:${e}:${t}:${n}:${Math.round(r)}`,a=this.cache.get(i);if(a!==void 0)return a;let o=vn(e,t,n,r);return this.cache.set(i,o),o}getYTicks(e,t,n){let r=`y:${e}:${t}:${Math.round(n)}`,i=this.cache.get(r);if(i!==void 0)return i;let a=Tn(e,t,n);return this.cache.set(r,a),a}},kn=`#1a1a1a`,An=0,jn=200,Mn=2;function Nn(e){switch(e){case k.Line:return 18;case k.Candlestick:return 6;case k.Rhombus:return 6}}function Pn(e){switch(e){case k.Line:case k.Candlestick:return!0;case k.Rhombus:return!1}}function Fn(e,t){switch(e){case k.Line:return t.linePipeline;case k.Candlestick:return t.candlestickPipeline;case k.Rhombus:return t.rhombusPipeline}}var In=2,Ln=3,Rn=4,zn=class{targetCanvas;target2dContext;seriesManager;fpsController;viewport;dataMinTime;dataMaxTime;allocator;registry;dataPipelines;inputController;resizeObserver;textCache=new on;tickCache=new On;canvasWidth=0;canvasHeight=0;lastTextureCapacity=0;layoutCache=null;constructor(e,t,n,a,o,s){this.targetCanvas=n;let c=n.getContext(`2d`);i(!r(c),`Failed to get 2D canvas context`),this.target2dContext=c,this.dataMinTime=E,this.dataMaxTime=E+D,this.viewport={viewTimeStart:a,viewTimeEnd:o,targetTimeStart:a,targetTimeEnd:o,viewValueMin:An,viewValueMax:jn},this.registry=new Mt,this.allocator=new rn(e.device,void 0,void 0,void 0,e=>{this.registry.removeBySlot(e)}),this.lastTextureCapacity=this.allocator.getCapacity(),this.dataPipelines=[],this.seriesManager=new Kt;for(let n of t){let t=new St(this.allocator,this.registry,`${s}${n.seedSuffix}`,n.chartType,n.colorFn,n.sizeFn,()=>e.debugMode,()=>e.instantLoad);this.dataPipelines.push(t);let r=new Gt(Nn(n.chartType),Pn(n.chartType)),i=Fn(n.chartType,e);this.seriesManager.addSeries(r,i)}this.seriesManager.initAll(e.device,e.bindGroupLayout,this.allocator),this.seriesManager.updateBindGroups(this.allocator.createView()),this.fpsController=new Te,this.inputController=new zt(this.viewport,n,this.dataMinTime,this.dataMaxTime,this.fpsController),this.inputController.attach(),this.updateCanvasSize(),this.resizeObserver=new ResizeObserver(()=>{this.updateCanvasSize(),this.fpsController.raise(j.Resize)}),this.resizeObserver.observe(n)}get width(){return this.canvasWidth}get height(){return this.canvasHeight}syncCanvasSize(){let e=Math.max(1,window.devicePixelRatio),t=Math.floor(this.targetCanvas.clientWidth*e),n=Math.floor(this.targetCanvas.clientHeight*e);return this.canvasWidth=t,this.canvasHeight=n,this.targetCanvas.width!==t||this.targetCanvas.height!==n?(this.targetCanvas.width=t,this.targetCanvas.height=n,!0):!1}update(){this.updateCanvasSize();let e=this.viewport.targetTimeStart-this.viewport.viewTimeStart,t=this.viewport.targetTimeEnd-this.viewport.viewTimeEnd,n=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*oe;Math.abs(e)>n||Math.abs(t)>n?(this.viewport.viewTimeStart+=e*ae,this.viewport.viewTimeEnd+=t*ae,this.fpsController.raise(j.ZoomAnimation)):(this.viewport.viewTimeStart=this.viewport.targetTimeStart,this.viewport.viewTimeEnd=this.viewport.targetTimeEnd)}prepareDrawCommands(){let e=Pt(this.viewport.viewTimeStart,this.viewport.viewTimeEnd),t=this.dataPipelines.map(t=>t.ensureBlocksForViewport(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,e));if(this.getLoadingRegions().length>0&&this.fpsController.raise(j.ZoomAnimation),!t.some(e=>e.reduce((e,t)=>e+t.pointCount,0)>=Mn)&&this.getLoadingRegions().length===0)return null;for(let e of t)for(let t of e)this.allocator.touch(t.slot);let n=1/0,r=-1/0;for(let e of t)for(let t of e){let e=It(t.pointTimes,t.pointValues,this.viewport.viewTimeStart,this.viewport.viewTimeEnd);e!==void 0&&(n=Math.min(n,e[0]),r=Math.max(r,e[1]))}if(n<r){let[e,t]=Ft(n,r);this.viewport.viewValueMin=e,this.viewport.viewValueMax=t}let i=this.allocator.getCapacity();i!==this.lastTextureCapacity&&(this.lastTextureCapacity=i,this.rebuildLayerBindGroups()),this.seriesManager.writeAllUniforms(t,this.canvasWidth,this.canvasHeight,this.viewport.viewTimeStart,this.viewport.viewTimeEnd,this.viewport.viewValueMin,this.viewport.viewValueMax);let a=Math.max(1,window.devicePixelRatio);return{x:Math.floor(10*a),y:Math.floor(10*a),width:Math.max(0,this.canvasWidth-Math.floor(20*a)),height:Math.max(0,this.canvasHeight-Math.floor(20*a))}}getFrameLayout(){let{viewTimeStart:e,viewTimeEnd:t,viewValueMin:n,viewValueMax:r}=this.viewport,i=Math.max(1,window.devicePixelRatio),a=this.layoutCache;if(a!==null&&a.timeStart===e&&a.timeEnd===t&&a.valueMin===n&&a.valueMax===r&&a.canvasWidth===this.canvasWidth&&a.canvasHeight===this.canvasHeight)return a;let o=10*i,s=10*i,c=this.canvasWidth-20*i,l=this.canvasHeight-20*i;if(c<=0||l<=0)return this.layoutCache=null,null;let u=Pt(e,t),d=c/i,f=l/i;return this.layoutCache={timeStart:e,timeEnd:t,valueMin:n,valueMax:r,canvasWidth:this.canvasWidth,canvasHeight:this.canvasHeight,dpr:i,plotLeft:o,plotTop:s,plotWidth:c,plotHeight:l,plotRight:o+c,plotBottom:s+l,scale:u,xTicks:this.tickCache.getXTicks(e,t,u,d),yTicks:this.tickCache.getYTicks(n,r,f)},this.layoutCache}renderCanvasAxes(){let e=this.getFrameLayout();if(e===null)return;let{dpr:t,plotLeft:n,plotTop:r,plotRight:i,plotBottom:a,plotWidth:o,plotHeight:s,xTicks:c,yTicks:l}=e,u=this.target2dContext,d=e.timeEnd-e.timeStart,f=e.valueMax-e.valueMin,p=11*t,m=5*t,h=3*t,g=2*t,_=In*t,v=Ln*t,y=Rn*t,b=18*t,x=18*t;u.strokeStyle=le,u.lineWidth=t,u.beginPath(),u.moveTo(n,r),u.lineTo(n,a),u.lineTo(i,a),u.stroke(),u.font=`${p}px ${de}`,u.textBaseline=`alphabetic`;let{centerOffset:S}=this.textCache.getGlyphMetrics(u);for(let r of c){let s=n+(r.position-e.timeStart)/d*o;if(s<n||s>i)continue;u.strokeStyle=le,u.lineWidth=t,u.beginPath(),u.moveTo(s,a),u.lineTo(s,a-m),u.stroke();let c=this.textCache.measureWidth(u,r.label);if(s-c/2-h<n+b)continue;let l=a-m-v-p/2,f=p+g*2;u.fillStyle=ce,u.beginPath(),u.roundRect(s-c/2-h,l-f/2,c+h*2,f,_),u.fill(),u.fillStyle=se,u.textAlign=`center`,u.fillText(r.label,s,l+S)}for(let i of l){let o=a-(i.position-e.valueMin)/f*s;if(o<r||o>a)continue;u.strokeStyle=le,u.lineWidth=t,u.beginPath(),u.moveTo(n,o),u.lineTo(n+m,o),u.stroke();let c=n+m+y,l=o,d=p+g*2;if(l+d/2>a-x)continue;let v=this.textCache.measureWidth(u,i.label);u.fillStyle=ce,u.beginPath(),u.roundRect(c-h,l-d/2,v+h*2,d,_),u.fill(),u.fillStyle=se,u.textAlign=`start`,u.fillText(i.label,c,l+S)}}renderCanvasGrid(){let e=this.getFrameLayout();if(e===null)return;let{dpr:t,plotLeft:n,plotTop:r,plotRight:i,plotBottom:a,plotWidth:o,plotHeight:s,xTicks:c,yTicks:l}=e,u=this.target2dContext,d=e.timeEnd-e.timeStart,f=e.valueMax-e.valueMin;u.fillStyle=kn,u.fillRect(0,0,this.canvasWidth,this.canvasHeight),u.strokeStyle=ue,u.lineWidth=t*.5,u.setLineDash([10*t,10*t]),u.beginPath();for(let t of c){let s=n+(t.position-e.timeStart)/d*o;s<n||s>i||(u.moveTo(s,r),u.lineTo(s,a))}for(let t of l){let o=a-(t.position-e.valueMin)/f*s;o<r||o>a||(u.moveTo(n,o),u.lineTo(i,o))}u.stroke(),u.setLineDash([])}getLoadingRegions(){let e=[];for(let t of this.dataPipelines)e.push(...t.getLoadingRegions());return e}getViewport(){return{timeStart:this.viewport.viewTimeStart,timeEnd:this.viewport.viewTimeEnd}}dispose(){this.resizeObserver.disconnect(),this.inputController.detach(),this.seriesManager.dispose(),this.allocator.dispose(),this.fpsController.dispose()}rebuildLayerBindGroups(){this.seriesManager.updateBindGroups(this.allocator.createView())}updateCanvasSize(){let e=Math.max(1,window.devicePixelRatio),t=Math.floor(this.targetCanvas.clientWidth*e),n=this.canvasWidth;if(this.canvasWidth=t,this.canvasHeight=Math.floor(this.targetCanvas.clientHeight*e),n>0&&t!==n){let e=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*(t/n),r=(this.viewport.viewTimeStart+this.viewport.viewTimeEnd)/2;this.viewport.viewTimeStart=r-e/2,this.viewport.viewTimeEnd=r+e/2}}},Bn=(0,_.memo)(({initialTimeStart:e,initialTimeEnd:t,chartSeed:n,seriesConfigs:i})=>{let a=(0,_.useRef)(null),o=Ke();return(0,_.useEffect)(()=>{if(r(o)||r(a.current))return;let s=new zn(o,i,a.current,e,t,n);return o.registerChart(s)},[o,e,t,n,i]),(0,A.jsx)(`div`,{className:`relative h-full w-full bg-[#1a1a1a]`,children:(0,A.jsx)(`canvas`,{ref:a,className:`absolute inset-0 h-full w-full [touch-action:none]`})})}),Vn=110,Hn=105,Un=100,Wn=95,Gn=C(.9,.2,.2,1),Kn=C(1,.6,.1,1),qn=C(.2,.8,.3,1),Jn=C(.2,.5,.9,1),Yn=C(.7,.7,.7,1),Xn=C(0,.5,1,1),Zn=10,Qn=.6,$n=C(1,.6,.1,1),er=2,tr=4,nr=6,rr=8,ir=10;function ar(e){return e>Vn?ir:e>Hn?rr:e>Un?nr:e>Wn?tr:er}function or(e){return e>Vn?Gn:e>Hn?Kn:e>Un?Yn:e>Wn?qn:Jn}var sr=[[{chartType:k.Line,seedSuffix:``,colorFn:()=>Xn,sizeFn:()=>Zn},{chartType:k.Candlestick,seedSuffix:`-series-2`,colorFn:(e,t,n)=>{let r=w(n[t].color);return C(r.r,r.g,r.b,Qn)}}],[{chartType:k.Candlestick,seedSuffix:``}],[{chartType:k.Line,seedSuffix:``,colorFn:()=>$n,sizeFn:e=>ar(e)}],[{chartType:k.Rhombus,seedSuffix:``,colorFn:e=>or(e)}]],cr=(0,_.memo)(()=>{let e=Ke();return(0,A.jsxs)(`div`,{className:`${m.fixedContainer} relative grid grid-cols-2 grid-rows-2`,children:[(0,A.jsx)(Se,{renderer:e}),ge.map((e,t)=>(0,A.jsx)(Bn,{initialTimeStart:E+e[0],initialTimeEnd:E+e[1],chartSeed:`chart-${t}`,seriesConfigs:sr[t]},`${e[0]}-${e[1]}`))]})}),lr=(0,_.memo)(()=>(0,A.jsx)(f,{className:`h-full w-full`,children:(0,A.jsx)(Ce,{children:(0,A.jsx)(qe,{children:(0,A.jsx)(cr,{})})})}));export{lr as Timeseries};