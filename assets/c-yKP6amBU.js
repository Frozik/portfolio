import{n as e,o as t,t as n}from"./c-AyPMouqq.js";import{C as r}from"./e-BYWaZGkp.js";import{n as i,t as a}from"./c-_lO1Xgk82.js";import{a as o}from"./c-Cvd663k42.js";import{a as s,i as c,n as l,t as u}from"./c-Bg4qmmPh.js";import{n as d,t as f}from"./c-CLAONXbA.js";var p=t(e(),1),m=`const PI: f32 = 3.1415926535;
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
`,h=1e6,g={r:.02745,g:.03529,b:.04706,a:1},_=.005,v=.01,y=Math.PI/2,b=.95,x=Math.PI/4,S=.1,C=`depth24plus`,w=1,T=class{device;format;pipeline;bindGroup;uniformBuffer;uniformView;depthTexture=null;constructor(e,t){this.camera=e,this.msaaManager=t}init(e){this.device=e.device,this.format=e.format,this.uniformView=d(f(m).uniforms.U),this.uniformBuffer=this.device.createBuffer({size:this.uniformView.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let t=this.device.createShaderModule({code:m}),n=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.pipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[n]}),vertex:{module:t,entryPoint:`vs`},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:C},multisample:{count:4}}),this.bindGroup=this.device.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]})}update(e){this.camera.tick();let t=this.camera.getViewMatrix(),n=e.canvasWidth/Math.max(w,e.canvasHeight),r=u.perspective(x,n,S,100),i=u.multiply(r,t);this.uniformView.set({time:e.time,mvp:i}),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformView.arrayBuffer)}render(e,t,n){let i=this.msaaManager.ensureView(this.device,this.format,n.canvasWidth,n.canvasHeight);if(r(i))return;let a=this.ensureDepthTexture(n.canvasWidth,n.canvasHeight),o=e.beginRenderPass({colorAttachments:[{view:i,resolveTarget:t,loadOp:`clear`,clearValue:g,storeOp:`discard`}],depthStencilAttachment:{view:a.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});o.setPipeline(this.pipeline),o.setBindGroup(0,this.bindGroup),o.draw(3,h,0,0),o.end()}dispose(){this.uniformBuffer.destroy(),this.depthTexture?.destroy()}ensureDepthTexture(e,t){return!r(this.depthTexture)&&this.depthTexture.width===e&&this.depthTexture.height===t?this.depthTexture:(this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(w,e),Math.max(w,t)],format:C,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthTexture)}};function E(e){let{canvas:t,context:n,layerManager:r}=e,{device:i,canvasContext:a}=n,s=0,c=0,l=Math.max(1,window.devicePixelRatio);function u(){l=Math.max(1,window.devicePixelRatio);let e=Math.floor(t.clientWidth*l),n=Math.floor(t.clientHeight*l);(t.width!==e||t.height!==n)&&(t.width=e,t.height=n),s=e,c=n}u();let d=new ResizeObserver(()=>{u()});d.observe(t);let f=0,p=!1,m=performance.now();function h(){if(p)return;if(u(),s===0||c===0){f=requestAnimationFrame(h);return}let e={time:(performance.now()-m)/o,canvasWidth:s,canvasHeight:c,devicePixelRatio:l};r.updateAll(e);let t=a.getCurrentTexture().createView(),n=i.createCommandEncoder();r.renderAll(n,t,e),i.queue.submit([n.finish()]),f=requestAnimationFrame(h)}return f=requestAnimationFrame(h),()=>{p=!0,cancelAnimationFrame(f),d.disconnect()}}function D(e){let t=16,n=y,r=l.fromValues(Math.sin(n)*Math.sin(0),Math.cos(n),Math.sin(n)*Math.cos(0)),i=l.fromValues(0,1,0);function a(e,t){let n=l.negate(r),a=l.normalize(l.cross(n,i));if(Math.abs(t)>0){let e=-t*_,n=u.rotation(a,e);r=l.transformMat4(r,n),i=l.normalize(l.transformMat4(i,n))}if(Math.abs(e)>0){let t=-e*_,n=u.rotation(i,t);r=l.transformMat4(r,n)}r=l.normalize(r)}function o(e){return Math.max(5,Math.min(20,e))}let s=0,c=0,d=new Map,f=0;function p(){let e=[...d.values()],t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}function m(e){d.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),d.size===2&&(f=p())}function h(e){let n=d.get(e.pointerId);if(n===void 0)return;if(d.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),d.size===2){let e=p(),n=f/e;t=o(t*n),f=e;return}if(d.size!==1)return;let r=e.clientX-n.clientX,i=e.clientY-n.clientY;s=r,c=i,a(r,i)}function g(e){d.delete(e.pointerId)}function x(e){d.delete(e.pointerId)}function S(e){e.preventDefault(),t=o(t*(1+e.deltaY*v))}return e.addEventListener(`pointerdown`,m),window.addEventListener(`pointermove`,h),window.addEventListener(`pointerup`,g),window.addEventListener(`pointercancel`,x),e.addEventListener(`wheel`,S,{passive:!1}),{tick(){if(!(d.size>0)){if(Math.abs(s)<.1&&Math.abs(c)<.1){s=0,c=0;return}a(s,c),s*=b,c*=b}},getViewMatrix(){let e=l.scale(r,t),n=l.fromValues(0,0,0);return u.lookAt(e,n,i)},destroy(){e.removeEventListener(`pointerdown`,m),window.removeEventListener(`pointermove`,h),window.removeEventListener(`pointerup`,g),window.removeEventListener(`pointercancel`,x),e.removeEventListener(`wheel`,S)}}}function O(e){let t=!1,n,r=D(e);return k(e,r).then(e=>{t?e():n=e}),()=>{t=!0,r.destroy(),n?.()}}async function k(e,t){let n=await s(e),r=a(4),i=new c([new T(t,r)]);i.initAll(n);let o=E({canvas:e,context:n,layerManager:i});return()=>{o(),i.dispose(),r.dispose(),n.device.destroy()}}var A=n(),j=(0,p.memo)(()=>{let e=(0,p.useRef)(null);return(0,p.useEffect)(()=>{if(e.current)return O(e.current)},[]),(0,A.jsx)(i,{className:`h-full w-full`,children:(0,A.jsx)(`canvas`,{ref:e,className:`h-full w-full [touch-action:none]`})})});export{j as Sun};