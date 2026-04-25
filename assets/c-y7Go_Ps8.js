import{n as e,o as t,t as n}from"./c-AyPMouqq.js";import{C as r}from"./e--7L6UAn3.js";import{n as i,t as a}from"./c-Dr3I7Csy2.js";import{a as o}from"./c-Cvd663k42.js";import{a as s,i as c,t as l}from"./c-BZYyOCUH.js";import{n as u,t as d}from"./c-CLAONXbA.js";var f=t(e(),1),p={r:.02745,g:.03529,b:.04706,a:1},m=.5,h=.7,g=1e-4,_=16384,v=.5,y=.4,b=.6,x=`rgba8unorm`;function S(e){return Math.trunc(e/20/4)*4+1}function C(e){return Math.trunc(e/20/4)*4+1}var w={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}};function T(e,t,n){let i=null,a=null,o=null,s=null,c=null;return{ensureOffscreenTextures(l,u,d,f,p){return!r(i)&&i.width===l&&i.height===u?r(a)||r(s)||r(c)?null:{offscreenMsaaView:a,offscreenResolveView:s,compositeBindGroup:c}:(i?.destroy(),o?.destroy(),l===0||u===0?(i=null,a=null,o=null,s=null,c=null,null):(i=e.createTexture({size:[l,u],format:t,sampleCount:n,usage:GPUTextureUsage.RENDER_ATTACHMENT}),a=i.createView(),o=e.createTexture({size:[l,u],format:t,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),s=o.createView(),c=e.createBindGroup({layout:d,entries:[{binding:0,resource:s},{binding:1,resource:f},{binding:2,resource:{buffer:p}}]}),{offscreenMsaaView:a,offscreenResolveView:s,compositeBindGroup:c}))},destroy(){i?.destroy(),o?.destroy()}}}var E=`struct CompositeUniforms {
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
`,D=3,O=16;function k(e){let t=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]}),n=e.createSampler({magFilter:`linear`,minFilter:`linear`}),r=e.createBuffer({size:O,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),i=new Float32Array([h,0,0,0]);return e.queue.writeBuffer(r,0,i),{compositeBindGroupLayout:t,compositeSampler:n,compositeUniformBuffer:r}}var A=class{compositePipeline;constructor(e,t){this.textureManager=e,this.resources=t}init(e){let{device:t,format:n}=e,r=t.createShaderModule({code:E});this.compositePipeline=t.createRenderPipeline({layout:t.createPipelineLayout({bindGroupLayouts:[this.resources.compositeBindGroupLayout]}),vertex:{module:r,entryPoint:`vsComposite`},fragment:{module:r,entryPoint:`fsComposite`,targets:[{format:n,blend:w}]},primitive:{topology:`triangle-list`}})}update(e){}render(e,t,n){let i=this.textureManager.ensureOffscreenTextures(n.canvasWidth,n.canvasHeight,this.resources.compositeBindGroupLayout,this.resources.compositeSampler,this.resources.compositeUniformBuffer);if(r(i))return;let a=e.beginRenderPass({colorAttachments:[{view:t,loadOp:`load`,storeOp:`store`}]});a.setPipeline(this.compositePipeline),a.setBindGroup(0,i.compositeBindGroup),a.draw(D,1,0,0),a.end()}dispose(){this.resources.compositeUniformBuffer.destroy()}},j=`struct Uniforms {
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
`;function M(e,t){let n=u(d(t).uniforms.U),r=e.createBuffer({size:n.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});return{buffer:r,writeFromFrameState(e,t){let i=t.canvasWidth*m,a=t.canvasHeight*m,o=l.ortho(-i,i,-a,a,-1,1),s=S(t.canvasWidth),c=C(t.canvasHeight);n.set({mvp:o,viewport:[t.canvasWidth,t.canvasHeight],time:t.time,sinCount:s,sinPenMin:2,sinPenMax:20,borderMargin:20,borderOffset:s,sinYCount:c}),e.queue.writeBuffer(r,0,n.arrayBuffer)},dispose(){r.destroy()}}}var N=class{device;format;uniformManager;pipeline;bindGroup;constructor(e,t){this.chartShaderModule=e,this.msaaManager=t}init(e){this.device=e.device,this.format=e.format,this.uniformManager=M(this.device,j);let t=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.pipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[t]}),vertex:{module:this.chartShaderModule,entryPoint:`vs`},fragment:{module:this.chartShaderModule,entryPoint:`fs`,targets:[{format:this.format,blend:w}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),this.bindGroup=this.device.createBindGroup({layout:t,entries:[{binding:0,resource:{buffer:this.uniformManager.buffer}}]})}update(e){this.uniformManager.writeFromFrameState(this.device,e)}render(e,t,n){let i=S(n.canvasWidth)+4,a=this.msaaManager.ensureView(this.device,this.format,n.canvasWidth,n.canvasHeight);if(r(a))return;let o=e.beginRenderPass({colorAttachments:[{view:a,resolveTarget:t,loadOp:`clear`,clearValue:p,storeOp:`discard`}]});o.setPipeline(this.pipeline),o.setBindGroup(0,this.bindGroup),i>0&&o.draw(18,i,0,0),o.end()}dispose(){this.uniformManager.dispose()}};function P(e,t){return e+Math.random()*(t-e)}function F(e){let t=Math.random(),n=Math.random(),r=Math.random(),i=(t+n+r)/3;if(i<.4){let e=y/Math.max(i,.01);t=Math.min(1,t*e),n=Math.min(1,n*e),r=Math.min(1,r*e)}return{x:0,y:0,halfSize:P(40/2,160/2),spawnTime:e,r:t,g:n,b:r,holdDuration:P(2,3),shapeType:Math.floor(Math.random()*10),fillMode:Math.random()<.5?0:1,maxOpacity:P(b,1)}}function I(e){return 2*v+e.holdDuration}function L(e,t,n){t[n]=e.x,t[n+1]=e.y,t[n+2]=e.halfSize,t[n+3]=e.spawnTime,t[n+4]=e.r,t[n+4+1]=e.g,t[n+4+2]=e.b,t[n+4+3]=e.holdDuration,t[n+8]=e.shapeType,t[n+8+1]=e.fillMode,t[n+8+2]=e.maxOpacity,t[n+8+3]=0}function R(e,t,n){let r=e/n*(t/n);return Math.min(Math.max(1,Math.round(r*g)),_)}function z(e){let t=[],n=2*v+5/2;for(let r=0;r<e;r++){let i=F(0);i.spawnTime=-(n/e)*r,t.push(i)}return t}function B(e,t,n,r,i){if(t>e.length){let a=2*v+5/2,o=t-e.length;for(let t=0;t<o;t++){let s=F(n);s.spawnTime=n-a/o*t,s.x=P(-r+s.halfSize,r-s.halfSize),s.y=P(-i+s.halfSize,i-s.halfSize),e.push(s)}}else t<e.length&&e.splice(t)}function V(e){return new Float32Array(e*48/Float32Array.BYTES_PER_ELEMENT)}var H=j+`const HALF: f32 = 0.5;
// Keep in sync with SHAPE_FADE_DURATION in chart-draw.ts
const FADE_DURATION: f32 = 0.5;
const BORDER_THICKNESS: f32 = 0.08;
const SHAPE_TYPE_COUNT: u32 = 10u;

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
`,U=48/Float32Array.BYTES_PER_ELEMENT,W=class{device;uniformManager;shapesPipeline;shapesBindGroup;shapesStorageBuffer;shapeDataBuffer=V(_);shapes=[];init(e){this.device=e.device,this.uniformManager=M(this.device,H);let t=this.device.createShaderModule({code:H}),n=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`read-only-storage`}}]});this.shapesStorageBuffer=this.device.createBuffer({size:_*48,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.shapesPipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[n]}),vertex:{module:t,entryPoint:`vsShapes`},fragment:{module:t,entryPoint:`fsShapes`,targets:[{format:e.format,blend:{color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`}}),this.shapesBindGroup=this.device.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:this.uniformManager.buffer}},{binding:1,resource:{buffer:this.shapesStorageBuffer}}]})}update(e){this.uniformManager.writeFromFrameState(this.device,e);let{time:t,canvasWidth:n,canvasHeight:r,devicePixelRatio:i}=e,a=n*m,o=r*m;this.shapes.length===0&&(this.shapes=z(R(n,r,i)));let s=R(n,r,i);s!==this.shapes.length&&B(this.shapes,s,t,a,o);for(let e=0;e<this.shapes.length;e++){let n=this.shapes[e];if(t-n.spawnTime>I(n)){let n=F(t);n.x=P(-a+n.halfSize,a-n.halfSize),n.y=P(-o+n.halfSize,o-n.halfSize),this.shapes[e]=n}L(this.shapes[e],this.shapeDataBuffer,e*U)}this.device.queue.writeBuffer(this.shapesStorageBuffer,0,this.shapeDataBuffer.buffer,0,this.shapes.length*48)}render(e,t,n){if(this.shapes.length===0)return;let r=e.beginRenderPass({colorAttachments:[{view:t,loadOp:`load`,storeOp:`store`}]});r.setPipeline(this.shapesPipeline),r.setBindGroup(0,this.shapesBindGroup),r.draw(6,this.shapes.length,0,0),r.end()}dispose(){this.uniformManager.dispose(),this.shapesStorageBuffer.destroy()}},G=class{device;uniformManager;sinYPipeline;bindGroup;constructor(e,t,n,r,i){this.textureManager=e,this.compositeBindGroupLayout=t,this.compositeSampler=n,this.compositeUniformBuffer=r,this.chartShaderModule=i}init(e){this.device=e.device,this.uniformManager=M(this.device,j);let t=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.sinYPipeline=this.device.createRenderPipeline({layout:this.device.createPipelineLayout({bindGroupLayouts:[t]}),vertex:{module:this.chartShaderModule,entryPoint:`vsSinY`},fragment:{module:this.chartShaderModule,entryPoint:`fsSinY`,targets:[{format:x,blend:w}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),this.bindGroup=this.device.createBindGroup({layout:t,entries:[{binding:0,resource:{buffer:this.uniformManager.buffer}}]})}update(e){this.uniformManager.writeFromFrameState(this.device,e)}render(e,t,n){let i=C(n.canvasHeight),a=this.textureManager.ensureOffscreenTextures(n.canvasWidth,n.canvasHeight,this.compositeBindGroupLayout,this.compositeSampler,this.compositeUniformBuffer);if(r(a))return;let o=e.beginRenderPass({colorAttachments:[{view:a.offscreenMsaaView,resolveTarget:a.offscreenResolveView,loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});o.setPipeline(this.sinYPipeline),o.setBindGroup(0,this.bindGroup),i>0&&o.draw(18,i,0,0),o.end()}dispose(){this.uniformManager.dispose()}};function K(e){let{canvas:t,context:n,layerManager:r}=e,{device:i,canvasContext:a}=n,s=0,c=0,l=Math.max(1,window.devicePixelRatio);function u(){l=Math.max(1,window.devicePixelRatio);let e=Math.floor(t.clientWidth*l),n=Math.floor(t.clientHeight*l);(t.width!==e||t.height!==n)&&(t.width=e,t.height=n),s=e,c=n}u();let d=new ResizeObserver(()=>{u()});d.observe(t);let f=0,p=!1,m=performance.now();function h(){if(p)return;if(u(),s===0||c===0){f=requestAnimationFrame(h);return}let e={time:(performance.now()-m)/o,canvasWidth:s,canvasHeight:c,devicePixelRatio:l};r.updateAll(e);let t=a.getCurrentTexture().createView(),n=i.createCommandEncoder();r.renderAll(n,t,e),i.queue.submit([n.finish()]),f=requestAnimationFrame(h)}return f=requestAnimationFrame(h),()=>{p=!0,cancelAnimationFrame(f),d.disconnect()}}var q=j+`const PI: f32 = 3.14159265358979323846;
const HALF: f32 = 0.5;
const BORDER_POINT_COUNT: u32 = 5u;
// Keep in sync with BORDER_SEGMENT_COUNT in chart-draw.ts
const BORDER_SEGMENT_COUNT: u32 = 4u;

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
`;function J(e){let t=!1,n;return Y(e).then(e=>{t?e():n=e}),()=>{t=!0,n?.()}}async function Y(e){let t=await s(e),{device:n}=t,r=n.createShaderModule({code:q}),i=T(n,x,4),o=a(4),l=k(n),u=new c([new N(r,o),new G(i,l.compositeBindGroupLayout,l.compositeSampler,l.compositeUniformBuffer,r),new A(i,l),new W]);u.initAll(t);let d=K({canvas:e,context:t,layerManager:u});return()=>{d(),u.dispose(),o.dispose(),i.destroy(),n.destroy()}}var X=n(),Z=(0,f.memo)(()=>{let e=(0,f.useRef)(null);return(0,f.useEffect)(()=>{if(e.current)return J(e.current)},[]),(0,X.jsx)(i,{className:`h-full w-full`,children:(0,X.jsx)(`canvas`,{ref:e,className:`h-full w-full`})})});export{Z as Charts};