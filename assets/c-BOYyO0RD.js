import{r as e}from"./c-BlVx34DW.js";import{F as t,I as n,M as r,P as i,t as a}from"./c-CE-6D_Ho.js";import{_ as o,d as s,g as c,h as l,m as u,p as d,v as f}from"./c-C5H0VhIF.js";import{i as p,n as m,r as h,t as g}from"./c-DP0tl3jn.js";import{t as _}from"./c-C8dC3tvw.js";import{a as v,i as y,n as b,r as x,t as S}from"./c-C3PoB8Fr.js";import{n as C,t as w}from"./c-Dhbp9WuA.js";import{t as T}from"./c-79FAfWPB.js";var E=p(`move`,[[`path`,{d:`M12 2v20`,key:`t6zp3m`}],[`path`,{d:`m15 19-3 3-3-3`,key:`11eu04`}],[`path`,{d:`m19 9 3 3-3 3`,key:`1mg7y2`}],[`path`,{d:`M2 12h20`,key:`9i4pu4`}],[`path`,{d:`m5 9-3 3 3 3`,key:`j64kie`}],[`path`,{d:`m9 5 3-3 3 3`,key:`l8vdw6`}]]),D=p(`redo-2`,[[`path`,{d:`m15 14 5-5-5-5`,key:`12vg1m`}],[`path`,{d:`M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13`,key:`6uklza`}]]),O=p(`rotate-ccw`,[[`path`,{d:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`1357e3`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}]]),k=e(t(),1),A=`/**
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
`,j=`struct Uniforms {
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
`,M=`struct Uniforms {
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
`,ee=.005,te=.003,ne=.01,re=Math.PI/3,ie=.95,ae=.1,oe=.1,se=Math.PI/4,ce=.1,le=Math.tan(se/2),ue={r:.1,g:.1,b:.12,a:1},de=1e3,fe=2.5,pe=3.5,me=.3,he=[.4,.75,1],ge=[1,.6,0],N=1e3;function _e(e){let{vertices:t,edges:n,faces:r}=e,i=ye(r,n),{faceTriangles:a,triangleFaceIndex:o}=be(r);return{vertices:t,edges:n,faces:r,faceEdges:i,faceTriangles:a,triangleFaceIndex:o}}function ve(e){let{vertices:t,edges:n}=e,r=new Float32Array(n.length*6);for(let e=0;e<n.length;e++){let[i,a]=n[e],o=t[i],s=t[a],c=e*6;r[c]=o[0],r[c+1]=o[1],r[c+2]=o[2],r[c+3]=s[0],r[c+4]=s[1],r[c+5]=s[2]}let{faceTriangles:i}=e,a=i.length*3,o=new Float32Array(a*3),s=0;for(let[e,n,r]of i)P(o,s,t[e]),P(o,s+1,t[n]),P(o,s+2,t[r]),s+=3;return{edgeInstances:r,edgeCount:n.length,facePositions:o,faceVertexCount:a}}function ye(e,t){return e.map(e=>{let n=new Set(e),r=[];for(let e=0;e<t.length;e++){let[i,a]=t[e];n.has(i)&&n.has(a)&&r.push(e)}return r})}function be(e){let t=[],n=[];for(let r=0;r<e.length;r++){let i=e[r];if(i.length<3)continue;let a=i[0];for(let e=1;e<i.length-1;e++)t.push([a,i[e],i[e+1]]),n.push(r)}return{faceTriangles:t,triangleFaceIndex:n}}function P(e,t,n){let r=t*3;e[r]=n[0],e[r+1]=n[1],e[r+2]=n[2]}function F(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function I(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function xe(e,t){return(e[0]-t[0])**2+(e[1]-t[1])**2+(e[2]-t[2])**2}function Se(e){return Math.sqrt(e[0]*e[0]+e[1]*e[1]+e[2]*e[2])}function Ce(e,t){let n=F(t,e),r=Se(n);if(r!==0)return[n[0]/r,n[1]/r,n[2]/r]}function L(e,t){let n=Ce(e,t);return n===void 0?[[e[0],e[1],e[2]],[t[0],t[1],t[2]]]:[[e[0]-n[0]*N,e[1]-n[1]*N,e[2]-n[2]*N],[t[0]+n[0]*N,t[1]+n[1]*N,t[2]+n[2]*N]]}function we(e,t){let n=Ce(e,t);return n===void 0?[[e[0],e[1],e[2]],[e[0],e[1],e[2]],[t[0],t[1],t[2]],[t[0],t[1],t[2]]]:[[e[0]-n[0]*N,e[1]-n[1]*N,e[2]-n[2]*N],[e[0],e[1],e[2]],[t[0],t[1],t[2]],[t[0]+n[0]*N,t[1]+n[1]*N,t[2]+n[2]*N]]}function Te(e,t,n){for(let r of t)if(xe(e,r)<n)return!0;return!1}var R=`depth24plus`,Ee=1,z=4,B=4,V=6*z,De=0,Oe=3*z,ke=B,H=2,Ae=3,U=Ae*z,W=z,G=1e-6,je=3*z,Me=96,Ne=0,Pe=64,Fe=80,Ie=92,Le=6,Re=1,ze=class{device;format;depthFacesPipeline;visibleEdgePipeline;hiddenEdgePipeline;visibleLinePipeline;hiddenLinePipeline;selectionMarkerPipeline;persistentMarkerPipeline;previewEdgePipeline;bindGroup;previewBindGroup;uniformBuffer;previewUniformBuffer;edgeInstanceBuffer;faceVertexBuffer;highlightFlagBuffer;lineInstanceBuffer;lineHighlightBuffer;topologyVertexMarkerBuffer;topologyVertexBrightnessBuffer;userSegmentInstanceBuffer;userSegmentHighlightBuffer;previewLineBuffer;previewLineHighlightBuffer;previewStartMarkerBuffer;previewStartBrightnessBuffer;previewSnapMarkerBuffer;previewSnapBrightnessBuffer;edgeCount=0;faceVertexCount=0;depthTexture=null;lastMvpMatrix=new Float32Array(16);extendedLineCount=0;extendedEdgeIndexList=[];selectedEdgeIndex=null;selectedUserSegmentIndex=null;userSegmentCount=0;topologyVertexCount=0;allVertexPositions=[];hasDragPreview=!1;hasSnapTarget=!1;lastCanvasWidth=0;lastCanvasHeight=0;lastDevicePixelRatio=1;constructor(e,t,n){this.camera=e,this.msaaManager=t,this.topology=n}init(e){this.device=e.device,this.format=e.format;let t=ve(this.topology);this.edgeCount=t.edgeCount,this.faceVertexCount=t.faceVertexCount,this.edgeInstanceBuffer=this.createAndWriteBuffer(t.edgeInstances,GPUBufferUsage.VERTEX),this.faceVertexBuffer=this.createAndWriteBuffer(t.facePositions,GPUBufferUsage.VERTEX),this.highlightFlagBuffer=this.device.createBuffer({size:this.edgeCount*B,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.lineInstanceBuffer=this.device.createBuffer({size:this.edgeCount*H*V,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let n=this.edgeCount*(this.edgeCount-1)/2,r=this.topology.vertices.length+n;this.topologyVertexMarkerBuffer=this.device.createBuffer({size:r*U,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.topologyVertexBrightnessBuffer=this.device.createBuffer({size:r*W,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let i=n;this.userSegmentInstanceBuffer=this.device.createBuffer({size:Math.max(V,i*V),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.userSegmentHighlightBuffer=this.device.createBuffer({size:Math.max(B,i*B),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.lineHighlightBuffer=this.device.createBuffer({size:this.edgeCount*H*B,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewLineBuffer=this.device.createBuffer({size:V,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewLineHighlightBuffer=this.device.createBuffer({size:B,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.previewLineHighlightBuffer,0,new Uint32Array([1])),this.previewStartMarkerBuffer=this.device.createBuffer({size:U,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewStartBrightnessBuffer=this.device.createBuffer({size:W,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.previewStartBrightnessBuffer,0,new Float32Array([1])),this.previewSnapMarkerBuffer=this.device.createBuffer({size:U,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewSnapBrightnessBuffer=this.device.createBuffer({size:W,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.previewSnapBrightnessBuffer,0,new Float32Array([1])),this.uniformBuffer=this.device.createBuffer({size:Me,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.uniformBuffer,Fe,new Float32Array(he)),this.device.queue.writeBuffer(this.uniformBuffer,Ie,new Float32Array([20])),this.previewUniformBuffer=this.device.createBuffer({size:Me,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.previewUniformBuffer,Fe,new Float32Array(ge)),this.device.queue.writeBuffer(this.previewUniformBuffer,Ie,new Float32Array([20]));let a=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.bindGroup=this.device.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]}),this.previewBindGroup=this.device.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:this.previewUniformBuffer}}]});let o=this.device.createPipelineLayout({bindGroupLayouts:[a]});this.depthFacesPipeline=this.createDepthFacesPipeline(o),this.visibleEdgePipeline=this.createEdgePipeline(o,{depthCompare:`less-equal`,depthWriteEnabled:!0,normalWidth:5,highlightWidth:7}),this.hiddenEdgePipeline=this.createEdgePipeline(o,{depthCompare:`greater`,depthWriteEnabled:!1,normalWidth:5,highlightWidth:7,brightness:me,dashLength:10,gapLength:10}),this.visibleLinePipeline=this.createEdgePipeline(o,{depthCompare:`less-equal`,depthWriteEnabled:!0,normalWidth:1,highlightWidth:3}),this.hiddenLinePipeline=this.createEdgePipeline(o,{depthCompare:`greater`,depthWriteEnabled:!1,normalWidth:fe,highlightWidth:pe,brightness:me,dashLength:10,gapLength:10}),this.selectionMarkerPipeline=this.createVertexMarkerPipeline(o,{depthCompare:`always`}),this.persistentMarkerPipeline=this.createVertexMarkerPipeline(o,{depthCompare:`always`,highlighted:!1,markerSize:6}),this.previewEdgePipeline=this.createEdgePipeline(o,{depthCompare:`always`,depthWriteEnabled:!1,normalWidth:5,highlightWidth:5})}update(e){this.camera.tick();let t=this.camera.getViewMatrix(),n=this.camera.getDistance(),r=e.canvasWidth/Math.max(Ee,e.canvasHeight),i=n*le,a=i*r,o=S.ortho(-a,a,-i,i,ce,100),s=S.multiply(o,t);this.lastMvpMatrix.set(s),this.lastCanvasWidth=e.canvasWidth,this.lastCanvasHeight=e.canvasHeight,this.lastDevicePixelRatio=e.devicePixelRatio,this.device.queue.writeBuffer(this.uniformBuffer,Ne,s);let c=new Float32Array([e.canvasWidth,e.canvasHeight]);this.device.queue.writeBuffer(this.uniformBuffer,Pe,c),this.device.queue.writeBuffer(this.previewUniformBuffer,Ne,s),this.device.queue.writeBuffer(this.previewUniformBuffer,Pe,c),this.updateMarkerBrightness()}render(e,t,r){let i=this.msaaManager.ensureView(this.device,this.format,r.canvasWidth,r.canvasHeight);if(n(i))return;let a=this.ensureDepthTexture(r.canvasWidth,r.canvasHeight),o=e.beginRenderPass({colorAttachments:[{view:i,resolveTarget:t,loadOp:`clear`,clearValue:ue,storeOp:`discard`}],depthStencilAttachment:{view:a.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});o.setPipeline(this.depthFacesPipeline),o.setBindGroup(0,this.bindGroup),o.setVertexBuffer(0,this.faceVertexBuffer),o.draw(this.faceVertexCount),o.setPipeline(this.hiddenEdgePipeline),o.setVertexBuffer(0,this.edgeInstanceBuffer),o.setVertexBuffer(1,this.highlightFlagBuffer),o.draw(6,this.edgeCount),this.userSegmentCount>0&&(o.setPipeline(this.hiddenLinePipeline),o.setVertexBuffer(0,this.userSegmentInstanceBuffer),o.setVertexBuffer(1,this.userSegmentHighlightBuffer),o.draw(6,this.userSegmentCount)),this.extendedLineCount>0&&(o.setPipeline(this.hiddenLinePipeline),o.setVertexBuffer(0,this.lineInstanceBuffer),o.setVertexBuffer(1,this.lineHighlightBuffer),o.draw(6,this.extendedLineCount)),o.setPipeline(this.visibleEdgePipeline),o.setVertexBuffer(0,this.edgeInstanceBuffer),o.setVertexBuffer(1,this.highlightFlagBuffer),o.draw(6,this.edgeCount),this.userSegmentCount>0&&(o.setPipeline(this.visibleLinePipeline),o.setVertexBuffer(0,this.userSegmentInstanceBuffer),o.setVertexBuffer(1,this.userSegmentHighlightBuffer),o.draw(6,this.userSegmentCount)),this.extendedLineCount>0&&(o.setPipeline(this.visibleLinePipeline),o.setVertexBuffer(0,this.lineInstanceBuffer),o.setVertexBuffer(1,this.lineHighlightBuffer),o.draw(6,this.extendedLineCount)),this.topologyVertexCount>0&&(o.setPipeline(this.persistentMarkerPipeline),o.setVertexBuffer(0,this.topologyVertexMarkerBuffer),o.setVertexBuffer(1,this.topologyVertexBrightnessBuffer),o.draw(Le,this.topologyVertexCount)),this.hasDragPreview&&(o.setPipeline(this.previewEdgePipeline),o.setBindGroup(0,this.previewBindGroup),o.setVertexBuffer(0,this.previewLineBuffer),o.setVertexBuffer(1,this.previewLineHighlightBuffer),o.draw(6,1),o.setPipeline(this.selectionMarkerPipeline),o.setVertexBuffer(0,this.previewStartMarkerBuffer),o.setVertexBuffer(1,this.previewStartBrightnessBuffer),o.draw(Le,1),o.setBindGroup(0,this.bindGroup)),this.hasSnapTarget&&(o.setPipeline(this.selectionMarkerPipeline),o.setBindGroup(0,this.previewBindGroup),o.setVertexBuffer(0,this.previewSnapMarkerBuffer),o.setVertexBuffer(1,this.previewSnapBrightnessBuffer),o.draw(Le,1),o.setBindGroup(0,this.bindGroup)),o.end()}getLastMvpMatrix(){return this.lastMvpMatrix}setSelection(e){let t=new Uint32Array(this.edgeCount);switch(this.selectedEdgeIndex=null,this.selectedUserSegmentIndex=null,e.type){case`none`:break;case`edge`:this.selectedEdgeIndex=e.edgeIndex,t[e.edgeIndex]=1;break;case`line`:this.selectedEdgeIndex=e.edgeIndex,t[e.edgeIndex]=1;break;case`userSegment`:this.selectedUserSegmentIndex=e.userSegmentIndex;break;default:r(e)}this.device.queue.writeBuffer(this.highlightFlagBuffer,0,t),this.updateLineHighlights(),this.updateUserSegmentHighlights()}setDragPreview(e){if(n(e)){this.hasDragPreview=!1,this.hasSnapTarget=!1;return}let t=n(e.snapTargetPosition)?this.unprojectToVertexPlane(e.cursorScreenX,e.cursorScreenY,e.startPosition):e.snapTargetPosition;this.device.queue.writeBuffer(this.previewLineBuffer,0,new Float32Array([e.startPosition[0],e.startPosition[1],e.startPosition[2],t[0],t[1],t[2]])),this.hasDragPreview=!0,this.device.queue.writeBuffer(this.previewStartMarkerBuffer,0,new Float32Array(e.startPosition)),n(e.snapTargetPosition)?this.hasSnapTarget=!1:(this.device.queue.writeBuffer(this.previewSnapMarkerBuffer,0,new Float32Array(e.snapTargetPosition)),this.hasSnapTarget=!0)}applySceneState(e){this.applyTopologyVertices(e),this.applyExtendedSegments(e),this.applyUserSegments(e)}applyTopologyVertices(e){if(this.topologyVertexCount=e.vertices.length,this.allVertexPositions=e.vertices.map(e=>e.position),this.topologyVertexCount===0)return;let t=new Float32Array(this.topologyVertexCount*Ae);for(let n=0;n<this.topologyVertexCount;n++){let r=e.vertices[n].position,i=n*Ae;t[i]=r[0],t[i+1]=r[1],t[i+2]=r[2]}this.device.queue.writeBuffer(this.topologyVertexMarkerBuffer,0,t)}applyExtendedSegments(e){if(this.extendedEdgeIndexList=e.lines.map(e=>e.edgeIndex),this.extendedLineCount=this.extendedEdgeIndexList.length*H,this.extendedLineCount===0)return;let t=new Float32Array(this.extendedLineCount*6),n=0;for(let e of this.extendedEdgeIndexList){let[r,i]=this.computeEdgeHalves(e);t.set(r,n),n+=6,t.set(i,n),n+=6}this.device.queue.writeBuffer(this.lineInstanceBuffer,0,t),this.updateLineHighlights()}applyUserSegments(e){if(this.userSegmentCount=e.userSegments.length,this.userSegmentCount===0)return;let t=new Float32Array(this.userSegmentCount*6),n=new Uint32Array(this.userSegmentCount);for(let r=0;r<this.userSegmentCount;r++){let i=e.userSegments[r],a=this.computeFullExtendedLine(i.startPosition,i.endPosition);t.set(a,r*6),n[r]=0}this.device.queue.writeBuffer(this.userSegmentInstanceBuffer,0,t),this.device.queue.writeBuffer(this.userSegmentHighlightBuffer,0,n)}updateMarkerBrightness(){if(this.topologyVertexCount===0)return;let e=this.computeViewDirection(),t=new Float32Array(this.topologyVertexCount);for(let n=0;n<this.topologyVertexCount;n++){let r=this.allVertexPositions[n];t[n]=this.isVertexOccluded(e,r)?me:1}this.device.queue.writeBuffer(this.topologyVertexBrightnessBuffer,0,t)}computeViewDirection(){let e=this.camera.getViewMatrix();return[-e[2],-e[6],-e[10]]}isVertexOccluded(e,t){let n=[t[0]-e[0]*100,t[1]-e[1]*100,t[2]-e[2]*100];for(let t of this.topology.faceTriangles){let r=this.topology.vertices[t[0]],i=this.topology.vertices[t[1]],a=this.topology.vertices[t[2]],o=this.rayTriangleIntersect(n,e,r,i,a);if(o!==void 0&&o>G&&o<100-G)return!0}return!1}rayTriangleIntersect(e,t,n,r,i){let a=[r[0]-n[0],r[1]-n[1],r[2]-n[2]],o=[i[0]-n[0],i[1]-n[1],i[2]-n[2]],s=t[1]*o[2]-t[2]*o[1],c=t[2]*o[0]-t[0]*o[2],l=t[0]*o[1]-t[1]*o[0],u=a[0]*s+a[1]*c+a[2]*l;if(Math.abs(u)<G)return;let d=1/u,f=e[0]-n[0],p=e[1]-n[1],m=e[2]-n[2],h=(f*s+p*c+m*l)*d;if(h<0||h>1)return;let g=p*a[2]-m*a[1],_=m*a[0]-f*a[2],v=f*a[1]-p*a[0],y=(t[0]*g+t[1]*_+t[2]*v)*d;if(!(y<0||h+y>1))return(o[0]*g+o[1]*_+o[2]*v)*d}dispose(){this.uniformBuffer.destroy(),this.previewUniformBuffer.destroy(),this.edgeInstanceBuffer.destroy(),this.faceVertexBuffer.destroy(),this.highlightFlagBuffer.destroy(),this.lineInstanceBuffer.destroy(),this.lineHighlightBuffer.destroy(),this.topologyVertexMarkerBuffer.destroy(),this.topologyVertexBrightnessBuffer.destroy(),this.userSegmentInstanceBuffer.destroy(),this.userSegmentHighlightBuffer.destroy(),this.previewLineBuffer.destroy(),this.previewLineHighlightBuffer.destroy(),this.previewStartMarkerBuffer.destroy(),this.previewStartBrightnessBuffer.destroy(),this.previewSnapMarkerBuffer.destroy(),this.previewSnapBrightnessBuffer.destroy(),this.depthTexture?.destroy()}unprojectToVertexPlane(e,t,n){let r=this.lastCanvasWidth,i=this.lastCanvasHeight,a=this.lastDevicePixelRatio,o=e*a,s=t*a,c=o/r*2-1,l=1-s/i*2,u=x.transformMat4(x.fromValues(n[0],n[1],n[2],Re),this.lastMvpMatrix),d=u[2]/u[3],f=S.inverse(this.lastMvpMatrix),p=x.transformMat4(x.fromValues(c,l,d,Re),f);return[p[0]/p[3],p[1]/p[3],p[2]/p[3]]}updateLineHighlights(){if(this.extendedLineCount===0)return;let e=new Uint32Array(this.extendedLineCount);for(let t=0;t<this.extendedEdgeIndexList.length;t++){let n=this.extendedEdgeIndexList[t]===this.selectedEdgeIndex?1:0,r=t*H;e[r]=n,e[r+1]=n}this.device.queue.writeBuffer(this.lineHighlightBuffer,0,e)}updateUserSegmentHighlights(){if(this.userSegmentCount===0)return;let e=new Uint32Array(this.userSegmentCount);for(let t=0;t<this.userSegmentCount;t++)e[t]=t===this.selectedUserSegmentIndex?1:0;this.device.queue.writeBuffer(this.userSegmentHighlightBuffer,0,e)}computeEdgeHalves(e){let[t,n]=this.topology.edges[e],[r,i,a,o]=we(this.topology.vertices[t],this.topology.vertices[n]);return[new Float32Array([...r,...i]),new Float32Array([...a,...o])]}computeFullExtendedLine(e,t){let[n,r]=L(e,t);return new Float32Array([...n,...r])}createAndWriteBuffer(e,t){let n=this.device.createBuffer({size:e.byteLength,usage:t|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(n,0,e),n}createDepthFacesPipeline(e){let t=this.device.createShaderModule({code:A});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:je,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format,writeMask:0}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:R,depthBias:2,depthBiasSlopeScale:1},multisample:{count:4}})}createEdgePipeline(e,t){let n=this.device.createShaderModule({code:j}),r={2:t.brightness??1};return t.dashLength!==void 0&&(r[3]=t.dashLength),t.gapLength!==void 0&&(r[4]=t.gapLength),this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,constants:{0:t.normalWidth,1:t.highlightWidth},buffers:[{arrayStride:V,stepMode:`instance`,attributes:[{shaderLocation:0,offset:De,format:`float32x3`},{shaderLocation:1,offset:Oe,format:`float32x3`}]},{arrayStride:ke,stepMode:`instance`,attributes:[{shaderLocation:2,offset:0,format:`uint32`}]}]},fragment:{module:n,entryPoint:`fs`,targets:[{format:this.format}],constants:r},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:t.depthWriteEnabled,depthCompare:t.depthCompare,format:R},multisample:{count:4}})}createVertexMarkerPipeline(e,t){let n=this.device.createShaderModule({code:M}),r={};return t.markerSize!==void 0&&(r[1]=t.markerSize),this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,constants:Object.keys(r).length>0?r:void 0,buffers:[{arrayStride:U,stepMode:`instance`,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]},{arrayStride:W,stepMode:`instance`,attributes:[{shaderLocation:1,offset:0,format:`float32`}]}]},fragment:{module:n,entryPoint:`fs`,targets:[{format:this.format}],constants:{0:t.highlighted??!0?1:0}},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:t.depthCompare,format:R},multisample:{count:4}})}ensureDepthTexture(e,t){return!n(this.depthTexture)&&this.depthTexture.width===e&&this.depthTexture.height===t?this.depthTexture:(this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(Ee,e),Math.max(Ee,t)],format:R,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthTexture)}},Be=1,Ve=1.5,K=5,He=Ve/2;function Ue(){let e=[];for(let t=0;t<K;t++){let n=2*Math.PI*t/K;e.push([Be*Math.sin(n),-He,Be*Math.cos(n)])}return e}var We=Ue(),Ge=[0,Ve-He,0],Ke=[...We,Ge],qe=K,Je=Array.from({length:K},(e,t)=>[t,(t+1)%K]),Ye=Array.from({length:K},(e,t)=>[t,qe]),Xe=Array.from({length:K},(e,t)=>[qe,t,(t+1)%K]),Ze=Array.from({length:K},(e,t)=>t),Qe={name:`Pentagonal Pyramid`,vertices:Ke,edges:[...Je,...Ye],faces:[...Xe,Ze]};function $e(e){let{canvas:t,context:n,layerManager:r}=e,{device:i,canvasContext:a}=n,o=0,s=0,c=Math.max(1,window.devicePixelRatio);function l(){c=Math.max(1,window.devicePixelRatio);let e=Math.floor(t.clientWidth*c),n=Math.floor(t.clientHeight*c);(t.width!==e||t.height!==n)&&(t.width=e,t.height=n),o=e,s=n}l();let u=new ResizeObserver(()=>{l()});u.observe(t);let d=0,f=!1,p=performance.now();function m(){if(f)return;if(l(),o===0||s===0){d=requestAnimationFrame(m);return}let e={time:(performance.now()-p)/de,canvasWidth:o,canvasHeight:s,devicePixelRatio:c};r.updateAll(e);let t=a.getCurrentTexture().createView(),n=i.createCommandEncoder();r.renderAll(n,t,e),i.queue.submit([n.finish()]),d=requestAnimationFrame(m)}return d=requestAnimationFrame(m),()=>{f=!0,cancelAnimationFrame(d),u.disconnect()}}function et(e,t=[0,0,0]){let n=0,r=re,i=5,a=5,o=[t[0],t[1],t[2]],s=`rotate`,c=0,l=0,u=0;function d(){return[o[0]+Math.sin(r)*Math.sin(n)*i,o[1]+Math.cos(r)*i,o[2]+Math.sin(r)*Math.cos(n)*i]}function f(){return[-Math.cos(r)*Math.sin(n),Math.sin(r),-Math.cos(r)*Math.cos(n)]}function p(){return[Math.cos(n),0,-Math.sin(n)]}function m(e){let r=-e*ee;n+=r;let i=o[0]-t[0],a=o[2]-t[2],s=Math.cos(r),c=Math.sin(r);o[0]=t[0]+i*s+a*c,o[2]=t[2]-i*c+a*s}function h(e,t){let n=te*i,r=p();o[0]-=r[0]*e*n,o[1]+=t*n,o[2]-=r[2]*e*n}function g(e){return Math.max(3,Math.min(15,e))}function _(){c=0,l=0,u=0}let v=!1,y=0,x=0,C=!1;function w(e){v=!0,y=e.clientX,x=e.clientY,C=e.shiftKey}function T(e){if(!v)return;let t=e.clientX-y,n=e.clientY-x;y=e.clientX,x=e.clientY,C||s===`pan`?(l=t,u=n,c=0,h(t,n)):(c=t,l=0,u=0,m(t))}function E(){v=!1,C=!1}function D(e){e.preventDefault(),a=g(a*(1+e.deltaY*ne))}e.addEventListener(`mousedown`,w),window.addEventListener(`mousemove`,T),window.addEventListener(`mouseup`,E),e.addEventListener(`wheel`,D,{passive:!1});let O=0,k=0,A=!1,j=0;function M(e){let t=e.touches[0].clientX-e.touches[1].clientX,n=e.touches[0].clientY-e.touches[1].clientY;return Math.sqrt(t*t+n*n)}function se(e){e.touches.length===1?(A=!0,O=e.touches[0].clientX,k=e.touches[0].clientY):e.touches.length===2&&(A=!1,j=M(e))}function ce(e){if(e.preventDefault(),e.touches.length===2){let t=M(e),n=j/t;a=g(a*n),j=t;return}if(!A||e.touches.length!==1)return;let t=e.touches[0].clientX-O,n=e.touches[0].clientY-k;O=e.touches[0].clientX,k=e.touches[0].clientY,s===`pan`?(l=t,u=n,c=0,h(t,n)):(c=t,l=0,u=0,m(t))}function le(e){e.touches.length===0?A=!1:e.touches.length===1&&(A=!0,O=e.touches[0].clientX,k=e.touches[0].clientY)}return e.addEventListener(`touchstart`,se,{passive:!0}),e.addEventListener(`touchmove`,ce,{passive:!1}),e.addEventListener(`touchend`,le),{tick(){let e=a-i;if(Math.abs(e)>.001?i+=e*oe:i=a,v||A)return;let t=Math.abs(c)>=ae,n=Math.abs(l)>=.1||Math.abs(u)>=.1;if(!t&&!n){_();return}t&&(m(c),c*=ie),n&&(h(l,u),l*=ie,u*=ie)},getViewMatrix(){let e=d(),t=f();return S.lookAt(b.fromValues(e[0],e[1],e[2]),b.fromValues(o[0],o[1],o[2]),b.fromValues(t[0],t[1],t[2]))},getEyePosition(){return d()},getDistance(){return i},setInteractionMode(e){s=e,_()},destroy(){e.removeEventListener(`mousedown`,w),window.removeEventListener(`mousemove`,T),window.removeEventListener(`mouseup`,E),e.removeEventListener(`wheel`,D),e.removeEventListener(`touchstart`,se),e.removeEventListener(`touchmove`,ce),e.removeEventListener(`touchend`,le)}}}function tt(e,t,n){let r=0,i=0,a=0,o=!1,s=0,c=0,l=0;function u(e,t){let n=Math.abs(e-r),o=Math.abs(t-i),s=performance.now()-a;return n<3&&o<3&&s<300}function d(e,r){let i=performance.now(),a=i-l,o=Math.sqrt((e-s)**2+(r-c)**2);a<400&&o<10?(n(e,r),l=0):(t(e,r),s=e,c=r,l=i)}function f(e){r=e.clientX,i=e.clientY,a=performance.now(),o=!0}function p(t){if(o&&(o=!1,u(t.clientX,t.clientY))){let n=e.getBoundingClientRect();d(t.clientX-n.left,t.clientY-n.top)}}function m(e){if(e.touches.length!==1){o=!1;return}r=e.touches[0].clientX,i=e.touches[0].clientY,a=performance.now(),o=!0}function h(t){if(!o||(o=!1,t.changedTouches.length!==1))return;let n=t.changedTouches[0];if(u(n.clientX,n.clientY)){let t=e.getBoundingClientRect();d(n.clientX-t.left,n.clientY-t.top)}}return e.addEventListener(`mousedown`,f),window.addEventListener(`mouseup`,p),e.addEventListener(`touchstart`,m,{passive:!0}),e.addEventListener(`touchend`,h),()=>{e.removeEventListener(`mousedown`,f),window.removeEventListener(`mouseup`,p),e.removeEventListener(`touchstart`,m),e.removeEventListener(`touchend`,h)}}function nt(e,t){let n=!1,r=[0,0,0];function i(t,n){let r=e.getBoundingClientRect();return{screenX:t-r.left,screenY:n-r.top}}function a(e,t){return e[0]===t[0]&&e[1]===t[1]&&e[2]===t[2]}function o(e,a){let{screenX:o,screenY:s}=i(e,a),c=t.performPointHitTest(o,s);return c===void 0?!1:(n=!0,r=c,t.onDragStart(),t.onDragUpdate({startPosition:r,cursorScreenX:o,cursorScreenY:s,snapTargetPosition:void 0}),!0)}function s(e,n){let{screenX:o,screenY:s}=i(e,n),c=t.performPointHitTest(o,s);t.onDragUpdate({startPosition:r,cursorScreenX:o,cursorScreenY:s,snapTargetPosition:c!==void 0&&!a(c,r)?c:void 0})}function c(e,o){let{screenX:s,screenY:c}=i(e,o),l=t.performPointHitTest(s,c);l!==void 0&&!a(l,r)?t.onDragComplete(r,l):t.onVertexTap(r),n=!1,t.onDragUpdate(void 0)}function l(e){o(e.clientX,e.clientY)&&e.stopPropagation()}function u(e){n&&s(e.clientX,e.clientY)}function d(e){n&&c(e.clientX,e.clientY)}function f(){n=!1,t.onDragUpdate(void 0)}function p(e){if(n){f(),e.stopPropagation();return}if(e.touches.length!==1)return;let t=e.touches[0];o(t.clientX,t.clientY)&&e.stopPropagation()}function m(e){if(!n||e.touches.length!==1)return;e.preventDefault();let t=e.touches[0];s(t.clientX,t.clientY)}function h(e){if(!n)return;if(e.changedTouches.length!==1){f();return}let t=e.changedTouches[0];c(t.clientX,t.clientY)}return e.addEventListener(`mousedown`,l,{capture:!0}),window.addEventListener(`mousemove`,u),window.addEventListener(`mouseup`,d),e.addEventListener(`touchstart`,p,{capture:!0}),e.addEventListener(`touchmove`,m,{passive:!1}),e.addEventListener(`touchend`,h),()=>{e.removeEventListener(`mousedown`,l,{capture:!0}),window.removeEventListener(`mousemove`,u),window.removeEventListener(`mouseup`,d),e.removeEventListener(`touchstart`,p,{capture:!0}),e.removeEventListener(`touchmove`,m),e.removeEventListener(`touchend`,h)}}var rt=100;function it(){let e=[],t=[];return{push(n){e.push(n),t.length=0,e.length>rt&&e.shift()},undo(n){let r=e.pop();if(r!==void 0)return t.push(n),r},redo(n){let r=t.pop();if(r!==void 0)return e.push(n),r},canUndo(){return e.length>0},canRedo(){return t.length>0}}}var q={type:`none`},at=1;function ot(e,t,r,i,a,o,s,c,l){let u=r*a,d=i*a,f=e*a,p=t*a,m=(10*a)**2,h=J(o,s.vertices,u,d),g=dt(f,p,m,s.edges.map(([e,t])=>({start:h[e],end:h[t]})));if(!n(g))return{type:`edge`,edgeIndex:g};if(c.length>0){let e=dt(f,p,m,ct(o,s,c,u,d));if(!n(e))return{type:`line`,edgeIndex:c[e]}}if(l.length>0){let e=dt(f,p,m,lt(o,l,u,d));if(!n(e))return{type:`userSegment`,userSegmentIndex:e}}return q}function st(e,t,n,r,i,a,o){let s=n*i,c=r*i;return ut(e*i,t*i,i,J(a,o,s,c))}function J(e,t,n,r){return t.map(t=>{let i=x.transformMat4(x.fromValues(t[0],t[1],t[2],at),e);if(i[3]<=0)return{screenX:0,screenY:0,behindCamera:!0};let a=i[0]/i[3],o=i[1]/i[3];return{screenX:(a+1)*.5*n,screenY:(1-o)*.5*r,behindCamera:!1}})}function ct(e,t,n,r,i){return n.map(n=>{let[a,o]=t.edges[n],[s,c]=L(t.vertices[a],t.vertices[o]),l=J(e,[s,c],r,i);return{start:l[0],end:l[1]}})}function lt(e,t,n,r){return t.map(t=>{let[i,a]=L(t.startPosition,t.endPosition),o=J(e,[i,a],n,r);return{start:o[0],end:o[1]}})}function ut(e,t,n,r){let i=(15*n)**2,a;for(let n=0;n<r.length;n++){let o=r[n];if(o.behindCamera)continue;let s=o.screenX-e,c=o.screenY-t,l=s*s+c*c;l<i&&(i=l,a=n)}return a}function dt(e,t,n,r){let i=n,a;for(let n=0;n<r.length;n++){let{start:o,end:s}=r[n];if(o.behindCamera||s.behindCamera)continue;let c=ft(e,t,o.screenX,o.screenY,s.screenX,s.screenY);c<i&&(i=c,a=n)}return a}function ft(e,t,n,r,i,a){let o=i-n,s=a-r,c=o*o+s*s;if(c===0){let i=e-n,a=t-r;return i*i+a*a}let l=Math.max(0,Math.min(1,((e-n)*o+(t-r)*s)/c)),u=n+l*o,d=r+l*s,f=e-u,p=t-d;return f*f+p*p}var pt=1e-10,mt=.001,ht=1e-4;function gt(e,t){let n=new Set(e.lines.map(e=>e.edgeIndex)),r=[];for(let n of e.lines)r.push(yt(n.edgeIndex,t));for(let t of e.userSegments)r.push({point:t.startPosition,direction:F(t.endPosition,t.startPosition)});let i=[],a=[];function o(e){e!==void 0&&(Te(e,t.vertices,mt)||Te(e,a,ht)||(i.push({position:e,sourceEdgeA:0,sourceEdgeB:0}),a.push(e)))}for(let e=0;e<r.length;e++){for(let t=e+1;t<r.length;t++)o(_t(r[e],r[t]));for(let i=0;i<t.edges.length;i++)n.has(i)||o(vt(r[e],yt(i,t)))}return i}function _t(e,t){return bt(e.point,e.direction,t.point,t.direction)?.midpoint}function vt(e,t){let n=bt(e.point,e.direction,t.point,t.direction);if(!(n===void 0||n.parameterB<0||n.parameterB>1))return n.midpoint}function yt(e,t){let[n,r]=t.edges[e],i=t.vertices[n],a=t.vertices[r];return{point:i,direction:F(a,i)}}function bt(e,t,n,r){let i=I(t,t),a=I(t,r),o=I(r,r),s=i*o-a*a;if(Math.abs(s)<pt)return;let c=F(e,n),l=I(t,c),u=I(r,c),d=(a*u-o*l)/s,f=(i*u-a*l)/s,p=[e[0]+d*t[0],e[1]+d*t[1],e[2]+d*t[2]],m=[n[0]+f*r[0],n[1]+f*r[1],n[2]+f*r[2]];if(!(xe(p,m)>.01**2))return{midpoint:[(p[0]+m[0])*.5,(p[1]+m[1])*.5,(p[2]+m[2])*.5],parameterB:f}}function xt(e){return{vertices:e.vertices.map((e,t)=>({position:e,topologyIndex:t})),segments:e.edges.map((e,t)=>({edgeIndex:t})),lines:[],userSegments:[],intersections:[]}}function St(e,t,n){let r=e.lines.some(e=>e.edgeIndex===t)?e.lines.filter(e=>e.edgeIndex!==t):[...e.lines,{edgeIndex:t}],i={...e,lines:r,intersections:[]},a=gt(i,n);return{...i,intersections:a,vertices:Ct(n,a)}}function Ct(e,t){let n=e.vertices.map((e,t)=>({position:e,topologyIndex:t})),r=t.map(e=>({position:e.position,topologyIndex:void 0}));return[...n,...r]}function wt(e,t,n,r){let i={...e,userSegments:[...e.userSegments,{startPosition:t,endPosition:n}],intersections:[]},a=gt(i,r);return{...i,intersections:a,vertices:Ct(r,a)}}function Tt(e){let t=!1,n,r=_e(Qe),i=et(e,[0,0,0]),a,o=xt(r),s=q,c=it(),l=new Set;function u(){for(let e of l)e(c.canUndo(),c.canRedo())}function d(e){c.push(o),o=e,a?.applySceneState(o),u()}function f(n,i){if(t||!a)return q;let s=e.clientWidth,c=e.clientHeight,l=Math.max(1,window.devicePixelRatio),u=o.lines.map(e=>e.edgeIndex);return ot(n,i,s,c,l,a.getLastMvpMatrix(),r,u,o.userSegments)}function p(n,r){if(t||!a)return;let i=e.clientWidth,s=e.clientHeight,c=Math.max(1,window.devicePixelRatio),l=o.vertices.map(e=>e.position),u=st(n,r,i,s,c,a.getLastMvpMatrix(),l);if(u!==void 0)return l[u]}function m(e){s=e,a?.setSelection(e)}function h(){switch(s.type){case`edge`:case`line`:{let[e,t]=r.edges[s.edgeIndex];return F(r.vertices[t],r.vertices[e])}case`userSegment`:{let e=o.userSegments[s.userSegmentIndex];return F(e.endPosition,e.startPosition)}case`none`:return}}function g(e,t){m(f(e,t))}function _(e,t){let n=f(e,t);n.type===`edge`&&d(St(o,n.edgeIndex,r))}let v=tt(e,g,_),y=nt(e,{performPointHitTest:p,onDragStart:()=>{},onDragUpdate:e=>{a?.setDragPreview(e)},onVertexTap:e=>{let t=h();if(t!==void 0){let n=[e[0]+t[0],e[1]+t[1],e[2]+t[2]];d(wt(o,e,n,r))}m(q)},onDragComplete:(e,t)=>{d(wt(o,e,t,r)),m(q)}});Et(e,i,r).then(({cleanup:e,pyramidLayer:r})=>{t?e():(n=e,a=r,r.applySceneState(o))});function b(e){e!==void 0&&(o=e,a?.applySceneState(o),m(q),u())}return{destroy:()=>{t=!0,i.destroy(),v(),y(),l.clear(),n?.()},camera:i,undo:()=>b(c.undo(o)),redo:()=>b(c.redo(o)),subscribeHistory:e=>(l.add(e),e(c.canUndo(),c.canRedo()),()=>l.delete(e))}}async function Et(e,t,n){let r=await v(e),i=C(4),a=new ze(t,i,n),o=new y([a]);o.initAll(r);let s=$e({canvas:e,context:r,layerManager:o});return{cleanup:()=>{s(),o.dispose(),i.dispose(),r.device.destroy()},pyramidLayer:a}}var Y=a({en:{toolbar:{undo:`Undo`,redo:`Redo`,rotate:`Rotate`,pan:`Pan`,help:`Help`,close:`Close`},help:{title:`Stereometry`,description:`Interactive 3D geometry game — construct auxiliary lines, find intersection points of lines and faces, and build cross-sections of solids.`,controls:{drag:`rotate the camera`,shiftDrag:`pan the view`,scrollPinch:`zoom in and out`,clickEdge:`select it`,doubleClickEdge:`extend edge into an infinite line`,dragVertex:`draw a construction line between two points`,selectEdgeTapVertex:`draw a parallel line through that vertex`},controlLabels:{drag:`Drag`,shiftDrag:`Shift+Drag`,scrollPinch:`Scroll / Pinch`,clickEdge:`Click edge/line`,doubleClickEdge:`Double-click edge`,dragVertex:`Drag vertex → vertex`,selectEdgeTapVertex:`Select edge/line + tap vertex`},intersectionHint:`Intersection points appear automatically where lines cross.`}},ru:{toolbar:{undo:`Отменить`,redo:`Повторить`,rotate:`Вращение`,pan:`Перемещение`,help:`Справка`,close:`Закрыть`},help:{title:`Стереометрия`,description:`Интерактивная 3D-игра по стереометрии — стройте вспомогательные линии, находите точки пересечения прямых и граней, выполняйте сечения фигур.`,controls:{drag:`вращение камеры`,shiftDrag:`перемещение вида`,scrollPinch:`приближение и отдаление`,clickEdge:`выделить ребро`,doubleClickEdge:`продлить ребро в бесконечную прямую`,dragVertex:`провести вспомогательную линию между двумя точками`,selectEdgeTapVertex:`провести параллельную прямую через эту вершину`},controlLabels:{drag:`Перетаскивание`,shiftDrag:`Shift+Перетаскивание`,scrollPinch:`Прокрутка / Щипок`,clickEdge:`Клик по ребру/линии`,doubleClickEdge:`Двойной клик по ребру`,dragVertex:`Перетащить вершину → вершину`,selectEdgeTapVertex:`Выделить ребро + нажать на вершину`},intersectionHint:`Точки пересечения появляются автоматически при пересечении линий.`}}}),X=i(),Z=20,Q=40,Dt=14,Ot=(0,k.memo)(()=>{let e=(0,k.useRef)(null),t=(0,k.useRef)(null),[n,r]=(0,k.useState)(`rotate`),[i,a]=(0,k.useState)(!1),[o,c]=(0,k.useState)(!1);(0,k.useEffect)(()=>{if(e.current){let n=Tt(e.current);t.current=n;let r=n.subscribeHistory((e,t)=>{a(e),c(t)});return()=>{t.current=null,r(),n.destroy()}}},[]);let l=s(()=>{r(`rotate`),t.current?.camera.setInteractionMode(`rotate`)}),u=s(()=>{r(`pan`),t.current?.camera.setInteractionMode(`pan`)}),d=s(()=>{t.current?.undo()}),f=s(()=>{t.current?.redo()});return(0,X.jsx)(w,{className:T.fixedContainer,children:(0,X.jsxs)(`div`,{className:T.fixedContainer,children:[(0,X.jsx)(`canvas`,{ref:e,style:{width:`100%`,height:`100%`}}),(0,X.jsxs)(`div`,{className:`absolute bottom-4 right-4 flex gap-2`,children:[(0,X.jsx)(kt,{}),(0,X.jsx)($,{onClick:d,label:Y.toolbar.undo,disabled:!i,children:(0,X.jsx)(_,{size:Z})}),(0,X.jsx)($,{onClick:f,label:Y.toolbar.redo,disabled:!o,children:(0,X.jsx)(D,{size:Z})}),(0,X.jsx)($,{active:n===`rotate`,onClick:l,label:Y.toolbar.rotate,children:(0,X.jsx)(O,{size:Z})}),(0,X.jsx)($,{active:n===`pan`,onClick:u,label:Y.toolbar.pan,children:(0,X.jsx)(E,{size:Z})})]})]})})}),$=(0,k.memo)(({active:e=!1,disabled:t=!1,onClick:n,children:r,label:i})=>(0,X.jsx)(`button`,{type:`button`,onClick:n,disabled:t,"aria-label":i,"aria-pressed":e,className:g(`flex items-center justify-center rounded-lg shadow-lg`,`transition-all`,t?`bg-neutral-900 text-neutral-600 cursor-not-allowed`:`hover:scale-110 active:scale-95`,!t&&e&&`bg-blue-500 text-white`,!t&&!e&&`bg-neutral-800 text-neutral-400 hover:text-white`),style:{width:Q,height:Q},children:r})),kt=(0,k.memo)(()=>{let[e,t]=(0,k.useState)(!1);return(0,X.jsxs)(o,{open:e,onOpenChange:t,children:[(0,X.jsx)(f,{asChild:!0,children:(0,X.jsx)(`button`,{type:`button`,"aria-label":Y.toolbar.help,className:g(`flex items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,e?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),style:{width:Q,height:Q},children:(0,X.jsx)(h,{size:Z})})}),(0,X.jsx)(c,{children:(0,X.jsxs)(l,{side:`top`,sideOffset:8,align:`end`,className:g(`z-50 w-72 rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,X.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,X.jsx)(`span`,{className:`font-semibold text-white`,children:Y.help.title}),(0,X.jsx)(u,{"aria-label":Y.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,X.jsx)(m,{size:Dt})})]}),(0,X.jsx)(`p`,{className:`mb-3 text-neutral-400`,children:Y.help.description}),(0,X.jsxs)(`ul`,{className:`space-y-1.5 text-neutral-300`,children:[(0,X.jsxs)(`li`,{children:[(0,X.jsx)(`strong`,{className:`text-neutral-100`,children:Y.help.controlLabels.drag}),` —`,` `,Y.help.controls.drag]}),(0,X.jsxs)(`li`,{children:[(0,X.jsx)(`strong`,{className:`text-neutral-100`,children:Y.help.controlLabels.shiftDrag}),` `,`— `,Y.help.controls.shiftDrag]}),(0,X.jsxs)(`li`,{children:[(0,X.jsx)(`strong`,{className:`text-neutral-100`,children:Y.help.controlLabels.scrollPinch}),` `,`— `,Y.help.controls.scrollPinch]}),(0,X.jsxs)(`li`,{children:[(0,X.jsx)(`strong`,{className:`text-neutral-100`,children:Y.help.controlLabels.clickEdge}),` `,`— `,Y.help.controls.clickEdge]}),(0,X.jsxs)(`li`,{children:[(0,X.jsx)(`strong`,{className:`text-neutral-100`,children:Y.help.controlLabels.doubleClickEdge}),` `,`— `,Y.help.controls.doubleClickEdge]}),(0,X.jsxs)(`li`,{children:[(0,X.jsx)(`strong`,{className:`text-neutral-100`,children:Y.help.controlLabels.dragVertex}),` `,`— `,Y.help.controls.dragVertex]}),(0,X.jsxs)(`li`,{children:[(0,X.jsx)(`strong`,{className:`text-neutral-100`,children:Y.help.controlLabels.selectEdgeTapVertex}),` `,`— `,Y.help.controls.selectEdgeTapVertex]})]}),(0,X.jsx)(`p`,{className:`mt-3 text-xs text-neutral-500`,children:Y.help.intersectionHint}),(0,X.jsx)(d,{className:`fill-neutral-900`})]})})]})});export{Ot as Stereometry};