import{r as e}from"./c-BlVx34DW.js";import{B as t,H as n,N as r,V as i,i as a,o,r as s}from"./c--0d3J7OA.js";import{t as c}from"./c-BdIG0Mup.js";import{t as l}from"./c-BIKi1dEH.js";import{n as u,t as d}from"./c-ZNkAqwS5.js";import{n as f,t as p}from"./c-DXBWVpQV.js";var m=e(i(),1),h=`const PI: f32 = 3.1415926535;
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
`,g=1e5,_={r:.149,g:.149,b:.149,a:1},v=.005,y=.01,b=Math.PI/2;Math.PI-.01;var x=.95,S=Math.PI/4,C=.1,w=`depth24plus`,T=1,E=class{device;format;pipeline;bindGroup;uniformBuffer;uniformView;depthTexture=null;constructor(e,t){this.camera=e,this.msaaManager=t}init(e){this.device=e.device,this.format=e.format,this.uniformView=u(d(h).uniforms.U),this.uniformBuffer=this.device.createBuffer({size:this.uniformView.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let t=this.device.createShaderModule({code:h}),n=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.pipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[n]}),vertex:{module:t,entryPoint:`vs`},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:w},multisample:{count:4}}),this.bindGroup=this.device.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]})}update(e){this.camera.tick();let t=this.camera.getViewMatrix(),n=e.canvasWidth/Math.max(T,e.canvasHeight),r=p.perspective(S,n,C,100),i=p.multiply(r,t);this.uniformView.set({time:e.time,mvp:i}),this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformView.arrayBuffer)}render(e,t,r){let i=this.msaaManager.ensureView(this.device,this.format,r.canvasWidth,r.canvasHeight);if(n(i))return;let a=this.ensureDepthTexture(r.canvasWidth,r.canvasHeight),o=e.beginRenderPass({colorAttachments:[{view:i,resolveTarget:t,loadOp:`clear`,clearValue:_,storeOp:`discard`}],depthStencilAttachment:{view:a.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});o.setPipeline(this.pipeline),o.setBindGroup(0,this.bindGroup),o.draw(3,g,0,0),o.end()}dispose(){this.uniformBuffer.destroy(),this.depthTexture?.destroy()}ensureDepthTexture(e,t){return!n(this.depthTexture)&&this.depthTexture.width===e&&this.depthTexture.height===t?this.depthTexture:(this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(T,e),Math.max(T,t)],format:w,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthTexture)}};function D(e){let{canvas:t,context:n,layerManager:i}=e,{device:a,canvasContext:o}=n,s=0,c=0,l=Math.max(1,window.devicePixelRatio);function u(){l=Math.max(1,window.devicePixelRatio);let e=Math.floor(t.clientWidth*l),n=Math.floor(t.clientHeight*l);(t.width!==e||t.height!==n)&&(t.width=e,t.height=n),s=e,c=n}u();let d=new ResizeObserver(()=>{u()});d.observe(t);let f=0,p=!1,m=performance.now();function h(){if(p)return;if(u(),s===0||c===0){f=requestAnimationFrame(h);return}let e={time:(performance.now()-m)/r,canvasWidth:s,canvasHeight:c,devicePixelRatio:l};i.updateAll(e);let t=o.getCurrentTexture().createView(),n=a.createCommandEncoder();i.renderAll(n,t,e),a.queue.submit([n.finish()]),f=requestAnimationFrame(h)}return f=requestAnimationFrame(h),()=>{p=!0,cancelAnimationFrame(f),d.disconnect()}}function O(e){let t=16,n=b,r=f.fromValues(Math.sin(n)*Math.sin(0),Math.cos(n),Math.sin(n)*Math.cos(0)),i=f.fromValues(0,1,0);function a(e,t){let n=f.negate(r),a=f.normalize(f.cross(n,i));if(Math.abs(t)>0){let e=-t*v,n=p.rotation(a,e);r=f.transformMat4(r,n),i=f.normalize(f.transformMat4(i,n))}if(Math.abs(e)>0){let t=-e*v,n=p.rotation(i,t);r=f.transformMat4(r,n)}r=f.normalize(r)}function o(e){return Math.max(5,Math.min(20,e))}let s=0,c=0,l=new Map,u=0;function d(){let e=[...l.values()],t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}function m(e){l.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),l.size===2&&(u=d())}function h(e){let n=l.get(e.pointerId);if(n===void 0)return;if(l.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),l.size===2){let e=d(),n=u/e;t=o(t*n),u=e;return}if(l.size!==1)return;let r=e.clientX-n.clientX,i=e.clientY-n.clientY;s=r,c=i,a(r,i)}function g(e){l.delete(e.pointerId)}function _(e){l.delete(e.pointerId)}function S(e){e.preventDefault(),t=o(t*(1+e.deltaY*y))}return e.addEventListener(`pointerdown`,m),window.addEventListener(`pointermove`,h),window.addEventListener(`pointerup`,g),window.addEventListener(`pointercancel`,_),e.addEventListener(`wheel`,S,{passive:!1}),{tick(){if(!(l.size>0)){if(Math.abs(s)<.1&&Math.abs(c)<.1){s=0,c=0;return}a(s,c),s*=x,c*=x}},getViewMatrix(){let e=f.scale(r,t),n=f.fromValues(0,0,0);return p.lookAt(e,n,i)},destroy(){e.removeEventListener(`pointerdown`,m),window.removeEventListener(`pointermove`,h),window.removeEventListener(`pointerup`,g),window.removeEventListener(`pointercancel`,_),e.removeEventListener(`wheel`,S)}}}function k(e){let t=!1,n,r=O(e);return A(e,r).then(e=>{t?e():n=e}),()=>{t=!0,r.destroy(),n?.()}}async function A(e,t){let n=await o(e),r=a(4),i=new s([new E(t,r)]);i.initAll(n);let c=D({canvas:e,context:n,layerManager:i});return()=>{c(),i.dispose(),r.dispose(),n.device.destroy()}}var j=t(),M=(0,m.memo)(()=>{let e=(0,m.useRef)(null);return(0,m.useEffect)(()=>{if(e.current)return k(e.current)},[]),(0,j.jsx)(l,{className:c.fixedContainer,children:(0,j.jsx)(`div`,{className:c.fixedContainer,children:(0,j.jsx)(`canvas`,{ref:e,className:`h-full w-full [touch-action:none]`})})})});export{M as Sun};