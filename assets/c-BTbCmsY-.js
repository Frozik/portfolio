import{D as e,M as t,N as n,P as r,j as i,st as a}from"./c-D2N51Ix1.js";import{t as o}from"./c-CLIWQxFX.js";var s=a(n(),1),c=2048,l=.1,u=1767225600;48/Float32Array.BYTES_PER_ELEMENT;var d=.9,f=1.1,p=.18,m=365*24*3600,h=`http://www.w3.org/2000/svg`,g=`#999`,_=`#555`,v=`#333`,y=`monospace`,b=1024,ee=2160*3600,te=720*3600,ne=168*3600,re=[[0,m],[m/2-ee/2,m/2+ee/2],[m/2-te/2,m/2+te/2],[m/2-ne/2,m/2+ne/2]],ie=`struct Uniforms {
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

struct VSOut {
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

const BYTE_MASK: u32 = 0xFFu;
const SHIFT_R: u32 = 8u;
const SHIFT_G: u32 = 16u;
const SHIFT_B: u32 = 24u;
const COLOR_SCALE: f32 = 255.0;

const JOIN_A_END: u32 = 6u;
const JOIN_B_END: u32 = 12u;

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

// 18 vertices per instance: 6 join A + 6 join B + 6 rect body
@vertex
fn vs(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    var out: VSOut;

    let pointA = readPoint(iid);
    let pointB = readPoint(iid + 1u);

    let pixelA = dataToPixel(pointA.x, pointA.y);
    let pixelB = dataToPixel(pointB.x, pointB.y);

    let dpr = max(1.0, U.lineWidth);
    let widthA = pointA.z * dpr;
    let widthB = pointB.z * dpr;

    let colorA = unpackColorWgsl(pointA.w);
    let colorB = unpackColorWgsl(pointB.w);

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

// ── Rhombus rendering ────────────────────────────────────────────────

// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
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

// One instance per point — renders a quad, rhombus shape cut in fragment shader
@vertex
fn vsRhombus(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> RhombusVSOut {
    var out: RhombusVSOut;

    let point = readPoint(iid);
    let center = dataToPixel(point.x, point.y);
    let dpr = max(1.0, U.lineWidth);
    let size = point.z * dpr * 4.0;

    let quadPos = QUAD_POSITIONS[vid];
    out.uv = quadPos; // UV in [-0.5, 0.5]

    let pixel = center + quadPos * size;

    out.position = vec4<f32>(pixelToClip(pixel), 0.0, 1.0);
    out.color = unpackColorWgsl(point.w);

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

// ── Candlestick rendering ────────────────────────────────────────────

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

// One instance per pair of consecutive points — renders a candlestick quad
@vertex
fn vsCandlestick(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> CandlestickVSOut {
    var out: CandlestickVSOut;

    let pointA = readPoint(iid);
    let pointB = readPoint(iid + 1u);

    let dpr = max(1.0, U.lineWidth);
    let openVal = pointA.y;
    let closeVal = pointB.y;

    let bodyHi = max(openVal, closeVal);
    let bodyLo = min(openVal, closeVal);
    let bodyHeight = bodyHi - bodyLo;
    let wickExt = bodyHeight * WICK_BODY_RATIO;
    let high = bodyHi + wickExt;
    let low = bodyLo - wickExt;

    // Pixel positions for top and bottom at the same X
    let pixHigh = dataToPixel(pointA.x, high);
    let pixLow = dataToPixel(pointA.x, low);
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
    out.color = unpackColorWgsl(pointA.w);
    out.uv = quadPos;
    out.bodyBounds = vec2<f32>(bodyYMin, bodyYMax);
    out.quadPixelSize = vec2<f32>(halfWidth * 2.0, halfHeight * 2.0);

    return out;
}

const BORDER_PX: f32 = 2.0;
const WICK_HALF_WIDTH_PX: f32 = 1.5;
const CAP_HALF_WIDTH_PX: f32 = 6.0;
const CAP_HALF_HEIGHT_PX: f32 = 1.5;
const CANDLESTICK_BLACK: vec4<f32> = vec4<f32>(0.0, 0.0, 0.0, 1.0);
const CANDLESTICK_GRAY: vec4<f32> = vec4<f32>(0.6, 0.6, 0.6, 1.0);

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

    // Body region (with black border)
    if (pixelY >= bodyPixelBot && pixelY <= bodyPixelTop && absPixelX <= bodyHalfWidthPx) {
        // Border: fixed pixel width
        if (absPixelX > bodyHalfWidthPx - BORDER_PX ||
            pixelY < bodyPixelBot + BORDER_PX ||
            pixelY > bodyPixelTop - BORDER_PX) {
            return CANDLESTICK_BLACK;
        }
        return in.color;
    }

    // Wick (thin black vertical line)
    if (absPixelX <= WICK_HALF_WIDTH_PX) {
        return CANDLESTICK_BLACK;
    }

    // Caps at top and bottom of wick
    if ((abs(pixelY - wickTop) < CAP_HALF_HEIGHT_PX ||
         abs(pixelY - wickBot) < CAP_HALF_HEIGHT_PX) &&
        absPixelX <= CAP_HALF_WIDTH_PX) {
        return CANDLESTICK_BLACK;
    }

    discard;
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

// ── Line fragment shader ─────────────────────────────────────────────

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    // Discard pixels outside the join circle
    if (in.joinWidth > 0.0 && dot(in.joinCenter, in.joinCenter) > 0.25) {
        discard;
    }
    return in.color;
}
`;async function ae(){i(!r(navigator.gpu),`WebGPU is not supported`);let e=await navigator.gpu.requestAdapter();i(!r(e),`WebGPU adapter not available`);let t=await e.requestDevice(),n=new OffscreenCanvas(b,768),a=n.getContext(`webgpu`);i(!r(a),`Failed to get WebGPU context on OffscreenCanvas`);let o=navigator.gpu.getPreferredCanvasFormat();a.configure({device:t,format:o,alphaMode:`premultiplied`});let s=t.createShaderModule({code:ie}),c=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}}]}),l={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},u=t.createPipelineLayout({bindGroupLayouts:[c]});return new oe(t,o,c,t.createRenderPipeline({layout:u,vertex:{module:s,entryPoint:`vs`},fragment:{module:s,entryPoint:`fs`,targets:[{format:o,blend:l}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),t.createRenderPipeline({layout:u,vertex:{module:s,entryPoint:`vsCandlestick`},fragment:{module:s,entryPoint:`fsCandlestick`,targets:[{format:o,blend:l}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),n,a)}var oe=class{device;format;bindGroupLayout;linePipeline;candlestickPipeline;offscreen;ctx;charts=new Set;msaaTexture=null;msaaView=null;msaaWidth=0;msaaHeight=0;animationFrameId=0;disposed=!1;constructor(e,t,n,r,i,a,o){this.device=e,this.format=t,this.bindGroupLayout=n,this.linePipeline=r,this.candlestickPipeline=i,this.offscreen=a,this.ctx=o}registerChart(e){return this.charts.add(e),this.charts.size===1&&this.startAnimationLoop(),()=>{this.charts.delete(e),e.dispose(),this.charts.size===0&&this.stopAnimationLoop()}}destroy(){if(!this.disposed){this.disposed=!0,this.stopAnimationLoop();for(let e of this.charts)e.dispose();this.charts.clear(),this.msaaTexture?.destroy(),this.msaaTexture=null,this.msaaView=null,this.device.destroy()}}startAnimationLoop(){if(this.disposed)return;let e=()=>{this.disposed||(this.renderAllCharts(),this.animationFrameId=requestAnimationFrame(e))};this.animationFrameId=requestAnimationFrame(e)}stopAnimationLoop(){cancelAnimationFrame(this.animationFrameId),this.animationFrameId=0}ensureMsaaTexture(){let e=0,t=0;for(let n of this.charts)e=Math.max(e,n.width),t=Math.max(t,n.height);return e===this.msaaWidth&&t===this.msaaHeight&&!r(this.msaaView)?this.msaaView:(this.msaaTexture?.destroy(),e===0||t===0?(this.msaaTexture=null,this.msaaView=null,this.msaaWidth=0,this.msaaHeight=0,null):(this.msaaTexture=this.device.createTexture({size:[e,t],format:this.format,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.msaaView=this.msaaTexture.createView(),this.msaaWidth=e,this.msaaHeight=t,this.msaaView))}renderAllCharts(){for(let e of this.charts){e.update();let{width:t,height:n}=e;if(t===0||n===0)continue;let i=e.prepareDrawCommands();if(r(i))continue;(this.offscreen.width!==t||this.offscreen.height!==n)&&(this.offscreen.width=t,this.offscreen.height=n,this.ctx.configure({device:this.device,format:this.format,alphaMode:`premultiplied`}));let a=this.ensureMsaaTexture();if(r(a))continue;let o=this.ctx.getCurrentTexture().createView(),s=this.device.createCommandEncoder(),c=s.beginRenderPass({colorAttachments:[{view:a,resolveTarget:o,loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});c.setPipeline(this.linePipeline),c.setBindGroup(0,i.lineBindGroup),c.draw(18,i.lineInstanceCount,0,0),c.setPipeline(this.candlestickPipeline),c.setBindGroup(0,i.candlestickBindGroup),c.draw(6,i.candlestickInstanceCount,0,0),c.end(),this.device.queue.submit([s.finish()]);let l=this.offscreen.transferToImageBitmap();e.target2dContext.clearRect(0,0,t,n),e.target2dContext.drawImage(l,0,0),l.close(),e.renderOverlay()}}},x=t(),se=(0,s.createContext)(null);function ce(){return(0,s.useContext)(se)}var le=(0,s.memo)(({children:e})=>{let[t,n]=(0,s.useState)(null);return(0,s.useEffect)(()=>{let e=!1,t;return ae().then(r=>{if(e){r.destroy();return}t=r,n(r)}),()=>{e=!0,r(t)||t.destroy()}},[]),(0,x.jsx)(se,{value:t,children:e})}),S=function(e){return e[e.Year=0]=`Year`,e[e.Month=1]=`Month`,e[e.Week=2]=`Week`,e[e.Day=3]=`Day`,e[e.Hour=4]=`Hour`,e[e.Minute=5]=`Minute`,e}({}),C=60,w=3600,ue=86400,de=60,T=24,E=[1,2,5],fe=8,D=2,pe=70,me=20,he=10;function O(t){let n=BigInt(Math.trunc(t))*1000000000n;return e.Instant.fromEpochNanoseconds(n)}function ge(e,t){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}`}function _e(e,t,n){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}:${String(n).padStart(2,`0`)}`}function k(e,t,n,r,i){if(e.length<=1||r<=0)return e;let a=n-t;if(a<=0)return e;let o=i+he,s=[],c=-1/0;for(let n of e){let e=(n.position-t)/a*r;e-c>=o&&(s.push(n),c=e)}return s}function ve(e,t,n,r){return k(ye(e,t,n),e,t,r,pe)}function ye(t,n,r){let i=[];switch(r){case S.Year:{let r=O(t).toZonedDateTimeISO(`UTC`),a=O(n).toZonedDateTimeISO(`UTC`),o=r.with({day:1,hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(o,r)<0&&(o=o.add({months:1}));e.ZonedDateTime.compare(o,a)<=0;)i.push({position:Number(o.epochNanoseconds/1000000000n),label:o.toPlainDate().toLocaleString(`en-US`,{month:`short`})}),o=o.add({months:1});break}case S.Month:{let r=O(t).toZonedDateTimeISO(`UTC`),a=O(n).toZonedDateTimeISO(`UTC`),o=r.with({hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(o,r)<0&&(o=o.add({days:1}));e.ZonedDateTime.compare(o,a)<=0;)i.push({position:Number(o.epochNanoseconds/1000000000n),label:String(o.day)}),o=o.add({days:1});break}case S.Week:{let r=O(t).toZonedDateTimeISO(`UTC`),a=O(n).toZonedDateTimeISO(`UTC`),o=[`Mon`,`Tue`,`Wed`,`Thu`,`Fri`,`Sat`,`Sun`],s=r.with({hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(s,r)<0&&(s=s.add({days:1}));e.ZonedDateTime.compare(s,a)<=0;){let e=s.dayOfWeek;i.push({position:Number(s.epochNanoseconds/1000000000n),label:o[e-1]}),s=s.add({days:1})}break}case S.Day:{let e=Math.ceil(t/w),r=Math.floor(n/w);for(let t=e;t<=r;t++){let e=t*w,n=(t%T+T)%T;i.push({position:e,label:ge(n,0)})}break}case S.Hour:{let e=Math.ceil(t/C),r=Math.floor(n/C);for(let t=e;t<=r;t++){let e=t*C,n=Math.floor(e%ue/C),r=Math.floor(n/de),a=n%de;i.push({position:e,label:ge((r%T+T)%T,a)})}break}case S.Minute:{let e=Math.ceil(t),r=Math.floor(n);for(let t=e;t<=r;t++){let e=t%ue,n=Math.floor(e/w),r=Math.floor(e%w/C),a=e%C;i.push({position:t,label:_e((n%T+T)%T,r,a)})}break}}return i}function A(e){if(e<=0)return 1;let t=10**Math.floor(Math.log10(e)),n=e/t;for(let e of E)if(e>=n)return e*t;return E[0]*t*10}function be(e,t,n){let r=t-e;if(r<=0)return[{position:e,label:j(e,1)}];let i=A(r/fe);Math.floor(r/i)<D&&(i=A(r/D));let a=Math.max(0,-Math.floor(Math.log10(i))+1),o=[],s=Math.ceil(e/i)*i;for(let n=s;n<=t+i*.01;n+=i)n>=e&&n<=t&&o.push({position:n,label:j(n,a)});return k(o,e,t,n,me)}function j(e,t){return e.toFixed(t)}function M(e,t){let n=t-e;return n>=15552e3?S.Year:n>=1728e3?S.Month:n>=259200?S.Week:n>=21600?S.Day:n>=600?S.Hour:S.Minute}function N(e,t,n,r){let i=t-e;return i>=r-n?[n,r]:e<n?[n,n+i]:t>r?[r-i,r]:[e,t]}function xe(e,t){let n=t-e,r=n>0?n*l:1;return[e-r,t+r]}function P(e,t,n,r){let i=e.length;if(i===0)return;let a=0,o=i;for(;a<o;){let t=a+o>>1;e[t]<n?a=t+1:o=t}let s=a;for(a=s,o=i;a<o;){let t=a+o>>1;e[t]<=r?a=t+1:o=t}let c=a;if(s>=c)return;let l=1/0,u=-1/0;for(let e=s;e<c;e++){let n=t[e];n<l&&(l=n),n>u&&(u=n)}return[l,u]}function F(e,t,n,r){let i=n*((t-e)/r);return[e-i,t-i]}function I(e,t,n,r){let i=t-e,a=e+i*r,o=Math.max(i*n,60);return[a-o*r,a+o*(1-r)]}function Se(e){for(;e.firstChild;)e.removeChild(e.firstChild)}function Ce(e,t,n,r){Se(e);let i=n,a=r;e.setAttribute(`width`,String(i)),e.setAttribute(`height`,String(a)),e.setAttribute(`viewBox`,`0 0 ${i} ${a}`);let o=i-10,s=a-30,c=o-60,l=s-10;if(c<=0||l<=0)return;let u=document.createElementNS(h,`path`);u.setAttribute(`d`,`M 60 10 L 60 ${s} L ${o} ${s}`),u.setAttribute(`stroke`,_),u.setAttribute(`fill`,`none`),u.setAttribute(`stroke-width`,`1`),e.appendChild(u);let d=t.viewTimeEnd-t.viewTimeStart,f=t.viewValueMax-t.viewValueMin,p=M(t.viewTimeStart,t.viewTimeEnd),m=ve(t.viewTimeStart,t.viewTimeEnd,p,c);for(let n of m){let r=60+(n.position-t.viewTimeStart)/d*c;if(r<60||r>o)continue;let i=document.createElementNS(h,`line`);i.setAttribute(`x1`,String(r)),i.setAttribute(`y1`,`10`),i.setAttribute(`x2`,String(r)),i.setAttribute(`y2`,String(s)),i.setAttribute(`stroke`,v),i.setAttribute(`stroke-width`,`0.5`),e.appendChild(i);let a=document.createElementNS(h,`line`);a.setAttribute(`x1`,String(r)),a.setAttribute(`y1`,String(s)),a.setAttribute(`x2`,String(r)),a.setAttribute(`y2`,String(s+5)),a.setAttribute(`stroke`,_),a.setAttribute(`stroke-width`,`1`),e.appendChild(a);let l=document.createElementNS(h,`text`);l.setAttribute(`x`,String(r)),l.setAttribute(`y`,String(s+5+11+2)),l.setAttribute(`text-anchor`,`middle`),l.setAttribute(`fill`,g),l.setAttribute(`font-size`,`11`),l.setAttribute(`font-family`,y),l.textContent=n.label,e.appendChild(l)}let b=be(t.viewValueMin,t.viewValueMax,l);for(let n of b){let r=s-(n.position-t.viewValueMin)/f*l;if(r<10||r>s)continue;let i=document.createElementNS(h,`line`);i.setAttribute(`x1`,`60`),i.setAttribute(`y1`,String(r)),i.setAttribute(`x2`,String(o)),i.setAttribute(`y2`,String(r)),i.setAttribute(`stroke`,v),i.setAttribute(`stroke-width`,`0.5`),e.appendChild(i);let a=document.createElementNS(h,`line`);a.setAttribute(`x1`,`55`),a.setAttribute(`y1`,String(r)),a.setAttribute(`x2`,`60`),a.setAttribute(`y2`,String(r)),a.setAttribute(`stroke`,_),a.setAttribute(`stroke-width`,`1`),e.appendChild(a);let c=document.createElementNS(h,`text`);c.setAttribute(`x`,`51`),c.setAttribute(`y`,String(r+11/3)),c.setAttribute(`text-anchor`,`end`),c.setAttribute(`fill`,g),c.setAttribute(`font-size`,`11`),c.setAttribute(`font-family`,y),c.textContent=n.label,e.appendChild(c)}}var we=class{isDragging=!1;lastMouseX=0;isTouching=!1;lastTouchX=0;lastPinchDistance=0;handleMouseDown;handleMouseMove;handleMouseUp;handleWheel;handleTouchStart;handleTouchMove;handleTouchEnd;constructor(e,t,n,r){this.viewport=e,this.canvas=t,this.dataMinTime=n,this.dataMaxTime=r,this.handleMouseDown=e=>{this.isDragging=!0,this.lastMouseX=e.clientX,this.canvas.style.cursor=`grabbing`},this.handleMouseMove=e=>{if(!this.isDragging)return;let t=e.clientX-this.lastMouseX;this.lastMouseX=e.clientX;let[n,r]=N(...F(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,t,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=n,this.viewport.viewTimeEnd=r,this.viewport.targetTimeStart=n,this.viewport.targetTimeEnd=r},this.handleMouseUp=()=>{this.isDragging=!1,this.canvas.style.cursor=`grab`},this.handleWheel=e=>{e.preventDefault();let t=this.canvas.getBoundingClientRect(),n=(e.clientX-t.left)/t.width,r=e.deltaY>0?f:d,[i,a]=N(...I(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,r,n),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a},this.handleTouchStart=e=>{e.touches.length===1?(this.isTouching=!0,this.lastTouchX=e.touches[0].clientX):e.touches.length===2&&(this.isTouching=!1,this.lastPinchDistance=this.getTouchDistance(e))},this.handleTouchMove=e=>{if(e.preventDefault(),e.touches.length===2){let t=this.getTouchDistance(e),n=this.lastPinchDistance/t,r=this.getTouchCenter(e),[i,a]=N(...I(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,n,r),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a,this.lastPinchDistance=t;return}if(!this.isTouching||e.touches.length!==1)return;let t=e.touches[0].clientX-this.lastTouchX;this.lastTouchX=e.touches[0].clientX;let[n,r]=N(...F(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,t,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=n,this.viewport.viewTimeEnd=r,this.viewport.targetTimeStart=n,this.viewport.targetTimeEnd=r},this.handleTouchEnd=e=>{e.touches.length===0?this.isTouching=!1:e.touches.length===1&&(this.isTouching=!0,this.lastTouchX=e.touches[0].clientX)}}attach(){this.canvas.addEventListener(`mousedown`,this.handleMouseDown),this.canvas.addEventListener(`mousemove`,this.handleMouseMove),this.canvas.addEventListener(`mouseup`,this.handleMouseUp),this.canvas.addEventListener(`mouseleave`,this.handleMouseUp),this.canvas.addEventListener(`wheel`,this.handleWheel,{passive:!1}),this.canvas.addEventListener(`touchstart`,this.handleTouchStart,{passive:!0}),this.canvas.addEventListener(`touchmove`,this.handleTouchMove,{passive:!1}),this.canvas.addEventListener(`touchend`,this.handleTouchEnd),this.canvas.style.cursor=`grab`}detach(){this.canvas.removeEventListener(`mousedown`,this.handleMouseDown),this.canvas.removeEventListener(`mousemove`,this.handleMouseMove),this.canvas.removeEventListener(`mouseup`,this.handleMouseUp),this.canvas.removeEventListener(`mouseleave`,this.handleMouseUp),this.canvas.removeEventListener(`wheel`,this.handleWheel),this.canvas.removeEventListener(`touchstart`,this.handleTouchStart),this.canvas.removeEventListener(`touchmove`,this.handleTouchMove),this.canvas.removeEventListener(`touchend`,this.handleTouchEnd)}getTouchDistance(e){let t=e.touches[0].clientX-e.touches[1].clientX,n=e.touches[0].clientY-e.touches[1].clientY;return Math.sqrt(t*t+n*n)}getTouchCenter(e){let t=this.canvas.getBoundingClientRect();return((e.touches[0].clientX+e.touches[1].clientX)/2-t.left)/t.width}},L=255,R=255,z=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),Te=new Float32Array(z),Ee=new Uint32Array(z);function De(e,t,n,r){let i=Math.round(r*R)&L,a=Math.round(e*R)&L,o=Math.round(t*R)&L,s=Math.min(Math.round(n*R)&L,126);return Ee[0]=i|a<<8|o<<16|s<<24,Te[0]}var B=2654435761,Oe=16,ke=4294967296;function V(e){let t=Math.imul(e,B)>>>0,n=(t^t>>>Oe)>>>0;return{value:n/ke,next:n}}function Ae(e,t){return V((Math.trunc(e*1e3)^Math.imul(t,B))>>>0).value-.5}var H=366,je=.5,Me=100,U;function Ne(){if(U!==void 0)return U;let e=new Float64Array(H),t=new Float64Array(H),n=u,r=m/(H-1),i=42,a=Me;for(let o=0;o<H;o++){e[o]=n+o*r;let s=V(i);i=s.next,a+=(s.value-.5)*je,t[o]=a}return U={times:e,values:t},U}function Pe(e){let{times:t,values:n}=Ne();if(e<=t[0])return n[0];if(e>=t[H-1])return n[H-1];let r=0,i=H-1;for(;i-r>1;){let n=r+i>>1;t[n]<=e?r=n:i=n}let a=(e-t[r])/(t[i]-t[r]);return n[r]+a*(n[i]-n[r])}var Fe={[S.Year]:0,[S.Month]:.15,[S.Week]:.08,[S.Day]:.04,[S.Hour]:.02,[S.Minute]:.01},Ie={[S.Year]:365,[S.Month]:300,[S.Week]:168,[S.Day]:480,[S.Hour]:360,[S.Minute]:60},Le=1,Re=10-Le;function ze(e){return De(e,.8-e*.6,1-e*.2,1)}function Be(e){return Le+(Ae(e,7)+.5)*Re}function Ve(e,t,n){return n===S.Year?He(e,t):Ue(e,t,n)}function He(e,t){let{times:n,values:r}=Ne(),i=[],a=n[H-1]-n[0];for(let o=0;o<H;o++)if(n[o]>=e&&n[o]<=t){let e=(n[o]-n[0])/a;i.push({time:n[o],value:r[o],size:Be(n[o]),color:ze(e)})}return i}function Ue(e,t,n){let r=Ie[n],i=(t-e)/(r-1),a=Fe[n],o=u,s=m,c=Array(r);for(let t=0;t<r;t++){let r=e+t*i,l=Pe(r),u=0,d=n;for(let e=1;e<=d;e++){let t=Fe[e]??0;u+=Ae(r,e)*t}let f=l+u*a*10,p=(r-o)/s,m=Math.max(0,Math.min(1,p));c[t]={time:r,value:f,size:Be(r),color:ze(m)}}return c}var We=3;function Ge(e,t,n){let r=new ArrayBuffer(e.length*4*Float32Array.BYTES_PER_ELEMENT),i=new Float32Array(r),a=new Uint32Array(r);for(let r=0;r<e.length;r++){let o=r*4,s=e[r];i[o]=s.time-t,i[o+1]=s.value-n,i[o+2]=s.size,a[o+We]=Ye(s.color)}return i}var Ke=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),qe=new Float32Array(Ke),Je=new Uint32Array(Ke);function Ye(e){return qe[0]=e,Je[0]}function Xe(e,t,n=0,r=e.length-1,i=Ze){for(;r>n;){if(r-n>600){let a=r-n+1,o=t-n+1,s=Math.log(a),c=.5*Math.exp(2*s/3),l=.5*Math.sqrt(s*c*(a-c)/a)*(o-a/2<0?-1:1);Xe(e,t,Math.max(n,Math.floor(t-o*c/a+l)),Math.min(r,Math.floor(t+(a-o)*c/a+l)),i)}let a=e[t],o=n,s=r;for(W(e,n,t),i(e[r],a)>0&&W(e,n,r);o<s;){for(W(e,o,s),o++,s--;i(e[o],a)<0;)o++;for(;i(e[s],a)>0;)s--}i(e[n],a)===0?W(e,n,s):(s++,W(e,s,r)),s<=t&&(n=s+1),t<=s&&(r=s-1)}}function W(e,t,n){let r=e[t];e[t]=e[n],e[n]=r}function Ze(e,t){return e<t?-1:e>t?1:0}var Qe=class{constructor(e=9){this._maxEntries=Math.max(4,e),this._minEntries=Math.max(2,Math.ceil(this._maxEntries*.4)),this.clear()}all(){return this._all(this.data,[])}search(e){let t=this.data,n=[];if(!Z(e,t))return n;let r=this.toBBox,i=[];for(;t;){for(let a=0;a<t.children.length;a++){let o=t.children[a],s=t.leaf?r(o):o;Z(e,s)&&(t.leaf?n.push(o):X(e,s)?this._all(o,n):i.push(o))}t=i.pop()}return n}collides(e){let t=this.data;if(!Z(e,t))return!1;let n=[];for(;t;){for(let r=0;r<t.children.length;r++){let i=t.children[r],a=t.leaf?this.toBBox(i):i;if(Z(e,a)){if(t.leaf||X(e,a))return!0;n.push(i)}}t=n.pop()}return!1}load(e){if(!(e&&e.length))return this;if(e.length<this._minEntries){for(let t=0;t<e.length;t++)this.insert(e[t]);return this}let t=this._build(e.slice(),0,e.length-1,0);if(!this.data.children.length)this.data=t;else if(this.data.height===t.height)this._splitRoot(this.data,t);else{if(this.data.height<t.height){let e=this.data;this.data=t,t=e}this._insert(t,this.data.height-t.height-1,!0)}return this}insert(e){return e&&this._insert(e,this.data.height-1),this}clear(){return this.data=Q([]),this}remove(e,t){if(!e)return this;let n=this.data,r=this.toBBox(e),i=[],a=[],o,s,c;for(;n||i.length;){if(n||(n=i.pop(),s=i[i.length-1],o=a.pop(),c=!0),n.leaf){let r=$e(e,n.children,t);if(r!==-1)return n.children.splice(r,1),i.push(n),this._condense(i),this}!c&&!n.leaf&&X(n,r)?(i.push(n),a.push(o),o=0,s=n,n=n.children[0]):s?(o++,n=s.children[o],c=!1):n=null}return this}toBBox(e){return e}compareMinX(e,t){return e.minX-t.minX}compareMinY(e,t){return e.minY-t.minY}toJSON(){return this.data}fromJSON(e){return this.data=e,this}_all(e,t){let n=[];for(;e;)e.leaf?t.push(...e.children):n.push(...e.children),e=n.pop();return t}_build(e,t,n,r){let i=n-t+1,a=this._maxEntries,o;if(i<=a)return o=Q(e.slice(t,n+1)),G(o,this.toBBox),o;r||(r=Math.ceil(Math.log(i)/Math.log(a)),a=Math.ceil(i/a**(r-1))),o=Q([]),o.leaf=!1,o.height=r;let s=Math.ceil(i/a),c=s*Math.ceil(Math.sqrt(a));it(e,t,n,c,this.compareMinX);for(let i=t;i<=n;i+=c){let t=Math.min(i+c-1,n);it(e,i,t,s,this.compareMinY);for(let n=i;n<=t;n+=s){let i=Math.min(n+s-1,t);o.children.push(this._build(e,n,i,r-1))}}return G(o,this.toBBox),o}_chooseSubtree(e,t,n,r){for(;r.push(t),!(t.leaf||r.length-1===n);){let n=1/0,r=1/0,i;for(let a=0;a<t.children.length;a++){let o=t.children[a],s=J(o),c=nt(e,o)-s;c<r?(r=c,n=s<n?s:n,i=o):c===r&&s<n&&(n=s,i=o)}t=i||t.children[0]}return t}_insert(e,t,n){let r=n?e:this.toBBox(e),i=[],a=this._chooseSubtree(r,this.data,t,i);for(a.children.push(e),q(a,r);t>=0&&i[t].children.length>this._maxEntries;)this._split(i,t),t--;this._adjustParentBBoxes(r,i,t)}_split(e,t){let n=e[t],r=n.children.length,i=this._minEntries;this._chooseSplitAxis(n,i,r);let a=this._chooseSplitIndex(n,i,r),o=Q(n.children.splice(a,n.children.length-a));o.height=n.height,o.leaf=n.leaf,G(n,this.toBBox),G(o,this.toBBox),t?e[t-1].children.push(o):this._splitRoot(n,o)}_splitRoot(e,t){this.data=Q([e,t]),this.data.height=e.height+1,this.data.leaf=!1,G(this.data,this.toBBox)}_chooseSplitIndex(e,t,n){let r,i=1/0,a=1/0;for(let o=t;o<=n-t;o++){let t=K(e,0,o,this.toBBox),s=K(e,o,n,this.toBBox),c=rt(t,s),l=J(t)+J(s);c<i?(i=c,r=o,a=l<a?l:a):c===i&&l<a&&(a=l,r=o)}return r||n-t}_chooseSplitAxis(e,t,n){let r=e.leaf?this.compareMinX:et,i=e.leaf?this.compareMinY:tt;this._allDistMargin(e,t,n,r)<this._allDistMargin(e,t,n,i)&&e.children.sort(r)}_allDistMargin(e,t,n,r){e.children.sort(r);let i=this.toBBox,a=K(e,0,t,i),o=K(e,n-t,n,i),s=Y(a)+Y(o);for(let r=t;r<n-t;r++){let t=e.children[r];q(a,e.leaf?i(t):t),s+=Y(a)}for(let r=n-t-1;r>=t;r--){let t=e.children[r];q(o,e.leaf?i(t):t),s+=Y(o)}return s}_adjustParentBBoxes(e,t,n){for(let r=n;r>=0;r--)q(t[r],e)}_condense(e){for(let t=e.length-1,n;t>=0;t--)e[t].children.length===0?t>0?(n=e[t-1].children,n.splice(n.indexOf(e[t]),1)):this.clear():G(e[t],this.toBBox)}};function $e(e,t,n){if(!n)return t.indexOf(e);for(let r=0;r<t.length;r++)if(n(e,t[r]))return r;return-1}function G(e,t){K(e,0,e.children.length,t,e)}function K(e,t,n,r,i){i||=Q(null),i.minX=1/0,i.minY=1/0,i.maxX=-1/0,i.maxY=-1/0;for(let a=t;a<n;a++){let t=e.children[a];q(i,e.leaf?r(t):t)}return i}function q(e,t){return e.minX=Math.min(e.minX,t.minX),e.minY=Math.min(e.minY,t.minY),e.maxX=Math.max(e.maxX,t.maxX),e.maxY=Math.max(e.maxY,t.maxY),e}function et(e,t){return e.minX-t.minX}function tt(e,t){return e.minY-t.minY}function J(e){return(e.maxX-e.minX)*(e.maxY-e.minY)}function Y(e){return e.maxX-e.minX+(e.maxY-e.minY)}function nt(e,t){return(Math.max(t.maxX,e.maxX)-Math.min(t.minX,e.minX))*(Math.max(t.maxY,e.maxY)-Math.min(t.minY,e.minY))}function rt(e,t){let n=Math.max(e.minX,t.minX),r=Math.max(e.minY,t.minY),i=Math.min(e.maxX,t.maxX),a=Math.min(e.maxY,t.maxY);return Math.max(0,i-n)*Math.max(0,a-r)}function X(e,t){return e.minX<=t.minX&&e.minY<=t.minY&&t.maxX<=e.maxX&&t.maxY<=e.maxY}function Z(e,t){return t.minX<=e.maxX&&t.minY<=e.maxY&&t.maxX>=e.minX&&t.maxY>=e.minY}function Q(e){return{children:e,height:1,leaf:!0,minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0}}function it(e,t,n,r,i){let a=[t,n];for(;a.length;){if(n=a.pop(),t=a.pop(),n-t<=r)continue;let o=t+Math.ceil((n-t)/r/2)*r;Xe(e,o,t,n,i),a.push(t,o,o,n)}}function at(){return new Qe}function ot(e,t){e.insert({minX:t.timeStart,minY:t.scale,maxX:t.timeEnd,maxY:t.scale,part:t})}function st(e,t,n,r){return e.search({minX:n,minY:t,maxX:r,maxY:t})}var ct=0,lt=200,$=2,ut=class{targetCanvas;target2dContext;svgContainer;viewport;dataMinTime;dataMaxTime;spatialIndex1=at();spatialIndex2=at();nextTextureRow=0;uniformBuf1;uniformBuf2;textureRows;dataTexture;bindGroup1;bindGroup2;inputController;resizeObserver;canvasWidth=0;canvasHeight=0;constructor(e,t,n,a,o,s){this.device=e,this.bindGroupLayout=t,this.targetCanvas=n,this.svgContainer=a;let l=n.getContext(`2d`);i(!r(l),`Failed to get 2D canvas context`),this.target2dContext=l,this.dataMinTime=u,this.dataMaxTime=u+m,this.viewport={viewTimeStart:o,viewTimeEnd:s,targetTimeStart:o,targetTimeEnd:s,viewValueMin:ct,viewValueMax:lt},this.uniformBuf1=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.uniformBuf2=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.textureRows=4,this.dataTexture=e.createTexture({size:[c,this.textureRows],format:`rgba32float`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC}),this.bindGroup1=this.createBindGroup(this.uniformBuf1),this.bindGroup2=this.createBindGroup(this.uniformBuf2),this.inputController=new we(this.viewport,n,this.dataMinTime,this.dataMaxTime),this.inputController.attach(),this.updateCanvasSize(),this.resizeObserver=new ResizeObserver(()=>{this.updateCanvasSize()}),this.resizeObserver.observe(n)}get width(){return this.canvasWidth}get height(){return this.canvasHeight}update(){this.updateCanvasSize();let e=this.viewport.targetTimeStart-this.viewport.viewTimeStart,t=this.viewport.targetTimeEnd-this.viewport.viewTimeEnd;Math.abs(e)>.001||Math.abs(t)>.001?(this.viewport.viewTimeStart+=e*p,this.viewport.viewTimeEnd+=t*p):(this.viewport.viewTimeStart=this.viewport.targetTimeStart,this.viewport.viewTimeEnd=this.viewport.targetTimeEnd)}prepareDrawCommands(){let e=this.ensureDataForViewport();return r(e)||e.line.pointCount<$||e.rhombus.pointCount<$?null:(this.writeUniforms(e.line,this.uniformBuf1),this.writeUniforms(e.rhombus,this.uniformBuf2),{lineBindGroup:this.bindGroup1,lineInstanceCount:e.line.pointCount-1,candlestickBindGroup:this.bindGroup2,candlestickInstanceCount:e.rhombus.pointCount-1})}renderOverlay(){Ce(this.svgContainer,this.viewport,this.targetCanvas.clientWidth,this.targetCanvas.clientHeight)}dispose(){this.resizeObserver.disconnect(),this.inputController.detach(),this.dataTexture.destroy(),this.uniformBuf1.destroy(),this.uniformBuf2.destroy()}createBindGroup(e){let t=this.dataTexture.createView();return this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:e}},{binding:1,resource:t}]})}rebuildBindGroups(){this.bindGroup1=this.createBindGroup(this.uniformBuf1),this.bindGroup2=this.createBindGroup(this.uniformBuf2)}growTextureIfNeeded(e){if(e<=this.textureRows)return!0;let t=this.textureRows;for(;t<e;)t*=2;if(t=Math.min(t,512),e>t)return!1;let n=this.device.createTexture({size:[c,t],format:`rgba32float`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC}),r=this.device.createCommandEncoder();return r.copyTextureToTexture({texture:this.dataTexture,origin:[0,0,0]},{texture:n,origin:[0,0,0]},[c,this.nextTextureRow,1]),this.device.queue.submit([r.finish()]),this.dataTexture.destroy(),this.dataTexture=n,this.textureRows=t,this.rebuildBindGroups(),!0}ensureSeriesData(e,t){let n=M(this.viewport.viewTimeStart,this.viewport.viewTimeEnd),r=st(e,n,this.viewport.viewTimeStart,this.viewport.viewTimeEnd).find(e=>e.part.timeStart<=this.viewport.viewTimeStart&&e.part.timeEnd>=this.viewport.viewTimeEnd);if(r!==void 0)return r.part;let i=this.viewport.viewTimeEnd-this.viewport.viewTimeStart,a=Math.max(this.dataMinTime,this.viewport.viewTimeStart-i),o=Math.min(this.dataMaxTime,this.viewport.viewTimeEnd+i),s=Ve(a,o,n);if(s.length===0)return null;if(t!==0)for(let e of s)e.value+=t;let l=s[0].time,u=s[0].value,d=Ge(s,l,u),f=this.nextTextureRow,p=Math.ceil(s.length/c);if(!this.growTextureIfNeeded(f+p))return null;for(let e=0;e<p;e++){let t=Math.min(c,s.length-e*c),n=e*c*4,r=d.subarray(n,n+t*4);this.device.queue.writeTexture({texture:this.dataTexture,origin:[0,f+e,0]},r,{bytesPerRow:c*4*Float32Array.BYTES_PER_ELEMENT,rowsPerImage:1},[t,1,1])}let m=new Float64Array(s.length),h=new Float64Array(s.length),g=1/0,_=-1/0;for(let e=0;e<s.length;e++)m[e]=s[e].time,h[e]=s[e].value,s[e].value<g&&(g=s[e].value),s[e].value>_&&(_=s[e].value);let v={scale:n,timeStart:a,timeEnd:o,baseTime:l,baseValue:u,textureRowStart:f,pointCount:s.length,valueMin:g,valueMax:_,pointTimes:m,pointValues:h};return ot(e,v),this.nextTextureRow+=p,v}ensureDataForViewport(){let e=this.ensureSeriesData(this.spatialIndex1,0),t=this.ensureSeriesData(this.spatialIndex2,2);if(r(e)||r(t))return null;let n=P(e.pointTimes,e.pointValues,this.viewport.viewTimeStart,this.viewport.viewTimeEnd),i=P(t.pointTimes,t.pointValues,this.viewport.viewTimeStart,this.viewport.viewTimeEnd),a=1/0,o=-1/0;if(n!==void 0&&(a=Math.min(a,n[0]),o=Math.max(o,n[1])),i!==void 0&&(a=Math.min(a,i[0]),o=Math.max(o,i[1])),a<o){let[e,t]=xe(a,o);this.viewport.viewValueMin=e,this.viewport.viewValueMax=t}return{line:e,rhombus:t}}writeUniforms(e,t){let n=new ArrayBuffer(48),r=new Float32Array(n),i=new Uint32Array(n);r[0]=this.canvasWidth,r[1]=this.canvasHeight,r[2]=this.viewport.viewTimeStart-e.baseTime,r[3]=this.viewport.viewTimeEnd-e.baseTime,r[4]=this.viewport.viewValueMin-e.baseValue,r[5]=this.viewport.viewValueMax-e.baseValue,i[6]=e.pointCount,i[7]=c,r[8]=Math.max(1,window.devicePixelRatio),i[9]=e.textureRowStart,r[10]=e.baseTime,r[11]=e.baseValue,this.device.queue.writeBuffer(t,0,n)}updateCanvasSize(){let e=Math.max(1,window.devicePixelRatio),t=Math.floor(this.targetCanvas.clientWidth*e),n=Math.floor(this.targetCanvas.clientHeight*e);(this.targetCanvas.width!==t||this.targetCanvas.height!==n)&&(this.targetCanvas.width=t,this.targetCanvas.height=n),this.canvasWidth=t,this.canvasHeight=n}},dt=(0,s.memo)(({initialTimeStart:e,initialTimeEnd:t})=>{let n=(0,s.useRef)(null),i=(0,s.useRef)(null),a=ce();return(0,s.useEffect)(()=>{if(r(a)||r(n.current)||r(i.current))return;let o=new ut(a.device,a.bindGroupLayout,n.current,i.current,e,t);return a.registerChart(o)},[a,e,t]),(0,x.jsxs)(`div`,{className:`relative h-full w-full`,children:[(0,x.jsx)(`div`,{className:`absolute inset-0 bg-[#262626]`}),(0,x.jsx)(`svg`,{ref:i,className:`absolute inset-0 h-full w-full pointer-events-none`}),(0,x.jsx)(`canvas`,{ref:n,className:`absolute inset-0 h-full w-full`})]})}),ft=(0,s.memo)(()=>(0,x.jsx)(le,{children:(0,x.jsx)(`div`,{className:`${o.fixedContainer} grid grid-cols-2 grid-rows-2`,children:re.map(e=>(0,x.jsx)(dt,{initialTimeStart:u+e[0],initialTimeEnd:u+e[1]},`${e[0]}-${e[1]}`))})}));export{ft as Timeseries};