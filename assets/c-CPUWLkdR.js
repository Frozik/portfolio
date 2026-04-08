import{M as e,N as t,P as n,j as r,st as i}from"./c-D2N51Ix1.js";import{t as a}from"./c-CLIWQxFX.js";import{n as o,t as s}from"./c-9Q3yUddn.js";var c=i(t(),1),l=1e5,u={r:.149,g:.149,b:.149,a:1},d=.005,f=.01,p=Math.PI/2;Math.PI-.01;var m=.95,h=Math.PI/4,g=.1,_=1e3;function v(e){let t=16,n=p,r=o.fromValues(Math.sin(n)*Math.sin(0),Math.cos(n),Math.sin(n)*Math.cos(0)),i=o.fromValues(0,1,0);function a(e,t){let n=o.negate(r),a=o.normalize(o.cross(n,i));if(Math.abs(t)>0){let e=-t*d,n=s.rotation(a,e);r=o.transformMat4(r,n),i=o.normalize(o.transformMat4(i,n))}if(Math.abs(e)>0){let t=-e*d,n=s.rotation(i,t);r=o.transformMat4(r,n)}r=o.normalize(r)}let c=0,l=0,u=!1,h=0,g=0;function _(e){u=!0,h=e.clientX,g=e.clientY}function v(e){if(!u)return;let t=e.clientX-h,n=e.clientY-g;h=e.clientX,g=e.clientY,c=t,l=n,a(t,n)}function y(){u=!1}function b(e){e.preventDefault(),t=Math.max(5,Math.min(20,t*(1+e.deltaY*f)))}e.addEventListener(`mousedown`,_),window.addEventListener(`mousemove`,v),window.addEventListener(`mouseup`,y),e.addEventListener(`wheel`,b,{passive:!1});let x=0,S=0,C=!1,w=0;function T(e){let t=e.touches[0].clientX-e.touches[1].clientX,n=e.touches[0].clientY-e.touches[1].clientY;return Math.sqrt(t*t+n*n)}function E(e){e.touches.length===1?(C=!0,x=e.touches[0].clientX,S=e.touches[0].clientY):e.touches.length===2&&(C=!1,w=T(e))}function D(e){if(e.preventDefault(),e.touches.length===2){let n=T(e),r=w/n;t=Math.max(5,Math.min(20,t*r)),w=n;return}if(!C||e.touches.length!==1)return;let n=e.touches[0].clientX-x,r=e.touches[0].clientY-S;x=e.touches[0].clientX,S=e.touches[0].clientY,c=n,l=r,a(n,r)}function O(e){e.touches.length===0?C=!1:e.touches.length===1&&(C=!0,x=e.touches[0].clientX,S=e.touches[0].clientY)}return e.addEventListener(`touchstart`,E,{passive:!0}),e.addEventListener(`touchmove`,D,{passive:!1}),e.addEventListener(`touchend`,O),{tick(){if(!(u||C)){if(Math.abs(c)<.1&&Math.abs(l)<.1){c=0,l=0;return}a(c,l),c*=m,l*=m}},getViewMatrix(){let e=o.scale(r,t),n=o.fromValues(0,0,0);return s.lookAt(e,n,i)},destroy(){e.removeEventListener(`mousedown`,_),window.removeEventListener(`mousemove`,v),window.removeEventListener(`mouseup`,y),e.removeEventListener(`wheel`,b),e.removeEventListener(`touchstart`,E),e.removeEventListener(`touchmove`,D),e.removeEventListener(`touchend`,O)}}}var y=`const PI: f32 = 3.1415926535;
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
`;async function b(e){r(!n(navigator.gpu),`WebGPU is not supported`);let t=await navigator.gpu.requestAdapter();r(!n(t),`WebGPU adapter not available`);let i=await t.requestDevice(),a=e.getContext(`webgpu`),o=navigator.gpu.getPreferredCanvasFormat();a.configure({device:i,format:o,alphaMode:`premultiplied`});let s=i.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),c=i.createShaderModule({code:y}),l=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});return{device:i,ctx:a,format:o,pipeline:i.createRenderPipeline({layout:i.createPipelineLayout({bindGroupLayouts:[l]}),vertex:{module:c,entryPoint:`vs`},fragment:{module:c,entryPoint:`fs`,targets:[{format:o}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:`depth24plus`},multisample:{count:4}}),bindGroup:i.createBindGroup({layout:l,entries:[{binding:0,resource:{buffer:s}}]}),uniformBuf:s}}function x(e,t,n,r){return e.createTexture({size:[t,n],format:`depth24plus`,sampleCount:r,usage:GPUTextureUsage.RENDER_ATTACHMENT})}function S(e,t,n,r,i){return e.createTexture({size:[t,n],format:r,sampleCount:i,usage:GPUTextureUsage.RENDER_ATTACHMENT})}function C(e){let t=!1,r=0,i=v(e),a;o().then(e=>{t?e():a=e});async function o(){let{device:a,ctx:o,format:c,pipeline:d,bindGroup:f,uniformBuf:p}=await b(e);if(t)return a.destroy(),()=>{};let m=x(a,e.width||1,e.height||1,4),v=null,y=null;function C(e,t){if(!(!n(v)&&v.width===e&&v.height===t)){if(v?.destroy(),e===0||t===0){v=null,y=null;return}v=S(a,e,t,c,4),y=v.createView()}}function w(){let t=Math.max(1,window.devicePixelRatio||1),n=Math.floor(e.clientWidth*t),r=Math.floor(e.clientHeight*t);(e.width!==n||e.height!==r)&&(e.width=n,e.height=r,m.destroy(),m=x(a,n,r,4),C(n,r))}w();let T=new ResizeObserver(w);T.observe(e);let E=performance.now();function D(){if(t)return;w(),i.tick();let c=(performance.now()-E)/_,v=i.getViewMatrix(),b=e.width/Math.max(1,e.height),x=s.perspective(h,b,g,100),S=s.multiply(x,v),T=new Float32Array(20);if(T[0]=c,T.set(new Float32Array(S),4),a.queue.writeBuffer(p,0,T),C(e.width,e.height),n(y)){r=requestAnimationFrame(D);return}let O=a.createCommandEncoder(),k=O.beginRenderPass({colorAttachments:[{view:y,resolveTarget:o.getCurrentTexture().createView(),loadOp:`clear`,clearValue:u,storeOp:`discard`}],depthStencilAttachment:{view:m.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});k.setPipeline(d),k.setBindGroup(0,f),k.draw(3,l,0,0),k.end(),a.queue.submit([O.finish()]),r=requestAnimationFrame(D)}return r=requestAnimationFrame(D),()=>{T.disconnect(),v?.destroy(),p.destroy(),m.destroy(),a.destroy()}}return()=>{t=!0,cancelAnimationFrame(r),i.destroy(),a?.()}}var w=e(),T=(0,c.memo)(()=>{let e=(0,c.useRef)(null);return(0,c.useEffect)(()=>{if(e.current)return C(e.current)},[]),(0,w.jsx)(`div`,{className:a.fixedContainer,children:(0,w.jsx)(`canvas`,{ref:e,style:{width:`100%`,height:`100%`}})})});export{T as Sun};