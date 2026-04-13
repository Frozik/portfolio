import{r as e}from"./c-BlVx34DW.js";import{F as t,I as n,M as r,P as i,t as a}from"./c-CE-6D_Ho.js";import{_ as o,d as s,g as c,h as l,m as u,p as d,v as f}from"./c-C5H0VhIF.js";import{i as p,n as m,r as h,t as g}from"./c-DP0tl3jn.js";import{t as _}from"./c-C8dC3tvw.js";import{a as v,i as y,n as b,r as x,t as S}from"./c-C3PoB8Fr.js";import{n as ee,t as te}from"./c-Dhbp9WuA.js";import{t as C}from"./c-79FAfWPB.js";var w=p(`move`,[[`path`,{d:`M12 2v20`,key:`t6zp3m`}],[`path`,{d:`m15 19-3 3-3-3`,key:`11eu04`}],[`path`,{d:`m19 9 3 3-3 3`,key:`1mg7y2`}],[`path`,{d:`M2 12h20`,key:`9i4pu4`}],[`path`,{d:`m5 9-3 3 3 3`,key:`j64kie`}],[`path`,{d:`m9 5 3-3 3 3`,key:`l8vdw6`}]]),T=p(`redo-2`,[[`path`,{d:`m15 14 5-5-5-5`,key:`12vg1m`}],[`path`,{d:`M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13`,key:`6uklza`}]]),E=p(`rotate-ccw`,[[`path`,{d:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`1357e3`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}]]),D=e(t(),1),ne=`/**
 * Minimal depth-only shader for rendering solid faces into the depth buffer.
 * Color output is discarded via writeMask: 0 on the pipeline's color target.
 * Used to establish occlusion so hidden edges can be drawn with reduced brightness.
 */

struct Uniforms {
    mvp: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
    return uniforms.mvp * vec4<f32>(position, 1.0);
}

@fragment
fn fs() -> @location(0) vec4<f32> {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}
`,re=`struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    lineWidth: f32,
    highlightLineWidth: f32,
    highlightColor: vec3<f32>,
    vertexMarkerSize: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct EdgeInstance {
    @location(0) startPos: vec3<f32>,
    @location(1) endPos: vec3<f32>,
    @location(2) highlighted: u32,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) @interpolate(flat) isHighlighted: u32,
    @location(1) lineDistance: f32,
};

const EDGE_COLOR: vec3<f32> = vec3<f32>(1.0, 1.0, 1.0);

/** Minimum w value for near-plane clipping (prevents behind-camera artifacts) */
const NEAR_CLIP_W: f32 = 0.01;

/** Pipeline-overridable: line width for normal edges (differs between visible/hidden passes) */
@id(0) override normalLineWidth: f32 = 3.0;
/** Pipeline-overridable: line width for highlighted edges (differs between visible/hidden passes) */
@id(1) override highlightedLineWidth: f32 = 5.0;
/** Pipeline-overridable: brightness multiplier (1.0 for visible, reduced for hidden) */
@id(2) override edgeBrightness: f32 = 1.0;
/** Pipeline-overridable: dash length in screen pixels (0 = solid line) */
@id(3) override dashLength: f32 = 0.0;
/** Pipeline-overridable: gap length in screen pixels (0 = solid line) */
@id(4) override gapLength: f32 = 0.0;

/**
 * Clamps a clip-space point to the near plane by interpolating towards
 * the other endpoint. Prevents artifacts when endpoints are behind the camera.
 */
fn clampToNearPlane(point: vec4<f32>, other: vec4<f32>) -> vec4<f32> {
    if (point.w >= NEAR_CLIP_W) {
        return point;
    }
    let parametricT = (NEAR_CLIP_W - point.w) / (other.w - point.w);
    return mix(point, other, parametricT);
}

/**
 * Each edge instance is drawn as a screen-space quad (2 triangles, 6 vertices).
 * The vertex shader expands each edge into a rectangle perpendicular to
 * the line direction in screen space. Width comes from pipeline overrides
 * so visible and hidden passes can use different thicknesses.
 *
 * Endpoints are clamped to the near plane so lines can extend arbitrarily
 * far without producing thickness artifacts when behind the camera.
 *
 * Quad corners:
 *   0 = start-left,  1 = start-right
 *   2 = end-left,    3 = end-right
 *
 * Two triangles: (0,2,1) and (1,2,3)
 */
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    edge: EdgeInstance
) -> VertexOutput {
    // Map vertex_index (0..5) to quad corner index (0..3)
    let cornerMap = array<u32, 6>(0u, 2u, 1u, 1u, 2u, 3u);
    let corner = cornerMap[vertexIndex];

    // Decode corner: bit 1 = end vs start, bit 0 = right vs left
    let isEnd = (corner & 2u) != 0u;
    let side = f32(i32(corner & 1u)) * 2.0 - 1.0;

    // Project both endpoints to clip space
    let rawClipA = uniforms.mvp * vec4<f32>(edge.startPos, 1.0);
    let rawClipB = uniforms.mvp * vec4<f32>(edge.endPos, 1.0);

    // Clamp endpoints to near plane to prevent behind-camera artifacts
    let clipA = clampToNearPlane(rawClipA, rawClipB);
    let clipB = clampToNearPlane(rawClipB, rawClipA);

    // Select the clip position for this vertex's endpoint
    let clipPos = select(clipA, clipB, isEnd);

    // Convert to screen-space pixels for perpendicular direction computation
    let halfViewport = uniforms.viewport * 0.5;
    let screenA = (clipA.xy / clipA.w) * halfViewport;
    let screenB = (clipB.xy / clipB.w) * halfViewport;

    // Perpendicular direction in screen space
    let screenDir = screenB - screenA;
    let screenLen = length(screenDir);

    // Guard against degenerate edges (zero length)
    let safeDir = select(
        screenDir / screenLen,
        vec2<f32>(1.0, 0.0),
        screenLen < 0.001
    );
    let perp = vec2<f32>(-safeDir.y, safeDir.x);

    // Select line width based on highlight state (overrides differ per pipeline)
    let currentLineWidth = select(normalLineWidth, highlightedLineWidth, edge.highlighted != 0u);

    // Offset in pixels, then convert back to NDC
    let offsetPixels = perp * side * currentLineWidth * 0.5;
    let offsetNdc = offsetPixels / halfViewport;

    // Compute screen-space distance along the line for dash pattern
    let distance = select(0.0, screenLen, isEnd);

    var result: VertexOutput;
    result.clipPosition = vec4<f32>(
        clipPos.xy + offsetNdc * clipPos.w,
        clipPos.z,
        clipPos.w
    );
    result.isHighlighted = edge.highlighted;
    result.lineDistance = distance;
    return result;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    // Dash pattern: discard fragments in gap portions
    let patternLength = dashLength + gapLength;
    if (patternLength > 0.0) {
        let posInPattern = input.lineDistance % patternLength;
        if (posInPattern >= dashLength) {
            discard;
        }
    }

    let baseColor = select(EDGE_COLOR, uniforms.highlightColor, input.isHighlighted != 0u);
    return vec4<f32>(baseColor * edgeBrightness, 1.0);
}
`,ie=`struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    lineWidth: f32,
    highlightLineWidth: f32,
    highlightColor: vec3<f32>,
    vertexMarkerSize: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

/** Pipeline-overridable: 1.0 = use highlight color, 0.0 = use white */
@id(0) override useHighlightColor: f32 = 1.0;
/** Pipeline-overridable: marker diameter override (0 = use uniform value) */
@id(1) override markerSizeOverride: f32 = 0.0;

const DEFAULT_MARKER_COLOR: vec3<f32> = vec3<f32>(1.0, 1.0, 1.0);

struct MarkerInstance {
    @location(0) position: vec3<f32>,
    @location(1) instanceBrightness: f32,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) quadUV: vec2<f32>,
    @location(1) @interpolate(flat) brightness: f32,
};

/**
 * Expands a single vertex position into a screen-space billboard quad.
 * Uses the same 6-vertex (2-triangle) pattern as edges.
 * The quad is centered on the projected vertex and sized by vertexMarkerSize.
 * Brightness is per-instance (computed via CPU occlusion test).
 */
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    marker: MarkerInstance,
) -> VertexOutput {
    let cornerMap = array<u32, 6>(0u, 2u, 1u, 1u, 2u, 3u);
    let corner = cornerMap[vertexIndex];

    // Decode corner: bit 1 = top vs bottom, bit 0 = right vs left
    let sideX = f32(i32(corner & 1u)) * 2.0 - 1.0;
    let sideY = f32(i32((corner >> 1u) & 1u)) * 2.0 - 1.0;

    let clipPos = uniforms.mvp * vec4<f32>(marker.position, 1.0);

    let halfViewport = uniforms.viewport * 0.5;
    let effectiveSize = select(uniforms.vertexMarkerSize, markerSizeOverride, markerSizeOverride > 0.0);
    let halfSize = effectiveSize * 0.5;

    let offsetPixels = vec2<f32>(sideX * halfSize, sideY * halfSize);
    let offsetNdc = offsetPixels / halfViewport;

    var result: VertexOutput;
    result.clipPosition = vec4<f32>(
        clipPos.xy + offsetNdc * clipPos.w,
        clipPos.z,
        clipPos.w,
    );
    result.quadUV = vec2<f32>(sideX, sideY);
    result.brightness = marker.instanceBrightness;
    return result;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let distanceSquared = dot(input.quadUV, input.quadUV);
    if (distanceSquared > 1.0) {
        discard;
    }
    let markerColor = select(DEFAULT_MARKER_COLOR, uniforms.highlightColor, useHighlightColor > 0.5);
    return vec4<f32>(markerColor * input.brightness, 1.0);
}
`,ae=Math.PI/2.5,oe=.005,se=.003,ce=.01,le=.95,ue=.1,de=.1,fe=Math.PI/4,pe=.1,me=Math.tan(fe/2),O=1e3,he=1e3,k={segment:{color:`#FFFFFF`,width:5,brightness:1,line:{type:`solid`}},"segment:hidden":{brightness:.3,line:{type:`dashed`,dash:10,gap:10}},"segment:selected":{width:7},"segment:hidden:selected":{width:7},"segment:preview":{color:`#FF9900`},line:{color:`#FFFFFF`,width:1,brightness:1,line:{type:`solid`}},"line:hidden":{brightness:1,line:{type:`dashed`,dash:20,gap:10}},"line:selected":{},"line:hidden:selected":{},vertex:{color:`#FFFFFF`,size:6,brightness:1},"vertex:hidden":{brightness:.3},"vertex:selected":{color:`#66BFFF`,size:20},"vertex:preview":{color:`#FF9900`,size:20},background:{color:`#1A1A1F`}};function ge(e){let{vertices:t,edges:n,faces:r}=e,i=ve(r,n),{faceTriangles:a,triangleFaceIndex:o}=ye(r);return{vertices:t,edges:n,faces:r,faceEdges:i,faceTriangles:a,triangleFaceIndex:o}}function _e(e){let{vertices:t,edges:n}=e,r=new Float32Array(n.length*6);for(let e=0;e<n.length;e++){let[i,a]=n[e],o=t[i],s=t[a],c=e*6;r[c]=o[0],r[c+1]=o[1],r[c+2]=o[2],r[c+3]=s[0],r[c+4]=s[1],r[c+5]=s[2]}let{faceTriangles:i}=e,a=i.length*3,o=new Float32Array(a*3),s=0;for(let[e,n,r]of i)A(o,s,t[e]),A(o,s+1,t[n]),A(o,s+2,t[r]),s+=3;return{edgeInstances:r,edgeCount:n.length,facePositions:o,faceVertexCount:a}}function ve(e,t){return e.map(e=>{let n=new Set(e),r=[];for(let e=0;e<t.length;e++){let[i,a]=t[e];n.has(i)&&n.has(a)&&r.push(e)}return r})}function ye(e){let t=[],n=[];for(let r=0;r<e.length;r++){let i=e[r];if(i.length<3)continue;let a=i[0];for(let e=1;e<i.length-1;e++)t.push([a,i[e],i[e+1]]),n.push(r)}return{faceTriangles:t,triangleFaceIndex:n}}function A(e,t,n){let r=t*3;e[r]=n[0],e[r+1]=n[1],e[r+2]=n[2]}function j(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function M(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function be(e,t){return(e[0]-t[0])**2+(e[1]-t[1])**2+(e[2]-t[2])**2}function xe(e){return Math.sqrt(e[0]*e[0]+e[1]*e[1]+e[2]*e[2])}function Se(e,t){let n=j(t,e),r=xe(n);if(r!==0)return[n[0]/r,n[1]/r,n[2]/r]}function Ce(e,t){let n=Se(e,t);return n===void 0?[[e[0],e[1],e[2]],[t[0],t[1],t[2]]]:[[e[0]-n[0]*O,e[1]-n[1]*O,e[2]-n[2]*O],[t[0]+n[0]*O,t[1]+n[1]*O,t[2]+n[2]*O]]}function we(e,t){let n=Se(e,t);return n===void 0?[[e[0],e[1],e[2]],[e[0],e[1],e[2]],[t[0],t[1],t[2]],[t[0],t[1],t[2]]]:[[e[0]-n[0]*O,e[1]-n[1]*O,e[2]-n[2]*O],[e[0],e[1],e[2]],[t[0],t[1],t[2]],[t[0]+n[0]*O,t[1]+n[1]*O,t[2]+n[2]*O]]}function Te(e,t,n){for(let r of t)if(be(e,r)<n)return!0;return!1}var Ee={color:`#FFFFFF`,width:1,size:1,brightness:1,line:{type:`solid`}},De=16,Oe=7,ke=255;function N(e){if(e.length!==Oe||e[0]!==`#`)throw Error(`Invalid hex color: ${e}. Expected format: #RRGGBB`);return[Number.parseInt(e.slice(1,3),De)/ke,Number.parseInt(e.slice(3,5),De)/ke,Number.parseInt(e.slice(5,7),De)/ke]}function Ae(e){let t=[...e].sort(),n=[[]];for(let e of t){let t=n.length;for(let r=0;r<t;r++)n.push([...n[r],e])}return n.sort((e,t)=>e.length===t.length?e.join(`:`).localeCompare(t.join(`:`)):e.length-t.length),n}function je(e,t){return{color:t.color??e.color,width:t.width??e.width,size:t.size??e.size,brightness:t.brightness??e.brightness,line:t.line??e.line}}function P(e,t,n){let r=Ae(n),i={...Ee};for(let n of r){let r=e[n.length===0?t:`${t}:${n.join(`:`)}`];r!==void 0&&(i=je(i,r))}return i}var F=`depth24plus`,I=1,L=4,R=4,z=6*L,Me=0,Ne=3*L,Pe=R,B=2,V=3,H=V*L,U=L,W=1e-6,Fe=3*L,Ie=96,Le=0,Re=64,ze=80,Be=92,G=6,Ve=class{device;format;depthFacesPipeline;visibleEdgePipeline;hiddenEdgePipeline;visibleLinePipeline;hiddenLinePipeline;selectionMarkerPipeline;persistentMarkerPipeline;previewEdgePipeline;bindGroup;previewBindGroup;uniformBuffer;previewUniformBuffer;edgeInstanceBuffer;faceVertexBuffer;highlightFlagBuffer;lineInstanceBuffer;lineHighlightBuffer;topologyVertexMarkerBuffer;topologyVertexBrightnessBuffer;userSegmentInstanceBuffer;userSegmentHighlightBuffer;previewLineBuffer;previewLineHighlightBuffer;previewStartMarkerBuffer;previewStartBrightnessBuffer;previewSnapMarkerBuffer;previewSnapBrightnessBuffer;edgeCount=0;faceVertexCount=0;depthTexture=null;lastMvpMatrix=new Float32Array(16);extendedLineCount=0;extendedEdgeIndexList=[];selectedEdgeIndex=null;selectedUserSegmentIndex=null;userSegmentCount=0;topologyVertexCount=0;allVertexPositions=[];hasDragPreview=!1;hasSnapTarget=!1;lastCanvasWidth=0;lastCanvasHeight=0;lastDevicePixelRatio=1;backgroundClearColor;vertexHiddenBrightness;constructor(e,t,n){this.camera=e,this.msaaManager=t,this.topology=n;let[r,i,a]=N(P(k,`background`,[]).color);this.backgroundClearColor={r,g:i,b:a,a:1},this.vertexHiddenBrightness=P(k,`vertex`,[`hidden`]).brightness}init(e){this.device=e.device,this.format=e.format;let t=_e(this.topology);this.edgeCount=t.edgeCount,this.faceVertexCount=t.faceVertexCount,this.edgeInstanceBuffer=this.createAndWriteBuffer(t.edgeInstances,GPUBufferUsage.VERTEX),this.faceVertexBuffer=this.createAndWriteBuffer(t.facePositions,GPUBufferUsage.VERTEX),this.highlightFlagBuffer=this.device.createBuffer({size:this.edgeCount*R,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.lineInstanceBuffer=this.device.createBuffer({size:this.edgeCount*B*z,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let n=this.edgeCount*(this.edgeCount-1)/2,r=this.topology.vertices.length+n;this.topologyVertexMarkerBuffer=this.device.createBuffer({size:r*H,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.topologyVertexBrightnessBuffer=this.device.createBuffer({size:r*U,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let i=n;this.userSegmentInstanceBuffer=this.device.createBuffer({size:Math.max(z,i*z),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.userSegmentHighlightBuffer=this.device.createBuffer({size:Math.max(R,i*R),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.lineHighlightBuffer=this.device.createBuffer({size:this.edgeCount*B*R,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewLineBuffer=this.device.createBuffer({size:z,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewLineHighlightBuffer=this.device.createBuffer({size:R,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.previewLineHighlightBuffer,0,new Uint32Array([1])),this.previewStartMarkerBuffer=this.device.createBuffer({size:H,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewStartBrightnessBuffer=this.device.createBuffer({size:U,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.previewStartBrightnessBuffer,0,new Float32Array([1])),this.previewSnapMarkerBuffer=this.device.createBuffer({size:H,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewSnapBrightnessBuffer=this.device.createBuffer({size:U,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.previewSnapBrightnessBuffer,0,new Float32Array([1])),this.uniformBuffer=this.device.createBuffer({size:Ie,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let a=P(k,`vertex`,[`selected`]),o=P(k,`vertex`,[`preview`]);this.device.queue.writeBuffer(this.uniformBuffer,ze,new Float32Array(N(a.color))),this.device.queue.writeBuffer(this.uniformBuffer,Be,new Float32Array([a.size])),this.previewUniformBuffer=this.device.createBuffer({size:Ie,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.previewUniformBuffer,ze,new Float32Array(N(o.color))),this.device.queue.writeBuffer(this.previewUniformBuffer,Be,new Float32Array([o.size]));let s=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.bindGroup=this.device.createBindGroup({layout:s,entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]}),this.previewBindGroup=this.device.createBindGroup({layout:s,entries:[{binding:0,resource:{buffer:this.previewUniformBuffer}}]});let c=this.device.createPipelineLayout({bindGroupLayouts:[s]});this.depthFacesPipeline=this.createDepthFacesPipeline(c);let l=P(k,`segment`,[]),u=P(k,`segment`,[`selected`]),d=P(k,`segment`,[`hidden`]),f=P(k,`segment`,[`hidden`,`selected`]),p=P(k,`line`,[]),m=P(k,`line`,[`selected`]),h=P(k,`line`,[`hidden`]),g=P(k,`line`,[`hidden`,`selected`]),_=P(k,`vertex`,[]),v=P(k,`segment`,[`preview`]);this.visibleEdgePipeline=this.createEdgePipeline(c,{depthCompare:`less-equal`,depthWriteEnabled:!0,normalWidth:l.width,highlightWidth:u.width}),this.hiddenEdgePipeline=this.createEdgePipeline(c,{depthCompare:`greater`,depthWriteEnabled:!1,normalWidth:d.width,highlightWidth:f.width,brightness:d.brightness,...d.line.type===`dashed`?{dashLength:d.line.dash,gapLength:d.line.gap}:{}}),this.visibleLinePipeline=this.createEdgePipeline(c,{depthCompare:`less-equal`,depthWriteEnabled:!0,normalWidth:p.width,highlightWidth:m.width}),this.hiddenLinePipeline=this.createEdgePipeline(c,{depthCompare:`greater`,depthWriteEnabled:!1,normalWidth:h.width,highlightWidth:g.width,brightness:h.brightness,...h.line.type===`dashed`?{dashLength:h.line.dash,gapLength:h.line.gap}:{}}),this.selectionMarkerPipeline=this.createVertexMarkerPipeline(c,{depthCompare:`always`}),this.persistentMarkerPipeline=this.createVertexMarkerPipeline(c,{depthCompare:`always`,highlighted:!1,markerSize:_.size}),this.previewEdgePipeline=this.createEdgePipeline(c,{depthCompare:`always`,depthWriteEnabled:!1,normalWidth:v.width,highlightWidth:v.width})}update(e){this.camera.tick();let t=this.camera.getViewMatrix(),n=this.camera.getDistance(),r=e.canvasWidth/Math.max(I,e.canvasHeight),i=n*me,a=i*r,o=S.ortho(-a,a,-i,i,pe,100),s=S.multiply(o,t);this.lastMvpMatrix.set(s),this.lastCanvasWidth=e.canvasWidth,this.lastCanvasHeight=e.canvasHeight,this.lastDevicePixelRatio=e.devicePixelRatio,this.device.queue.writeBuffer(this.uniformBuffer,Le,s);let c=new Float32Array([e.canvasWidth,e.canvasHeight]);this.device.queue.writeBuffer(this.uniformBuffer,Re,c),this.device.queue.writeBuffer(this.previewUniformBuffer,Le,s),this.device.queue.writeBuffer(this.previewUniformBuffer,Re,c),this.updateMarkerBrightness()}render(e,t,r){let i=this.msaaManager.ensureView(this.device,this.format,r.canvasWidth,r.canvasHeight);if(n(i))return;let a=this.ensureDepthTexture(r.canvasWidth,r.canvasHeight),o=e.beginRenderPass({colorAttachments:[{view:i,resolveTarget:t,loadOp:`clear`,clearValue:this.backgroundClearColor,storeOp:`discard`}],depthStencilAttachment:{view:a.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});o.setPipeline(this.depthFacesPipeline),o.setBindGroup(0,this.bindGroup),o.setVertexBuffer(0,this.faceVertexBuffer),o.draw(this.faceVertexCount),o.setPipeline(this.hiddenEdgePipeline),o.setVertexBuffer(0,this.edgeInstanceBuffer),o.setVertexBuffer(1,this.highlightFlagBuffer),o.draw(6,this.edgeCount),this.userSegmentCount>0&&(o.setPipeline(this.hiddenLinePipeline),o.setVertexBuffer(0,this.userSegmentInstanceBuffer),o.setVertexBuffer(1,this.userSegmentHighlightBuffer),o.draw(6,this.userSegmentCount)),this.extendedLineCount>0&&(o.setPipeline(this.hiddenLinePipeline),o.setVertexBuffer(0,this.lineInstanceBuffer),o.setVertexBuffer(1,this.lineHighlightBuffer),o.draw(6,this.extendedLineCount)),o.setPipeline(this.visibleEdgePipeline),o.setVertexBuffer(0,this.edgeInstanceBuffer),o.setVertexBuffer(1,this.highlightFlagBuffer),o.draw(6,this.edgeCount),this.userSegmentCount>0&&(o.setPipeline(this.visibleLinePipeline),o.setVertexBuffer(0,this.userSegmentInstanceBuffer),o.setVertexBuffer(1,this.userSegmentHighlightBuffer),o.draw(6,this.userSegmentCount)),this.extendedLineCount>0&&(o.setPipeline(this.visibleLinePipeline),o.setVertexBuffer(0,this.lineInstanceBuffer),o.setVertexBuffer(1,this.lineHighlightBuffer),o.draw(6,this.extendedLineCount)),this.topologyVertexCount>0&&(o.setPipeline(this.persistentMarkerPipeline),o.setVertexBuffer(0,this.topologyVertexMarkerBuffer),o.setVertexBuffer(1,this.topologyVertexBrightnessBuffer),o.draw(G,this.topologyVertexCount)),this.hasDragPreview&&(o.setPipeline(this.previewEdgePipeline),o.setBindGroup(0,this.previewBindGroup),o.setVertexBuffer(0,this.previewLineBuffer),o.setVertexBuffer(1,this.previewLineHighlightBuffer),o.draw(6,1),o.setPipeline(this.selectionMarkerPipeline),o.setVertexBuffer(0,this.previewStartMarkerBuffer),o.setVertexBuffer(1,this.previewStartBrightnessBuffer),o.draw(G,1),o.setBindGroup(0,this.bindGroup)),this.hasSnapTarget&&(o.setPipeline(this.selectionMarkerPipeline),o.setBindGroup(0,this.previewBindGroup),o.setVertexBuffer(0,this.previewSnapMarkerBuffer),o.setVertexBuffer(1,this.previewSnapBrightnessBuffer),o.draw(G,1),o.setBindGroup(0,this.bindGroup)),o.end()}getLastMvpMatrix(){return this.lastMvpMatrix}setSelection(e){let t=new Uint32Array(this.edgeCount);switch(this.selectedEdgeIndex=null,this.selectedUserSegmentIndex=null,e.type){case`none`:break;case`edge`:this.selectedEdgeIndex=e.edgeIndex,t[e.edgeIndex]=1;break;case`line`:this.selectedEdgeIndex=e.edgeIndex,t[e.edgeIndex]=1;break;case`userSegment`:this.selectedUserSegmentIndex=e.userSegmentIndex;break;default:r(e)}this.device.queue.writeBuffer(this.highlightFlagBuffer,0,t),this.updateLineHighlights(),this.updateUserSegmentHighlights()}setDragPreview(e){if(n(e)){this.hasDragPreview=!1,this.hasSnapTarget=!1;return}let t=n(e.snapTargetPosition)?this.unprojectToVertexPlane(e.cursorScreenX,e.cursorScreenY,e.startPosition):e.snapTargetPosition;this.device.queue.writeBuffer(this.previewLineBuffer,0,new Float32Array([e.startPosition[0],e.startPosition[1],e.startPosition[2],t[0],t[1],t[2]])),this.hasDragPreview=!0,this.device.queue.writeBuffer(this.previewStartMarkerBuffer,0,new Float32Array(e.startPosition)),n(e.snapTargetPosition)?this.hasSnapTarget=!1:(this.device.queue.writeBuffer(this.previewSnapMarkerBuffer,0,new Float32Array(e.snapTargetPosition)),this.hasSnapTarget=!0)}applySceneState(e){this.applyTopologyVertices(e),this.applyExtendedSegments(e),this.applyUserSegments(e)}applyTopologyVertices(e){if(this.topologyVertexCount=e.vertices.length,this.allVertexPositions=e.vertices.map(e=>e.position),this.topologyVertexCount===0)return;let t=new Float32Array(this.topologyVertexCount*V);for(let n=0;n<this.topologyVertexCount;n++){let r=e.vertices[n].position,i=n*V;t[i]=r[0],t[i+1]=r[1],t[i+2]=r[2]}this.device.queue.writeBuffer(this.topologyVertexMarkerBuffer,0,t)}applyExtendedSegments(e){if(this.extendedEdgeIndexList=e.lines.map(e=>e.edgeIndex),this.extendedLineCount=this.extendedEdgeIndexList.length*B,this.extendedLineCount===0)return;let t=new Float32Array(this.extendedLineCount*6),n=0;for(let e of this.extendedEdgeIndexList){let[r,i]=this.computeEdgeHalves(e);t.set(r,n),n+=6,t.set(i,n),n+=6}this.device.queue.writeBuffer(this.lineInstanceBuffer,0,t),this.updateLineHighlights()}applyUserSegments(e){if(this.userSegmentCount=e.userSegments.length,this.userSegmentCount===0)return;let t=new Float32Array(this.userSegmentCount*6),n=new Uint32Array(this.userSegmentCount);for(let r=0;r<this.userSegmentCount;r++){let i=e.userSegments[r],a=this.computeFullExtendedLine(i.startPosition,i.endPosition);t.set(a,r*6),n[r]=0}this.device.queue.writeBuffer(this.userSegmentInstanceBuffer,0,t),this.device.queue.writeBuffer(this.userSegmentHighlightBuffer,0,n)}updateMarkerBrightness(){if(this.topologyVertexCount===0)return;let e=this.computeViewDirection(),t=new Float32Array(this.topologyVertexCount);for(let n=0;n<this.topologyVertexCount;n++){let r=this.allVertexPositions[n];t[n]=this.isVertexOccluded(e,r)?this.vertexHiddenBrightness:1}this.device.queue.writeBuffer(this.topologyVertexBrightnessBuffer,0,t)}computeViewDirection(){let e=this.camera.getViewMatrix();return[-e[2],-e[6],-e[10]]}isVertexOccluded(e,t){let n=[t[0]-e[0]*100,t[1]-e[1]*100,t[2]-e[2]*100];for(let t of this.topology.faceTriangles){let r=this.topology.vertices[t[0]],i=this.topology.vertices[t[1]],a=this.topology.vertices[t[2]],o=this.rayTriangleIntersect(n,e,r,i,a);if(o!==void 0&&o>W&&o<100-W)return!0}return!1}rayTriangleIntersect(e,t,n,r,i){let a=[r[0]-n[0],r[1]-n[1],r[2]-n[2]],o=[i[0]-n[0],i[1]-n[1],i[2]-n[2]],s=t[1]*o[2]-t[2]*o[1],c=t[2]*o[0]-t[0]*o[2],l=t[0]*o[1]-t[1]*o[0],u=a[0]*s+a[1]*c+a[2]*l;if(Math.abs(u)<W)return;let d=1/u,f=e[0]-n[0],p=e[1]-n[1],m=e[2]-n[2],h=(f*s+p*c+m*l)*d;if(h<0||h>1)return;let g=p*a[2]-m*a[1],_=m*a[0]-f*a[2],v=f*a[1]-p*a[0],y=(t[0]*g+t[1]*_+t[2]*v)*d;if(!(y<0||h+y>1))return(o[0]*g+o[1]*_+o[2]*v)*d}dispose(){this.uniformBuffer.destroy(),this.previewUniformBuffer.destroy(),this.edgeInstanceBuffer.destroy(),this.faceVertexBuffer.destroy(),this.highlightFlagBuffer.destroy(),this.lineInstanceBuffer.destroy(),this.lineHighlightBuffer.destroy(),this.topologyVertexMarkerBuffer.destroy(),this.topologyVertexBrightnessBuffer.destroy(),this.userSegmentInstanceBuffer.destroy(),this.userSegmentHighlightBuffer.destroy(),this.previewLineBuffer.destroy(),this.previewLineHighlightBuffer.destroy(),this.previewStartMarkerBuffer.destroy(),this.previewStartBrightnessBuffer.destroy(),this.previewSnapMarkerBuffer.destroy(),this.previewSnapBrightnessBuffer.destroy(),this.depthTexture?.destroy()}unprojectToVertexPlane(e,t,n){let r=this.lastCanvasWidth,i=this.lastCanvasHeight,a=this.lastDevicePixelRatio,o=e*a,s=t*a,c=o/r*2-1,l=1-s/i*2,u=x.transformMat4(x.fromValues(n[0],n[1],n[2],1),this.lastMvpMatrix),d=u[2]/u[3],f=S.inverse(this.lastMvpMatrix),p=x.transformMat4(x.fromValues(c,l,d,1),f);return[p[0]/p[3],p[1]/p[3],p[2]/p[3]]}updateLineHighlights(){if(this.extendedLineCount===0)return;let e=new Uint32Array(this.extendedLineCount);for(let t=0;t<this.extendedEdgeIndexList.length;t++){let n=this.extendedEdgeIndexList[t]===this.selectedEdgeIndex?1:0,r=t*B;e[r]=n,e[r+1]=n}this.device.queue.writeBuffer(this.lineHighlightBuffer,0,e)}updateUserSegmentHighlights(){if(this.userSegmentCount===0)return;let e=new Uint32Array(this.userSegmentCount);for(let t=0;t<this.userSegmentCount;t++)e[t]=t===this.selectedUserSegmentIndex?1:0;this.device.queue.writeBuffer(this.userSegmentHighlightBuffer,0,e)}computeEdgeHalves(e){let[t,n]=this.topology.edges[e],[r,i,a,o]=we(this.topology.vertices[t],this.topology.vertices[n]);return[new Float32Array([...r,...i]),new Float32Array([...a,...o])]}computeFullExtendedLine(e,t){let[n,r]=Ce(e,t);return new Float32Array([...n,...r])}createAndWriteBuffer(e,t){let n=this.device.createBuffer({size:e.byteLength,usage:t|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(n,0,e),n}createDepthFacesPipeline(e){let t=this.device.createShaderModule({code:ne});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:Fe,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format,writeMask:0}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:F,depthBias:2,depthBiasSlopeScale:1},multisample:{count:4}})}createEdgePipeline(e,t){let n=this.device.createShaderModule({code:re}),r={2:t.brightness??1};return t.dashLength!==void 0&&(r[3]=t.dashLength),t.gapLength!==void 0&&(r[4]=t.gapLength),this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,constants:{0:t.normalWidth,1:t.highlightWidth},buffers:[{arrayStride:z,stepMode:`instance`,attributes:[{shaderLocation:0,offset:Me,format:`float32x3`},{shaderLocation:1,offset:Ne,format:`float32x3`}]},{arrayStride:Pe,stepMode:`instance`,attributes:[{shaderLocation:2,offset:0,format:`uint32`}]}]},fragment:{module:n,entryPoint:`fs`,targets:[{format:this.format}],constants:r},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:t.depthWriteEnabled,depthCompare:t.depthCompare,format:F},multisample:{count:4}})}createVertexMarkerPipeline(e,t){let n=this.device.createShaderModule({code:ie}),r={};return t.markerSize!==void 0&&(r[1]=t.markerSize),this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,constants:Object.keys(r).length>0?r:void 0,buffers:[{arrayStride:H,stepMode:`instance`,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]},{arrayStride:U,stepMode:`instance`,attributes:[{shaderLocation:1,offset:0,format:`float32`}]}]},fragment:{module:n,entryPoint:`fs`,targets:[{format:this.format}],constants:{0:t.highlighted??!0?1:0}},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:t.depthCompare,format:F},multisample:{count:4}})}ensureDepthTexture(e,t){return!n(this.depthTexture)&&this.depthTexture.width===e&&this.depthTexture.height===t?this.depthTexture:(this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(I,e),Math.max(I,t)],format:F,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthTexture)}},He=1,Ue=1.5,K=5,We=Ue/2;function Ge(){let e=[];for(let t=0;t<K;t++){let n=2*Math.PI*t/K;e.push([He*Math.sin(n),-We,He*Math.cos(n)])}return e}var Ke=Ge(),qe=[0,Ue-We,0],Je=[...Ke,qe],Ye=K,Xe=Array.from({length:K},(e,t)=>[t,(t+1)%K]),Ze=Array.from({length:K},(e,t)=>[t,Ye]),Qe=Array.from({length:K},(e,t)=>[Ye,t,(t+1)%K]),$e=Array.from({length:K},(e,t)=>t),et={name:`Pentagonal Pyramid`,vertices:Je,edges:[...Xe,...Ze],faces:[...Qe,$e]};function tt(e){let{canvas:t,context:n,layerManager:r}=e,{device:i,canvasContext:a}=n,o=0,s=0,c=Math.max(1,window.devicePixelRatio);function l(){c=Math.max(1,window.devicePixelRatio);let e=Math.floor(t.clientWidth*c),n=Math.floor(t.clientHeight*c);(t.width!==e||t.height!==n)&&(t.width=e,t.height=n),o=e,s=n}l();let u=new ResizeObserver(()=>{l()});u.observe(t);let d=0,f=!1,p=performance.now();function m(){if(f)return;if(l(),o===0||s===0){d=requestAnimationFrame(m);return}let e={time:(performance.now()-p)/he,canvasWidth:o,canvasHeight:s,devicePixelRatio:c};r.updateAll(e);let t=a.getCurrentTexture().createView(),n=i.createCommandEncoder();r.renderAll(n,t,e),i.queue.submit([n.finish()]),d=requestAnimationFrame(m)}return d=requestAnimationFrame(m),()=>{f=!0,cancelAnimationFrame(d),u.disconnect()}}function nt(e,t=[0,0,0]){let n=0,r=ae,i=5,a=5,o=[t[0],t[1],t[2]],s=`rotate`,c=0,l=0,u=0;function d(){return[o[0]+Math.sin(r)*Math.sin(n)*i,o[1]+Math.cos(r)*i,o[2]+Math.sin(r)*Math.cos(n)*i]}function f(){return[-Math.cos(r)*Math.sin(n),Math.sin(r),-Math.cos(r)*Math.cos(n)]}function p(){return[Math.cos(n),0,-Math.sin(n)]}function m(e){let r=-e*oe;n+=r;let i=o[0]-t[0],a=o[2]-t[2],s=Math.cos(r),c=Math.sin(r);o[0]=t[0]+i*s+a*c,o[2]=t[2]-i*c+a*s}function h(e,t){let n=se*i,r=p();o[0]-=r[0]*e*n,o[1]+=t*n,o[2]-=r[2]*e*n}function g(e){return Math.max(3,Math.min(15,e))}function _(){c=0,l=0,u=0}let v=new Map,y=!1,x=0;function ee(){let e=[...v.values()],t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}function te(e){v.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),v.size===1?y=e.shiftKey:v.size===2&&(x=ee())}function C(e){let t=v.get(e.pointerId);if(t===void 0)return;if(v.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),v.size===2){let e=ee(),t=x/e;a=g(a*t),x=e;return}if(v.size!==1)return;let n=e.clientX-t.clientX,r=e.clientY-t.clientY;y||s===`pan`?(l=n,u=r,c=0,h(n,r)):(c=n,l=0,u=0,m(n))}function w(e){v.delete(e.pointerId),v.size===0&&(y=!1)}function T(e){v.delete(e.pointerId)}function E(e){e.preventDefault(),a=g(a*(1+e.deltaY*ce))}return e.addEventListener(`pointerdown`,te),window.addEventListener(`pointermove`,C),window.addEventListener(`pointerup`,w),window.addEventListener(`pointercancel`,T),e.addEventListener(`wheel`,E,{passive:!1}),{tick(){let e=a-i;if(Math.abs(e)>.001?i+=e*de:i=a,v.size>0)return;let t=Math.abs(c)>=ue,n=Math.abs(l)>=.1||Math.abs(u)>=.1;if(!t&&!n){_();return}t&&(m(c),c*=le),n&&(h(l,u),l*=le,u*=le)},getViewMatrix(){let e=d(),t=f();return S.lookAt(b.fromValues(e[0],e[1],e[2]),b.fromValues(o[0],o[1],o[2]),b.fromValues(t[0],t[1],t[2]))},getEyePosition(){return d()},getDistance(){return i},setInteractionMode(e){s=e,_()},destroy(){e.removeEventListener(`pointerdown`,te),window.removeEventListener(`pointermove`,C),window.removeEventListener(`pointerup`,w),window.removeEventListener(`pointercancel`,T),e.removeEventListener(`wheel`,E)}}}function rt(e,t,n){let r=0,i=0,a=0,o,s=0,c=0,l=0;function u(e,t){let n=Math.abs(e-r),o=Math.abs(t-i),s=performance.now()-a;return n<3&&o<3&&s<300}function d(e,r){let i=performance.now(),a=i-l,o=Math.sqrt((e-s)**2+(r-c)**2);a<400&&o<10?(n(e,r),l=0):(t(e,r),s=e,c=r,l=i)}function f(e){e.isPrimary&&(o=e.pointerId,r=e.clientX,i=e.clientY,a=performance.now())}function p(t){if(t.pointerId===o&&(o=void 0,u(t.clientX,t.clientY))){let n=e.getBoundingClientRect();d(t.clientX-n.left,t.clientY-n.top)}}return e.addEventListener(`pointerdown`,f),window.addEventListener(`pointerup`,p),()=>{e.removeEventListener(`pointerdown`,f),window.removeEventListener(`pointerup`,p)}}function it(e,t){let n=!1,r,i=[0,0,0];function a(t,n){let r=e.getBoundingClientRect();return{screenX:t-r.left,screenY:n-r.top}}function o(e,t){return e[0]===t[0]&&e[1]===t[1]&&e[2]===t[2]}function s(e){let{screenX:o,screenY:s}=a(e.clientX,e.clientY),c=t.performPointHitTest(o,s);return c===void 0?!1:(n=!0,r=e.pointerId,i=c,t.onDragStart(),t.onDragUpdate({startPosition:i,cursorScreenX:o,cursorScreenY:s,snapTargetPosition:void 0}),!0)}function c(e,n){let{screenX:r,screenY:s}=a(e,n),c=t.performPointHitTest(r,s);t.onDragUpdate({startPosition:i,cursorScreenX:r,cursorScreenY:s,snapTargetPosition:c!==void 0&&!o(c,i)?c:void 0})}function l(e,s){let{screenX:c,screenY:l}=a(e,s),u=t.performPointHitTest(c,l);u!==void 0&&!o(u,i)?t.onDragComplete(i,u):t.onVertexTap(i),n=!1,r=void 0,t.onDragUpdate(void 0)}function u(){n=!1,r=void 0,t.onDragUpdate(void 0)}function d(e){if(n){u(),e.stopPropagation();return}e.isPrimary&&s(e)&&e.stopPropagation()}function f(e){!n||e.pointerId!==r||c(e.clientX,e.clientY)}function p(e){!n||e.pointerId!==r||l(e.clientX,e.clientY)}return e.addEventListener(`pointerdown`,d,{capture:!0}),window.addEventListener(`pointermove`,f),window.addEventListener(`pointerup`,p),()=>{e.removeEventListener(`pointerdown`,d,{capture:!0}),window.removeEventListener(`pointermove`,f),window.removeEventListener(`pointerup`,p)}}var at=100;function ot(){let e=[],t=[];return{push(n){e.push(n),t.length=0,e.length>at&&e.shift()},undo(n){let r=e.pop();if(r!==void 0)return t.push(n),r},redo(n){let r=t.pop();if(r!==void 0)return e.push(n),r},canUndo(){return e.length>0},canRedo(){return t.length>0}}}var q={type:`none`};function st(e,t,r,i,a,o,s,c,l){let u=r*a,d=i*a,f=e*a,p=t*a,m=(10*a)**2,h=J(o,s.vertices,u,d),g=dt(f,p,m,s.edges.map(([e,t])=>({start:h[e],end:h[t]})));if(!n(g))return{type:`edge`,edgeIndex:g};if(c.length>0){let e=dt(f,p,m,lt(o,c.map(e=>{let[t,n]=s.edges[e];return{startPosition:s.vertices[t],endPosition:s.vertices[n]}}),u,d));if(!n(e))return{type:`line`,edgeIndex:c[e]}}if(l.length>0){let e=dt(f,p,m,lt(o,l,u,d));if(!n(e))return{type:`userSegment`,userSegmentIndex:e}}return q}function ct(e,t,n,r,i,a,o){let s=n*i,c=r*i;return ut(e*i,t*i,i,J(a,o,s,c))}function J(e,t,n,r){return t.map(t=>{let i=x.transformMat4(x.fromValues(t[0],t[1],t[2],1),e);if(i[3]<=0)return{screenX:0,screenY:0,behindCamera:!0};let a=i[0]/i[3],o=i[1]/i[3];return{screenX:(a+1)*.5*n,screenY:(1-o)*.5*r,behindCamera:!1}})}function lt(e,t,n,r){return t.map(t=>{let[i,a]=Ce(t.startPosition,t.endPosition),o=J(e,[i,a],n,r);return{start:o[0],end:o[1]}})}function ut(e,t,n,r){let i=(15*n)**2,a;for(let n=0;n<r.length;n++){let o=r[n];if(o.behindCamera)continue;let s=o.screenX-e,c=o.screenY-t,l=s*s+c*c;l<i&&(i=l,a=n)}return a}function dt(e,t,n,r){let i=n,a;for(let n=0;n<r.length;n++){let{start:o,end:s}=r[n];if(o.behindCamera||s.behindCamera)continue;let c=ft(e,t,o.screenX,o.screenY,s.screenX,s.screenY);c<i&&(i=c,a=n)}return a}function ft(e,t,n,r,i,a){let o=i-n,s=a-r,c=o*o+s*s;if(c===0){let i=e-n,a=t-r;return i*i+a*a}let l=Math.max(0,Math.min(1,((e-n)*o+(t-r)*s)/c)),u=n+l*o,d=r+l*s,f=e-u,p=t-d;return f*f+p*p}var pt=1e-10,mt=.001,ht=1e-4;function gt(e,t){let n=new Set(e.lines.map(e=>e.edgeIndex)),r=[];for(let n of e.lines)r.push(yt(n.edgeIndex,t));for(let t of e.userSegments)r.push({point:t.startPosition,direction:j(t.endPosition,t.startPosition)});let i=[],a=[];function o(e){e!==void 0&&(Te(e,t.vertices,mt)||Te(e,a,ht)||(i.push({position:e,sourceEdgeA:0,sourceEdgeB:0}),a.push(e)))}for(let e=0;e<r.length;e++){for(let t=e+1;t<r.length;t++)o(_t(r[e],r[t]));for(let i=0;i<t.edges.length;i++)n.has(i)||o(vt(r[e],yt(i,t)))}return i}function _t(e,t){return bt(e.point,e.direction,t.point,t.direction)?.midpoint}function vt(e,t){let n=bt(e.point,e.direction,t.point,t.direction);if(!(n===void 0||n.parameterB<0||n.parameterB>1))return n.midpoint}function yt(e,t){let[n,r]=t.edges[e],i=t.vertices[n],a=t.vertices[r];return{point:i,direction:j(a,i)}}function bt(e,t,n,r){let i=M(t,t),a=M(t,r),o=M(r,r),s=i*o-a*a;if(Math.abs(s)<pt)return;let c=j(e,n),l=M(t,c),u=M(r,c),d=(a*u-o*l)/s,f=(i*u-a*l)/s,p=[e[0]+d*t[0],e[1]+d*t[1],e[2]+d*t[2]],m=[n[0]+f*r[0],n[1]+f*r[1],n[2]+f*r[2]];if(!(be(p,m)>.01**2))return{midpoint:[(p[0]+m[0])*.5,(p[1]+m[1])*.5,(p[2]+m[2])*.5],parameterB:f}}var xt=1e-4;function St(e){return{vertices:e.vertices.map((e,t)=>({position:e,topologyIndex:t})),segments:e.edges.map((e,t)=>({edgeIndex:t})),lines:[],userSegments:[],intersections:[]}}function Ct(e,t,n){let r=e.lines.some(e=>e.edgeIndex===t),i=kt(e,t,n),a=r?e.lines.filter(e=>e.edgeIndex!==t):r||i!==void 0?e.lines:[...e.lines,{edgeIndex:t}],o=i===void 0?e.userSegments:e.userSegments.filter((e,t)=>t!==i);return Et({...e,lines:a,userSegments:o},n)}function wt(e,t,n,r){let i=Ot(t,n,r);return i===void 0?Et({...e,userSegments:[...e.userSegments,{startPosition:t,endPosition:n}]},r):Ct(e,i,r)}function Tt(e,t,n){return Et({...e,userSegments:e.userSegments.filter((e,n)=>n!==t)},n)}function Et(e,t){let n={...e,intersections:[]},r=gt(n,t);return{...n,intersections:r,vertices:Dt(t,r)}}function Dt(e,t){let n=e.vertices.map((e,t)=>({position:e,topologyIndex:t})),r=t.map(e=>({position:e.position,topologyIndex:void 0}));return[...n,...r]}function Ot(e,t,n){for(let r=0;r<n.edges.length;r++){let[i,a]=n.edges[r],o=n.vertices[i],s=n.vertices[a];if(At(e,t,o,s))return r}}function kt(e,t,n){let[r,i]=n.edges[t],a=n.vertices[r],o=n.vertices[i];for(let t=0;t<e.userSegments.length;t++){let n=e.userSegments[t];if(At(n.startPosition,n.endPosition,a,o))return t}}function At(e,t,n,r){let i=Y(e,n)&&Y(t,r),a=Y(e,r)&&Y(t,n);return i||a}function Y(e,t){return be(e,t)<xt}function jt(e){let t=!1,n,r=ge(et),i=nt(e,[0,0,0]),a,o=St(r),s=q,c=ot(),l=new Set;function u(){for(let e of l)e(c.canUndo(),c.canRedo())}function d(e){c.push(o),o=e,a?.applySceneState(o),u()}function f(){if(!(t||!a))return{canvasWidth:e.clientWidth,canvasHeight:e.clientHeight,devicePixelRatio:Math.max(1,window.devicePixelRatio),mvpMatrix:a.getLastMvpMatrix()}}function p(e,t){let n=f();return n===void 0?q:st(e,t,n.canvasWidth,n.canvasHeight,n.devicePixelRatio,n.mvpMatrix,r,o.lines.map(e=>e.edgeIndex),o.userSegments)}function m(e,t){let n=f();if(n===void 0)return;let r=o.vertices.map(e=>e.position),i=ct(e,t,n.canvasWidth,n.canvasHeight,n.devicePixelRatio,n.mvpMatrix,r);if(i!==void 0)return r[i]}function h(e){s=e,a?.setSelection(e)}function g(){switch(s.type){case`edge`:case`line`:{let[e,t]=r.edges[s.edgeIndex];return j(r.vertices[t],r.vertices[e])}case`userSegment`:{let e=o.userSegments[s.userSegmentIndex];return j(e.endPosition,e.startPosition)}case`none`:return}}function _(e,t){h(p(e,t))}function v(e,t){let n=p(e,t);n.type===`edge`||n.type===`line`?d(Ct(o,n.edgeIndex,r)):n.type===`userSegment`&&d(Tt(o,n.userSegmentIndex,r))}let y=rt(e,_,v),b=it(e,{performPointHitTest:m,onDragStart:()=>{},onDragUpdate:e=>{a?.setDragPreview(e)},onVertexTap:e=>{let t=g();if(t!==void 0){let n=[e[0]+t[0],e[1]+t[1],e[2]+t[2]];d(wt(o,e,n,r))}h(q)},onDragComplete:(e,t)=>{d(wt(o,e,t,r)),h(q)}});Mt(e,i,r).then(({cleanup:e,pyramidLayer:r})=>{t?e():(n=e,a=r,r.applySceneState(o))});function x(e){e!==void 0&&(o=e,a?.applySceneState(o),h(q),u())}return{destroy:()=>{t=!0,i.destroy(),y(),b(),l.clear(),n?.()},camera:i,undo:()=>x(c.undo(o)),redo:()=>x(c.redo(o)),subscribeHistory:e=>(l.add(e),e(c.canUndo(),c.canRedo()),()=>l.delete(e))}}async function Mt(e,t,n){let r=await v(e),i=ee(4),a=new Ve(t,i,n),o=new y([a]);o.initAll(r);let s=tt({canvas:e,context:r,layerManager:o});return{cleanup:()=>{s(),o.dispose(),i.dispose(),r.device.destroy()},pyramidLayer:a}}var X=a({en:{toolbar:{undo:`Undo`,redo:`Redo`,rotate:`Rotate`,pan:`Pan`,help:`Help`,close:`Close`},help:{title:`Stereometry`,description:`Interactive 3D geometry game — construct auxiliary lines, find intersection points of lines and faces, and build cross-sections of solids.`,controls:{drag:`rotate the camera`,shiftDrag:`pan the view`,scrollPinch:`zoom in and out`,clickEdge:`select it`,doubleClickEdge:`extend edge into an infinite line`,dragVertex:`draw a construction line between two points`,selectEdgeTapVertex:`draw a parallel line through that vertex`},controlLabels:{drag:`Drag`,shiftDrag:`Shift+Drag`,scrollPinch:`Scroll / Pinch`,clickEdge:`Click edge/line`,doubleClickEdge:`Double-click edge`,dragVertex:`Drag vertex → vertex`,selectEdgeTapVertex:`Select edge/line + tap vertex`},intersectionHint:`Intersection points appear automatically where lines cross.`}},ru:{toolbar:{undo:`Отменить`,redo:`Повторить`,rotate:`Вращение`,pan:`Перемещение`,help:`Справка`,close:`Закрыть`},help:{title:`Стереометрия`,description:`Интерактивная 3D-игра по стереометрии — стройте вспомогательные линии, находите точки пересечения прямых и граней, выполняйте сечения фигур.`,controls:{drag:`вращение камеры`,shiftDrag:`перемещение вида`,scrollPinch:`приближение и отдаление`,clickEdge:`выделить ребро`,doubleClickEdge:`продлить ребро в бесконечную прямую`,dragVertex:`провести вспомогательную линию между двумя точками`,selectEdgeTapVertex:`провести параллельную прямую через эту вершину`},controlLabels:{drag:`Перетаскивание`,shiftDrag:`Shift+Перетаскивание`,scrollPinch:`Прокрутка / Щипок`,clickEdge:`Клик по ребру/линии`,doubleClickEdge:`Двойной клик по ребру`,dragVertex:`Перетащить вершину → вершину`,selectEdgeTapVertex:`Выделить ребро + нажать на вершину`},intersectionHint:`Точки пересечения появляются автоматически при пересечении линий.`}}}),Z=i(),Q=20,Nt=14,Pt=(0,D.memo)(()=>{let e=(0,D.useRef)(null),t=(0,D.useRef)(null),[n,r]=(0,D.useState)(`rotate`),[i,a]=(0,D.useState)(!1),[o,c]=(0,D.useState)(!1);(0,D.useEffect)(()=>{if(e.current){let n=jt(e.current);t.current=n;let r=n.subscribeHistory((e,t)=>{a(e),c(t)});return()=>{t.current=null,r(),n.destroy()}}},[]);let l=s(()=>{r(`rotate`),t.current?.camera.setInteractionMode(`rotate`)}),u=s(()=>{r(`pan`),t.current?.camera.setInteractionMode(`pan`)}),d=s(()=>{t.current?.undo()}),f=s(()=>{t.current?.redo()});return(0,Z.jsx)(te,{className:C.fixedContainer,children:(0,Z.jsxs)(`div`,{className:C.fixedContainer,children:[(0,Z.jsx)(`canvas`,{ref:e,className:`h-full w-full [touch-action:none]`}),(0,Z.jsxs)(`div`,{className:`absolute bottom-4 right-4 flex gap-2`,children:[(0,Z.jsx)(Ft,{}),(0,Z.jsx)($,{onClick:d,label:X.toolbar.undo,disabled:!i,children:(0,Z.jsx)(_,{size:Q})}),(0,Z.jsx)($,{onClick:f,label:X.toolbar.redo,disabled:!o,children:(0,Z.jsx)(T,{size:Q})}),(0,Z.jsx)($,{active:n===`rotate`,onClick:l,label:X.toolbar.rotate,children:(0,Z.jsx)(E,{size:Q})}),(0,Z.jsx)($,{active:n===`pan`,onClick:u,label:X.toolbar.pan,children:(0,Z.jsx)(w,{size:Q})})]})]})})}),$=(0,D.memo)(({active:e=!1,disabled:t=!1,onClick:n,children:r,label:i})=>(0,Z.jsx)(`button`,{type:`button`,onClick:n,disabled:t,"aria-label":i,"aria-pressed":e,className:g(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all`,t?`bg-neutral-900 text-neutral-600 cursor-not-allowed`:`hover:scale-110 active:scale-95`,!t&&e&&`bg-blue-500 text-white`,!t&&!e&&`bg-neutral-800 text-neutral-400 hover:text-white`),children:r})),Ft=(0,D.memo)(()=>{let[e,t]=(0,D.useState)(!1);return(0,Z.jsxs)(o,{open:e,onOpenChange:t,children:[(0,Z.jsx)(f,{asChild:!0,children:(0,Z.jsx)(`button`,{type:`button`,"aria-label":X.toolbar.help,className:g(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,e?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,Z.jsx)(h,{size:Q})})}),(0,Z.jsx)(c,{children:(0,Z.jsxs)(l,{side:`top`,sideOffset:8,align:`end`,className:g(`z-50 w-72 rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,Z.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,Z.jsx)(`span`,{className:`font-semibold text-white`,children:X.help.title}),(0,Z.jsx)(u,{"aria-label":X.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,Z.jsx)(m,{size:Nt})})]}),(0,Z.jsx)(`p`,{className:`mb-3 text-neutral-400`,children:X.help.description}),(0,Z.jsxs)(`ul`,{className:`space-y-1.5 text-neutral-300`,children:[(0,Z.jsxs)(`li`,{children:[(0,Z.jsx)(`strong`,{className:`text-neutral-100`,children:X.help.controlLabels.drag}),` —`,` `,X.help.controls.drag]}),(0,Z.jsxs)(`li`,{children:[(0,Z.jsx)(`strong`,{className:`text-neutral-100`,children:X.help.controlLabels.shiftDrag}),` `,`— `,X.help.controls.shiftDrag]}),(0,Z.jsxs)(`li`,{children:[(0,Z.jsx)(`strong`,{className:`text-neutral-100`,children:X.help.controlLabels.scrollPinch}),` `,`— `,X.help.controls.scrollPinch]}),(0,Z.jsxs)(`li`,{children:[(0,Z.jsx)(`strong`,{className:`text-neutral-100`,children:X.help.controlLabels.clickEdge}),` `,`— `,X.help.controls.clickEdge]}),(0,Z.jsxs)(`li`,{children:[(0,Z.jsx)(`strong`,{className:`text-neutral-100`,children:X.help.controlLabels.doubleClickEdge}),` `,`— `,X.help.controls.doubleClickEdge]}),(0,Z.jsxs)(`li`,{children:[(0,Z.jsx)(`strong`,{className:`text-neutral-100`,children:X.help.controlLabels.dragVertex}),` `,`— `,X.help.controls.dragVertex]}),(0,Z.jsxs)(`li`,{children:[(0,Z.jsx)(`strong`,{className:`text-neutral-100`,children:X.help.controlLabels.selectEdgeTapVertex}),` `,`— `,X.help.controls.selectEdgeTapVertex]})]}),(0,Z.jsx)(`p`,{className:`mt-3 text-xs text-neutral-500`,children:X.help.intersectionHint}),(0,Z.jsx)(d,{className:`fill-neutral-900`})]})})]})});export{Pt as Stereometry};