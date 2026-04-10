import{M as e,N as t,P as n,st as r}from"./c-CRgvI9kF.js";import{i,n as a,r as o,t as s}from"./c-CY585mb8.js";import{n as c,r as l,t as u}from"./c-5muM_k27.js";import{t as d}from"./c-CbOWP2mN.js";var f=r(t(),1),p=`const PI: f32 = 3.1415926535;
const TWO_PI: f32 = PI * 2.0;
// Keep in sync with INSTANCE_COUNT in sun-constants.ts
const INSTANCE_COUNT: f32 = 100000.0;
const SPHERE_RADIUS: f32 = 5.0;
const TRIANGLE_HALF_SIZE: f32 = 0.25;
const EVERY_NTH_CENTER_LINE: f32 = 50.0;

// Golden angle ~ 2.39996322972865332...
// For range reduction we compute (GOLDEN_ANGLE * instID) mod TWO_PI
// using extended precision to avoid the f32 seam artifact.
// Split 2pi into high + low: TWO_PI = TP_HI + TP_LO
const GOLDEN_ANGLE: f32 = 2.3999632297286533;
const INV_TWO_PI: f32 = 0.15915494309189535;
const TP_HI: f32 = 6.28125;       // exact in f32 (few mantissa bits)
const TP_LO: f32 = 0.0019353071795864769; // TWO_PI - TP_HI

struct Uniforms {
    time: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
    mvp: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> U: Uniforms;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

fn random(v3: vec3<f32>) -> f32 {
    return fract(sin(dot(v3, vec3<f32>(12.9898, 78.233, 34.258))) * 43758.5453123);
}

fn square(s: f32) -> f32 {
    return s * s;
}

fn neonGradient(val: f32) -> vec3<f32> {
    return clamp(
        vec3<f32>(
            val * 1.3 + 0.1,
            square(abs(0.43 - val) * 1.7),
            (1.0 - val) * 1.7,
        ),
        vec3<f32>(0.0, 0.0, 0.0),
        vec3<f32>(1.0, 1.0, 1.0),
    );
}

// Cody-Waite range reduction: compute (GOLDEN_ANGLE * instID) mod 2pi
// with extended precision to avoid seam artifacts from f32 rounding.
fn reducedTheta(instID: f32) -> f32 {
    let raw = GOLDEN_ANGLE * instID;
    let n = floor(raw * INV_TWO_PI);
    // Subtract n*2pi in two steps for precision: raw - n*TP_HI - n*TP_LO
    return (raw - n * TP_HI) - n * TP_LO;
}

fn instPos(instID: f32) -> vec3<f32> {
    let y = 1.0 - (instID / (INSTANCE_COUNT - 1.0)) * 2.0;
    let radius = sqrt(1.0 - square(y));
    let theta = reducedTheta(instID);

    let x = cos(theta) * radius;
    let z = sin(theta) * radius;

    return vec3<f32>(x, y, z) * SPHERE_RADIUS;
}

fn rot2d(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, s, -s, c);
}

// Build an orthonormal basis from a normal vector (no polar singularities).
// Uses the Pixar method (Duff et al. 2017) which is stable for all directions.
fn buildBasis(n: vec3<f32>) -> mat3x3<f32> {
    let sign = select(-1.0, 1.0, n.z >= 0.0);
    let a = -1.0 / (sign + n.z);
    let b = n.x * n.y * a;
    let tangent = vec3<f32>(1.0 + sign * n.x * n.x * a, sign * b, -sign * n.x);
    let bitangent = vec3<f32>(b, sign + n.y * n.y * a, -n.y);
    return mat3x3<f32>(tangent, bitangent, n);
}

@vertex
fn vs(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    let time = U.time * 0.1;
    let instID = f32(iid);

    // Triangle vertex position (equilateral triangle in XY plane)
    var pos = vec3<f32>(0.0, TRIANGLE_HALF_SIZE, 0.0);
    let angle = f32(vid) * TWO_PI / 3.0;
    let rotated = rot2d(angle) * pos.xy;
    pos = vec3<f32>(rotated, 0.0);

    // Instance position on sphere (golden spiral)
    let iPos = instPos(instID);
    let normal = normalize(iPos);

    // Time-based animation
    let shift = random(iPos) * 2.0 - 1.0;
    let sinVal = abs(sin(TWO_PI * (shift + time)));
    pos *= (1.0 - sinVal) * 0.99 + 0.01;

    // Spin the triangle
    let spinRotated = rot2d(TWO_PI * (shift + time * shift)) * pos.xy;
    pos = vec3<f32>(spinRotated, pos.z);

    // Orient triangle to face outward using stable orthonormal basis
    let basis = buildBasis(normal);
    pos = basis * pos;

    // Offset from center + push outward by sinVal
    pos = pos + iPos + normal * sinVal;

    // Every 50th instance: first vertex draws a line to center
    var finalPos: vec4<f32>;
    if (vid == 0u && (u32(instID) % u32(EVERY_NTH_CENTER_LINE)) == 0u) {
        finalPos = U.mvp * vec4<f32>(0.0, 0.0, 0.0, 1.0);
    } else {
        finalPos = U.mvp * vec4<f32>(pos, 1.0);
    }

    var out: VSOut;
    out.position = finalPos;
    out.color = neonGradient(0.6 + sinVal * 0.4);
    return out;
}

@fragment
fn fs(input: VSOut) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 1.0);
}
`,m=1e5,h={r:.149,g:.149,b:.149,a:1},g=.005,_=.01,v=Math.PI/2;Math.PI-.01;var y=.95,b=Math.PI/4,x=.1,S=1e3,C=`depth24plus`,w=1,T=class{device;format;pipeline;bindGroup;uniformBuffer;uniformView;depthTexture=null;constructor(e,t){this.camera=e,this.msaaManager=t}init(e){this.device=e.device,this.format=e.format,this.uniformView=c(u(p).uniforms.U),this.uniformBuffer=this.device.createBuffer({size:this.uniformView.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let t=this.device.createShaderModule({code:p}),n=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.pipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[n]}),vertex:{module:t,entryPoint:`vs`},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:C},multisample:{count:4}}),this.bindGroup=this.device.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]})}update(e){this.camera.tick();let t=this.camera.getViewMatrix(),n=e.canvasWidth/Math.max(w,e.canvasHeight),r=s.perspective(b,n,x,100),i=s.multiply(r,t);this.uniformView.set({time:e.time,mvp:i}),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformView.arrayBuffer)}render(e,t,r){let i=this.msaaManager.ensureView(this.device,this.format,r.canvasWidth,r.canvasHeight);if(n(i))return;let a=this.ensureDepthTexture(r.canvasWidth,r.canvasHeight),o=e.beginRenderPass({colorAttachments:[{view:i,resolveTarget:t,loadOp:`clear`,clearValue:h,storeOp:`discard`}],depthStencilAttachment:{view:a.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});o.setPipeline(this.pipeline),o.setBindGroup(0,this.bindGroup),o.draw(3,m,0,0),o.end()}dispose(){this.uniformBuffer.destroy(),this.depthTexture?.destroy()}ensureDepthTexture(e,t){return!n(this.depthTexture)&&this.depthTexture.width===e&&this.depthTexture.height===t?this.depthTexture:(this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(w,e),Math.max(w,t)],format:C,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthTexture)}};function E(e){let{canvas:t,context:n,layerManager:r}=e,{device:i,canvasContext:a}=n,o=0,s=0,c=Math.max(1,window.devicePixelRatio);function l(){c=Math.max(1,window.devicePixelRatio);let e=Math.floor(t.clientWidth*c),n=Math.floor(t.clientHeight*c);(t.width!==e||t.height!==n)&&(t.width=e,t.height=n),o=e,s=n}l();let u=new ResizeObserver(()=>{l()});u.observe(t);let d=0,f=!1,p=performance.now();function m(){if(f)return;if(l(),o===0||s===0){d=requestAnimationFrame(m);return}let e={time:(performance.now()-p)/S,canvasWidth:o,canvasHeight:s,devicePixelRatio:c};r.updateAll(e);let t=a.getCurrentTexture().createView(),n=i.createCommandEncoder();r.renderAll(n,t,e),i.queue.submit([n.finish()]),d=requestAnimationFrame(m)}return d=requestAnimationFrame(m),()=>{f=!0,cancelAnimationFrame(d),u.disconnect()}}function D(e){let t=16,n=v,r=a.fromValues(Math.sin(n)*Math.sin(0),Math.cos(n),Math.sin(n)*Math.cos(0)),i=a.fromValues(0,1,0);function o(e,t){let n=a.negate(r),o=a.normalize(a.cross(n,i));if(Math.abs(t)>0){let e=-t*g,n=s.rotation(o,e);r=a.transformMat4(r,n),i=a.normalize(a.transformMat4(i,n))}if(Math.abs(e)>0){let t=-e*g,n=s.rotation(i,t);r=a.transformMat4(r,n)}r=a.normalize(r)}let c=0,l=0,u=!1,d=0,f=0;function p(e){u=!0,d=e.clientX,f=e.clientY}function m(e){if(!u)return;let t=e.clientX-d,n=e.clientY-f;d=e.clientX,f=e.clientY,c=t,l=n,o(t,n)}function h(){u=!1}function b(e){e.preventDefault(),t=Math.max(5,Math.min(20,t*(1+e.deltaY*_)))}e.addEventListener(`mousedown`,p),window.addEventListener(`mousemove`,m),window.addEventListener(`mouseup`,h),e.addEventListener(`wheel`,b,{passive:!1});let x=0,S=0,C=!1,w=0;function T(e){let t=e.touches[0].clientX-e.touches[1].clientX,n=e.touches[0].clientY-e.touches[1].clientY;return Math.sqrt(t*t+n*n)}function E(e){e.touches.length===1?(C=!0,x=e.touches[0].clientX,S=e.touches[0].clientY):e.touches.length===2&&(C=!1,w=T(e))}function D(e){if(e.preventDefault(),e.touches.length===2){let n=T(e),r=w/n;t=Math.max(5,Math.min(20,t*r)),w=n;return}if(!C||e.touches.length!==1)return;let n=e.touches[0].clientX-x,r=e.touches[0].clientY-S;x=e.touches[0].clientX,S=e.touches[0].clientY,c=n,l=r,o(n,r)}function O(e){e.touches.length===0?C=!1:e.touches.length===1&&(C=!0,x=e.touches[0].clientX,S=e.touches[0].clientY)}return e.addEventListener(`touchstart`,E,{passive:!0}),e.addEventListener(`touchmove`,D,{passive:!1}),e.addEventListener(`touchend`,O),{tick(){if(!(u||C)){if(Math.abs(c)<.1&&Math.abs(l)<.1){c=0,l=0;return}o(c,l),c*=y,l*=y}},getViewMatrix(){let e=a.scale(r,t),n=a.fromValues(0,0,0);return s.lookAt(e,n,i)},destroy(){e.removeEventListener(`mousedown`,p),window.removeEventListener(`mousemove`,m),window.removeEventListener(`mouseup`,h),e.removeEventListener(`wheel`,b),e.removeEventListener(`touchstart`,E),e.removeEventListener(`touchmove`,D),e.removeEventListener(`touchend`,O)}}}function O(e){let t=!1,n,r=D(e);return k(e,r).then(e=>{t?e():n=e}),()=>{t=!0,r.destroy(),n?.()}}async function k(e,t){let n=await i(e),r=l(4),a=new o([new T(t,r)]);a.initAll(n);let s=E({canvas:e,context:n,layerManager:a});return()=>{s(),a.dispose(),r.dispose(),n.device.destroy()}}var A=e(),j=(0,f.memo)(()=>{let e=(0,f.useRef)(null);return(0,f.useEffect)(()=>{if(e.current)return O(e.current)},[]),(0,A.jsx)(`div`,{className:d.fixedContainer,children:(0,A.jsx)(`canvas`,{ref:e,style:{width:`100%`,height:`100%`}})})});export{j as Sun};