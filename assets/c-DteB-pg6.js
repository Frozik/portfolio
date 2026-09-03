import{a as e,n as t,t as n}from"./c-HFhCPKiE.js";import{t as r}from"./c-CiQY6nnt.js";import{at as i,f as a,l as o,u as s,z as c}from"./e-D5M5uKrK.js";import{i as l,n as u,r as d}from"./c-BF9w7xaT.js";import"./c-Xg4Ssy0I.js";import{t as f}from"./c-hUOIOutD.js";import{a as p,i as m,n as h,o as g,r as _,s as v,t as y}from"./c-lTU2tYwr.js";import{t as b}from"./c-CI2IPTs3.js";import{t as x}from"./c-tFz5Q8ue.js";import{n as S,t as C}from"./c-ChaKfK4V.js";import{t as w}from"./c-JQa_l6qu.js";import{n as T,t as E}from"./c-D4KnC0m8.js";var D=e(r(),1),O=2048,k=1767225600,ee=.5,A=1e3,te=.7,ne=1.3,re=.95,ie=.18,ae=.005,j=31536e3,oe=`#ccc`,se=`rgba(50, 50, 50, 0.75)`,M=`#aaa`,ce=`#444`,le=`monospace`,ue=1024,de=[[0,j],[j/2-3888e3,19656e3],[j/2-1296e3,17064e3],[j/2-302400,16070400]],N=function(e){return e[e.Hour1=3600]=`Hour1`,e[e.Hour12=43200]=`Hour12`,e[e.Day1=86400]=`Day1`,e[e.Day4=345600]=`Day4`,e[e.Day16=1382400]=`Day16`,e[e.Day64=5529600]=`Day64`,e[e.Day256=22118400]=`Day256`,e}({}),P=function(e){return e[e.Line=0]=`Line`,e[e.Candlestick=1]=`Candlestick`,e[e.Rhombus=2]=`Rhombus`,e}({}),F=a({en:{debugOverlay:{debug:`Debug`,loadingDelay:`Loading delay`}},ru:{debugOverlay:{debug:`Отладка`,loadingDelay:`Задержка загрузки`}}}),I=n(),fe=250,pe=w(),L=`relative h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 transition-colors duration-200 checked:bg-brand-500`,me=`pointer-events-none absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-3`,he=(0,D.memo)(({renderer:e})=>{let[t,n]=(0,D.useState)(0),[r,i]=(0,D.useState)(!1),[a,o]=(0,D.useState)(!0);(0,D.useEffect)(()=>{if(e===null)return;let t=setInterval(()=>{n(e.renderFps),i(e.debugMode),o(e.instantLoad)},fe);return()=>clearInterval(t)},[e]);let c=s(()=>{e!==null&&(e.debugMode=!e.debugMode)}),l=s(()=>{e!==null&&(e.instantLoad=!e.instantLoad)});return(0,I.jsxs)(`div`,{className:`pointer-events-auto absolute top-1 right-1 z-10 flex select-none flex-col items-center gap-2 rounded bg-[#1a1a40]/80 px-3 py-2 font-mono text-xs text-white`,children:[(0,I.jsxs)(`span`,{className:`tabular-nums`,children:[t,` fps`]}),(0,I.jsxs)(`div`,{className:`flex w-full flex-col gap-1.5`,children:[!pe&&(0,I.jsxs)(`label`,{className:`flex cursor-pointer items-center justify-between gap-2`,children:[(0,I.jsx)(`span`,{children:F.debugOverlay.debug}),(0,I.jsxs)(`span`,{className:`relative inline-flex items-center`,children:[(0,I.jsx)(`input`,{type:`checkbox`,checked:r,onChange:c,className:`peer ${L}`}),(0,I.jsx)(`span`,{className:me})]})]}),(0,I.jsxs)(`label`,{className:`flex cursor-pointer items-center justify-between gap-2`,children:[(0,I.jsx)(`span`,{children:F.debugOverlay.loadingDelay}),(0,I.jsxs)(`span`,{className:`relative inline-flex items-center`,children:[(0,I.jsx)(`input`,{type:`checkbox`,checked:!a,onChange:l,className:`peer ${L}`}),(0,I.jsx)(`span`,{className:me})]})]})]})]})}),ge=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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
`,R=`struct Uniforms {
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
`,_e=`// Debug shader: draws vertical lines at block boundaries.
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
`,ve=`struct VSOut {
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
`,ye=`// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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
`,be=R+ve,xe=R+ge,Se=R+ye,Ce=R+_e,we=2,Te=5,Ee=`rgba(100, 160, 255, 0.6)`,De=`rgba(30, 80, 180, 0.8)`,Oe=1200;async function ke(){o(!i(navigator.gpu),`WebGPU is not supported`);let e=await navigator.gpu.requestAdapter();o(!i(e),`WebGPU adapter not available`);let t=await e.requestDevice(),n=new OffscreenCanvas(ue,768),r=n.getContext(`webgpu`);o(!i(r),`Failed to get WebGPU context on OffscreenCanvas`);let a=navigator.gpu.getPreferredCanvasFormat();r.configure({device:t,format:a,alphaMode:`premultiplied`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST});let s=t.createShaderModule({code:be}),c=t.createShaderModule({code:xe}),l=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]}),u={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},d=t.createPipelineLayout({bindGroupLayouts:[l]}),f=t.createRenderPipeline({layout:d,vertex:{module:s,entryPoint:`vs`},fragment:{module:s,entryPoint:`fs`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),p=t.createRenderPipeline({layout:d,vertex:{module:c,entryPoint:`vsCandlestick`},fragment:{module:c,entryPoint:`fsCandlestick`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),m=t.createShaderModule({code:Se}),h=t.createRenderPipeline({layout:d,vertex:{module:m,entryPoint:`vsRhombus`},fragment:{module:m,entryPoint:`fsRhombus`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),g=t.createShaderModule({code:Ce});return new Ae(t,a,l,f,p,h,t.createRenderPipeline({layout:d,vertex:{module:g,entryPoint:`vsDebugLines`},fragment:{module:g,entryPoint:`fsDebugLines`,targets:[{format:a,blend:u}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),n,r)}var Ae=class{device;format;bindGroupLayout;linePipeline;candlestickPipeline;rhombusPipeline;debugPipeline;debugMode=!1;instantLoad=!0;renderFps=0;offscreen;ctx;charts=new Set;msaaManager=b(4);renderTargetPool=new g;animationFrameId=0;lastFrameTime=0;disposed=!1;needsReconfigure=!1;fpsMeter=new x({onUpdate:e=>{this.renderFps=e}});constructor(e,t,n,r,i,a,o,s,c){this.device=e,this.format=t,this.bindGroupLayout=n,this.linePipeline=r,this.candlestickPipeline=i,this.rhombusPipeline=a,this.debugPipeline=o,this.offscreen=s,this.ctx=c}registerChart(e){return this.charts.add(e),this.charts.size===1&&this.startAnimationLoop(),()=>{this.charts.delete(e),e.dispose(),this.charts.size===0&&this.stopAnimationLoop()}}destroy(){if(!this.disposed){this.disposed=!0,this.stopAnimationLoop();for(let e of this.charts)e.dispose();this.charts.clear(),this.msaaManager.dispose(),this.renderTargetPool.dispose(),this.device.destroy()}}getMinFrameIntervalMs(){let e;for(let t of this.charts){let n=t.fpsController.getFrameIntervalMs();(i(e)||n<e)&&(e=n)}return e??100}startAnimationLoop(){if(this.disposed)return;let e=t=>{if(this.disposed)return;for(let e of this.charts)e.fpsController.tick();let n=this.getMinFrameIntervalMs();if(t-this.lastFrameTime<n-we){this.animationFrameId=requestAnimationFrame(e);return}this.lastFrameTime=t,this.fpsMeter.tick(t,this.getMinFrameIntervalMs()),this.renderAllCharts(),this.animationFrameId=requestAnimationFrame(e)};this.animationFrameId=requestAnimationFrame(e)}stopAnimationLoop(){cancelAnimationFrame(this.animationFrameId),this.animationFrameId=0}drawLoadingBars(e){let t=e.getLoadingRegions();if(t.length===0)return;let n=e.getViewport(),r=n.timeEnd-n.timeStart;if(r<=0)return;let i=e.target2dContext,a=e.width,o=e.height,s=Te*Math.max(1,window.devicePixelRatio),c=o-s,l=performance.now()%Oe/Oe;for(let e of t){let t=(e.timeStart-n.timeStart)/r,o=(e.timeEnd-n.timeStart)/r,u=Math.max(0,Math.floor(t*a)),d=Math.min(a,Math.ceil(o*a))-u;if(d<=0)continue;let f=s*2,p=c-f+l*f,m=i.createLinearGradient(0,p,0,p+f);m.addColorStop(0,Ee),m.addColorStop(.5,De),m.addColorStop(1,Ee),i.save(),i.beginPath(),i.rect(u,c,d,s),i.clip(),i.fillStyle=m,i.fillRect(u,p,d,f),i.restore()}}ensureMsaaView(e,t){return this.msaaManager.ensureView(this.device,this.format,e,t)}renderAllCharts(){for(let e of this.charts){e.update();let{width:t,height:n}=e;if(t===0||n===0)continue;let r=e.prepareDrawCommands();i(r)||(this.renderChart(e,r),e.renderCanvasAxes(),this.drawLoadingBars(e))}}renderChart(e,t){let{width:n,height:r}=e;(this.offscreen.width!==n||this.offscreen.height!==r||this.needsReconfigure)&&(this.offscreen.width=n,this.offscreen.height=r,this.ctx.configure({device:this.device,format:this.format,alphaMode:`premultiplied`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST}),this.needsReconfigure=!1);let a=this.renderTargetPool.acquire(this.device,n,r,this.format),o=this.ensureMsaaView(n,r);if(i(o)){this.renderTargetPool.release(a);return}let s=this.device.createCommandEncoder(),c=s.beginRenderPass({colorAttachments:[{view:o,resolveTarget:a.createView(),loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});e.seriesManager.renderAll(c,t),this.debugMode&&e.seriesManager.renderDebug(c,this.debugPipeline,t),c.end();let l=this.ctx.getCurrentTexture();s.copyTextureToTexture({texture:a},{texture:l},[n,r]),this.device.queue.submit([s.finish()]),this.renderTargetPool.release(a),e.syncCanvasSize();let u=this.offscreen.transferToImageBitmap();this.needsReconfigure=!0,e.renderCanvasGrid(),e.target2dContext.drawImage(u,0,0),u.close()}},je={status:`initializing`,renderer:null},Me={status:`unsupported`,renderer:null},Ne=(0,D.createContext)(je);function z(){return(0,D.useContext)(Ne)}var Pe=(0,D.memo)(({children:e})=>{let[t,n]=(0,D.useState)(je);return(0,D.useEffect)(()=>{let e=!1,t;return ke().then(r=>{if(e){r.destroy();return}t=r,n({status:`ready`,renderer:r})}).catch(e=>{console.warn(`timeseries: shared WebGPU renderer init failed`,e),n(Me)}),()=>{e=!0,i(t)||t.destroy()}},[]),(0,I.jsx)(Ne,{value:t,children:e})});function B(e,t){let n=(t-e.timeStart)/(e.timeEnd-e.timeStart);return e.plotLeft+n*e.plotWidth}function V(e,t){let n=(t-e.valueMin)/(e.valueMax-e.valueMin);return e.plotBottom-n*e.plotHeight}var Fe=2,Ie=3,Le=4;function Re(e,t){let{plotLeft:n,plotRight:r,plotBottom:i}=e,a=18*e.dpr,o=Ie*e.dpr;return{ticks:e.xTicks,toPixel:t=>B(e,t),isVisible:e=>e>=n&&e<=r,strokeTickMark:(e,n)=>{e.moveTo(n,i),e.lineTo(n,i-t.tickLength)},placeLabel:(e,r)=>{let s=e-r/2-t.bgPaddingX;return s<n+a?null:{boxLeft:s,centerY:i-t.tickLength-o-t.fontSize/2,textX:e,textAlign:`center`}}}}function ze(e,t){let{plotLeft:n,plotTop:r,plotBottom:i}=e,a=18*e.dpr,o=n+t.tickLength+Le*e.dpr;return{ticks:e.yTicks,toPixel:t=>V(e,t),isVisible:e=>e>=r&&e<=i,strokeTickMark:(e,r)=>{e.moveTo(n,r),e.lineTo(n+t.tickLength,r)},placeLabel:e=>e+t.boxHeight/2>i-a?null:{boxLeft:o-t.bgPaddingX,centerY:e,textX:o,textAlign:`start`}}}function H(e,t,n,r){for(let i of t.ticks){let a=t.toPixel(i.position);if(!t.isVisible(a))continue;e.strokeStyle=M,e.lineWidth=n.lineWidth,e.beginPath(),t.strokeTickMark(e,a),e.stroke();let o=r.measureWidth(e,i.label),s=t.placeLabel(a,o);s!==null&&(e.fillStyle=se,e.beginPath(),e.roundRect(s.boxLeft,s.centerY-n.boxHeight/2,o+n.bgPaddingX*2,n.boxHeight,n.bgRadius),e.fill(),e.fillStyle=oe,e.textAlign=s.textAlign,e.fillText(i.label,s.textX,s.centerY+n.glyphCenterOffset))}}function Be(e,t,n){let{dpr:r,plotLeft:i,plotTop:a,plotRight:o,plotBottom:s}=t,c=11*r,l=2*r;e.strokeStyle=M,e.lineWidth=r,e.beginPath(),e.moveTo(i,a),e.lineTo(i,s),e.lineTo(o,s),e.stroke(),e.font=`${c}px ${le}`,e.textBaseline=`alphabetic`;let{centerOffset:u}=n.getGlyphMetrics(e),d={fontSize:c,tickLength:5*r,lineWidth:r,bgPaddingX:3*r,bgRadius:Fe*r,boxHeight:c+l*2,glyphCenterOffset:u};H(e,Re(t,d),d,n),H(e,ze(t,d),d,n)}var Ve=.5,U=10;function He(e,t){let{dpr:n,plotLeft:r,plotTop:i,plotRight:a,plotBottom:o,xTicks:s,yTicks:c}=t;e.fillStyle=u,e.fillRect(0,0,t.canvasWidth,t.canvasHeight),e.strokeStyle=ce,e.lineWidth=n*Ve,e.setLineDash([U*n,U*n]),e.beginPath();for(let n of s){let s=B(t,n.position);s<r||s>a||(e.moveTo(s,i),e.lineTo(s,o))}for(let n of c){let s=V(t,n.position);s<i||s>o||(e.moveTo(r,s),e.lineTo(a,s))}e.stroke(),e.setLineDash([])}function W(e){return e.row*8+e.slotIndex}var Ue=class{tree=new v;slotMap=new Map;insert(e){e.minX=e.timeStart,e.maxX=e.timeEnd,e.minY=e.scale,e.maxY=e.scale,this.tree.insert(e),this.slotMap.set(W(e.slot),e)}remove(e){this.tree.remove(e),this.slotMap.delete(W(e.slot))}removeBySlot(e){let t=this.slotMap.get(W(e));t!==void 0&&this.remove(t)}queryVisible(e,t,n,r){let i=this.tree.search({minX:t,maxX:n,minY:e,maxY:e});return r===void 0?i:i.filter(e=>e.chartType===r)}findCovering(e,t,n,r){return this.tree.search({minX:t,maxX:n,minY:e,maxY:e}).find(e=>e.chartType===r&&e.timeStart<=t&&e.timeEnd>=n)}clear(){this.tree.clear(),this.slotMap.clear()}getEntryCount(){return this.slotMap.size}};function G(e,t,n){return{left:10*n,top:10*n,width:e-20*n,height:t-20*n}}var K=60,q=3600,We=86400,J=60,Y=24,Ge=[1,2,5],Ke=8,qe=2,Je=70,Ye=20,Xe=10;function X(e){let t=BigInt(Math.trunc(e))*1000000000n;return c.Instant.fromEpochNanoseconds(t)}function Ze(e,t){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}`}function Qe(e,t,n,r,i){if(e.length<=1||r<=0)return e;let a=n-t;if(a<=0)return e;let o=i+Xe,s=[],c=-1/0;for(let n of e){let e=(n.position-t)/a*r;e-c>=o&&(s.push(n),c=e)}return s}function $e(e,t,n,r){return Qe(it(e,t,n),e,t,r,Je)}function et(e,t){let n=[],r=X(e).toZonedDateTimeISO(`UTC`),i=X(t).toZonedDateTimeISO(`UTC`),a=r.with({day:1,hour:0,minute:0,second:0,nanosecond:0});for(c.ZonedDateTime.compare(a,r)<0&&(a=a.add({months:1}));c.ZonedDateTime.compare(a,i)<=0;)n.push({position:Number(a.epochNanoseconds/1000000000n),label:a.toPlainDate().toLocaleString(`en-US`,{month:`short`})}),a=a.add({months:1});return n}function tt(e,t){let n=[],r=X(e).toZonedDateTimeISO(`UTC`),i=X(t).toZonedDateTimeISO(`UTC`),a=r.with({hour:0,minute:0,second:0,nanosecond:0});for(c.ZonedDateTime.compare(a,r)<0&&(a=a.add({days:1}));c.ZonedDateTime.compare(a,i)<=0;)n.push({position:Number(a.epochNanoseconds/1000000000n),label:String(a.day)}),a=a.add({days:1});return n}function nt(e,t){let n=[],r=Math.ceil(e/q),i=Math.floor(t/q);for(let e=r;e<=i;e++){let t=e*q,r=(e%Y+Y)%Y;n.push({position:t,label:Ze(r,0)})}return n}function rt(e,t){let n=[],r=Math.ceil(e/K),i=Math.floor(t/K);for(let e=r;e<=i;e++){let t=e*K,r=Math.floor(t%We/K),i=Math.floor(r/J),a=r%J;n.push({position:t,label:Ze((i%Y+Y)%Y,a)})}return n}function it(e,t,n){switch(n){case N.Day256:case N.Day64:return et(e,t);case N.Day16:case N.Day4:return tt(e,t);case N.Day1:return nt(e,t);case N.Hour12:case N.Hour1:return rt(e,t)}}function at(e){if(e<=0)return 1;let t=10**Math.floor(Math.log10(e)),n=e/t;for(let e of Ge)if(e>=n)return e*t;return Ge[0]*t*10}function ot(e,t,n){let r=t-e;if(r<=0)return[{position:e,label:st(e,1)}];let i=at(r/Ke);Math.floor(r/i)<qe&&(i=at(r/qe));let a=Math.max(0,-Math.floor(Math.log10(i))+1),o=[],s=Math.ceil(e/i)*i;for(let n=s;n<=t+i*.01;n+=i)n>=e&&n<=t&&o.push({position:n,label:st(n,a)});return Qe(o,e,t,n,Ye)}function st(e,t){return e.toFixed(t)}var ct=50,lt=class{cache;constructor(e=ct){this.cache=new p({max:e})}getXTicks(e,t,n,r){let i=`x:${e}:${t}:${n}:${Math.round(r)}`,a=this.cache.get(i);if(a!==void 0)return a;let o=$e(e,t,n,r);return this.cache.set(i,o),o}getYTicks(e,t,n){let r=`y:${e}:${t}:${Math.round(n)}`,i=this.cache.get(r);if(i!==void 0)return i;let a=ot(e,t,n);return this.cache.set(r,a),a}},ut=[N.Hour1,N.Hour12,N.Day1,N.Day4,N.Day16,N.Day64,N.Day256];function dt(e,t){let n=t-e;for(let e of ut)if(n<=e)return e;return N.Day256}function Z(e,t,n,r){let i=t-e;return i>=r-n?[n,r]:e<n?[n,n+i]:t>r?[r-i,r]:[e,t]}function ft(e,t){let n=t-e,r=(n>0?n:Math.abs(e))*.1||1;return[e-r,t+r]}function pt(e,t,n,r){let i=e.length;if(i===0)return;let a=0,o=i;for(;a<o;){let t=a+o>>1;e[t]<n?a=t+1:o=t}let s=a;for(a=s,o=i;a<o;){let t=a+o>>1;e[t]<=r?a=t+1:o=t}let c=a;if(s>=c)return;let l=1/0,u=-1/0;for(let e=s;e<c;e++){let n=t[e];n<l&&(l=n),n>u&&(u=n)}return[l,u]}function mt(e,t,n){let r=1/0,i=-1/0;for(let a of e)for(let e of a){let a=pt(e.pointTimes,e.pointValues,t,n);a!==void 0&&(r=Math.min(r,a[0]),i=Math.max(i,a[1]))}return r<i?[r,i]:void 0}function ht(e,t,n,r){let i=n*((t-e)/r);return[e-i,t-i]}function gt(e,t,n,r){let i=t-e,a=e+i*r,o=Math.max(i*n,60);return[a-o*r,a+o*(1-r)]}var _t=class{tickCache=new lt;layout=null;getLayout(e,t,n,r){let{viewTimeStart:i,viewTimeEnd:a,viewValueMin:o,viewValueMax:s}=e,c=this.layout;if(c!==null&&c.timeStart===i&&c.timeEnd===a&&c.valueMin===o&&c.valueMax===s&&c.canvasWidth===t&&c.canvasHeight===n)return c;let{left:l,top:u,width:d,height:f}=G(t,n,r);if(d<=0||f<=0)return this.layout=null,null;let p=dt(i,a),m=d/r,h=f/r;return this.layout={timeStart:i,timeEnd:a,valueMin:o,valueMax:s,canvasWidth:t,canvasHeight:n,dpr:r,plotLeft:l,plotTop:u,plotWidth:d,plotHeight:f,plotRight:l+d,plotBottom:u+f,xTicks:this.tickCache.getXTicks(i,a,p,m),yTicks:this.tickCache.getYTicks(o,s,h)},this.layout}},vt=class{canvas;onWidthChange;canvasWidth=0;canvasHeight=0;constructor(e,t){this.canvas=e,this.onWidthChange=t,this.measure()}get width(){return this.canvasWidth}get height(){return this.canvasHeight}get devicePixelRatio(){return Math.max(1,window.devicePixelRatio)}measure(){let e=this.devicePixelRatio,t=Math.floor(this.canvas.clientWidth*e),n=this.canvasWidth;this.canvasWidth=t,this.canvasHeight=Math.floor(this.canvas.clientHeight*e),n>0&&t!==n&&this.onWidthChange(t,n)}syncBackingStore(){return this.canvas.width!==this.canvasWidth||this.canvas.height!==this.canvasHeight?(this.canvas.width=this.canvasWidth,this.canvas.height=this.canvasHeight,!0):!1}},yt=class{viewport;canvas;dataMinTime;dataMaxTime;fpsController;activePointers=new Map;lastPinchDistance=0;velocitySamples=[];inertiaVelocity=0;lastInertiaTimestamp=0;handlePointerDown;handlePointerMove;handlePointerUp;handlePointerCancel;handleWheel;constructor(e,t,n,r,a){this.viewport=e,this.canvas=t,this.dataMinTime=n,this.dataMaxTime=r,this.fpsController=a,this.handlePointerDown=e=>{this.canvas.setPointerCapture(e.pointerId),this.activePointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),this.fpsController.raise(60),this.inertiaVelocity=0,this.velocitySamples.length=0,this.activePointers.size===1?this.canvas.style.cursor=`grabbing`:this.activePointers.size===2&&(this.lastPinchDistance=this.getPointerDistance())},this.handlePointerMove=e=>{let t=this.activePointers.get(e.pointerId);if(t===void 0)return;if(this.activePointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),this.fpsController.raise(60),this.activePointers.size===2){let e=this.getPointerDistance(),t=E(this.lastPinchDistance,e);if(i(t))return;let n=this.getPointerCenter(),[r,a]=Z(...gt(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,t,n),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=r,this.viewport.targetTimeEnd=a,this.lastPinchDistance=e;return}if(this.activePointers.size!==1)return;let n=e.clientX-t.clientX;this.recordVelocitySample(n,e.timeStamp);let[r,a]=Z(...ht(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,n,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=r,this.viewport.viewTimeEnd=a,this.viewport.targetTimeStart=r,this.viewport.targetTimeEnd=a},this.handlePointerUp=e=>{this.canvas.hasPointerCapture(e.pointerId)&&this.canvas.releasePointerCapture(e.pointerId),this.activePointers.delete(e.pointerId),this.activePointers.size===0&&(this.canvas.style.cursor=`grab`,this.startInertia())},this.handlePointerCancel=e=>{this.activePointers.delete(e.pointerId),this.activePointers.size===0&&(this.canvas.style.cursor=`grab`)},this.handleWheel=e=>{e.preventDefault();let t=this.canvas.getBoundingClientRect(),n=(e.clientX-t.left)/t.width,r=e.deltaY>0?ne:te,[i,a]=Z(...gt(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,r,n),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a,this.fpsController.raise(60)}}get isInteracting(){return this.activePointers.size>0}applyInertia(){if(Math.abs(this.inertiaVelocity)<.01)return this.inertiaVelocity=0,!1;let e=performance.now(),t=e-this.lastInertiaTimestamp;this.lastInertiaTimestamp=e;let n=this.inertiaVelocity*t,[r,i]=Z(...ht(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,n,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);if(r===this.viewport.viewTimeStart&&i===this.viewport.viewTimeEnd)return this.inertiaVelocity=0,!1;let a=r-this.viewport.viewTimeStart,o=i-this.viewport.viewTimeEnd;return this.viewport.viewTimeStart=r,this.viewport.viewTimeEnd=i,this.viewport.targetTimeStart+=a,this.viewport.targetTimeEnd+=o,this.inertiaVelocity*=re,!0}attach(){this.canvas.addEventListener(`pointerdown`,this.handlePointerDown),this.canvas.addEventListener(`pointermove`,this.handlePointerMove),this.canvas.addEventListener(`pointerup`,this.handlePointerUp),this.canvas.addEventListener(`pointercancel`,this.handlePointerCancel),this.canvas.addEventListener(`wheel`,this.handleWheel,{passive:!1}),this.canvas.style.cursor=`grab`}detach(){this.canvas.removeEventListener(`pointerdown`,this.handlePointerDown),this.canvas.removeEventListener(`pointermove`,this.handlePointerMove),this.canvas.removeEventListener(`pointerup`,this.handlePointerUp),this.canvas.removeEventListener(`pointercancel`,this.handlePointerCancel),this.canvas.removeEventListener(`wheel`,this.handleWheel)}recordVelocitySample(e,t){this.velocitySamples.push({dx:e,timestamp:t}),this.velocitySamples.length>5&&this.velocitySamples.shift()}startInertia(){if(this.velocitySamples.length<2){this.velocitySamples.length=0;return}let e=this.velocitySamples[0],t=this.velocitySamples[this.velocitySamples.length-1].timestamp-e.timestamp;if(t<=0){this.velocitySamples.length=0;return}let n=0;for(let e of this.velocitySamples)n+=e.dx;this.inertiaVelocity=n/t,this.lastInertiaTimestamp=performance.now(),this.velocitySamples.length=0}getPointerDistance(){let e=[...this.activePointers.values()];return T(e[0].clientX,e[0].clientY,e[1].clientX,e[1].clientY)}getPointerCenter(){let e=[...this.activePointers.values()],t=this.canvas.getBoundingClientRect();return((e[0].clientX+e[1].clientX)/2-t.left)/t.width}},bt=`rgba32float`,xt=class{device;textureWidth;textureUsage;onEvict;pool;texture;constructor(e,t={}){let{initialRows:n=4,maxRows:r=512,textureWidth:i=O,onEvict:a}=t;this.device=e,this.textureWidth=i,this.onEvict=a,this.textureUsage=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC,this.texture=e.createTexture({size:[i,n],format:bt,usage:this.textureUsage}),this.pool=new _({initialCapacity:n*8,maxCapacity:r*8,growCapacity:m,onGrow:this.handleGrow,onEvict:this.handleEvict})}allocateSlot(){let e=this.pool.acquire();return e===void 0?null:this.unflattenSlot(e)}writeSlotData(e,t,n){let r=e.row*this.textureWidth+e.slotIndex*256,i=r%this.textureWidth,a=Math.floor(r/this.textureWidth),o=this.textureWidth*4*Float32Array.BYTES_PER_ELEMENT,s=t.subarray(0,n*4);this.device.queue.writeTexture({texture:this.texture,origin:[i,a,0]},s,{bytesPerRow:o,rowsPerImage:1},[n,1,1])}touch(e){this.pool.touch(this.flattenSlot(e))}releaseSlot(e){this.pool.release(this.flattenSlot(e))}getTextureOffset(e){return e.row*this.textureWidth+e.slotIndex*256}createView(){return this.texture.createView()}getCapacity(){return this.pool.capacity/8}getAllocatedSlotCount(){return this.pool.allocatedCount}getHighWaterMark(){return this.pool.highWaterMark}dispose(){this.texture.destroy(),this.pool.clear()}handleEvict=e=>{this.onEvict?.(this.unflattenSlot(e))};handleGrow=({newCapacity:e,usedSlots:t})=>{let n=e/8,r=this.device.createTexture({size:[this.textureWidth,n],format:bt,usage:this.textureUsage});if(t>0){let e=Math.ceil(t/8),n=this.device.createCommandEncoder();n.copyTextureToTexture({texture:this.texture,origin:[0,0,0]},{texture:r,origin:[0,0,0]},[this.textureWidth,e,1]),this.device.queue.submit([n.finish()])}this.texture.destroy(),this.texture=r};flattenSlot(e){return e.row*8+e.slotIndex}unflattenSlot(e){return{row:Math.floor(e/8),slotIndex:e%8}}},St=500,Ct=class{widthCache;currentFont=``;glyphMetrics=null;constructor(e=St){this.widthCache=new p({max:e})}measureWidth(e,t){this.ensureFont(e);let n=this.widthCache.get(t);if(n!==void 0)return n;let r=e.measureText(t).width;return this.widthCache.set(t,r),r}getGlyphMetrics(e){if(this.ensureFont(e),this.glyphMetrics!==null)return this.glyphMetrics;let t=e.measureText(`0`),n=t.actualBoundingBoxAscent,r=t.actualBoundingBoxDescent;return this.glyphMetrics={ascent:n,descent:r,centerOffset:(n-r)/2},this.glyphMetrics}ensureFont(e){e.font!==this.currentFont&&(this.currentFont=e.font,this.widthCache.clear(),this.glyphMetrics=null)}},wt=e(t(((e,t)=>{(function(n,r){typeof e==`object`?t.exports=r():typeof define==`function`&&define.amd?define(r):n.Alea=r()})(e,function(){return e.importState=function(t){var n=new e;return n.importState(t),n},e;function e(){return function(e){var n=0,r=0,i=0,a=1;e.length==0&&(e=[+new Date]);var o=t();n=o(` `),r=o(` `),i=o(` `);for(var s=0;s<e.length;s++)n-=o(e[s]),n<0&&(n+=1),r-=o(e[s]),r<0&&(r+=1),i-=o(e[s]),i<0&&(i+=1);o=null;var c=function(){var e=2091639*n+a*23283064365386963e-26;return n=r,r=i,i=e-(a=e|0)};return c.next=c,c.uint32=function(){return c()*4294967296},c.fract53=function(){return c()+(c()*2097152|0)*11102230246251565e-32},c.version=`Alea 0.9`,c.args=e,c.exportState=function(){return[n,r,i,a]},c.importState=function(e){n=+e[0]||0,r=+e[1]||0,i=+e[2]||0,a=+e[3]||0},c}(Array.prototype.slice.call(arguments))}function t(){var e=4022871197,t=function(t){t=t.toString();for(var n=0;n<t.length;n++){e+=t.charCodeAt(n);var r=.02519603282416938*e;e=r>>>0,r-=e,r*=e,e=r>>>0,r-=e,e+=r*4294967296}return(e>>>0)*23283064365386963e-26};return t.version=`Mash 0.9`,t}})}))(),1),Tt=Math.sqrt(3),Et=Math.sqrt(5),Dt=.5*(Tt-1),Q=(3-Tt)/6;(Et-1)/4,(5-Et)/20;var Ot=e=>Math.floor(e)|0,kt=new Float64Array([1,1,-1,1,1,-1,-1,-1,1,0,-1,0,1,0,-1,0,0,1,0,-1,0,1,0,-1]);function At(e=Math.random){let t=jt(e),n=new Float64Array(t).map(e=>kt[e%12*2]),r=new Float64Array(t).map(e=>kt[e%12*2+1]);return function(e,i){let a=0,o=0,s=0,c=(e+i)*Dt,l=Ot(e+c),u=Ot(i+c),d=(l+u)*Q,f=l-d,p=u-d,m=e-f,h=i-p,g,_;m>h?(g=1,_=0):(g=0,_=1);let v=m-g+Q,y=h-_+Q,b=m-1+2*Q,x=h-1+2*Q,S=l&255,C=u&255,w=.5-m*m-h*h;if(w>=0){let e=S+t[C],i=n[e],o=r[e];w*=w,a=w*w*(i*m+o*h)}let T=.5-v*v-y*y;if(T>=0){let e=S+g+t[C+_],i=n[e],a=r[e];T*=T,o=T*T*(i*v+a*y)}let E=.5-b*b-x*x;if(E>=0){let e=S+1+t[C+1],i=n[e],a=r[e];E*=E,s=E*E*(i*b+a*x)}return 70*(a+o+s)}}function jt(e){let t=new Uint8Array(512);for(let e=0;e<256;e++)t[e]=e;for(let n=0;n<255;n++){let r=n+~~(e()*(256-n)),i=t[n];t[n]=t[r],t[r]=i}for(let e=256;e<512;e++)t[e]=t[e-256];return t}var Mt=180,Nt=1,Pt=9,Ft=7,It=.5;function Lt(e){return(e-k)/j}function Rt(e){let t=At((0,wt.default)(e));return e=>{let n=Lt(e),r=0,i=15,a=4;for(let e=0;e<6;e++)r+=i*t(n*a,e*A),i*=ee,a*=2;return 100+r}}var zt=y(.2,.8,.3,1),Bt=y(.9,.2,.2,1);function Vt(e,t){let n=e(Lt(t)*4,Ft*A);return Nt+Math.max(0,Math.min(1,(n+1)*It))*Pt}function Ht(e,t,n){let r=Mt,i=(t-e)/179,a=Rt(n),o=At((0,wt.default)(`${n}-size`)),s=Array(r),c=Array(r);for(let t=0;t<r;t++)s[t]=e+t*i,c[t]=a(s[t]);let l=Array(r);for(let e=0;e<r;e++){let t=c[Math.min(e+1,179)]>=c[e];l[e]={time:s[e],value:c[e],size:Vt(o,s[e]),color:t?zt:Bt}}return l}var Ut=3;function Wt(e,t,n){let r=new ArrayBuffer(e.length*4*Float32Array.BYTES_PER_ELEMENT),i=new Float32Array(r),a=new Uint32Array(r);for(let r=0;r<e.length;r++){let o=r*4,s=e[r];i[o]=s.time-t,i[o+1]=s.value-n,i[o+2]=s.size,a[o+Ut]=Jt(s.color)}return i}var Gt=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),Kt=new Float32Array(Gt),qt=new Uint32Array(Gt);function Jt(e){return Kt[0]=e,qt[0]}var Yt=1;function Xt(e,t,n,r=Yt){let i=n,a=Math.floor(e/i)*i-r*i,o=Math.ceil(t/i)*i+r*i,s=Math.round((o-a)/i),c=Array(s);for(let e=0;e<s;e++){let t=a+e*i;c[e]={start:t,end:t+i}}return c}var Zt=1e3,Qt=class{allocator;registry;seed;chartType;colorFn;sizeFn;isInstantLoad;pendingBlocks=new Map;constructor(e,t,n,r,i,a,o){this.allocator=e,this.registry=t,this.seed=n,this.chartType=r,this.colorFn=i,this.sizeFn=a,this.isInstantLoad=o}ensureBlocksForViewport(e,t,n){let r=Xt(e,t,n),i=[],a=performance.now(),o=new Set;for(let e of r){let t=`${n}:${e.start}:${e.end}`;o.add(t);let r=this.registry.findCovering(n,e.start,e.end,this.chartType);if(r!==void 0){this.allocator.touch(r.slot),i.push(r),this.pendingBlocks.delete(t);continue}let s=this.pendingBlocks.get(t);if(s===void 0){this.pendingBlocks.set(t,{periodStart:e.start,periodEnd:e.end,scale:n,requestTime:a});continue}if(this.isInstantLoad?.()===!0||a-s.requestTime>=Zt){this.pendingBlocks.delete(t);let r=this.generateBlocksForPeriod(e.start,e.end,n);i.push(...r)}}for(let e of this.pendingBlocks.keys())o.has(e)||this.pendingBlocks.delete(e);return i.sort((e,t)=>e.timeStart-t.timeStart)}getLoadingRegions(){let e=performance.now(),t=[];for(let n of this.pendingBlocks.values()){let r=e-n.requestTime,i=Math.min(1,r/Zt);t.push({timeStart:n.periodStart,timeEnd:n.periodEnd,progress:i})}return t}generateBlocksForPeriod(e,t,n){let r=Ht(e,t,this.seed);if(r.length===0)return[];if(this.colorFn!==void 0||this.sizeFn!==void 0)for(let e=0;e<r.length;e++){let t=r[e];r[e]={...t,color:this.colorFn===void 0?t.color:this.colorFn(t.value,e,r),size:this.sizeFn===void 0?t.size:this.sizeFn(t.value,e,r)}}let i=[];if(r.length<=256){let a=this.createBlock(r,e,t,n);a!==null&&i.push(a)}else{let e=Math.ceil(r.length/256);for(let t=0;t<e;t++){let e=t*256,a=Math.min(e+256,r.length),o=r.slice(e,a),s=o[0].time,c=o[o.length-1].time,l=this.createBlock(o,s,c,n);l!==null&&i.push(l)}}return i}createBlock(e,t,n,r){let i=this.allocator.allocateSlot();if(i===null)return null;let a=e[0].time,o=e[0].value,s=Wt(e,a,o);this.allocator.writeSlotData(i,s,e.length);let c=new Float64Array(e.length),l=new Float64Array(e.length);for(let t=0;t<e.length;t++)c[t]=e[t].time,l[t]=e[t].value;let u={minX:0,maxX:0,minY:0,maxY:0,timeStart:t,timeEnd:n,scale:r,chartType:this.chartType,slot:i,pointCount:e.length,baseTime:a,baseValue:o,pointTimes:c,pointValues:l};return this.registry.insert(u),u}},$=4,$t=$*Float32Array.BYTES_PER_ELEMENT,en=64,tn=class{device;buffer;cpuBuffer;f32View;u32View;allocator;maxBlocks;constructor(e,t,n=en){this.device=e,this.allocator=t,this.maxBlocks=n;let r=n*$t;this.buffer=e.createBuffer({size:r,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.cpuBuffer=new ArrayBuffer(r),this.f32View=new Float32Array(this.cpuBuffer),this.u32View=new Uint32Array(this.cpuBuffer)}writeDescriptors(e,t){let n=Math.min(e.length,this.maxBlocks);if(n===0)return{totalInstances:0,globalBaseTime:0,globalBaseValue:0};let r=e[0].baseTime,i=e[0].baseValue,a=0;for(let t=0;t<n;t++){let n=e[t],o=t*$,s=this.allocator.getTextureOffset(n.slot);this.u32View[o]=s,this.u32View[o+1]=n.pointCount,this.f32View[o+2]=n.baseTime-r,this.f32View[o+3]=n.baseValue-i,a+=n.pointCount}let o=n*$t;return this.device.queue.writeBuffer(this.buffer,0,this.cpuBuffer,0,o),{totalInstances:t?Math.max(0,a-1):a,globalBaseTime:r,globalBaseValue:i}}getBuffer(){return this.buffer}getTextureWidth(){return O}dispose(){this.buffer.destroy()}},nn=6,rn=class{verticesPerInstance;needsStitching;device;bindGroupLayout;uniformBuffer;uniformView;descriptorBuffer;currentBindGroup=null;currentInstanceCount=0;currentBlockCount=0;constructor(e,t){this.verticesPerInstance=e,this.needsStitching=t}init(e,t,n){this.device=e,this.bindGroupLayout=t;let r=C(R);this.uniformView=S(r.uniforms.U),this.uniformBuffer=this.device.createBuffer({size:this.uniformView.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.descriptorBuffer=new tn(e,n)}updateBindGroup(e){this.currentBindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:e},{binding:2,resource:{buffer:this.descriptorBuffer.getBuffer()}}]})}writeUniforms(e,t,n,r,i,a,o){if(e.length===0){this.currentInstanceCount=0,this.currentBlockCount=0;return}this.currentBlockCount=e.length;let{totalInstances:s,globalBaseTime:c,globalBaseValue:l}=this.descriptorBuffer.writeDescriptors(e,this.needsStitching);this.currentInstanceCount=s,this.uniformView.set({viewport:[t,n],timeRangeMin:r-c,timeRangeMax:i-c,valueRangeMin:a-l,valueRangeMax:o-l,textureWidth:O,lineWidth:Math.max(1,window.devicePixelRatio),blockCount:e.length}),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformView.arrayBuffer)}render(e,t,n){this.currentBindGroup===null||this.currentInstanceCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(this.verticesPerInstance,this.currentInstanceCount,0,0))}renderDebug(e,t,n){this.currentBindGroup===null||this.currentBlockCount<=0||(e.setScissorRect(n.x,n.y,n.width,n.height),e.setPipeline(t),e.setBindGroup(0,this.currentBindGroup),e.draw(nn,this.currentBlockCount,0,0))}get instanceCount(){return this.currentInstanceCount}get bindGroup(){return this.currentBindGroup}dispose(){this.uniformBuffer.destroy(),this.descriptorBuffer.dispose(),this.currentBindGroup=null}},an=class{entries=[];addSeries(e,t){this.entries.push({layer:e,pipeline:t})}initAll(e,t,n){for(let r of this.entries)r.layer.init(e,t,n)}updateBindGroups(e){for(let t of this.entries)t.layer.updateBindGroup(e)}writeAllUniforms(e,t,n,r,i,a,o){for(let s=0;s<this.entries.length;s++){let c=this.entries[s],l=e[s]??[];c.layer.writeUniforms(l,t,n,r,i,a,o)}}renderAll(e,t){for(let n of this.entries)n.layer.render(e,n.pipeline,t)}renderDebug(e,t,n){for(let r of this.entries)r.layer.renderDebug(e,t,n)}dispose(){for(let e of this.entries)e.layer.dispose()}};function on(e){switch(e){case P.Line:return 18;case P.Candlestick:return 6;case P.Rhombus:return 6}}function sn(e){switch(e){case P.Line:case P.Candlestick:return!0;case P.Rhombus:return!1}}function cn(e,t){switch(e){case P.Line:return t.linePipeline;case P.Candlestick:return t.candlestickPipeline;case P.Rhombus:return t.rhombusPipeline}}function ln({renderer:e,seriesConfigs:t,allocator:n,registry:r,seed:i}){let a=[],o=new an;for(let s of t){a.push(new Qt(n,r,`${i}${s.seedSuffix}`,s.chartType,s.colorFn,s.sizeFn,()=>e.instantLoad));let t=new rn(on(s.chartType),sn(s.chartType));o.addSeries(t,cn(s.chartType,e))}return o.initAll(e.device,e.bindGroupLayout,n),o.updateBindGroups(n.createView()),{dataPipelines:a,seriesManager:o}}var un=0,dn=200,fn=2,pn=class{targetCanvas;target2dContext;seriesManager;fpsController;viewport;dataMinTime;dataMaxTime;allocator;registry;dataPipelines;inputController;resizeObserver;canvasSize;textCache=new Ct;layoutCache=new _t;lastTextureCapacity=0;constructor(e,t,n,r,a,s){this.targetCanvas=n;let c=n.getContext(`2d`);o(!i(c),`Failed to get 2D canvas context`),this.target2dContext=c,this.dataMinTime=k,this.dataMaxTime=k+j,this.viewport={viewTimeStart:r,viewTimeEnd:a,targetTimeStart:r,targetTimeEnd:a,viewValueMin:un,viewValueMax:dn},this.registry=new Ue,this.allocator=new xt(e.device,{onEvict:e=>{this.registry.removeBySlot(e)}}),this.lastTextureCapacity=this.allocator.getCapacity();let{dataPipelines:l,seriesManager:u}=ln({renderer:e,seriesConfigs:t,allocator:this.allocator,registry:this.registry,seed:s});this.dataPipelines=l,this.seriesManager=u,this.fpsController=new f(10),this.inputController=new yt(this.viewport,n,this.dataMinTime,this.dataMaxTime,this.fpsController),this.inputController.attach(),this.canvasSize=new vt(n,(e,t)=>{this.springTimeAxis(e,t)}),this.resizeObserver=new ResizeObserver(()=>{this.canvasSize.measure(),this.fpsController.raise(60)}),this.resizeObserver.observe(n)}get width(){return this.canvasSize.width}get height(){return this.canvasSize.height}syncCanvasSize(){return this.canvasSize.syncBackingStore()}update(){this.canvasSize.measure(),this.inputController.applyInertia()&&this.fpsController.raise(60);let e=this.viewport.targetTimeStart-this.viewport.viewTimeStart,t=this.viewport.targetTimeEnd-this.viewport.viewTimeEnd,n=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*ae;Math.abs(e)>n||Math.abs(t)>n?(this.viewport.viewTimeStart+=e*ie,this.viewport.viewTimeEnd+=t*ie,this.fpsController.raise(60)):(this.viewport.viewTimeStart=this.viewport.targetTimeStart,this.viewport.viewTimeEnd=this.viewport.targetTimeEnd)}prepareDrawCommands(){let e=dt(this.viewport.viewTimeStart,this.viewport.viewTimeEnd),t=this.dataPipelines.map(t=>t.ensureBlocksForViewport(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,e));if(this.getLoadingRegions().length>0&&this.fpsController.raise(60),!t.some(e=>e.reduce((e,t)=>e+t.pointCount,0)>=fn)&&this.getLoadingRegions().length===0)return null;for(let e of t)for(let t of e)this.allocator.touch(t.slot);let n=mt(t,this.viewport.viewTimeStart,this.viewport.viewTimeEnd);if(n!==void 0){let[e,t]=ft(n[0],n[1]);this.viewport.viewValueMin=e,this.viewport.viewValueMax=t}let r=this.allocator.getCapacity();r!==this.lastTextureCapacity&&(this.lastTextureCapacity=r,this.rebuildLayerBindGroups()),this.seriesManager.writeAllUniforms(t,this.canvasSize.width,this.canvasSize.height,this.viewport.viewTimeStart,this.viewport.viewTimeEnd,this.viewport.viewValueMin,this.viewport.viewValueMax);let i=G(this.canvasSize.width,this.canvasSize.height,this.canvasSize.devicePixelRatio);return{x:Math.floor(i.left),y:Math.floor(i.top),width:Math.max(0,Math.floor(i.width)),height:Math.max(0,Math.floor(i.height))}}renderCanvasAxes(){let e=this.getFrameLayout();e!==null&&Be(this.target2dContext,e,this.textCache)}renderCanvasGrid(){let e=this.getFrameLayout();e!==null&&He(this.target2dContext,e)}getLoadingRegions(){let e=[];for(let t of this.dataPipelines)e.push(...t.getLoadingRegions());return e}getViewport(){return{timeStart:this.viewport.viewTimeStart,timeEnd:this.viewport.viewTimeEnd}}dispose(){this.resizeObserver.disconnect(),this.inputController.detach(),this.seriesManager.dispose(),this.allocator.dispose(),this.fpsController.dispose()}getFrameLayout(){return this.layoutCache.getLayout(this.viewport,this.canvasSize.width,this.canvasSize.height,this.canvasSize.devicePixelRatio)}rebuildLayerBindGroups(){this.seriesManager.updateBindGroups(this.allocator.createView())}springTimeAxis(e,t){let n=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*(e/t),r=(this.viewport.viewTimeStart+this.viewport.viewTimeEnd)/2;this.viewport.viewTimeStart=r-n/2,this.viewport.viewTimeEnd=r+n/2}},mn=(0,D.memo)(({initialTimeStart:e,initialTimeEnd:t,chartSeed:n,seriesConfigs:r})=>{let a=(0,D.useRef)(null),{renderer:o}=z();return(0,D.useEffect)(()=>{if(i(o)||i(a.current))return;let s=new pn(o,r,a.current,e,t,n);return o.registerChart(s)},[o,e,t,n,r]),(0,I.jsx)(`div`,{className:`relative h-full w-full`,children:(0,I.jsx)(`canvas`,{ref:a,className:`absolute inset-0 h-full w-full [touch-action:none]`})})}),hn=110,gn=105,_n=100,vn=95,yn=y(.9,.2,.2,1),bn=y(1,.6,.1,1),xn=y(.2,.8,.3,1),Sn=y(.2,.5,.9,1),Cn=y(.7,.7,.7,1),wn=y(0,.5,1,1),Tn=10,En=.6,Dn=y(1,.6,.1,1),On=2,kn=4,An=6,jn=8,Mn=10;function Nn(e){return e>hn?Mn:e>gn?jn:e>_n?An:e>vn?kn:On}function Pn(e){return e>hn?yn:e>gn?bn:e>_n?Cn:e>vn?xn:Sn}var Fn=[[{chartType:P.Line,seedSuffix:``,colorFn:()=>wn,sizeFn:()=>Tn},{chartType:P.Candlestick,seedSuffix:`-series-2`,colorFn:(e,t,n)=>{let r=h(n[t].color);return y(r.r,r.g,r.b,En)}}],[{chartType:P.Candlestick,seedSuffix:``}],[{chartType:P.Line,seedSuffix:``,colorFn:()=>Dn,sizeFn:e=>Nn(e)}],[{chartType:P.Rhombus,seedSuffix:``,colorFn:e=>Pn(e)}]],In=(0,D.memo)(()=>{let{status:e,renderer:t}=z();return e===`unsupported`?(0,I.jsx)(l,{className:`h-full w-full`}):(0,I.jsxs)(`div`,{className:`h-full w-full relative grid grid-cols-2 grid-rows-2`,children:[(0,I.jsx)(he,{renderer:t}),de.map((e,t)=>(0,I.jsx)(mn,{initialTimeStart:k+e[0],initialTimeEnd:k+e[1],chartSeed:`chart-${t}`,seriesConfigs:Fn[t]},`${e[0]}-${e[1]}`))]})}),Ln=(0,D.memo)(()=>(0,I.jsx)(d,{className:`h-full w-full`,children:(0,I.jsx)(Pe,{children:(0,I.jsx)(In,{})})}));export{Ln as Timeseries};