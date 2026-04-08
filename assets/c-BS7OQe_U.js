import{D as e,M as t,N as n,P as r,j as i,st as a}from"./c-D2N51Ix1.js";import{t as o}from"./c-ByL8Qlu7.js";var s=a(n(),1),c=2048,l=.1,u=1767225600;48/Float32Array.BYTES_PER_ELEMENT;var d=.7,f=1.3,p=.18,m=.005,h=365*24*3600,g=`http://www.w3.org/2000/svg`,_=`#999`,v=`rgba(38, 38, 38, 0.75)`,y=`#555`,b=`#333`,ee=`monospace`,te=1024,x=2160*3600,S=720*3600,C=168*3600,ne=[[0,h],[h/2-x/2,h/2+x/2],[h/2-S/2,h/2+S/2],[h/2-C/2,h/2+C/2]],re=`struct Uniforms {
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
`;async function ie(){i(!r(navigator.gpu),`WebGPU is not supported`);let e=await navigator.gpu.requestAdapter();i(!r(e),`WebGPU adapter not available`);let t=await e.requestDevice(),n=new OffscreenCanvas(te,768),a=n.getContext(`webgpu`);i(!r(a),`Failed to get WebGPU context on OffscreenCanvas`);let o=navigator.gpu.getPreferredCanvasFormat();a.configure({device:t,format:o,alphaMode:`premultiplied`});let s=t.createShaderModule({code:re}),c=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}}]}),l={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},u=t.createPipelineLayout({bindGroupLayouts:[c]});return new ae(t,o,c,t.createRenderPipeline({layout:u,vertex:{module:s,entryPoint:`vs`},fragment:{module:s,entryPoint:`fs`,targets:[{format:o,blend:l}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),t.createRenderPipeline({layout:u,vertex:{module:s,entryPoint:`vsCandlestick`},fragment:{module:s,entryPoint:`fsCandlestick`,targets:[{format:o,blend:l}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),n,a)}var ae=class{device;format;bindGroupLayout;linePipeline;candlestickPipeline;offscreen;ctx;charts=new Set;msaaTexture=null;msaaView=null;msaaWidth=0;msaaHeight=0;animationFrameId=0;lastFrameTime=0;disposed=!1;constructor(e,t,n,r,i,a,o){this.device=e,this.format=t,this.bindGroupLayout=n,this.linePipeline=r,this.candlestickPipeline=i,this.offscreen=a,this.ctx=o}registerChart(e){return this.charts.add(e),this.charts.size===1&&this.startAnimationLoop(),()=>{this.charts.delete(e),e.dispose(),this.charts.size===0&&this.stopAnimationLoop()}}destroy(){if(!this.disposed){this.disposed=!0,this.stopAnimationLoop();for(let e of this.charts)e.dispose();this.charts.clear(),this.msaaTexture?.destroy(),this.msaaTexture=null,this.msaaView=null,this.device.destroy()}}hasActiveCharts(){for(let e of this.charts)if(e.isActive)return!0;return!1}startAnimationLoop(){if(this.disposed)return;let e=t=>{if(!this.disposed){if(!this.hasActiveCharts()&&t-this.lastFrameTime<1e3){this.animationFrameId=requestAnimationFrame(e);return}this.lastFrameTime=t,this.renderAllCharts(),this.animationFrameId=requestAnimationFrame(e)}};this.animationFrameId=requestAnimationFrame(e)}stopAnimationLoop(){cancelAnimationFrame(this.animationFrameId),this.animationFrameId=0}ensureMsaaTexture(){let e=0,t=0;for(let n of this.charts)e=Math.max(e,n.width),t=Math.max(t,n.height);return e===this.msaaWidth&&t===this.msaaHeight&&!r(this.msaaView)?this.msaaView:(this.msaaTexture?.destroy(),e===0||t===0?(this.msaaTexture=null,this.msaaView=null,this.msaaWidth=0,this.msaaHeight=0,null):(this.msaaTexture=this.device.createTexture({size:[e,t],format:this.format,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.msaaView=this.msaaTexture.createView(),this.msaaWidth=e,this.msaaHeight=t,this.msaaView))}renderAllCharts(){for(let e of this.charts){e.update();let{width:t,height:n}=e;if(t===0||n===0)continue;let i=e.prepareDrawCommands();if(r(i))continue;(this.offscreen.width!==t||this.offscreen.height!==n)&&(this.offscreen.width=t,this.offscreen.height=n,this.ctx.configure({device:this.device,format:this.format,alphaMode:`premultiplied`}));let a=this.ensureMsaaTexture();if(r(a))continue;let o=this.ctx.getCurrentTexture().createView(),s=this.device.createCommandEncoder(),c=s.beginRenderPass({colorAttachments:[{view:a,resolveTarget:o,loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]}),{plotArea:l}=i;c.setScissorRect(l.x,l.y,l.width,l.height),c.setPipeline(this.linePipeline),c.setBindGroup(0,i.lineBindGroup),c.draw(18,i.lineInstanceCount,0,0),c.setPipeline(this.candlestickPipeline),c.setBindGroup(0,i.candlestickBindGroup),c.draw(6,i.candlestickInstanceCount,0,0),c.end(),this.device.queue.submit([s.finish()]);let u=this.offscreen.transferToImageBitmap();e.target2dContext.clearRect(0,0,t,n),e.target2dContext.drawImage(u,0,0),u.close(),e.renderOverlay()}}},w=t(),oe=(0,s.createContext)(null);function se(){return(0,s.useContext)(oe)}var ce=(0,s.memo)(({children:e})=>{let[t,n]=(0,s.useState)(null);return(0,s.useEffect)(()=>{let e=!1,t;return ie().then(r=>{if(e){r.destroy();return}t=r,n(r)}),()=>{e=!0,r(t)||t.destroy()}},[]),(0,w.jsx)(oe,{value:t,children:e})}),T=function(e){return e[e.Year=0]=`Year`,e[e.Month=1]=`Month`,e[e.Week=2]=`Week`,e[e.Day=3]=`Day`,e[e.Hour=4]=`Hour`,e[e.Minute=5]=`Minute`,e}({}),E=60,D=3600,le=86400,ue=60,O=24,k=[1,2,5],de=8,fe=2,pe=70,me=20,he=10;function A(t){let n=BigInt(Math.trunc(t))*1000000000n;return e.Instant.fromEpochNanoseconds(n)}function j(e,t){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}`}function ge(e,t,n){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}:${String(n).padStart(2,`0`)}`}function M(e,t,n,r,i){if(e.length<=1||r<=0)return e;let a=n-t;if(a<=0)return e;let o=i+he,s=[],c=-1/0;for(let n of e){let e=(n.position-t)/a*r;e-c>=o&&(s.push(n),c=e)}return s}function N(e,t,n,r){return M(_e(e,t,n),e,t,r,pe)}function _e(t,n,r){let i=[];switch(r){case T.Year:{let r=A(t).toZonedDateTimeISO(`UTC`),a=A(n).toZonedDateTimeISO(`UTC`),o=r.with({day:1,hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(o,r)<0&&(o=o.add({months:1}));e.ZonedDateTime.compare(o,a)<=0;)i.push({position:Number(o.epochNanoseconds/1000000000n),label:o.toPlainDate().toLocaleString(`en-US`,{month:`short`})}),o=o.add({months:1});break}case T.Month:{let r=A(t).toZonedDateTimeISO(`UTC`),a=A(n).toZonedDateTimeISO(`UTC`),o=r.with({hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(o,r)<0&&(o=o.add({days:1}));e.ZonedDateTime.compare(o,a)<=0;)i.push({position:Number(o.epochNanoseconds/1000000000n),label:String(o.day)}),o=o.add({days:1});break}case T.Week:{let r=A(t).toZonedDateTimeISO(`UTC`),a=A(n).toZonedDateTimeISO(`UTC`),o=[`Mon`,`Tue`,`Wed`,`Thu`,`Fri`,`Sat`,`Sun`],s=r.with({hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(s,r)<0&&(s=s.add({days:1}));e.ZonedDateTime.compare(s,a)<=0;){let e=s.dayOfWeek;i.push({position:Number(s.epochNanoseconds/1000000000n),label:o[e-1]}),s=s.add({days:1})}break}case T.Day:{let e=Math.ceil(t/D),r=Math.floor(n/D);for(let t=e;t<=r;t++){let e=t*D,n=(t%O+O)%O;i.push({position:e,label:j(n,0)})}break}case T.Hour:{let e=Math.ceil(t/E),r=Math.floor(n/E);for(let t=e;t<=r;t++){let e=t*E,n=Math.floor(e%le/E),r=Math.floor(n/ue),a=n%ue;i.push({position:e,label:j((r%O+O)%O,a)})}break}case T.Minute:{let e=Math.ceil(t),r=Math.floor(n);for(let t=e;t<=r;t++){let e=t%le,n=Math.floor(e/D),r=Math.floor(e%D/E),a=e%E;i.push({position:t,label:ge((n%O+O)%O,r,a)})}break}}return i}function P(e){if(e<=0)return 1;let t=10**Math.floor(Math.log10(e)),n=e/t;for(let e of k)if(e>=n)return e*t;return k[0]*t*10}function F(e,t,n){let r=t-e;if(r<=0)return[{position:e,label:I(e,1)}];let i=P(r/de);Math.floor(r/i)<fe&&(i=P(r/fe));let a=Math.max(0,-Math.floor(Math.log10(i))+1),o=[],s=Math.ceil(e/i)*i;for(let n=s;n<=t+i*.01;n+=i)n>=e&&n<=t&&o.push({position:n,label:I(n,a)});return M(o,e,t,n,me)}function I(e,t){return e.toFixed(t)}function L(e,t){let n=t-e;return n>=15552e3?T.Year:n>=1728e3?T.Month:n>=259200?T.Week:n>=21600?T.Day:n>=600?T.Hour:T.Minute}function R(e,t,n,r){let i=t-e;return i>=r-n?[n,r]:e<n?[n,n+i]:t>r?[r-i,r]:[e,t]}function ve(e,t){let n=t-e,r=n>0?n*l:1;return[e-r,t+r]}function z(e,t,n,r){let i=e.length;if(i===0)return;let a=0,o=i;for(;a<o;){let t=a+o>>1;e[t]<n?a=t+1:o=t}let s=a;for(a=s,o=i;a<o;){let t=a+o>>1;e[t]<=r?a=t+1:o=t}let c=a;if(s>=c)return;let l=1/0,u=-1/0;for(let e=s;e<c;e++){let n=t[e];n<l&&(l=n),n>u&&(u=n)}return[l,u]}function ye(e,t,n,r){let i=n*((t-e)/r);return[e-i,t-i]}function be(e,t,n,r){let i=t-e,a=e+i*r,o=Math.max(i*n,60);return[a-o*r,a+o*(1-r)]}function xe(e){for(;e.firstChild;)e.removeChild(e.firstChild)}function Se(e,t){let n=e,r=t,i=n-10,a=r-10,o=i-10,s=a-10;return o<=0||s<=0?null:{svgWidth:n,svgHeight:r,plotLeft:10,plotRight:i,plotTop:10,plotBottom:a,plotWidth:o,plotHeight:s}}function Ce(e,t,n){e.setAttribute(`width`,String(t)),e.setAttribute(`height`,String(n)),e.setAttribute(`viewBox`,`0 0 ${t} ${n}`)}function we(e,t,n,r){xe(e);let i=Se(n,r);if(i===null)return;let{svgWidth:a,svgHeight:o,plotLeft:s,plotRight:c,plotTop:l,plotBottom:u,plotWidth:d,plotHeight:f}=i;Ce(e,a,o);let p=t.viewTimeEnd-t.viewTimeStart,m=t.viewValueMax-t.viewValueMin,h=L(t.viewTimeStart,t.viewTimeEnd),_=N(t.viewTimeStart,t.viewTimeEnd,h,d);for(let n of _){let r=s+(n.position-t.viewTimeStart)/p*d;if(r<s||r>c)continue;let i=document.createElementNS(g,`line`);i.setAttribute(`x1`,String(r)),i.setAttribute(`y1`,String(l)),i.setAttribute(`x2`,String(r)),i.setAttribute(`y2`,String(u)),i.setAttribute(`stroke`,b),i.setAttribute(`stroke-width`,`0.5`),e.appendChild(i)}let v=F(t.viewValueMin,t.viewValueMax,f);for(let n of v){let r=u-(n.position-t.viewValueMin)/m*f;if(r<l||r>u)continue;let i=document.createElementNS(g,`line`);i.setAttribute(`x1`,String(s)),i.setAttribute(`y1`,String(r)),i.setAttribute(`x2`,String(c)),i.setAttribute(`y2`,String(r)),i.setAttribute(`stroke`,b),i.setAttribute(`stroke-width`,`0.5`),e.appendChild(i)}}function Te(e,t,n,r){xe(e);let i=Se(n,r);if(i===null)return;let{svgWidth:a,svgHeight:o,plotLeft:s,plotRight:c,plotTop:l,plotBottom:u,plotWidth:d,plotHeight:f}=i;Ce(e,a,o);let p=document.createElementNS(g,`path`);p.setAttribute(`d`,`M ${s} ${l} L ${s} ${u} L ${c} ${u}`),p.setAttribute(`stroke`,y),p.setAttribute(`fill`,`none`),p.setAttribute(`stroke-width`,`1`),e.appendChild(p);let m=t.viewTimeEnd-t.viewTimeStart,h=t.viewValueMax-t.viewValueMin,b=L(t.viewTimeStart,t.viewTimeEnd),te=N(t.viewTimeStart,t.viewTimeEnd,b,d);for(let n of te){let r=s+(n.position-t.viewTimeStart)/m*d;if(r<s||r>c)continue;let i=document.createElementNS(g,`line`);i.setAttribute(`x1`,String(r)),i.setAttribute(`y1`,String(u)),i.setAttribute(`x2`,String(r)),i.setAttribute(`y2`,String(u-5)),i.setAttribute(`stroke`,y),i.setAttribute(`stroke-width`,`1`),e.appendChild(i);let a=u-5-3,o=n.label.length*11*.6;if(r-o/2-3<s+18)continue;let l=document.createElementNS(g,`rect`);l.setAttribute(`x`,String(r-o/2-3)),l.setAttribute(`y`,String(a-11+2)),l.setAttribute(`width`,String(o+6)),l.setAttribute(`height`,`15`),l.setAttribute(`fill`,v),l.setAttribute(`rx`,`2`),e.appendChild(l);let f=document.createElementNS(g,`text`);f.setAttribute(`x`,String(r)),f.setAttribute(`y`,String(a)),f.setAttribute(`text-anchor`,`middle`),f.setAttribute(`fill`,_),f.setAttribute(`font-size`,`11`),f.setAttribute(`font-family`,ee),f.textContent=n.label,e.appendChild(f)}let x=F(t.viewValueMin,t.viewValueMax,f);for(let n of x){let r=u-(n.position-t.viewValueMin)/h*f;if(r<l||r>u)continue;let i=document.createElementNS(g,`line`);i.setAttribute(`x1`,String(s)),i.setAttribute(`y1`,String(r)),i.setAttribute(`x2`,String(s+5)),i.setAttribute(`y2`,String(r)),i.setAttribute(`stroke`,y),i.setAttribute(`stroke-width`,`1`),e.appendChild(i);let a=s+5+4,o=r+11/3;if(o+2>u-18)continue;let c=n.label.length*11*.6,d=document.createElementNS(g,`rect`);d.setAttribute(`x`,String(a-3)),d.setAttribute(`y`,String(o-11+2)),d.setAttribute(`width`,String(c+6)),d.setAttribute(`height`,`15`),d.setAttribute(`fill`,v),d.setAttribute(`rx`,`2`),e.appendChild(d);let p=document.createElementNS(g,`text`);p.setAttribute(`x`,String(a)),p.setAttribute(`y`,String(o)),p.setAttribute(`text-anchor`,`start`),p.setAttribute(`fill`,_),p.setAttribute(`font-size`,`11`),p.setAttribute(`font-family`,ee),p.textContent=n.label,e.appendChild(p)}}var Ee=class{isDragging=!1;lastMouseX=0;isTouching=!1;lastTouchX=0;lastPinchDistance=0;handleMouseDown;handleMouseMove;handleMouseUp;handleWheel;handleTouchStart;handleTouchMove;handleTouchEnd;constructor(e,t,n,r){this.viewport=e,this.canvas=t,this.dataMinTime=n,this.dataMaxTime=r,this.handleMouseDown=e=>{this.isDragging=!0,this.lastMouseX=e.clientX,this.canvas.style.cursor=`grabbing`},this.handleMouseMove=e=>{if(!this.isDragging)return;let t=e.clientX-this.lastMouseX;this.lastMouseX=e.clientX;let[n,r]=R(...ye(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,t,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=n,this.viewport.viewTimeEnd=r,this.viewport.targetTimeStart=n,this.viewport.targetTimeEnd=r},this.handleMouseUp=()=>{this.isDragging=!1,this.canvas.style.cursor=`grab`},this.handleWheel=e=>{e.preventDefault();let t=this.canvas.getBoundingClientRect(),n=(e.clientX-t.left)/t.width,r=e.deltaY>0?f:d,[i,a]=R(...be(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,r,n),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a},this.handleTouchStart=e=>{e.touches.length===1?(this.isTouching=!0,this.lastTouchX=e.touches[0].clientX):e.touches.length===2&&(this.isTouching=!1,this.lastPinchDistance=this.getTouchDistance(e))},this.handleTouchMove=e=>{if(e.preventDefault(),e.touches.length===2){let t=this.getTouchDistance(e),n=this.lastPinchDistance/t,r=this.getTouchCenter(e),[i,a]=R(...be(this.viewport.targetTimeStart,this.viewport.targetTimeEnd,n,r),this.dataMinTime,this.dataMaxTime);this.viewport.targetTimeStart=i,this.viewport.targetTimeEnd=a,this.lastPinchDistance=t;return}if(!this.isTouching||e.touches.length!==1)return;let t=e.touches[0].clientX-this.lastTouchX;this.lastTouchX=e.touches[0].clientX;let[n,r]=R(...ye(this.viewport.viewTimeStart,this.viewport.viewTimeEnd,t,this.canvas.clientWidth),this.dataMinTime,this.dataMaxTime);this.viewport.viewTimeStart=n,this.viewport.viewTimeEnd=r,this.viewport.targetTimeStart=n,this.viewport.targetTimeEnd=r},this.handleTouchEnd=e=>{e.touches.length===0?this.isTouching=!1:e.touches.length===1&&(this.isTouching=!0,this.lastTouchX=e.touches[0].clientX)}}get isInteracting(){return this.isDragging||this.isTouching}attach(){this.canvas.addEventListener(`mousedown`,this.handleMouseDown),this.canvas.addEventListener(`mousemove`,this.handleMouseMove),this.canvas.addEventListener(`mouseup`,this.handleMouseUp),this.canvas.addEventListener(`mouseleave`,this.handleMouseUp),this.canvas.addEventListener(`wheel`,this.handleWheel,{passive:!1}),this.canvas.addEventListener(`touchstart`,this.handleTouchStart,{passive:!0}),this.canvas.addEventListener(`touchmove`,this.handleTouchMove,{passive:!1}),this.canvas.addEventListener(`touchend`,this.handleTouchEnd),this.canvas.style.cursor=`grab`}detach(){this.canvas.removeEventListener(`mousedown`,this.handleMouseDown),this.canvas.removeEventListener(`mousemove`,this.handleMouseMove),this.canvas.removeEventListener(`mouseup`,this.handleMouseUp),this.canvas.removeEventListener(`mouseleave`,this.handleMouseUp),this.canvas.removeEventListener(`wheel`,this.handleWheel),this.canvas.removeEventListener(`touchstart`,this.handleTouchStart),this.canvas.removeEventListener(`touchmove`,this.handleTouchMove),this.canvas.removeEventListener(`touchend`,this.handleTouchEnd)}getTouchDistance(e){let t=e.touches[0].clientX-e.touches[1].clientX,n=e.touches[0].clientY-e.touches[1].clientY;return Math.sqrt(t*t+n*n)}getTouchCenter(e){let t=this.canvas.getBoundingClientRect();return((e.touches[0].clientX+e.touches[1].clientX)/2-t.left)/t.width}},B=255,V=255,De=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),Oe=new Float32Array(De),ke=new Uint32Array(De);function Ae(e,t,n,r){let i=Math.round(r*V)&B,a=Math.round(e*V)&B,o=Math.round(t*V)&B,s=Math.min(Math.round(n*V)&B,126);return ke[0]=i|a<<8|o<<16|s<<24,Oe[0]}var je=2654435761,Me=16,Ne=4294967296;function Pe(e){let t=Math.imul(e,je)>>>0,n=(t^t>>>Me)>>>0;return{value:n/Ne,next:n}}function Fe(e,t){return Pe((Math.trunc(e*1e3)^Math.imul(t,je))>>>0).value-.5}var H=366,Ie=.5,Le=100,U;function Re(){if(U!==void 0)return U;let e=new Float64Array(H),t=new Float64Array(H),n=u,r=h/(H-1),i=42,a=Le;for(let o=0;o<H;o++){e[o]=n+o*r;let s=Pe(i);i=s.next,a+=(s.value-.5)*Ie,t[o]=a}return U={times:e,values:t},U}function ze(e){let{times:t,values:n}=Re();if(e<=t[0])return n[0];if(e>=t[H-1])return n[H-1];let r=0,i=H-1;for(;i-r>1;){let n=r+i>>1;t[n]<=e?r=n:i=n}let a=(e-t[r])/(t[i]-t[r]);return n[r]+a*(n[i]-n[r])}var Be={[T.Year]:0,[T.Month]:.15,[T.Week]:.08,[T.Day]:.04,[T.Hour]:.02,[T.Minute]:.01},Ve={[T.Year]:365,[T.Month]:300,[T.Week]:168,[T.Day]:480,[T.Hour]:360,[T.Minute]:60},W=1,He=10-W;function Ue(e){return Ae(e,.8-e*.6,1-e*.2,1)}function We(e){return W+(Fe(e,7)+.5)*He}function Ge(e,t,n){return n===T.Year?Ke(e,t):qe(e,t,n)}function Ke(e,t){let{times:n,values:r}=Re(),i=[],a=n[H-1]-n[0];for(let o=0;o<H;o++)if(n[o]>=e&&n[o]<=t){let e=(n[o]-n[0])/a;i.push({time:n[o],value:r[o],size:We(n[o]),color:Ue(e)})}return i}function qe(e,t,n){let r=Ve[n],i=(t-e)/(r-1),a=Be[n],o=u,s=h,c=Array(r);for(let t=0;t<r;t++){let r=e+t*i,l=ze(r),u=0,d=n;for(let e=1;e<=d;e++){let t=Be[e]??0;u+=Fe(r,e)*t}let f=l+u*a*10,p=(r-o)/s,m=Math.max(0,Math.min(1,p));c[t]={time:r,value:f,size:We(r),color:Ue(m)}}return c}var Je=3;function Ye(e,t,n){let r=new ArrayBuffer(e.length*4*Float32Array.BYTES_PER_ELEMENT),i=new Float32Array(r),a=new Uint32Array(r);for(let r=0;r<e.length;r++){let o=r*4,s=e[r];i[o]=s.time-t,i[o+1]=s.value-n,i[o+2]=s.size,a[o+Je]=$e(s.color)}return i}var Xe=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),Ze=new Float32Array(Xe),Qe=new Uint32Array(Xe);function $e(e){return Ze[0]=e,Qe[0]}function et(e,t,n=0,r=e.length-1,i=tt){for(;r>n;){if(r-n>600){let a=r-n+1,o=t-n+1,s=Math.log(a),c=.5*Math.exp(2*s/3),l=.5*Math.sqrt(s*c*(a-c)/a)*(o-a/2<0?-1:1);et(e,t,Math.max(n,Math.floor(t-o*c/a+l)),Math.min(r,Math.floor(t+(a-o)*c/a+l)),i)}let a=e[t],o=n,s=r;for(G(e,n,t),i(e[r],a)>0&&G(e,n,r);o<s;){for(G(e,o,s),o++,s--;i(e[o],a)<0;)o++;for(;i(e[s],a)>0;)s--}i(e[n],a)===0?G(e,n,s):(s++,G(e,s,r)),s<=t&&(n=s+1),t<=s&&(r=s-1)}}function G(e,t,n){let r=e[t];e[t]=e[n],e[n]=r}function tt(e,t){return e<t?-1:e>t?1:0}var nt=class{constructor(e=9){this._maxEntries=Math.max(4,e),this._minEntries=Math.max(2,Math.ceil(this._maxEntries*.4)),this.clear()}all(){return this._all(this.data,[])}search(e){let t=this.data,n=[];if(!Q(e,t))return n;let r=this.toBBox,i=[];for(;t;){for(let a=0;a<t.children.length;a++){let o=t.children[a],s=t.leaf?r(o):o;Q(e,s)&&(t.leaf?n.push(o):Z(e,s)?this._all(o,n):i.push(o))}t=i.pop()}return n}collides(e){let t=this.data;if(!Q(e,t))return!1;let n=[];for(;t;){for(let r=0;r<t.children.length;r++){let i=t.children[r],a=t.leaf?this.toBBox(i):i;if(Q(e,a)){if(t.leaf||Z(e,a))return!0;n.push(i)}}t=n.pop()}return!1}load(e){if(!(e&&e.length))return this;if(e.length<this._minEntries){for(let t=0;t<e.length;t++)this.insert(e[t]);return this}let t=this._build(e.slice(),0,e.length-1,0);if(!this.data.children.length)this.data=t;else if(this.data.height===t.height)this._splitRoot(this.data,t);else{if(this.data.height<t.height){let e=this.data;this.data=t,t=e}this._insert(t,this.data.height-t.height-1,!0)}return this}insert(e){return e&&this._insert(e,this.data.height-1),this}clear(){return this.data=$([]),this}remove(e,t){if(!e)return this;let n=this.data,r=this.toBBox(e),i=[],a=[],o,s,c;for(;n||i.length;){if(n||(n=i.pop(),s=i[i.length-1],o=a.pop(),c=!0),n.leaf){let r=rt(e,n.children,t);if(r!==-1)return n.children.splice(r,1),i.push(n),this._condense(i),this}!c&&!n.leaf&&Z(n,r)?(i.push(n),a.push(o),o=0,s=n,n=n.children[0]):s?(o++,n=s.children[o],c=!1):n=null}return this}toBBox(e){return e}compareMinX(e,t){return e.minX-t.minX}compareMinY(e,t){return e.minY-t.minY}toJSON(){return this.data}fromJSON(e){return this.data=e,this}_all(e,t){let n=[];for(;e;)e.leaf?t.push(...e.children):n.push(...e.children),e=n.pop();return t}_build(e,t,n,r){let i=n-t+1,a=this._maxEntries,o;if(i<=a)return o=$(e.slice(t,n+1)),K(o,this.toBBox),o;r||(r=Math.ceil(Math.log(i)/Math.log(a)),a=Math.ceil(i/a**(r-1))),o=$([]),o.leaf=!1,o.height=r;let s=Math.ceil(i/a),c=s*Math.ceil(Math.sqrt(a));ct(e,t,n,c,this.compareMinX);for(let i=t;i<=n;i+=c){let t=Math.min(i+c-1,n);ct(e,i,t,s,this.compareMinY);for(let n=i;n<=t;n+=s){let i=Math.min(n+s-1,t);o.children.push(this._build(e,n,i,r-1))}}return K(o,this.toBBox),o}_chooseSubtree(e,t,n,r){for(;r.push(t),!(t.leaf||r.length-1===n);){let n=1/0,r=1/0,i;for(let a=0;a<t.children.length;a++){let o=t.children[a],s=Y(o),c=ot(e,o)-s;c<r?(r=c,n=s<n?s:n,i=o):c===r&&s<n&&(n=s,i=o)}t=i||t.children[0]}return t}_insert(e,t,n){let r=n?e:this.toBBox(e),i=[],a=this._chooseSubtree(r,this.data,t,i);for(a.children.push(e),J(a,r);t>=0&&i[t].children.length>this._maxEntries;)this._split(i,t),t--;this._adjustParentBBoxes(r,i,t)}_split(e,t){let n=e[t],r=n.children.length,i=this._minEntries;this._chooseSplitAxis(n,i,r);let a=this._chooseSplitIndex(n,i,r),o=$(n.children.splice(a,n.children.length-a));o.height=n.height,o.leaf=n.leaf,K(n,this.toBBox),K(o,this.toBBox),t?e[t-1].children.push(o):this._splitRoot(n,o)}_splitRoot(e,t){this.data=$([e,t]),this.data.height=e.height+1,this.data.leaf=!1,K(this.data,this.toBBox)}_chooseSplitIndex(e,t,n){let r,i=1/0,a=1/0;for(let o=t;o<=n-t;o++){let t=q(e,0,o,this.toBBox),s=q(e,o,n,this.toBBox),c=st(t,s),l=Y(t)+Y(s);c<i?(i=c,r=o,a=l<a?l:a):c===i&&l<a&&(a=l,r=o)}return r||n-t}_chooseSplitAxis(e,t,n){let r=e.leaf?this.compareMinX:it,i=e.leaf?this.compareMinY:at;this._allDistMargin(e,t,n,r)<this._allDistMargin(e,t,n,i)&&e.children.sort(r)}_allDistMargin(e,t,n,r){e.children.sort(r);let i=this.toBBox,a=q(e,0,t,i),o=q(e,n-t,n,i),s=X(a)+X(o);for(let r=t;r<n-t;r++){let t=e.children[r];J(a,e.leaf?i(t):t),s+=X(a)}for(let r=n-t-1;r>=t;r--){let t=e.children[r];J(o,e.leaf?i(t):t),s+=X(o)}return s}_adjustParentBBoxes(e,t,n){for(let r=n;r>=0;r--)J(t[r],e)}_condense(e){for(let t=e.length-1,n;t>=0;t--)e[t].children.length===0?t>0?(n=e[t-1].children,n.splice(n.indexOf(e[t]),1)):this.clear():K(e[t],this.toBBox)}};function rt(e,t,n){if(!n)return t.indexOf(e);for(let r=0;r<t.length;r++)if(n(e,t[r]))return r;return-1}function K(e,t){q(e,0,e.children.length,t,e)}function q(e,t,n,r,i){i||=$(null),i.minX=1/0,i.minY=1/0,i.maxX=-1/0,i.maxY=-1/0;for(let a=t;a<n;a++){let t=e.children[a];J(i,e.leaf?r(t):t)}return i}function J(e,t){return e.minX=Math.min(e.minX,t.minX),e.minY=Math.min(e.minY,t.minY),e.maxX=Math.max(e.maxX,t.maxX),e.maxY=Math.max(e.maxY,t.maxY),e}function it(e,t){return e.minX-t.minX}function at(e,t){return e.minY-t.minY}function Y(e){return(e.maxX-e.minX)*(e.maxY-e.minY)}function X(e){return e.maxX-e.minX+(e.maxY-e.minY)}function ot(e,t){return(Math.max(t.maxX,e.maxX)-Math.min(t.minX,e.minX))*(Math.max(t.maxY,e.maxY)-Math.min(t.minY,e.minY))}function st(e,t){let n=Math.max(e.minX,t.minX),r=Math.max(e.minY,t.minY),i=Math.min(e.maxX,t.maxX),a=Math.min(e.maxY,t.maxY);return Math.max(0,i-n)*Math.max(0,a-r)}function Z(e,t){return e.minX<=t.minX&&e.minY<=t.minY&&t.maxX<=e.maxX&&t.maxY<=e.maxY}function Q(e,t){return t.minX<=e.maxX&&t.minY<=e.maxY&&t.maxX>=e.minX&&t.maxY>=e.minY}function $(e){return{children:e,height:1,leaf:!0,minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0}}function ct(e,t,n,r,i){let a=[t,n];for(;a.length;){if(n=a.pop(),t=a.pop(),n-t<=r)continue;let o=t+Math.ceil((n-t)/r/2)*r;et(e,o,t,n,i),a.push(t,o,o,n)}}function lt(){return new nt}function ut(e,t){e.insert({minX:t.timeStart,minY:t.scale,maxX:t.timeEnd,maxY:t.scale,part:t})}function dt(e,t,n,r){return e.search({minX:n,minY:t,maxX:r,maxY:t})}var ft=0,pt=200,mt=2,ht=class{targetCanvas;target2dContext;gridSvg;axesSvg;viewport;dataMinTime;dataMaxTime;spatialIndex1=lt();spatialIndex2=lt();nextTextureRow=0;uniformBuf1;uniformBuf2;textureRows;dataTexture;bindGroup1;bindGroup2;inputController;resizeObserver;canvasWidth=0;canvasHeight=0;lastOverlayTimeStart=NaN;lastOverlayTimeEnd=NaN;lastOverlayValueMin=NaN;lastOverlayValueMax=NaN;lastOverlayWidth=0;lastOverlayHeight=0;constructor(e,t,n,a,o,s,l){this.device=e,this.bindGroupLayout=t,this.targetCanvas=n,this.gridSvg=a,this.axesSvg=o;let d=n.getContext(`2d`);i(!r(d),`Failed to get 2D canvas context`),this.target2dContext=d,this.dataMinTime=u,this.dataMaxTime=u+h,this.viewport={viewTimeStart:s,viewTimeEnd:l,targetTimeStart:s,targetTimeEnd:l,viewValueMin:ft,viewValueMax:pt},this.uniformBuf1=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.uniformBuf2=e.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.textureRows=4,this.dataTexture=e.createTexture({size:[c,this.textureRows],format:`rgba32float`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC}),this.bindGroup1=this.createBindGroup(this.uniformBuf1),this.bindGroup2=this.createBindGroup(this.uniformBuf2),this.inputController=new Ee(this.viewport,n,this.dataMinTime,this.dataMaxTime),this.inputController.attach(),this.updateCanvasSize(),this.resizeObserver=new ResizeObserver(()=>{this.updateCanvasSize()}),this.resizeObserver.observe(n)}get width(){return this.canvasWidth}get height(){return this.canvasHeight}get isActive(){if(this.inputController.isInteracting)return!0;let e=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*m,t=Math.abs(this.viewport.targetTimeStart-this.viewport.viewTimeStart),n=Math.abs(this.viewport.targetTimeEnd-this.viewport.viewTimeEnd);return t>e||n>e}update(){this.updateCanvasSize();let e=this.viewport.targetTimeStart-this.viewport.viewTimeStart,t=this.viewport.targetTimeEnd-this.viewport.viewTimeEnd,n=(this.viewport.viewTimeEnd-this.viewport.viewTimeStart)*m;Math.abs(e)>n||Math.abs(t)>n?(this.viewport.viewTimeStart+=e*p,this.viewport.viewTimeEnd+=t*p):(this.viewport.viewTimeStart=this.viewport.targetTimeStart,this.viewport.viewTimeEnd=this.viewport.targetTimeEnd)}prepareDrawCommands(){let e=this.ensureDataForViewport();if(r(e)||e.line.pointCount<mt||e.rhombus.pointCount<mt)return null;this.writeUniforms(e.line,this.uniformBuf1),this.writeUniforms(e.rhombus,this.uniformBuf2);let t=Math.max(1,window.devicePixelRatio),n=Math.floor(10*t),i=Math.floor(10*t),a=Math.max(0,this.canvasWidth-Math.floor(20*t)),o=Math.max(0,this.canvasHeight-Math.floor(20*t));return{lineBindGroup:this.bindGroup1,lineInstanceCount:e.line.pointCount-1,candlestickBindGroup:this.bindGroup2,candlestickInstanceCount:e.rhombus.pointCount-1,plotArea:{x:n,y:i,width:a,height:o}}}renderOverlay(){let e=this.targetCanvas.clientWidth,t=this.targetCanvas.clientHeight,{viewTimeStart:n,viewTimeEnd:r,viewValueMin:i,viewValueMax:a}=this.viewport;n===this.lastOverlayTimeStart&&r===this.lastOverlayTimeEnd&&i===this.lastOverlayValueMin&&a===this.lastOverlayValueMax&&e===this.lastOverlayWidth&&t===this.lastOverlayHeight||(this.lastOverlayTimeStart=n,this.lastOverlayTimeEnd=r,this.lastOverlayValueMin=i,this.lastOverlayValueMax=a,this.lastOverlayWidth=e,this.lastOverlayHeight=t,we(this.gridSvg,this.viewport,e,t),Te(this.axesSvg,this.viewport,e,t))}dispose(){this.resizeObserver.disconnect(),this.inputController.detach(),this.dataTexture.destroy(),this.uniformBuf1.destroy(),this.uniformBuf2.destroy()}createBindGroup(e){let t=this.dataTexture.createView();return this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:e}},{binding:1,resource:t}]})}rebuildBindGroups(){this.bindGroup1=this.createBindGroup(this.uniformBuf1),this.bindGroup2=this.createBindGroup(this.uniformBuf2)}growTextureIfNeeded(e){if(e<=this.textureRows)return!0;let t=this.textureRows;for(;t<e;)t*=2;if(t=Math.min(t,512),e>t)return!1;let n=this.device.createTexture({size:[c,t],format:`rgba32float`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC}),r=this.device.createCommandEncoder();return r.copyTextureToTexture({texture:this.dataTexture,origin:[0,0,0]},{texture:n,origin:[0,0,0]},[c,this.nextTextureRow,1]),this.device.queue.submit([r.finish()]),this.dataTexture.destroy(),this.dataTexture=n,this.textureRows=t,this.rebuildBindGroups(),!0}ensureSeriesData(e,t){let n=L(this.viewport.viewTimeStart,this.viewport.viewTimeEnd),r=dt(e,n,this.viewport.viewTimeStart,this.viewport.viewTimeEnd).find(e=>e.part.timeStart<=this.viewport.viewTimeStart&&e.part.timeEnd>=this.viewport.viewTimeEnd);if(r!==void 0)return r.part;let i=this.viewport.viewTimeEnd-this.viewport.viewTimeStart,a=Math.max(this.dataMinTime,this.viewport.viewTimeStart-i),o=Math.min(this.dataMaxTime,this.viewport.viewTimeEnd+i),s=Ge(a,o,n);if(s.length===0)return null;if(t!==0)for(let e of s)e.value+=t;let l=s[0].time,u=s[0].value,d=Ye(s,l,u),f=this.nextTextureRow,p=Math.ceil(s.length/c);if(!this.growTextureIfNeeded(f+p))return null;for(let e=0;e<p;e++){let t=Math.min(c,s.length-e*c),n=e*c*4,r=d.subarray(n,n+t*4);this.device.queue.writeTexture({texture:this.dataTexture,origin:[0,f+e,0]},r,{bytesPerRow:c*4*Float32Array.BYTES_PER_ELEMENT,rowsPerImage:1},[t,1,1])}let m=new Float64Array(s.length),h=new Float64Array(s.length),g=1/0,_=-1/0;for(let e=0;e<s.length;e++)m[e]=s[e].time,h[e]=s[e].value,s[e].value<g&&(g=s[e].value),s[e].value>_&&(_=s[e].value);let v={scale:n,timeStart:a,timeEnd:o,baseTime:l,baseValue:u,textureRowStart:f,pointCount:s.length,valueMin:g,valueMax:_,pointTimes:m,pointValues:h};return ut(e,v),this.nextTextureRow+=p,v}ensureDataForViewport(){let e=this.ensureSeriesData(this.spatialIndex1,0),t=this.ensureSeriesData(this.spatialIndex2,2);if(r(e)||r(t))return null;let n=z(e.pointTimes,e.pointValues,this.viewport.viewTimeStart,this.viewport.viewTimeEnd),i=z(t.pointTimes,t.pointValues,this.viewport.viewTimeStart,this.viewport.viewTimeEnd),a=1/0,o=-1/0;if(n!==void 0&&(a=Math.min(a,n[0]),o=Math.max(o,n[1])),i!==void 0&&(a=Math.min(a,i[0]),o=Math.max(o,i[1])),a<o){let[e,t]=ve(a,o);this.viewport.viewValueMin=e,this.viewport.viewValueMax=t}return{line:e,rhombus:t}}writeUniforms(e,t){let n=new ArrayBuffer(48),r=new Float32Array(n),i=new Uint32Array(n);r[0]=this.canvasWidth,r[1]=this.canvasHeight,r[2]=this.viewport.viewTimeStart-e.baseTime,r[3]=this.viewport.viewTimeEnd-e.baseTime,r[4]=this.viewport.viewValueMin-e.baseValue,r[5]=this.viewport.viewValueMax-e.baseValue,i[6]=e.pointCount,i[7]=c,r[8]=Math.max(1,window.devicePixelRatio),i[9]=e.textureRowStart,r[10]=e.baseTime,r[11]=e.baseValue,this.device.queue.writeBuffer(t,0,n)}updateCanvasSize(){let e=Math.max(1,window.devicePixelRatio),t=Math.floor(this.targetCanvas.clientWidth*e),n=Math.floor(this.targetCanvas.clientHeight*e);(this.targetCanvas.width!==t||this.targetCanvas.height!==n)&&(this.targetCanvas.width=t,this.targetCanvas.height=n),this.canvasWidth=t,this.canvasHeight=n}},gt=(0,s.memo)(({initialTimeStart:e,initialTimeEnd:t})=>{let n=(0,s.useRef)(null),i=(0,s.useRef)(null),a=(0,s.useRef)(null),o=se();return(0,s.useEffect)(()=>{if(r(o)||r(n.current)||r(i.current)||r(a.current))return;let s=new ht(o.device,o.bindGroupLayout,i.current,n.current,a.current,e,t);return o.registerChart(s)},[o,e,t]),(0,w.jsxs)(`div`,{className:`relative h-full w-full`,children:[(0,w.jsx)(`svg`,{ref:n,className:`absolute inset-0 h-full w-full bg-[#262626] pointer-events-none`}),(0,w.jsx)(`canvas`,{ref:i,className:`absolute inset-0 h-full w-full`}),(0,w.jsx)(`svg`,{ref:a,className:`absolute inset-0 h-full w-full pointer-events-none`})]})}),_t=(0,s.memo)(()=>(0,w.jsx)(ce,{children:(0,w.jsx)(`div`,{className:`${o.fixedContainer} grid grid-cols-2 grid-rows-2`,children:ne.map(e=>(0,w.jsx)(gt,{initialTimeStart:u+e[0],initialTimeEnd:u+e[1]},`${e[0]}-${e[1]}`))})}));export{_t as Timeseries};