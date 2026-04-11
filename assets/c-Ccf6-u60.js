import{D as e,M as t,N as n,P as r,Y as i,at as a,j as o,st as s}from"./c-Cy9pq3c4.js";import{d as c}from"./c-C1I1Uh3g.js";import{i as l,n as u,r as d,t as f}from"./c-BhCelCM8.js";import{t as p}from"./e-BG9VB_qy.js";import{t as m}from"./c-wJEgkeeX.js";var h=s(n(),1),g=255,_=255,v=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),y=new Float32Array(v),b=new Uint32Array(v);function x(e,t,n,r){let i=Math.round(r*_)&g,a=Math.round(e*_)&g,o=Math.round(t*_)&g,s=Math.min(Math.round(n*_)&g,126);return b[0]=i|a<<8|o<<16|s<<24,y[0]}function S(e){y[0]=e;let t=b[0];return{a:(t&g)/_,r:(t>>8&g)/_,g:(t>>16&g)/_,b:(t>>24&g)/_}}var C=2048,w=1767225600,T=.5,E=1e3,ee=1e3,te=.7,ne=1.3,re=.18,ie=.005,D=365*24*3600,O=`http://www.w3.org/2000/svg`,ae=`#ccc`,oe=`rgba(50, 50, 50, 0.75)`,k=`#aaa`,se=`#444`,ce=`monospace`,le=1024,ue=2160*3600,de=720*3600,fe=168*3600,pe=[[0,D],[D/2-ue/2,D/2+ue/2],[D/2-de/2,D/2+de/2],[D/2-fe/2,D/2+fe/2]],A=function(e){return e[e.Hour1=3600]=`Hour1`,e[e.Hour12=43200]=`Hour12`,e[e.Day1=86400]=`Day1`,e[e.Day4=345600]=`Day4`,e[e.Day16=1382400]=`Day16`,e[e.Day64=5529600]=`Day64`,e[e.Day256=22118400]=`Day256`,e}({}),j=function(e){return e[e.Line=0]=`Line`,e[e.Candlestick=1]=`Candlestick`,e[e.Rhombus=2]=`Rhombus`,e}({}),M=t(),me=250,he=(0,h.memo)(({renderer:e,onDebugChange:t})=>{let[n,r]=(0,h.useState)(0),[i,a]=(0,h.useState)(!1);(0,h.useEffect)(()=>{if(e===null)return;let t=setInterval(()=>{r(e.renderFps)},me);return()=>clearInterval(t)},[e]);let o=c(()=>{let e=!i;a(e),t(e)});return(0,M.jsxs)(`div`,{className:`pointer-events-auto absolute top-1 right-1 z-10 flex items-center gap-2 rounded bg-black/60 px-2 py-1 font-mono text-xs text-white`,children:[(0,M.jsxs)(`span`,{className:`tabular-nums`,children:[n,` fps`]}),(0,M.jsxs)(`label`,{className:`flex cursor-pointer items-center gap-1`,children:[(0,M.jsx)(`input`,{type:`checkbox`,checked:i,onChange:o,className:`h-3 w-3`}),`debug`]})]})}),ge=(0,h.memo)(({children:e})=>{let[t,n]=(0,h.useState)(!1),a=(0,h.useRef)(null);(0,h.useEffect)(()=>{if(r(screen.orientation)||!i(screen.orientation.lock))return;function e(){n(screen.orientation.type.startsWith(`portrait`)&&!document.fullscreenElement)}return e(),screen.orientation.addEventListener(`change`,e),document.addEventListener(`fullscreenchange`,e),()=>{screen.orientation.removeEventListener(`change`,e),document.removeEventListener(`fullscreenchange`,e);let t=a.current;r(t)||(screen.orientation.unlock(),!t.wasFullscreen&&document.fullscreenElement&&document.exitFullscreen().catch(()=>{}),a.current=null)}},[]);let o=c(async()=>{a.current={wasFullscreen:!!document.fullscreenElement,previousOrientation:screen.orientation.type};try{await document.documentElement.requestFullscreen(),await screen.orientation?.lock?.(`landscape`)}catch{}});return(0,M.jsxs)(`div`,{className:`relative h-full w-full`,children:[e,t&&(0,M.jsx)(`div`,{className:`absolute inset-0 z-20 flex items-center justify-center`,children:(0,M.jsx)(`button`,{type:`button`,onClick:o,className:`flex h-24 w-24 items-center justify-center rounded-full bg-brand-500/80 text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95`,children:(0,M.jsx)(p,{className:`h-14 w-14`})})})]})}),N=function(e){return e[e.Idle=5]=`Idle`,e[e.Resize=60]=`Resize`,e[e.ZoomAnimation=60]=`ZoomAnimation`,e[e.Interaction=60]=`Interaction`,e}({}),_e=500,ve=class{activeLevels=new Map;fallbackFps;constructor(e=N.Idle){this.fallbackFps=e}raise(e){let t=this.activeLevels.get(e);t!==void 0&&clearTimeout(t);let n=setTimeout(()=>{this.activeLevels.delete(e)},_e);this.activeLevels.set(e,n)}getFrameIntervalMs(){return ee/this.getCurrentFps()}getCurrentFps(){if(this.activeLevels.size===0)return this.fallbackFps;let e=0;for(let t of this.activeLevels.keys())t>e&&(e=t);return e}dispose(){for(let e of this.activeLevels.values())clearTimeout(e);this.activeLevels.clear()}},ye=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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
`,be=`// Debug shader: draws vertical lines at block boundaries.
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
`,xe=`struct VSOut {
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
`,Se=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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
`,Ce=P+xe,we=P+ye,Te=P+Se,Ee=P+be,De=5,Oe=`rgba(100, 160, 255, 0.6)`,ke=`rgba(30, 80, 180, 0.8)`,Ae=1200;async function je(){o(!r(navigator.gpu),`WebGPU is not supported`);let e=await navigator.gpu.requestAdapter();o(!r(e),`WebGPU adapter not available`);let t=await e.requestDevice(),n=new OffscreenCanvas(le,768),i=n.getContext(`webgpu`);o(!r(i),`Failed to get WebGPU context on OffscreenCanvas`);let a=navigator.gpu.getPreferredCanvasFormat();i.configure({device:t,format:a,alphaMode:`premultiplied`});let s=t.createShaderModule({code:Ce}),c=t.createShaderModule({code:we}),l=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]}),u={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},d=t.createPipelineLayout({bindGroupLayouts:[l]}),f=t.createRenderPipeline({layout:d,vertex:{module:s,entryPoint:`vs`},fragment:{module:s,entryPoint:`fs`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),p=t.createRenderPipeline({layout:d,vertex:{module:c,entryPoint:`vsCandlestick`},fragment:{module:c,entryPoint:`fsCandlestick`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),m=t.createShaderModule({code:Te}),h=t.createRenderPipeline({layout:d,vertex:{module:m,entryPoint:`vsRhombus`},fragment:{module:m,entryPoint:`fsRhombus`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),g=t.createShaderModule({code:Ee});return new Me(t,a,l,f,p,h,t.createRenderPipeline({layout:d,vertex:{module:g,entryPoint:`vsDebugLines`},fragment:{module:g,entryPoint:`fsDebugLines`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),n,i)}var Me=class{device;format;bindGroupLayout;linePipeline;candlestickPipeline;rhombusPipeline;debugPipeline;debugMode=!1;renderFps=0;offscreen;ctx;charts=new Set;msaaManager=l(4);animationFrameId=0;lastFrameTime=0;disposed=!1;renderFrameTimes=[];lastFpsUpdate=0;constructor(e,t,n,r,i,a,o,s,c){this.device=e,this.format=t,this.bindGroupLayout=n,this.linePipeline=r,this.candlestickPipeline=i,this.rhombusPipeline=a,this.debugPipeline=o,this.offscreen=s,this.ctx=c}registerChart(e){return this.charts.add(e),this.charts.size===1&&this.startAnimationLoop(),()=>{this.charts.delete(e),e.dispose(),this.charts.size===0&&this.stopAnimationLoop()}}destroy(){if(!this.disposed){this.disposed=!0,this.stopAnimationLoop();for(let e of this.charts)e.dispose();this.charts.clear(),this.msaaManager.dispose(),this.device.destroy()}}getMinFrameIntervalMs(){let e;for(let t of this.charts){let n=t.fpsController.getFrameIntervalMs();(r(e)||n<e)&&(e=n)}return e??1e3/N.Idle}startAnimationLoop(){if(this.disposed)return;let e=t=>{if(this.disposed)return;let n=this.getMinFrameIntervalMs();if(t-this.lastFrameTime<n){this.animationFrameId=requestAnimationFrame(e);return}this.lastFrameTime=t,this.trackRenderFps(t),this.renderAllCharts(),this.animationFrameId=requestAnimationFrame(e)};this.animationFrameId=requestAnimationFrame(e)}trackRenderFps(e){this.renderFrameTimes.push(e);let t=e-1e3;for(;this.renderFrameTimes.length>0&&this.renderFrameTimes[0]<t;)this.renderFrameTimes.shift();if(e-this.lastFpsUpdate>=250){this.lastFpsUpdate=e;let t=this.renderFrameTimes.length>1?this.renderFrameTimes[this.renderFrameTimes.length-1]-this.renderFrameTimes[0]:0;this.renderFps=t>0?Math.round((this.renderFrameTimes.length-1)/t*ee):0}}stopAnimationLoop(){cancelAnimationFrame(this.animationFrameId),this.animationFrameId=0}drawLoadingBars(e){let t=e.getLoadingRegions();if(t.length===0)return;let n=e.getViewport(),r=n.timeEnd-n.timeStart;if(r<=0)return;let i=e.target2dContext,a=e.width,o=e.height,s=De*Math.max(1,window.devicePixelRatio),c=o-s,l=performance.now()%Ae/Ae;for(let e of t){let t=(e.timeStart-n.timeStart)/r,o=(e.timeEnd-n.timeStart)/r,u=Math.max(0,Math.floor(t*a)),d=Math.min(a,Math.ceil(o*a))-u;if(d<=0)continue;let f=s*2,p=c-f+l*f,m=i.createLinearGradient(0,p,0,p+f);m.addColorStop(0,Oe),m.addColorStop(.5,ke),m.addColorStop(1,Oe),i.save(),i.beginPath(),i.rect(u,c,d,s),i.clip(),i.fillStyle=m,i.fillRect(u,p,d,f),i.restore()}}ensureMsaaView(e,t){return this.msaaManager.ensureView(this.device,this.format,e,t)}renderAllCharts(){for(let e of this.charts){e.update();let{width:t,height:n}=e;if(t===0||n===0)continue;let i=e.prepareDrawCommands();if(r(i))continue;(this.offscreen.width!==t||this.offscreen.height!==n)&&(this.offscreen.width=t,this.offscreen.height=n,this.ctx.configure({device:this.device,format:this.format,alphaMode:`premultiplied`}));let a=this.ctx.getCurrentTexture(),o=this.ensureMsaaView(a.width,a.height);if(r(o))continue;let s=a.createView(),c=this.device.createCommandEncoder(),l=c.beginRenderPass({colorAttachments:[{view:o,resolveTarget:s,loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});e.seriesManager.renderAll(l,i),this.debugMode&&e.seriesManager.renderDebug(l,this.debugPipeline,i),l.end(),this.device.queue.submit([c.finish()]),e.syncCanvasSize();let u=this.offscreen.transferToImageBitmap();e.target2dContext.clearRect(0,0,e.width,e.height),e.target2dContext.drawImage(u,0,0),u.close(),this.drawLoadingBars(e),e.renderOverlay()}}},Ne=(0,h.createContext)(null);function Pe(){return(0,h.useContext)(Ne)}var Fe=(0,h.memo)(({children:e})=>{let[t,n]=(0,h.useState)(null);return(0,h.useEffect)(()=>{let e=!1,t;return je().then(r=>{if(e){r.destroy();return}t=r,n(r)}),()=>{e=!0,r(t)||t.destroy()}},[]),(0,M.jsx)(Ne,{value:t,children:e})}),Ie=s(a(((e,t)=>{(function(n,r){typeof e==`object`?t.exports=r():typeof define==`function`&&define.amd?define(r):n.Alea=r()})(e,function(){return e.importState=function(t){var n=new e;return n.importState(t),n},e;function e(){return function(e){var n=0,r=0,i=0,a=1;e.length==0&&(e=[+new Date]);var o=t();n=o(` `),r=o(` `),i=o(` `);for(var s=0;s<e.length;s++)n-=o(e[s]),n<0&&(n+=1),r-=o(e[s]),r<0&&(r+=1),i-=o(e[s]),i<0&&(i+=1);o=null;var c=function(){var e=2091639*n+a*23283064365386963e-26;return n=r,r=i,i=e-(a=e|0)};return c.next=c,c.uint32=function(){return c()*4294967296},c.fract53=function(){return c()+(c()*2097152|0)*11102230246251565e-32},c.version=`Alea 0.9`,c.args=e,c.exportState=function(){return[n,r,i,a]},c.importState=function(e){n=+e[0]||0,r=+e[1]||0,i=+e[2]||0,a=+e[3]||0},c}(Array.prototype.slice.call(arguments))}function t(){var e=4022871197,t=function(t){t=t.toString();for(var n=0;n<t.length;n++){e+=t.charCodeAt(n);var r=.02519603282416938*e;e=r>>>0,r-=e,r*=e,e=r>>>0,r-=e,e+=r*4294967296}return(e>>>0)*23283064365386963e-26};return t.version=`Mash 0.9`,t}})}))(),1),Le=Math.sqrt(3),Re=Math.sqrt(5),ze=.5*(Le-1),F=(3-Le)/6;(Re-1)/4,(5-Re)/20;var Be=e=>Math.floor(e)|0,Ve=new Float64Array([1,1,-1,1,1,-1,-1,-1,1,0,-1,0,1,0,-1,0,0,1,0,-1,0,1,0,-1]);function He(e=Math.random){let t=Ue(e),n=new Float64Array(t).map(e=>Ve[e%12*2]),r=new Float64Array(t).map(e=>Ve[e%12*2+1]);return function(e,i){let a=0,o=0,s=0,c=(e+i)*ze,l=Be(e+c),u=Be(i+c),d=(l+u)*F,f=l-d,p=u-d,m=e-f,h=i-p,g,_;m>h?(g=1,_=0):(g=0,_=1);let v=m-g+F,y=h-_+F,b=m-1+2*F,x=h-1+2*F,S=l&255,C=u&255,w=.5-m*m-h*h;if(w>=0){let e=S+t[C],i=n[e],o=r[e];w*=w,a=w*w*(i*m+o*h)}let T=.5-v*v-y*y;if(T>=0){let e=S+g+t[C+_],i=n[e],a=r[e];T*=T,o=T*T*(i*v+a*y)}let E=.5-b*b-x*x;if(E>=0){let e=S+1+t[C+1],i=n[e],a=r[e];E*=E,s=E*E*(i*b+a*x)}return 70*(a+o+s)}}function Ue(e){let t=new Uint8Array(512);for(let e=0;e<512/2;e++)t[e]=e;for(let n=0;n<512/2-1;n++){let r=n+~~(e()*(256-n)),i=t[n];t[n]=t[r],t[r]=i}for(let e=256;e<512;e++)t[e]=t[e-256];return t}var I=180,We={[A.Hour1]:I,[A.Hour12]:I,[A.Day1]:I,[A.Day4]:I,[A.Day16]:I,[A.Day64]:I,[A.Day256]:I},Ge=1,Ke=10-Ge,qe=7,Je=.5;function Ye(e){return(e-w)/D}function Xe(e){let t=He((0,Ie.default)(e));return e=>{let n=Ye(e),r=0,i=15,a=4;for(let e=0;e<6;e++)r+=i*t(n*a,e*E),i*=T,a*=2;return 100+r}}var Ze=x(.2,.8,.3,1),Qe=x(.9,.2,.2,1);function $e(e,t){let n=e(Ye(t)*4,qe*E);return Ge+Math.max(0,Math.min(1,(n+1)*Je))*Ke}function et(e,t,n,r){let i=We[n],a=(t-e)/(i-1),o=Xe(r),s=He((0,Ie.default)(`${r}-size`)),c=Array(i),l=Array(i);for(let t=0;t<i;t++)c[t]=e+t*a,l[t]=o(c[t]);let u=Array(i);for(let e=0;e<i;e++){let t=l[Math.min(e+1,i-1)]>=l[e];u[e]={time:c[e],value:l[e],size:$e(s,c[e]),color:t?Ze:Qe}}return u}var tt=3;function nt(e,t,n){let r=new ArrayBuffer(e.length*4*Float32Array.BYTES_PER_ELEMENT),i=new Float32Array(r),a=new Uint32Array(r);for(let r=0;r<e.length;r++){let o=r*4,s=e[r];i[o]=s.time-t,i[o+1]=s.value-n,i[o+2]=s.size,a[o+tt]=ot(s.color)}return i}var rt=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),it=new Float32Array(rt),at=new Uint32Array(rt);function ot(e){return it[0]=e,at[0]}var st=1;function ct(e,t,n,r=st){let i=n,a=Math.floor(e/i)*i-r*i,o=Math.ceil(t/i)*i+r*i,s=Math.round((o-a)/i),c=Array(s);for(let e=0;e<s;e++){let t=a+e*i;c[e]={start:t,end:t+i}}return c}var lt=1e3,ut=class{pendingBlocks=new Map;requestCounter=0;constructor(e,t,n,r,i,a,o){this.allocator=e,this.registry=t,this.seed=n,this.chartType=r,this.colorFn=i,this.sizeFn=a,this.isDebug=o}ensureBlocksForViewport(e,t,n){let r=ct(e,t,n),i=[],a=performance.now(),o=new Set;for(let e of r){let t=`${n}:${e.start}:${e.end}`;o.add(t);let r=this.registry.findCovering(n,e.start,e.end,this.chartType);if(r!==void 0){this.allocator.touch(r.slot),i.push(r),this.pendingBlocks.delete(t);continue}let s=this.pendingBlocks.get(t);if(s===void 0){this.requestCounter++;let r=this.requestCounter;this.isDebug?.()&&console.log(`>>> [#${r}] REQUEST ${j[this.chartType]} [${e.start} → ${e.end}] scale=${n}`),this.pendingBlocks.set(t,{periodStart:e.start,periodEnd:e.end,scale:n,requestTime:a});continue}if(a-s.requestTime>=lt){this.pendingBlocks.delete(t);let r=this.generateBlocksForPeriod(e.start,e.end,n);if(i.push(...r),this.isDebug?.()){let t=r.reduce((e,t)=>e+t.pointCount,0);console.log(`>>> [#${this.requestCounter}] RESPONSE ${j[this.chartType]} [${e.start} → ${e.end}] ${r.length} block(s), ${t} points`)}}}for(let e of this.pendingBlocks.keys())o.has(e)||this.pendingBlocks.delete(e);return i.sort((e,t)=>e.timeStart-t.timeStart)}getLoadingRegions(){let e=performance.now(),t=[];for(let n of this.pendingBlocks.values()){let r=e-n.requestTime,i=Math.min(1,r/lt);t.push({timeStart:n.periodStart,timeEnd:n.periodEnd,progress:i})}return t}generateBlocksForPeriod(e,t,n){let r=et(e,t,n,this.seed);if(r.length===0)return[];if(this.colorFn!==void 0||this.sizeFn!==void 0)for(let e=0;e<r.length;e++){let t=r[e];r[e]={...t,color:this.colorFn===void 0?t.color:this.colorFn(t.value,e,r),size:this.sizeFn===void 0?t.size:this.sizeFn(t.value,e,r)}}let i=[];if(r.length<=256){let a=this.createBlock(r,e,t,n);a!==null&&i.push(a)}else{let e=Math.ceil(r.length/256);for(let t=0;t<e;t++){let e=t*256,a=Math.min(e+256,r.length),o=r.slice(e,a),s=o[0].time,c=o[o.length-1].time,l=this.createBlock(o,s,c,n);l!==null&&i.push(l)}}return i}createBlock(e,t,n,r){let i=this.allocator.allocateSlot();if(i===null)return null;let a=e[0].time,o=e[0].value,s=nt(e,a,o);this.allocator.writeSlotData(i,s,e.length);let c=new Float64Array(e.length),l=new Float64Array(e.length);for(let t=0;t<e.length;t++)c[t]=e[t].time,l[t]=e[t].value;let u={minX:0,maxX:0,minY:0,maxY:0,timeStart:t,timeEnd:n,scale:r,chartType:this.chartType,slot:i,pointCount:e.length,baseTime:a,baseValue:o,pointTimes:c,pointValues:l};return this.registry.insert(u),u}};function dt(e,t,n=0,r=e.length-1,i=ft){for(;r>n;){if(r-n>600){let a=r-n+1,o=t-n+1,s=Math.log(a),c=.5*Math.exp(2*s/3),l=.5*Math.sqrt(s*c*(a-c)/a)*(o-a/2<0?-1:1);dt(e,t,Math.max(n,Math.floor(t-o*c/a+l)),Math.min(r,Math.floor(t+(a-o)*c/a+l)),i)}let a=e[t],o=n,s=r;for(L(e,n,t),i(e[r],a)>0&&L(e,n,r);o<s;){for(L(e,o,s),o++,s--;i(e[o],a)<0;)o++;for(;i(e[s],a)>0;)s--}i(e[n],a)===0?L(e,n,s):(s++,L(e,s,r)),s<=t&&(n=s+1),t<=s&&(r=s-1)}}function L(e,t,n){let r=e[t];e[t]=e[n],e[n]=r}function ft(e,t){return e<t?-1:e>t?1:0}var pt=class{constructor(e=9){this._maxEntries=Math.max(4,e),this._minEntries=Math.max(2,Math.ceil(this._maxEntries*.4)),this.clear()}all(){return this._all(this.data,[])}search(e){let t=this.data,n=[];if(!W(e,t))return n;let r=this.toBBox,i=[];for(;t;){for(let a=0;a<t.children.length;a++){let o=t.children[a],s=t.leaf?r(o):o;W(e,s)&&(t.leaf?n.push(o):U(e,s)?this._all(o,n):i.push(o))}t=i.pop()}return n}collides(e){let t=this.data;if(!W(e,t))return!1;let n=[];for(;t;){for(let r=0;r<t.children.length;r++){let i=t.children[r],a=t.leaf?this.toBBox(i):i;if(W(e,a)){if(t.leaf||U(e,a))return!0;n.push(i)}}t=n.pop()}return!1}load(e){if(!(e&&e.length))return this;if(e.length<this._minEntries){for(let t=0;t<e.length;t++)this.insert(e[t]);return this}let t=this._build(e.slice(),0,e.length-1,0);if(!this.data.children.length)this.data=t;else if(this.data.height===t.height)this._splitRoot(this.data,t);else{if(this.data.height<t.height){let e=this.data;this.data=t,t=e}this._insert(t,this.data.height-t.height-1,!0)}return this}insert(e){return e&&this._insert(e,this.data.height-1),this}clear(){return this.data=G([]),this}remove(e,t){if(!e)return this;let n=this.data,r=this.toBBox(e),i=[],a=[],o,s,c;for(;n||i.length;){if(n||(n=i.pop(),s=i[i.length-1],o=a.pop(),c=!0),n.leaf){let r=mt(e,n.children,t);if(r!==-1)return n.children.splice(r,1),i.push(n),this._condense(i),this}!c&&!n.leaf&&U(n,r)?(i.push(n),a.push(o),o=0,s=n,n=n.children[0]):s?(o++,n=s.children[o],c=!1):n=null}return this}toBBox(e){return e}compareMinX(e,t){return e.minX-t.minX}compareMinY(e,t){return e.minY-t.minY}toJSON(){return this.data}fromJSON(e){return this.data=e,this}_all(e,t){let n=[];for(;e;)e.leaf?t.push(...e.children):n.push(...e.children),e=n.pop();return t}_build(e,t,n,r){let i=n-t+1,a=this._maxEntries,o;if(i<=a)return o=G(e.slice(t,n+1)),R(o,this.toBBox),o;r||(r=Math.ceil(Math.log(i)/Math.log(a)),a=Math.ceil(i/a**(r-1))),o=G([]),o.leaf=!1,o.height=r;let s=Math.ceil(i/a),c=s*Math.ceil(Math.sqrt(a));K(e,t,n,c,this.compareMinX);for(let i=t;i<=n;i+=c){let t=Math.min(i+c-1,n);K(e,i,t,s,this.compareMinY);for(let n=i;n<=t;n+=s){let i=Math.min(n+s-1,t);o.children.push(this._build(e,n,i,r-1))}}return R(o,this.toBBox),o}_chooseSubtree(e,t,n,r){for(;r.push(t),!(t.leaf||r.length-1===n);){let n=1/0,r=1/0,i;for(let a=0;a<t.children.length;a++){let o=t.children[a],s=V(o),c=_t(e,o)-s;c<r?(r=c,n=s<n?s:n,i=o):c===r&&s<n&&(n=s,i=o)}t=i||t.children[0]}return t}_insert(e,t,n){let r=n?e:this.toBBox(e),i=[],a=this._chooseSubtree(r,this.data,t,i);for(a.children.push(e),B(a,r);t>=0&&i[t].children.length>this._maxEntries;)this._split(i,t),t--;this._adjustParentBBoxes(r,i,t)}_split(e,t){let n=e[t],r=n.children.length,i=this._minEntries;this._chooseSplitAxis(n,i,r);let a=this._chooseSplitIndex(n,i,r),o=G(n.children.splice(a,n.children.length-a));o.height=n.height,o.leaf=n.leaf,R(n,this.toBBox),R(o,this.toBBox),t?e[t-1].children.push(o):this._splitRoot(n,o)}_splitRoot(e,t){this.data=G([e,t]),this.data.height=e.height+1,this.data.leaf=!1,R(this.data,this.toBBox)}_chooseSplitIndex(e,t,n){let r,i=1/0,a=1/0;for(let o=t;o<=n-t;o++){let t=z(e,0,o,this.toBBox),s=z(e,o,n,this.toBBox),c=vt(t,s),l=V(t)+V(s);c<i?(i=c,r=o,a=l<a?l:a):c===i&&l<a&&(a=l,r=o)}return r||n-t}_chooseSplitAxis(e,t,n){let r=e.leaf?this.compareMinX:ht,i=e.leaf?this.compareMinY:gt;this._allDistMargin(e,t,n,r)<this._allDistMargin(e,t,n,i)&&e.children.sort(r)}_allDistMargin(e,t,n,r){e.children.sort(r);let i=this.toBBox,a=z(e,0,t,i),o=z(e,n-t,n,i),s=H(a)+H(o);for(let r=t;r<n-t;r++){let t=e.children[r];B(a,e.leaf?i(t):t),s+=H(a)}for(let r=n-t-1;r>=t;r--){let t=e.children[r];B(o,e.leaf?i(t):t),s+=H(o)}return s}_adjustParentBBoxes(e,t,n){for(let r=n;r>=0;r--)B(t[r],e)}_condense(e){for(let t=e.length-1,n;t>=0;t--)e[t].children.length===0?t>0?(n=e[t-1].children,n.splice(n.indexOf(e[t]),1)):this.clear():R(e[t],this.toBBox)}};function mt(e,t,n){if(!n)return t.indexOf(e);for(let r=0;r<t.length;r++)if(n(e,t[r]))return r;return-1}function R(e,t){z(e,0,e.children.length,t,e)}function z(e,t,n,r,i){i||=G(null),i.minX=1/0,i.minY=1/0,i.maxX=-1/0,i.maxY=-1/0;for(let a=t;a<n;a++){let t=e.children[a];B(i,e.leaf?r(t):t)}return i}function B(e,t){return e.minX=Math.min(e.minX,t.minX),e.minY=Math.min(e.minY,t.minY),e.maxX=Math.max(e.maxX,t.maxX),e.maxY=Math.max(e.maxY,t.maxY),e}function ht(e,t){return e.minX-t.minX}function gt(e,t){return e.minY-t.minY}function V(e){return(e.maxX-e.minX)*(e.maxY-e.minY)}function H(e){return e.maxX-e.minX+(e.maxY-e.minY)}function _t(e,t){return(Math.max(t.maxX,e.maxX)-Math.min(t.minX,e.minX))*(Math.max(t.maxY,e.maxY)-Math.min(t.minY,e.minY))}function vt(e,t){let n=Math.max(e.minX,t.minX),r=Math.max(e.minY,t.minY),i=Math.min(e.maxX,t.maxX),a=Math.min(e.maxY,t.maxY);return Math.max(0,i-n)*Math.max(0,a-r)}function U(e,t){return e.minX<=t.minX&&e.minY<=t.minY&&t.maxX<=e.maxX&&t.maxY<=e.maxY}function W(e,t){return t.minX<=e.maxX&&t.minY<=e.maxY&&t.maxX>=e.minX&&t.maxY>=e.minY}function G(e){return{children:e,height:1,leaf:!0,minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0}}function K(e,t,n,r,i){let a=[t,n];for(;a.length;){if(n=a.pop(),t=a.pop(),n-t<=r)continue;let o=t+Math.ceil((n-t)/r/2)*r;dt(e,o,t,n,i),a.push(t,o,o,n)}}function q(e){return e.row*8+e.slotIndex}var yt=class{tree=new pt;slotMap=new Map;insert(e){e.minX=e.timeStart,e.maxX=e.timeEnd,e.minY=e.scale,e.maxY=e.scale,this.tree.insert(e),this.slotMap.set(q(e.slot),e)}remove(e){this.tree.remove(e),this.slotMap.delete(q(e.slot))}removeBySlot(e){let t=this.slotMap.get(q(e));t!==void 0&&this.remove(t)}queryVisible(e,t,n,r){let i=this.tree.search({minX:t,maxX:n,minY:e,maxY:e});return r===void 0?i:i.filter(e=>e.chartType===r)}findCovering(e,t,n,r){return this.tree.search({minX:t,maxX:n,minY:e,maxY:e}).find(e=>e.chartType===r&&e.timeStart<=t&&e.timeEnd>=n)}clear(){this.tree.clear(),this.slotMap.clear()}getEntryCount(){return this.slotMap.size}},J=60,Y=3600,bt=86400,xt=60,X=24,St=[1,2,5],Ct=8,wt=2,Tt=70,Et=20,Dt=10;function Z(t){let n=BigInt(Math.trunc(t))*1000000000n;return e.Instant.fromEpochNanoseconds(n)}function Ot(e,t){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}`}function kt(e,t,n,r,i){if(e.length<=1||r<=0)return e;let a=n-t;if(a<=0)return e;let o=i+Dt,s=[],c=-1/0;for(let n of e){let e=(n.position-t)/a*r;e-c>=o&&(s.push(n),c=e)}return s}function At(e,t,n,r){return kt(Ft(e,t,n),e,t,r,Tt)}function jt(t,n){let r=[],i=Z(t).toZonedDateTimeISO(`UTC`),a=Z(n).toZonedDateTimeISO(`UTC`),o=i.with({day:1,hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(o,i)<0&&(o=o.add({months:1}));e.ZonedDateTime.compare(o,a)<=0;)r.push({position:Number(o.epochNanoseconds/1000000000n),label:o.toPlainDate().toLocaleString(`en-US`,{month:`short`})}),o=o.add({months:1});return r}function Mt(t,n){let r=[],i=Z(t).toZonedDateTimeISO(`UTC`),a=Z(n).toZonedDateTimeISO(`UTC`),o=i.with({hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(o,i)<0&&(o=o.add({days:1}));e.ZonedDateTime.compare(o,a)<=0;)r.push({position:Number(o.epochNanoseconds/1000000000n),label:String(o.day)}),o=o.add({days:1});return r}function Nt(e,t){let n=[],r=Math.ceil(e/Y),i=Math.floor(t/Y);for(let e=r;e<=i;e++){let t=e*Y,r=(e%X+X)%X;n.push({position:t,label:Ot(r,0)})}return n}function Pt(e,t){let n=[],r=Math.ceil(e/J),i=Math.floor(t/J);for(let e=r;e<=i;e++){let t=e*J,r=Math.floor(t%bt/J),i=Math.floor(r/xt),a=r%xt;n.push({position:t,label:Ot((i%X+X)%X,a)})}return n}function Ft(e,t,n){switch(n){case A.Day256:case A.Day64:return jt(e,t);case A.Day16:case A.Day4:return Mt(e,t);case A.Day1:return Nt(e,t);case A.Hour12:case A.Hour1:return Pt(e,t)}}function It(e){if(e<=0)return 1;let t=10**Math.floor(Math.log10(e)),n=e/t;for(let e of St)if(e>=n)return e*t;return St[0]*t*10}function Lt(e,t,n){let r=t-e;if(r<=0)return[{position:e,label:Rt(e,1)}];let i=It(r/Ct);Math.floor(r/i)<wt&&(i=It(r/wt));let a=Math.max(0,-Math.floor(Math.log10(i))+1),o=[],s=Math.ceil(e/i)*i;for(let n=s;n<=t+i*.01;n+=i)n>=e&&n<=t&&o.push({position:n,label:Rt(n,a)});return kt(o,e,t,n,Et)}function Rt(e,t){return e.toFixed(t)}var zt=[A.Hour1,A.Hour12,A.Day1,A.Day4,A.Day16,A.Day64,A.Day256];function Q(e,t){let n=t-e;for(let e of zt)if(n<=e)return e;return A.Day256}function $(e,t,n,r){let i=t-e;return i>=r-n?[n,r]:e<n?[n,n+i]:t>r?[r-i,r]:[e,t]}function Bt(e,t){let n=t-e,r=(n>0?n:Math.abs(e))*.1||1;return[e-r,t+r]}function Vt(e,t,n,r){let i=e.length;if(i===0)return;let a=0,o=i;for(;a<o;){let t=a+o>>1;e[t]<n?a=t+1:o=t}let s=a;for(a=s,o=i;a<o;){let t=a+o>>1;e[t]<=r?a=t+1:o=t}let c=a;if(s>=c)return;let l=1/0,u=-1/0;for(let e=s;e<c;e++){let n=t[e];n<l&&(l=n),n>u&&(u=n)}return[l,u]}function Ht(e,t,n,r){let i=n*((t-e)/r);return[e-i,t-i]}function Ut(e,t,n,r){let i=t-e,a=e+i*r,o=Math.max(i*n,60);return[a-o*r,a+o*(1-r)]}function Wt(e){for(;e.firstChild;)e.removeChild(e.firstChild)}function Gt(e,t){let n=e,r=t,i=n-10,a=r-10,o=i-10,s=a-10;return o<=0||s<=0?null:{svgWidth:n,svgHeight:r,plotLeft:10,plotRight:i,plotTop:10,plotBottom:a,plotWidth:o,plotHeight:s}}function Kt(e,t,n){e.setAttribute(`width`,String(t)),e.setAttribute(`height`,String(n)),e.setAttribute(`viewBox`,`0 0 ${t} ${n}`)}function qt(e,t,n,r){Wt(e);let i=Gt(n,r);if(i===null)return;let{svgWidth:a,svgHeight:o,plotLeft:s,plotRight:c,plotTop:l,plotBottom:u,plotWidth:d,plotHeight:f}=i;Kt(e,a,o);let p=t.viewTimeEnd-t.viewTimeStart,m=t.viewValueMax-t.viewValueMin,h=Q(t.viewTimeStart,t.viewTimeEnd),g=At(t.viewTimeStart,t.viewTimeEnd,h,d);for(let n of g){let r=s+(n.position-t.viewTimeStart)/p*d;if(r<s||r>c)continue;let i=document.createElementNS(O,`line`);i.setAttribute(`x1`,String(r)),i.setAttribute(`y1`,String(l)),i.setAttribute(`x2`,String(r)),i.setAttribute(`y2`,String(u)),i.setAttribute(`stroke`,se),i.setAttribute(`stroke-width`,`0.5`),e.appendChild(i)}let _=Lt(t.viewValueMin,t.viewValueMax,f);for(let n of _){let r=u-(n.position-t.viewValueMin)/m*f;if(r<l||r>u)continue;let i=document.createElementNS(O,`line`);i.setAttribute(`x1`,String(s)),i.setAttribute(`y1`,String(r)),i.setAttribute(`x2`,String(c)),i.setAttribute(`y2`,String(r)),i.setAttribute(`stroke`,se),i.setAttribute(`stroke-width`,`0.5`),e.appendChild(i)}}function Jt(e,t,n,r){Wt(e);let i=Gt(n,r);if(i===null)return;let{svgWidth:a,svgHeight:o,plotLeft:s,plotRight:c,plotTop:l,plotBottom:u,plotWidth:d,plotHeight:f}=i;Kt(e,a,o);let p=document.createElementNS(O,`path`);p.setAttribute(`d`,`M ${s} ${l} L ${s} ${u} L ${c} ${u}`),p.setAttribute(`stroke`,k),p.setAttribute(`fill`,`none`),p.setAttribute(`stroke-width`,`1`),e.appendChild(p);let m=t.viewTimeEnd-t.viewTimeStart,h=t.viewValueMax-t.viewValueMin,g=Q(t.viewTimeStart,t.viewTimeEnd),_=At(t.viewTimeStart,t.viewTimeEnd,g,d);for(let n of _){let r=s+(n.position-t.viewTimeStart)/m*d;if(r<s||r>c)continue;let i=document.createElementNS(O,`line`);i.setAttribute(`x1`,String(r)),i.setAttribute(`y1`,String(u)),i.setAttribute(`x2`,String(r)),i.setAttribute(`y2`,String(u-5)),i.setAttribute(`stroke`,k),i.setAttribute(`stroke-width`,`1`),e.appendChild(i);let a=u-5-3,o=n.label.length*11*.6;if(r-o/2-3<s+18)continue;let l=document.createElementNS(O,`rect`);l.setAttribute(`x`,String(r-o/2-3)),l.setAttribute(`y`,String(a-11+2)),l.setAttribute(`width`,String(o+6)),l.setAttribute(`height`,`15`),l.setAttribute(`fill`,oe),l.setAttribute(`rx`,`2`),e.appendChild(l);let f=document.createElementNS(O,`text`);f.setAttribute(`x`,String(r)),f.setAttribute(`y`,String(a)),f.setAttribute(`text-anchor`,`middle`),f.setAttribute(`fill`,ae),f.setAttribute(`font-size`,`11`),f.setAttribute(`font-family`,ce),f.textContent=n.label,e.appendChild(f)}let v=Lt(t.viewValueMin,t.viewValueMax,f);for(let n of v){let r=u-(n.position-t.viewValueMin)/h*f;if(r<l||r>u)continue;let i=document.createElementNS(O,`line`);i.setAttribute(`x1`,String(s)),i.setAttribute(`y1`,String(r)),i.setAttribute(`x2`,String(s+5)),i.setAttribute(`y2`,String(r)),i.setAttribute(`stroke`,k),i.setAttribute(`stroke-width`,`1`),e.appendChild(i);let a=s+5+4,o=r+11/3;if(o+2>u-18)continue;let c=n.label.length*11*.6,d=document.createElementNS(O,`rect`);d.setAttribute(`x`,String(a-3)),d.setAttribute(`y`,String(o-11+2)),d.setAttribute(`width`,String(c+6)),d.setAttribute(`height`,`15`),d.setAttribute(`fill`,oe),d.setAttribute(`rx`,`2`),e.appendChild(d);let p=document.createElementNS(O,`text`);p.setAttribute(`x`,String(a)),p.setAttribute(`y`,String(o)),p.setAttribute(`text-anchor`,`start`),p.setAttribute(`fill`,ae),p.setAttribute(`font-size`,`11`),p.setAttribute(`font-family`,ce),p.textContent=n.label,e.appendChild(p)}}var Yt=class{isDragging=!1;lastMouseX=0;isTouching=!1;lastTouchX=0;lastPinchDistance=0;handleMouseDown;handleMouseMove;handleMouseUp;handleWheel;handleTouchStart;handleTouchMove;handleTouchEnd;constructor(e,t,n,r,i){this.viewport=e,this.canvas=t,this.dataMinTime=n,this.dataMaxTime=r,this.fpsController=i,this.handleMouseDown=e=>{this.isDragging=!0,this.lastMouseX=e.clientX,this.canvas.style.cursor=`grabbing`,this.fpsController.raise(N.Interaction)},this.handleMouseMove=e=>{if(!this.isDragging)return;let t=e.clientX-this.lastMouseX;this.lastMouseX=e.clientX;let[n,r]=$(...Ht(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,t,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=n,this.viewport.viewTimeEnd=r,this.viewport.targetTimeStart=n,this.viewport.targetTimeEnd=r,this.fpsController.raise(N.Interaction)},this.handleMouseUp=()=>{this.isDragging=!1,this.canvas.style.cursor=`grab`},this.handleWheel=e=>{e.preventDefault();let t=this.canvas.getBoundingClientRect(),n=(e.clientX-t.left)/t.width,r=e.deltaY>0?ne:te,[i,a]=$(...Ut(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,r,n),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a,this.fpsController.raise(N.Interaction)},this.handleTouchStart=e=>{this.fpsController.raise(N.Interaction),e.touches.length===1?(this.isTouching=!0,this.lastTouchX=e.touches[0].clientX):e.touches.length===2&&(this.isTouching=!1,this.lastPinchDistance=this.getTouchDistance(e))},this.handleTouchMove=e=>{if(e.preventDefault(),this.fpsController.raise(N.Interaction),e.touches.length===2){let t=this.getTouchDistance(e),n=this.lastPinchDistance/t,r=this.getTouchCenter(e),[i,a]=$(...Ut(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,n,r),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a,this.lastPinchDistance=t;return}if(!this.isTouching||e.touches.length!==1)return;let t=e.touches[0].clientX-this.lastTouchX;this.lastTouchX=e.touches[0].clientX;let[n,r]=$(...Ht(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,t,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=n,this.viewport.viewTimeEnd=r,this.viewport.targetTimeStart=n,this.viewport.targetTimeEnd=r},this.handleTouchEnd=e=>{e.touches.length===0?this.isTouching=!1:e.touches.length===1&&(this.isTouching=!0,this.lastTouchX=e.touches[0].clientX)}}get isInteracting(){return this.isDragging||this.isTouching}attach(){this.canvas.addEventListener(`mousedown`,this.handleMouseDown),this.canvas.addEventListener(`mousemove`,this.handleMouseMove),this.canvas.addEventListener(`mouseup`,this.handleMouseUp),this.canvas.addEventListener(`mouseleave`,this.handleMouseUp),this.canvas.addEventListener(`wheel`,this.handleWheel,{passive:!1}),this.canvas.addEventListener(`touchstart`,this.handleTouchStart,{passive:!0}),this.canvas.addEventListener(`touchmove`,this.handleTouchMove,{passive:!1}),this.canvas.addEventListener(`touchend`,this.handleTouchEnd),this.canvas.style.cursor=`grab`}detach(){this.canvas.removeEventListener(`mousedown`,this.handleMouseDown),this.canvas.removeEventListener(`mousemove`,this.handleMouseMove),this.canvas.removeEventListener(`mouseup`,this.handleMouseUp),this.canvas.removeEventListener(`mouseleave`,this.handleMouseUp),this.canvas.removeEventListener(`wheel`,this.handleWheel),this.canvas.removeEventListener(`touchstart`,this.handleTouchStart),this.canvas.removeEventListener(`touchmove`,this.handleTouchMove),this.canvas.removeEventListener(`touchend`,this.handleTouchEnd)}getTouchDistance(e){let t=e.touches[0].clientX-e.touches[1].clientX,n=e.touches[0].clientY-e.touches[1].clientY;return Math.sqrt(t*t+n*n)}getTouchCenter(e){let t=this.canvas.getBoundingClientRect();return((e.touches[0].clientX+e.touches[1].clientX)/2-t.left)/t.width}},Xt=4,Zt=Xt*Float32Array.BYTES_PER_ELEMENT,Qt=64,$t=class{device;buffer;cpuBuffer;f32View;u32View;allocator;maxBlocks;constructor(e,t,n=Qt){this.device=e,this.allocator=t,this.maxBlocks=n;let r=n*Zt;this.buffer=e.createBuffer({size:r,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.cpuBuffer=new ArrayBuffer(r),this.f32View=new Float32Array(this.cpuBuffer),this.u32View=new Uint32Array(this.cpuBuffer)}writeDescriptors(e,t){let n=Math.min(e.length,this.maxBlocks);if(n===0)return{totalInstances:0,globalBaseTime:0,globalBaseValue:0};let r=e[0].baseTime,i=e[0].baseValue,a=0;for(let t=0;t<n;t++){let n=e[t],o=t*Xt,s=this.allocator.getTextureOffset(n.slot);this.u32View[o]=s,this.u32View[o+1]=n.pointCount,this.f32View[o+2]=n.baseTime-r,this.f32View[o+3]=n.baseValue-i,a+=n.pointCount}let o=n*Zt;return this.device.queue.writeBuffer(this.buffer,0,this.cpuBuffer,0,o),{totalInstances:t?Math.max(0,a-1):a,globalBaseTime:r,globalBaseValue:i}}getBuffer(){return this.buffer}getTextureWidth(){return C}dispose(){this.buffer.destroy()}},en=6,tn=class{device;bindGroupLayout;uniformBuffer;uniformView;descriptorBuffer;currentBindGroup=null;currentInstanceCount=0;currentBlockCount=0;constructor(e,t){this.verticesPerInstance=e,this.needsStitching=t}init(e,t,n){this.device=e,this.bindGroupLayout=t,this.uniformView=u(f(P).uniforms.U),this.uniformBuffer=this.device.createBuffer({size:this.uniformView.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.descriptorBuffer=new $t(e,n)}updateBindGroup(e){this.currentBindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:e},{binding:2,resource:{buffer:this.descriptorBuffer.getBuffer()}}]})}writeUniforms(e,t,n,r,i,a,o){if(e.length===0){this.currentInstanceCount=0,this.currentBlockCount=0;return}this.currentBlockCount=e.length;let{totalInstances:s,globalBaseTime:c,globalBaseValue:l}=this.descriptorBuffer.writeDescriptors(e,this.needsStitching);this.currentInstanceCount=s,this.uniformView.set({viewport:[t,n],timeRangeMin:r-c,timeRangeMax:i-c,valueRangeMin:a-l,valueRangeMax:o-l,textureWidth:C,lineWidth:Math.max(1,window.devicePixelRatio),blockCount:e.length}),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformView.arrayBuffer)}render(e,t,n){this.currentBindGroup===null||this.currentInstanceCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(this.verticesPerInstance,this.currentInstanceCount,0,0))}renderDebug(e,t,n){this.currentBindGroup===null||this.currentBlockCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(en,this.currentBlockCount,0,0))}get instanceCount(){return this.currentInstanceCount}get bindGroup(){return this.currentBindGroup}dispose(){this.uniformBuffer.destroy(),this.descriptorBuffer.dispose(),this.currentBindGroup=null}},nn=class{entries=[];addSeries(e,t){this.entries.push({layer:e,pipeline:t})}initAll(e,t,n){for(let r of this.entries)r.layer.init(e,t,n)}updateBindGroups(e){for(let t of this.entries)t.layer.updateBindGroup(e)}writeAllUniforms(e,t,n,r,i,a,o){for(let s=0;s<this.entries.length;s++){let c=this.entries[s],l=e[s]??[];c.layer.writeUniforms(l,t,n,r,i,a,o)}}renderAll(e,t){for(let n of this.entries)n.layer.render(e,n.pipeline,t)}renderDebug(e,t,n){for(let r of this.entries)r.layer.renderDebug(e,t,n)}dispose(){for(let e of this.entries)e.layer.dispose()}},rn=`rgba32float`,an=class{device;maxRows;textureWidth;textureUsage;onEvict;texture;capacity;highWaterMark=0;usageCounter=0;freeSlots=[];slotMetadata=new Map;constructor(e,t=4,n=512,r=C,i){this.device=e,this.maxRows=n,this.textureWidth=r,this.onEvict=i,this.capacity=t,this.textureUsage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC,this.texture=e.createTexture({size:[r,t],format:rn,usage:this.textureUsage})}allocateSlot(){if(this.freeSlots.length>0){let e=this.freeSlots.pop();return this.registerSlot(e)}let e=this.capacity*8;if(this.highWaterMark<e){let e=this.highWaterMark;return this.highWaterMark++,this.registerSlot(e)}if(this.capacity<this.maxRows){let e=Math.min(this.capacity*2,this.maxRows);this.growTexture(e);let t=this.highWaterMark;return this.highWaterMark++,this.registerSlot(t)}return this.evictAndAllocate()}writeSlotData(e,t,n){let r=e.row*this.textureWidth+e.slotIndex*256,i=r%this.textureWidth,a=Math.floor(r/this.textureWidth),o=this.textureWidth*4*Float32Array.BYTES_PER_ELEMENT,s=t.subarray(0,n*4);this.device.queue.writeTexture({texture:this.texture,origin:[i,a,0]},s,{bytesPerRow:o,rowsPerImage:1},[n,1,1])}touch(e){let t=this.flattenSlot(e),n=this.slotMetadata.get(t);n!==void 0&&(this.usageCounter++,n.lastUsed=this.usageCounter)}releaseSlot(e){let t=this.flattenSlot(e);this.slotMetadata.delete(t),this.freeSlots.push(t)}getTextureOffset(e){return e.row*this.textureWidth+e.slotIndex*256}createView(){return this.texture.createView()}getCapacity(){return this.capacity}getAllocatedSlotCount(){return this.slotMetadata.size}getHighWaterMark(){return this.highWaterMark}dispose(){this.texture.destroy(),this.slotMetadata.clear(),this.freeSlots.length=0}registerSlot(e){return this.usageCounter++,this.slotMetadata.set(e,{lastUsed:this.usageCounter}),this.unflattenSlot(e)}evictAndAllocate(){let e=-1,t=1/0;for(let[n,r]of this.slotMetadata)r.lastUsed<t&&(t=r.lastUsed,e=n);if(e===-1)return null;let n=this.unflattenSlot(e);return this.slotMetadata.delete(e),this.onEvict!==void 0&&this.onEvict(n),this.registerSlot(e)}growTexture(e){let t=this.device.createTexture({size:[this.textureWidth,e],format:rn,usage:this.textureUsage});if(this.highWaterMark>0){let e=Math.ceil(this.highWaterMark/8),n=this.device.createCommandEncoder();n.copyTextureToTexture({texture:this.texture,origin:[0,0,0]},{texture:t,origin:[0,0,0]},[this.textureWidth,e,1]),this.device.queue.submit([n.finish()])}this.texture.destroy(),this.texture=t,this.capacity=e}flattenSlot(e){return e.row*8+e.slotIndex}unflattenSlot(e){return{row:Math.floor(e/8),slotIndex:e%8}}},on=0,sn=200,cn=2;function ln(e){switch(e){case j.Line:return 18;case j.Candlestick:return 6;case j.Rhombus:return 6}}function un(e){switch(e){case j.Line:case j.Candlestick:return!0;case j.Rhombus:return!1}}function dn(e,t){switch(e){case j.Line:return t.linePipeline;case j.Candlestick:return t.candlestickPipeline;case j.Rhombus:return t.rhombusPipeline}}var fn=class{targetCanvas;target2dContext;gridSvg;axesSvg;seriesManager;fpsController;viewport;dataMinTime;dataMaxTime;allocator;registry;dataPipelines;inputController;resizeObserver;canvasWidth=0;canvasHeight=0;lastTextureCapacity=0;lastOverlayTimeStart=NaN;lastOverlayTimeEnd=NaN;lastOverlayValueMin=NaN;lastOverlayValueMax=NaN;lastOverlayWidth=0;lastOverlayHeight=0;constructor(e,t,n,i,a,s,c,l,u,d){this.targetCanvas=a,this.gridSvg=s,this.axesSvg=c;let f=a.getContext(`2d`);o(!r(f),`Failed to get 2D canvas context`),this.target2dContext=f,this.dataMinTime=w,this.dataMaxTime=w+D,this.viewport={viewTimeStart:l,viewTimeEnd:u,targetTimeStart:l,targetTimeEnd:u,viewValueMin:on,viewValueMax:sn},this.registry=new yt,this.allocator=new an(e,void 0,void 0,void 0,e=>{this.registry.removeBySlot(e)}),this.lastTextureCapacity=this.allocator.getCapacity(),this.dataPipelines=[],this.seriesManager=new nn;for(let e of i){let t=new ut(this.allocator,this.registry,`${d}${e.seedSuffix}`,e.chartType,e.colorFn,e.sizeFn,()=>n.debugMode);this.dataPipelines.push(t);let r=new tn(ln(e.chartType),un(e.chartType)),i=dn(e.chartType,n);this.seriesManager.addSeries(r,i)}this.seriesManager.initAll(e,t,this.allocator),this.seriesManager.updateBindGroups(this.allocator.createView()),this.fpsController=new ve,this.inputController=new Yt(this.viewport,a,this.dataMinTime,this.dataMaxTime,this.fpsController),this.inputController.attach(),this.updateCanvasSize(),this.resizeObserver=new ResizeObserver(()=>{this.updateCanvasSize(),this.fpsController.raise(N.Resize),this.renderOverlay()}),this.resizeObserver.observe(a)}get width(){return this.canvasWidth}get height(){return this.canvasHeight}syncCanvasSize(){let e=Math.max(1,window.devicePixelRatio),t=Math.floor(this.targetCanvas.clientWidth*e),n=Math.floor(this.targetCanvas.clientHeight*e);return this.canvasWidth=t,this.canvasHeight=n,this.targetCanvas.width!==t||this.targetCanvas.height!==n?(this.targetCanvas.width=t,this.targetCanvas.height=n,!0):!1}update(){this.updateCanvasSize();let e=this.viewport.targetTimeStart-this.viewport.viewTimeStart,t=this.viewport.targetTimeEnd-this.viewport.viewTimeEnd,n=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*ie;Math.abs(e)>n||Math.abs(t)>n?(this.viewport.viewTimeStart+=e*re,this.viewport.viewTimeEnd+=t*re,this.fpsController.raise(N.ZoomAnimation)):(this.viewport.viewTimeStart=this.viewport.targetTimeStart,this.viewport.viewTimeEnd=this.viewport.targetTimeEnd)}prepareDrawCommands(){let e=Q(this.viewport.viewTimeStart,this.viewport.viewTimeEnd),t=this.dataPipelines.map(t=>t.ensureBlocksForViewport(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,e));if(this.getLoadingRegions().length>0&&this.fpsController.raise(N.ZoomAnimation),!t.some(e=>e.reduce((e,t)=>e+t.pointCount,0)>=cn)&&this.getLoadingRegions().length===0)return null;for(let e of t)for(let t of e)this.allocator.touch(t.slot);let n=1/0,r=-1/0;for(let e of t)for(let t of e){let e=Vt(t.pointTimes,t.pointValues,this.viewport.viewTimeStart,this.viewport.viewTimeEnd);e!==void 0&&(n=Math.min(n,e[0]),r=Math.max(r,e[1]))}if(n<r){let[e,t]=Bt(n,r);this.viewport.viewValueMin=e,this.viewport.viewValueMax=t}let i=this.allocator.getCapacity();i!==this.lastTextureCapacity&&(this.lastTextureCapacity=i,this.rebuildLayerBindGroups()),this.seriesManager.writeAllUniforms(t,this.canvasWidth,this.canvasHeight,this.viewport.viewTimeStart,this.viewport.viewTimeEnd,this.viewport.viewValueMin,this.viewport.viewValueMax);let a=Math.max(1,window.devicePixelRatio);return{x:Math.floor(10*a),y:Math.floor(10*a),width:Math.max(0,this.canvasWidth-Math.floor(20*a)),height:Math.max(0,this.canvasHeight-Math.floor(20*a))}}renderOverlay(){let{viewTimeStart:e,viewTimeEnd:t,viewValueMin:n,viewValueMax:r}=this.viewport;if(e===this.lastOverlayTimeStart&&t===this.lastOverlayTimeEnd&&n===this.lastOverlayValueMin&&r===this.lastOverlayValueMax&&this.canvasWidth===this.lastOverlayWidth&&this.canvasHeight===this.lastOverlayHeight)return;this.lastOverlayTimeStart=e,this.lastOverlayTimeEnd=t,this.lastOverlayValueMin=n,this.lastOverlayValueMax=r,this.lastOverlayWidth=this.canvasWidth,this.lastOverlayHeight=this.canvasHeight;let i=Math.max(1,window.devicePixelRatio),a=this.canvasWidth/i,o=this.canvasHeight/i;qt(this.gridSvg,this.viewport,a,o),Jt(this.axesSvg,this.viewport,a,o)}getLoadingRegions(){let e=[];for(let t of this.dataPipelines)e.push(...t.getLoadingRegions());return e}getViewport(){return{timeStart:this.viewport.viewTimeStart,timeEnd:this.viewport.viewTimeEnd}}dispose(){this.resizeObserver.disconnect(),this.inputController.detach(),this.seriesManager.dispose(),this.allocator.dispose(),this.fpsController.dispose()}rebuildLayerBindGroups(){this.seriesManager.updateBindGroups(this.allocator.createView())}updateCanvasSize(){let e=Math.max(1,window.devicePixelRatio),t=Math.floor(this.targetCanvas.clientWidth*e),n=this.canvasWidth;if(this.canvasWidth=t,this.canvasHeight=Math.floor(this.targetCanvas.clientHeight*e),n>0&&t!==n){let e=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*(t/n),r=(this.viewport.viewTimeStart+this.viewport.viewTimeEnd)/2;this.viewport.viewTimeStart=r-e/2,this.viewport.viewTimeEnd=r+e/2}}},pn=(0,h.memo)(({initialTimeStart:e,initialTimeEnd:t,chartSeed:n,seriesConfigs:i})=>{let a=(0,h.useRef)(null),o=(0,h.useRef)(null),s=(0,h.useRef)(null),c=Pe();return(0,h.useEffect)(()=>{if(r(c)||r(a.current)||r(o.current)||r(s.current))return;let l=new fn(c.device,c.bindGroupLayout,c,i,o.current,a.current,s.current,e,t,n);return c.registerChart(l)},[c,e,t,n,i]),(0,M.jsxs)(`div`,{className:`relative h-full w-full`,children:[(0,M.jsx)(`svg`,{ref:a,className:`absolute inset-0 h-full w-full bg-[#1a1a1a] pointer-events-none`}),(0,M.jsx)(`canvas`,{ref:o,className:`absolute inset-0 h-full w-full`}),(0,M.jsx)(`svg`,{ref:s,className:`absolute inset-0 h-full w-full pointer-events-none`})]})}),mn=110,hn=105,gn=100,_n=95,vn=x(.9,.2,.2,1),yn=x(1,.6,.1,1),bn=x(.2,.8,.3,1),xn=x(.2,.5,.9,1),Sn=x(.7,.7,.7,1),Cn=x(0,.5,1,1),wn=10,Tn=.6,En=x(1,.6,.1,1),Dn=2,On=4,kn=6,An=8,jn=10;function Mn(e){return e>mn?jn:e>hn?An:e>gn?kn:e>_n?On:Dn}function Nn(e){return e>mn?vn:e>hn?yn:e>gn?Sn:e>_n?bn:xn}var Pn=[[{chartType:j.Line,seedSuffix:``,colorFn:()=>Cn,sizeFn:()=>wn},{chartType:j.Candlestick,seedSuffix:`-series-2`,colorFn:(e,t,n)=>{let r=S(n[t].color);return x(r.r,r.g,r.b,Tn)}}],[{chartType:j.Candlestick,seedSuffix:``}],[{chartType:j.Line,seedSuffix:``,colorFn:()=>En,sizeFn:e=>Mn(e)}],[{chartType:j.Rhombus,seedSuffix:``,colorFn:e=>Nn(e)}]],Fn=(0,h.memo)(()=>{let e=Pe(),t=c(t=>{e&&(e.debugMode=t)});return(0,M.jsxs)(`div`,{className:`${m.fixedContainer} relative grid grid-cols-2 grid-rows-2`,children:[(0,M.jsx)(he,{renderer:e,onDebugChange:t}),pe.map((e,t)=>(0,M.jsx)(pn,{initialTimeStart:w+e[0],initialTimeEnd:w+e[1],chartSeed:`chart-${t}`,seriesConfigs:Pn[t]},`${e[0]}-${e[1]}`))]})}),In=(0,h.memo)(()=>(0,M.jsx)(d,{className:`h-full w-full`,children:(0,M.jsx)(ge,{children:(0,M.jsx)(Fe,{children:(0,M.jsx)(Fn,{})})})}));export{In as Timeseries};