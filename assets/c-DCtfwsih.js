import{a as e,t}from"./c-HFhCPKiE.js";import{t as n}from"./c-CiQY6nnt.js";import{at as r}from"./e-BtwYBLlY.js";import{r as i,t as a}from"./c-CcVTHRoQ.js";import{t as o}from"./c-DdnA2I_z.js";import{t as s}from"./c-Ds5WEjZe.js";import{n as c,r as l,t as u}from"./c-BSjzdo9w.js";import{i as d,t as f}from"./c-Dr8IWdrq.js";import{t as p}from"./c-C0PiR4rC.js";import{n as m,t as h}from"./c-ChaKfK4V.js";var g=e(n(),1),_=.7,v=1e-4,y=16384,b=.5,x=.4,S=.01,C=.6;function w(e){return Math.trunc(e/20/4)*4+1}function T(e){return Math.trunc(e/20/4)*4+1}var E=`rgba8unorm`,D={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}};function ee(e,t){let n,i,a;function o(){n?.destroy(),i?.destroy(),n=void 0,i=void 0,a=void 0}return{ensure(s,c){if(!r(n)&&n.width===s&&n.height===c)return a;if(o(),s===0||c===0)return;n=e.createTexture({size:[s,c],format:t.format,sampleCount:t.sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT}),i=e.createTexture({size:[s,c],format:t.format,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});let l=i.createView();return a={msaaView:n.createView(),resolveView:l,compositeBindGroup:e.createBindGroup({layout:t.compositeBindGroupLayout,entries:[{binding:0,resource:l},{binding:1,resource:t.compositeSampler},{binding:2,resource:{buffer:t.compositeUniformBuffer}}]})},a},dispose:o}}var te=`struct CompositeUniforms {
    opacity: f32,
};

struct CompositeVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var offscreenTex: texture_2d<f32>;
@group(0) @binding(1) var offscreenSampler: sampler;
@group(0) @binding(2) var<uniform> CU: CompositeUniforms;

// Fullscreen triangle: 3 vertices covering the entire screen
@vertex
fn vsComposite(@builtin(vertex_index) vid: u32) -> CompositeVSOut {
    var out: CompositeVSOut;

    // Generates a large triangle that covers the viewport:
    // vid=0: (-1, -1), vid=1: (3, -1), vid=2: (-1, 3)
    let x = f32(vid & 1u) * 4.0 - 1.0;
    let y = f32((vid >> 1u) & 1u) * 4.0 - 1.0;

    out.position = vec4<f32>(x, y, 0.0, 1.0);
    // Map from clip space to UV: x: [-1,1] -> [0,1], y: [-1,1] -> [1,0] (flip Y)
    out.uv = vec2<f32>((x + 1.0) * 0.5, (1.0 - y) * 0.5);

    return out;
}

@fragment
fn fsComposite(in: CompositeVSOut) -> @location(0) vec4<f32> {
    let color = textureSample(offscreenTex, offscreenSampler, in.uv);
    // Apply layer opacity -- multiply alpha by the uniform opacity
    // Output premultiplied alpha for correct blending
    return vec4<f32>(color.rgb * CU.opacity, color.a * CU.opacity);
}
`,O=3,k=16;function A(e){let t=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]}),n=e.createSampler({magFilter:`linear`,minFilter:`linear`}),r=e.createBuffer({size:k,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});return e.queue.writeBuffer(r,0,new Float32Array([_,0,0,0])),{bindGroupLayout:t,sampler:n,uniformBuffer:r,dispose(){r.destroy()}}}var j=class{textureManager;pipeline;constructor(e,t,n){this.textureManager=t;let{device:r,format:i}=e,a=r.createShaderModule({code:te});this.pipeline=r.createRenderPipeline({layout:r.createPipelineLayout({bindGroupLayouts:[n.bindGroupLayout]}),vertex:{module:a,entryPoint:`vsComposite`},fragment:{module:a,entryPoint:`fsComposite`,targets:[{format:i,blend:D}]},primitive:{topology:`triangle-list`}})}update(){}render(e,t,n){let i=this.textureManager.ensure(n.canvasWidth,n.canvasHeight);if(r(i))return;let a=e.beginRenderPass({colorAttachments:[{view:t,loadOp:`load`,storeOp:`store`}]});a.setPipeline(this.pipeline),a.setBindGroup(0,i.compositeBindGroup),a.draw(O,1,0,0),a.end()}dispose(){}},M=class{msaaManager;device;format;pipeline;bindGroup;constructor(e,t,n,r){this.msaaManager=n,this.device=e.device,this.format=e.format;let i=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.pipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[i]}),vertex:{module:t,entryPoint:`vs`},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format,blend:D}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),this.bindGroup=this.device.createBindGroup({layout:i,entries:[{binding:0,resource:{buffer:r.buffer}}]})}update(){}render(e,t,n){let i=this.msaaManager.ensureView(this.device,this.format,n.canvasWidth,n.canvasHeight);if(r(i))return;let o=w(n.canvasWidth)+4,s=e.beginRenderPass({colorAttachments:[{view:i,resolveTarget:t,loadOp:`clear`,clearValue:a,storeOp:`discard`}]});s.setPipeline(this.pipeline),s.setBindGroup(0,this.bindGroup),s.draw(18,o,0,0),s.end()}dispose(){}},N=[`circle`,`square`,`rhombus`,`pentagon`,`hexagon`,`star`,`triangleUp`,`triangleDown`,`triangleLeft`,`triangleRight`],P=3,F=2*b+5/2;function I(e,t,n){return t+e()*(n-t)}function L(e,t){return t[Math.floor(e()*t.length)]}function R(e){let t=(e.r+e.g+e.b)/P;if(t>=.4)return e;let n=x/Math.max(t,S);return{r:Math.min(1,e.r*n),g:Math.min(1,e.g*n),b:Math.min(1,e.b*n)}}function z(e,t,n=Math.random){let r=I(n,20,80);return{x:I(n,-t.halfWidth+r,t.halfWidth-r),y:I(n,-t.halfHeight+r,t.halfHeight-r),halfSize:r,spawnTime:e,color:R({r:n(),g:n(),b:n()}),holdDuration:I(n,2,3),shapeType:L(n,N),fillMode:L(n,[`solid`,`outline`]),maxOpacity:I(n,C,1)}}function B(e){return 2*b+e.holdDuration}function V(e,t,n){let r=e/n*(t/n);return Math.min(Math.max(1,Math.round(r*v)),y)}function H(e,t,n,r=Math.random){return Array.from({length:e},(i,a)=>z(t-F/e*a,n,r))}function U(e,t,n,r,i=Math.random){return t<e.length?e.slice(0,t):[...e,...H(t-e.length,n,r,i)]}function ne(e,t,n,r=Math.random){return e.map(e=>t-e.spawnTime>B(e)?z(t,n,r):e)}var W=`struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    time: f32,
    sinCount: u32,
    sinPenMin: f32,
    sinPenMax: f32,
    borderMargin: f32,
    borderOffset: u32,
    sinYCount: u32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
`,G=`const HALF: f32 = 0.5;
override FADE_DURATION: f32;
const BORDER_THICKNESS: f32 = 0.08;

// Shape type constants
const SHAPE_CIRCLE: u32 = 0u;
const SHAPE_SQUARE: u32 = 1u;
const SHAPE_RHOMBUS: u32 = 2u;
const SHAPE_PENTAGON: u32 = 3u;
const SHAPE_HEXAGON: u32 = 4u;
const SHAPE_STAR: u32 = 5u;
const SHAPE_TRIANGLE_UP: u32 = 6u;
const SHAPE_TRIANGLE_DOWN: u32 = 7u;
const SHAPE_TRIANGLE_LEFT: u32 = 8u;
const SHAPE_TRIANGLE_RIGHT: u32 = 9u;

// Polygon vertex arrays — precomputed from JS helper functions
const SQUARE_VERTS: array<vec2<f32>, 4> = array<vec2<f32>, 4>(
  vec2<f32>(-0.500000, -0.500000),
  vec2<f32>(-0.500000, 0.500000),
  vec2<f32>(0.500000, 0.500000),
  vec2<f32>(0.500000, -0.500000),
);
const RHOMBUS_VERTS: array<vec2<f32>, 4> = array<vec2<f32>, 4>(
  vec2<f32>(0.300000, 0.000000),
  vec2<f32>(0.000000, 0.500000),
  vec2<f32>(-0.300000, 0.000000),
  vec2<f32>(-0.000000, -0.500000),
);
const PENTAGON_VERTS: array<vec2<f32>, 5> = array<vec2<f32>, 5>(
  vec2<f32>(0.000000, 0.500000),
  vec2<f32>(-0.475528, 0.154508),
  vec2<f32>(-0.293893, -0.404508),
  vec2<f32>(0.293893, -0.404508),
  vec2<f32>(0.475528, 0.154508),
);
const HEXAGON_VERTS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
  vec2<f32>(0.000000, 0.500000),
  vec2<f32>(-0.433013, 0.250000),
  vec2<f32>(-0.433013, -0.250000),
  vec2<f32>(-0.000000, -0.500000),
  vec2<f32>(0.433013, -0.250000),
  vec2<f32>(0.433013, 0.250000),
);
const STAR_VERTS: array<vec2<f32>, 10> = array<vec2<f32>, 10>(
  vec2<f32>(0.000000, 0.500000),
  vec2<f32>(-0.117557, 0.161803),
  vec2<f32>(-0.475528, 0.154508),
  vec2<f32>(-0.190211, -0.061803),
  vec2<f32>(-0.293893, -0.404508),
  vec2<f32>(-0.000000, -0.200000),
  vec2<f32>(0.293893, -0.404508),
  vec2<f32>(0.190211, -0.061803),
  vec2<f32>(0.475528, 0.154508),
  vec2<f32>(0.117557, 0.161803),
);
const TRIANGLE_UP_VERTS: array<vec2<f32>, 3> = array<vec2<f32>, 3>(
  vec2<f32>(0.000000, 0.500000),
  vec2<f32>(-0.433013, -0.250000),
  vec2<f32>(0.433013, -0.250000),
);
const TRIANGLE_DOWN_VERTS: array<vec2<f32>, 3> = array<vec2<f32>, 3>(
  vec2<f32>(-0.000000, -0.500000),
  vec2<f32>(0.433013, 0.250000),
  vec2<f32>(-0.433013, 0.250000),
);
const TRIANGLE_LEFT_VERTS: array<vec2<f32>, 3> = array<vec2<f32>, 3>(
  vec2<f32>(-0.500000, 0.000000),
  vec2<f32>(0.250000, -0.433013),
  vec2<f32>(0.250000, 0.433013),
);
const TRIANGLE_RIGHT_VERTS: array<vec2<f32>, 3> = array<vec2<f32>, 3>(
  vec2<f32>(0.500000, 0.000000),
  vec2<f32>(-0.250000, 0.433013),
  vec2<f32>(-0.250000, -0.433013),
);

// Vertex counts for each polygon type
const SQUARE_COUNT: u32 = 4u;
const RHOMBUS_COUNT: u32 = 4u;
const PENTAGON_COUNT: u32 = 5u;
const HEXAGON_COUNT: u32 = 6u;
const STAR_COUNT: u32 = 10u;
const TRIANGLE_COUNT: u32 = 3u;

struct ShapeData {
    posAndSize: vec4<f32>,  // x, y, halfSize, spawnTime
    colorAndHold: vec4<f32>,  // r, g, b, holdDuration
    typeAndFill: vec4<f32>,  // shapeType, fillMode, maxOpacity, 0
};

@group(0) @binding(1) var<storage, read> shapes: array<ShapeData>;

struct ShapesVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) @interpolate(flat) color: vec3<f32>,
    @location(2) @interpolate(flat) opacity: f32,
    @location(3) @interpolate(flat) shapeType: u32,
    @location(4) @interpolate(flat) fillMode: u32,
};

// Quad corners for 2 triangles (6 vertices)
const QUAD_POSITIONS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
);

fn computeOpacity(time: f32, spawnTime: f32, holdDuration: f32) -> f32 {
    let elapsed = time - spawnTime;
    let fadeInEnd = FADE_DURATION;
    let holdEnd = FADE_DURATION + holdDuration;
    let fadeOutEnd = holdEnd + FADE_DURATION;

    if (elapsed < 0.0) {
        return 0.0;
    }
    if (elapsed < fadeInEnd) {
        return elapsed / FADE_DURATION;
    }
    if (elapsed < holdEnd) {
        return 1.0;
    }
    if (elapsed < fadeOutEnd) {
        return 1.0 - (elapsed - holdEnd) / FADE_DURATION;
    }
    return 0.0;
}

@vertex
fn vsShapes(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> ShapesVSOut {
    var out: ShapesVSOut;

    let shape = shapes[iid];
    let pos = shape.posAndSize.xy;
    let halfSize = shape.posAndSize.z;
    let spawnTime = shape.posAndSize.w;
    let holdDuration = shape.colorAndHold.w;

    let quadPos = QUAD_POSITIONS[vid];
    out.uv = quadPos;  // UV in [-0.5, 0.5]

    let worldPos = pos + quadPos * halfSize * 2.0;
    out.position = U.mvp * vec4<f32>(worldPos, 0.0, 1.0);

    out.color = shape.colorAndHold.xyz;
    let maxOpacity = shape.typeAndFill.z;
    out.opacity = computeOpacity(U.time, spawnTime, holdDuration) * maxOpacity;
    out.shapeType = u32(shape.typeAndFill.x);
    out.fillMode = u32(shape.typeAndFill.y);

    return out;
}

// Get polygon vertex by index for a given shape type
fn getPolygonVertex(shapeType: u32, index: u32) -> vec2<f32> {
    switch (shapeType) {
        case 1u: { return SQUARE_VERTS[index]; }
        case 2u: { return RHOMBUS_VERTS[index]; }
        case 3u: { return PENTAGON_VERTS[index]; }
        case 4u: { return HEXAGON_VERTS[index]; }
        case 5u: { return STAR_VERTS[index]; }
        case 6u: { return TRIANGLE_UP_VERTS[index]; }
        case 7u: { return TRIANGLE_DOWN_VERTS[index]; }
        case 8u: { return TRIANGLE_LEFT_VERTS[index]; }
        case 9u: { return TRIANGLE_RIGHT_VERTS[index]; }
        default: { return vec2<f32>(0.0, 0.0); }
    }
}

fn getPolygonVertexCount(shapeType: u32) -> u32 {
    switch (shapeType) {
        case 1u: { return SQUARE_COUNT; }
        case 2u: { return RHOMBUS_COUNT; }
        case 3u: { return PENTAGON_COUNT; }
        case 4u: { return HEXAGON_COUNT; }
        case 5u: { return STAR_COUNT; }
        case 6u, 7u, 8u, 9u: { return TRIANGLE_COUNT; }
        default: { return 0u; }
    }
}

// Ray-casting point-in-polygon test
fn pointInPolygon(p: vec2<f32>, shapeType: u32) -> bool {
    let count = getPolygonVertexCount(shapeType);
    if (count == 0u) { return false; }

    var inside = false;
    var j = count - 1u;

    for (var i = 0u; i < count; i = i + 1u) {
        let vi = getPolygonVertex(shapeType, i);
        let vj = getPolygonVertex(shapeType, j);

        if (((vi.y > p.y) != (vj.y > p.y)) &&
            (p.x < (vj.x - vi.x) * (p.y - vi.y) / (vj.y - vi.y) + vi.x)) {
            inside = !inside;
        }
        j = i;
    }

    return inside;
}

// Distance from point to nearest polygon edge
fn distToPolygonEdge(p: vec2<f32>, shapeType: u32) -> f32 {
    let count = getPolygonVertexCount(shapeType);
    if (count == 0u) { return 1e10; }

    var minDist = 1e10;
    var j = count - 1u;

    for (var i = 0u; i < count; i = i + 1u) {
        let a = getPolygonVertex(shapeType, j);
        let b = getPolygonVertex(shapeType, i);
        let ab = b - a;
        let ap = p - a;
        let t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
        let closest = a + ab * t;
        let d = length(p - closest);
        minDist = min(minDist, d);
        j = i;
    }

    return minDist;
}

// Smoothstep anti-aliasing width in UV space based on halfSize
const AA_WIDTH: f32 = 0.01;

@fragment
fn fsShapes(in: ShapesVSOut) -> @location(0) vec4<f32> {
    if (in.opacity <= 0.0) {
        discard;
    }

    let uv = in.uv;
    var alpha: f32 = 0.0;

    if (in.shapeType == SHAPE_CIRCLE) {
        let dist = length(uv);
        if (in.fillMode == 0u) {
            // Solid circle
            alpha = 1.0 - smoothstep(HALF - AA_WIDTH, HALF, dist);
        } else {
            // Hollow circle
            let outerAlpha = 1.0 - smoothstep(HALF - AA_WIDTH, HALF, dist);
            let innerRadius = HALF - BORDER_THICKNESS;
            let innerAlpha = smoothstep(innerRadius - AA_WIDTH, innerRadius, dist);
            alpha = outerAlpha * innerAlpha;
        }
    } else {
        // Polygon shapes
        let inside = pointInPolygon(uv, in.shapeType);
        let edgeDist = distToPolygonEdge(uv, in.shapeType);

        if (in.fillMode == 0u) {
            // Solid polygon
            if (inside) {
                alpha = smoothstep(0.0, AA_WIDTH, edgeDist);
            } else {
                alpha = 0.0;
            }
        } else {
            // Hollow polygon
            if (inside) {
                let outerAlpha = smoothstep(0.0, AA_WIDTH, edgeDist);
                let innerAlpha = 1.0 - smoothstep(BORDER_THICKNESS - AA_WIDTH, BORDER_THICKNESS, edgeDist);
                alpha = outerAlpha * innerAlpha;
            } else {
                alpha = 0.0;
            }
        }
    }

    if (alpha <= 0.0) {
        discard;
    }

    let finalAlpha = alpha * in.opacity;
    // Premultiplied alpha output
    return vec4<f32>(in.color * finalAlpha, finalAlpha);
}
`,K=48/Float32Array.BYTES_PER_ELEMENT,q=4,J=8,Y={solid:0,outline:1};function X(e){return new Float32Array(e*K)}function Z(e,t){return t.forEach((t,n)=>{let r=n*K;e[r]=t.x,e[r+1]=t.y,e[r+2]=t.halfSize,e[r+3]=t.spawnTime,e[r+q]=t.color.r,e[r+q+1]=t.color.g,e[r+q+2]=t.color.b,e[r+q+3]=t.holdDuration,e[r+J]=N.indexOf(t.shapeType),e[r+J+1]=Y[t.fillMode],e[r+J+2]=t.maxOpacity,e[r+J+3]=0}),t.length*48}var re=W+G,ie={color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},ae=class{device;pipeline;bindGroup;storageBuffer;shapeData=X(y);shapes=[];constructor(e,t){this.device=e.device;let n=this.device.createShaderModule({code:re}),r=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`read-only-storage`}}]});this.storageBuffer=this.device.createBuffer({size:y*48,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.pipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[r]}),vertex:{module:n,entryPoint:`vsShapes`,constants:{FADE_DURATION:b}},fragment:{module:n,entryPoint:`fsShapes`,targets:[{format:e.format,blend:ie}]},primitive:{topology:`triangle-list`}}),this.bindGroup=this.device.createBindGroup({layout:r,entries:[{binding:0,resource:{buffer:t.buffer}},{binding:1,resource:{buffer:this.storageBuffer}}]})}update(e){let{time:t,canvasWidth:n,canvasHeight:r,devicePixelRatio:i}=e,a={halfWidth:n/2,halfHeight:r/2},o=V(n,r,i),s=this.shapes.length===0?H(o,t,a):U(this.shapes,o,t,a);this.shapes=ne(s,t,a);let c=Z(this.shapeData,this.shapes);this.device.queue.writeBuffer(this.storageBuffer,0,this.shapeData.buffer,0,c)}render(e,t){if(this.shapes.length===0)return;let n=e.beginRenderPass({colorAttachments:[{view:t,loadOp:`load`,storeOp:`store`}]});n.setPipeline(this.pipeline),n.setBindGroup(0,this.bindGroup),n.draw(6,this.shapes.length,0,0),n.end()}dispose(){this.storageBuffer.destroy()}},oe=class{textureManager;pipeline;bindGroup;constructor(e,t,n,r){this.textureManager=t;let{device:i}=e,a=i.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.pipeline=i.createRenderPipeline({layout:i.createPipelineLayout({bindGroupLayouts:[a]}),vertex:{module:n,entryPoint:`vsSinY`},fragment:{module:n,entryPoint:`fsSinY`,targets:[{format:E,blend:D}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),this.bindGroup=i.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:r.buffer}}]})}update(){}render(e,t,n){let i=this.textureManager.ensure(n.canvasWidth,n.canvasHeight);if(r(i))return;let a=e.beginRenderPass({colorAttachments:[{view:i.msaaView,resolveTarget:i.resolveView,loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});a.setPipeline(this.pipeline),a.setBindGroup(0,this.bindGroup),a.draw(18,T(n.canvasHeight),0,0),a.end()}dispose(){}},se=`const PI: f32 = 3.14159265358979323846;
const HALF: f32 = 0.5;
const BORDER_POINT_COUNT: u32 = 5u;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) joinCenter: vec2<f32>,
    @location(2) joinWidth: f32,
};

// 6 vertices for a join quad (2 triangles)
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

// Border data
const BORDER_POSITIONS: array<vec2<f32>, 5> = array<vec2<f32>, 5>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
);

const BORDER_WIDTHS: array<f32, 5> = array<f32, 5>(4.0, 16.0, 4.0, 16.0, 4.0);

const BORDER_COLORS: array<vec4<f32>, 5> = array<vec4<f32>, 5>(
    vec4<f32>(0.0, 0.5, 1.0, 1.0),
    vec4<f32>(0.5, 1.0, 0.0, 1.0),
    vec4<f32>(1.0, 0.5, 0.0, 1.0),
    vec4<f32>(1.0, 0.0, 0.5, 1.0),
    vec4<f32>(0.0, 0.5, 1.0, 1.0),
);

fn getSinUVPoint(index: f32, count: f32) -> vec2<f32> {
    let x = (index / count - HALF) * 2.0;
    let y = sin(x * HALF * PI + U.time);
    let indexU32 = u32(index);
    let sign = select(-1.0, 1.0, (indexU32 + 1u) % 4u > 1u);
    return vec2<f32>(x, y * sign);
}

fn getSinWidth(index: f32, count: f32) -> f32 {
    return U.sinPenMin + (index / count) * U.sinPenMax;
}

fn getSinColor(uv: vec2<f32>) -> vec4<f32> {
    return vec4<f32>(HALF, (uv.x + 1.0) / 2.0, (uv.y + 1.0) / 2.0, 1.0);
}

// Sin-Y: perpendicular sine wave along the Y axis
fn getSinYUVPoint(index: f32, count: f32) -> vec2<f32> {
    let y = (index / count - HALF) * 2.0;
    let x = sin(y * HALF * PI + U.time);
    let indexU32 = u32(index);
    let sign = select(-1.0, 1.0, (indexU32 + 1u) % 4u > 1u);
    return vec2<f32>(x * sign, y);
}

fn getSinYColor(uv: vec2<f32>) -> vec4<f32> {
    return vec4<f32>((uv.y + 1.0) / 2.0, HALF, (uv.x + 1.0) / 2.0, 1.0);
}

struct SegmentData {
    pointA: vec2<f32>,
    pointB: vec2<f32>,
    widthA: f32,
    widthB: f32,
    colorA: vec4<f32>,
    colorB: vec4<f32>,
};

fn getSegmentData(instanceId: u32) -> SegmentData {
    var seg: SegmentData;

    if (instanceId < U.sinCount) {
        // Sine wave segment
        let count = f32(U.sinCount);
        let indexA = f32(instanceId);
        let indexB = f32(instanceId + 1u);

        let uvA = getSinUVPoint(indexA, count);
        let uvB = getSinUVPoint(indexB, count);

        let sizeX = U.viewport.x - 4.0 * U.sinPenMax;
        let sizeY = U.viewport.y - 4.0 * U.sinPenMax;

        seg.pointA = vec2<f32>(uvA.x * sizeX * HALF, uvA.y * sizeY * HALF);
        seg.pointB = vec2<f32>(uvB.x * sizeX * HALF, uvB.y * sizeY * HALF);
        seg.widthA = getSinWidth(indexA, count);
        seg.widthB = getSinWidth(indexB, count);
        seg.colorA = getSinColor(uvA);
        seg.colorB = getSinColor(uvB);
    } else {
        // Border segment
        let borderIdx = instanceId - U.borderOffset;

        let posA = BORDER_POSITIONS[borderIdx];
        let posB = BORDER_POSITIONS[borderIdx + 1u];

        let sizeX = U.viewport.x - U.borderMargin;
        let sizeY = U.viewport.y - U.borderMargin;

        seg.pointA = posA * vec2<f32>(sizeX * HALF, sizeY * HALF);
        seg.pointB = posB * vec2<f32>(sizeX * HALF, sizeY * HALF);
        seg.widthA = BORDER_WIDTHS[borderIdx];
        seg.widthB = BORDER_WIDTHS[borderIdx + 1u];
        seg.colorA = BORDER_COLORS[borderIdx];
        seg.colorB = BORDER_COLORS[borderIdx + 1u];
    }

    return seg;
}

fn getSinYSegmentData(instanceId: u32) -> SegmentData {
    var seg: SegmentData;

    let count = f32(U.sinYCount);
    let indexA = f32(instanceId);
    let indexB = f32(instanceId + 1u);

    let uvA = getSinYUVPoint(indexA, count);
    let uvB = getSinYUVPoint(indexB, count);

    let sizeX = U.viewport.x - 4.0 * U.sinPenMax;
    let sizeY = U.viewport.y - 4.0 * U.sinPenMax;

    seg.pointA = vec2<f32>(uvA.x * sizeX * HALF, uvA.y * sizeY * HALF);
    seg.pointB = vec2<f32>(uvB.x * sizeX * HALF, uvB.y * sizeY * HALF);
    seg.widthA = getSinWidth(indexA, count);
    seg.widthB = getSinWidth(indexB, count);
    seg.colorA = getSinYColor(uvA);
    seg.colorB = getSinYColor(uvB);

    return seg;
}

fn safeNormalize(v: vec2<f32>) -> vec2<f32> {
    let len2 = dot(v, v);
    if (len2 > 1e-20) {
        return v * inverseSqrt(len2);
    }
    return vec2<f32>(0.0, 1.0);
}

fn buildVertex(seg: SegmentData, vid: u32) -> VSOut {
    var out: VSOut;

    let JOIN_A_END: u32 = 6u;
    let JOIN_B_END: u32 = 12u;

    if (vid < JOIN_A_END) {
        // Join A (circle at pointA)
        let basis = JOIN_BASIS[vid];
        out.joinCenter = basis;
        out.joinWidth = seg.widthA;
        out.color = seg.colorA;

        let offset = basis * seg.widthA;
        out.position = U.mvp * vec4<f32>(seg.pointA + offset, 0.0, 1.0);
    } else if (vid < JOIN_B_END) {
        // Join B (circle at pointB)
        let localVid = vid - JOIN_A_END;
        let basis = JOIN_BASIS[localVid];
        out.joinCenter = basis;
        out.joinWidth = seg.widthB;
        out.color = seg.colorB;

        let offset = basis * seg.widthB;
        out.position = U.mvp * vec4<f32>(seg.pointB + offset, 0.0, 1.0);
    } else {
        // Line body rectangle
        let localVid = vid - JOIN_B_END;
        let basis = RECT_BASIS[localVid];

        out.joinCenter = vec2<f32>(0.0, 0.0);
        out.joinWidth = 0.0;

        // Direction along the segment
        let dir = seg.pointB - seg.pointA;
        let normal = safeNormalize(vec2<f32>(-dir.y, dir.x));

        // Width at this vertex depends on t (basis.x)
        let w = mix(seg.widthA, seg.widthB, basis.x);

        // Base position along the segment
        let basePos = mix(seg.pointA, seg.pointB, basis.x);
        let vertexPos = basePos + normal * (basis.y * w);

        out.color = mix(seg.colorA, seg.colorB, basis.x);
        out.position = U.mvp * vec4<f32>(vertexPos, 0.0, 1.0);
    }

    return out;
}

@vertex
fn vs(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    let seg = getSegmentData(iid);
    return buildVertex(seg, vid);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    if (in.joinWidth > 0.0 && dot(in.joinCenter, in.joinCenter) > 0.25) {
        discard;
    }
    return in.color;
}

// Sin-Y vertex shader -- uses sinYCount instances
@vertex
fn vsSinY(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    let seg = getSinYSegmentData(iid);
    return buildVertex(seg, vid);
}

// Sin-Y fragment shader -- renders opaque (alpha=1) into offscreen
@fragment
fn fsSinY(in: VSOut) -> @location(0) vec4<f32> {
    if (in.joinWidth > 0.0 && dot(in.joinCenter, in.joinCenter) > 0.25) {
        discard;
    }
    return in.color;
}
`;function Q(e,t){let n=h(t),r=m(n.uniforms.U),i=e.createBuffer({size:r.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});return{buffer:i,writeFromFrameState(t){let n=t.canvasWidth/2,a=t.canvasHeight/2,o=w(t.canvasWidth);r.set({mvp:f.ortho(-n,n,-a,a,-1,1),viewport:[t.canvasWidth,t.canvasHeight],time:t.time,sinCount:o,sinPenMin:2,sinPenMax:20,borderMargin:20,borderOffset:o,sinYCount:T(t.canvasHeight)}),e.queue.writeBuffer(i,0,r.arrayBuffer)},dispose(){i.destroy()}}}var ce=W+se;function le(e){return d({init:()=>ue(e),initErrorMessage:`Failed to initialize charts renderer`})}async function ue(e){let t=await l(e),{device:n}=t,r=n.createShaderModule({code:ce}),i=Q(n,W),a=o(4),s=A(n),d=ee(n,{format:E,sampleCount:4,compositeBindGroupLayout:s.bindGroupLayout,compositeSampler:s.sampler,compositeUniformBuffer:s.uniformBuffer}),f=new c([p(i.writeFromFrameState),new M(t,r,a,i),new oe(t,d,r,i),new j(t,d,s),new ae(t,i)]),m=u({canvas:e,context:t,layerManager:f});return{cleanup:()=>{m(),f.dispose(),d.dispose(),s.dispose(),i.dispose(),a.dispose(),n.destroy()}}}var $=t(),de=(0,g.memo)(()=>{let e=s(le);return(0,$.jsx)(i,{className:`h-full w-full`,children:(0,$.jsx)(`canvas`,{ref:e,className:`h-full w-full`})})});export{de as Charts};