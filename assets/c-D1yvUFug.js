import{i as e}from"./c-Dd_uD5pT.js";import{$ as t,J as n,M as r,U as i,et as a,j as o,k as s,st as c}from"./c-DdXPcpX4.js";import{i as l}from"./c-DP_47kS8.js";import{t as u}from"./c-BPGH9ISs.js";import{n as d,t as f}from"./c-BvnrnbFa.js";import{t as p}from"./c-oJIZ8OgY.js";import{t as m}from"./c-CUoJvfzq.js";import{r as h}from"./e-byMUi2nT.js";import{c as g,l as _,n as v,u as y}from"./c-lJhJ9RNg.js";import{t as b}from"./c-Dq44MqJS.js";import{t as x}from"./c-DYB0KuWP.js";import{n as S}from"./c-BDdvXvP8.js";import{t as C}from"./c-EfPkFKRw.js";import{t as w}from"./c-09uwkeRn.js";import{t as T}from"./c--AaeBE8l.js";import{t as E}from"./c-D1cdsHD6.js";import{t as D}from"./c-JQa_l6qu.js";import{t as O}from"./c-D2HOHJwD.js";import{a as k,i as ee,n as te,o as ne,r as re,s as ie}from"./c-Xffp34B0.js";import{i as ae,n as oe,r as se,t as ce}from"./c-Bz4cfUfA.js";import{n as le,t as ue}from"./c-BTNSIE_w.js";import{n as de,r as A,t as j}from"./c-DTV00nEu.js";import{n as M,t as fe}from"./c-BmETuRJw.js";import{A as pe,B as me,C as he,D as ge,E as _e,F as N,I as ve,L as ye,M as be,N as xe,O as Se,P as Ce,R as we,S as Te,T as Ee,U as De,V as Oe,_ as P,a as ke,b as Ae,c as je,d as Me,f as F,g as I,h as Ne,i as Pe,j as Fe,k as Ie,l as Le,m as Re,n as L,o as ze,p as Be,r as Ve,s as He,t as Ue,u as We,v as R,w as Ge,x as Ke,y as qe,z as Je}from"./c-_pH1zAbE.js";var Ye=s(`move`,[[`path`,{d:`M12 2v20`,key:`t6zp3m`}],[`path`,{d:`m15 19-3 3-3-3`,key:`11eu04`}],[`path`,{d:`m19 9 3 3-3 3`,key:`1mg7y2`}],[`path`,{d:`M2 12h20`,key:`9i4pu4`}],[`path`,{d:`m5 9-3 3 3 3`,key:`j64kie`}],[`path`,{d:`m9 5 3-3 3 3`,key:`l8vdw6`}]]),Xe=s(`puzzle`,[[`path`,{d:`M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z`,key:`w46dr5`}]]),z=e(l(),1);function Ze(e,t,n){let r=he(t),{minDistance:i,maxDistance:a,elevation:o}=r,s=r.center,c=r.azimuth,l=r.initialDistance,u=r.initialDistance,d=[s[0],s[1],s[2]],f=0,p=0,m=0;function h(e){let t=-e*we;c+=t;let n=d[0]-s[0],r=d[2]-s[2],i=Math.cos(t),a=Math.sin(t);d[0]=s[0]+n*i+r*a,d[2]=s[2]-n*a+r*i}function g(e,t){let n=ye*l,r=Ae(c);d[0]-=r[0]*e*n,d[1]+=t*n,d[2]-=r[2]*e*n}function _(e){return Math.max(i,Math.min(a,e))}function v(){f=0,p=0,m=0}let y=!1,b=0;function x(e){y=e.shiftKey}function S(e,t){b=performance.now(),y||n()===`pan`?(p=e,m=t,f=0,g(e,t)):(f=e,p=0,m=0,h(e))}function C(e){u=_(u*e)}function w(e){u=_(u*(1+e*Je))}function T(){y=!1,performance.now()-b>80&&v()}function E(){y=!1,v()}let D=fe(e,{onDrag:S,onPinch:C,onWheel:w,onReset:E,onGestureStart:x,onGestureEnd:T});return{tick(){let e=Math.abs(u-l)>Oe;if(e?l+=(u-l)*me:l=u,D.hasActivePointers())return!0;let t=Math.abs(f)>=ve,n=Math.abs(p)>=.1||Math.abs(m)>=.1;return!t&&!n?(v(),e):(t&&(h(f),f*=N),n&&(g(p,m),p*=N,m*=N),!0)},getViewMatrix(){return Te(qe(d,c,o,l),d,Ke(c,o))},getEyePosition(){return qe(d,c,o,l)},getDistance(){return l},registerExternalPointer(e,t,n){D.registerExternalPointer(e,t,n)},destroy(){D.destroy()}}}function Qe(e,t,n){let r=0,i=0,a=0,o,s=0,c=0,l=0;function u(e,t){let n=Math.abs(e-r),o=Math.abs(t-i),s=performance.now()-a;return n<3&&o<3&&s<300}function d(e,r){let i=performance.now(),a=i-l,o=Math.sqrt((e-s)**2+(r-c)**2);n!==void 0&&a<400&&o<10?(n(e,r),l=0):(t(e,r),s=e,c=r,l=i)}function f(e){e.isPrimary&&(o=e.pointerId,r=e.clientX,i=e.clientY,a=performance.now())}function p(t){if(t.pointerId===o&&(o=void 0,u(t.clientX,t.clientY))){let n=e.getBoundingClientRect();d(t.clientX-n.left,t.clientY-n.top)}}function m(e){e.pointerId===o&&(o=void 0)}return e.addEventListener(`pointerdown`,f),window.addEventListener(`pointerup`,p),window.addEventListener(`pointercancel`,m),()=>{e.removeEventListener(`pointerdown`,f),window.removeEventListener(`pointerup`,p),window.removeEventListener(`pointercancel`,m)}}function $e(e,t){let n,r,i,a=0,o=0,s=0,c=0,l,u,d=0,f=0,p=0;function m(t,n){let r=e.getBoundingClientRect();return{screenX:t-r.left,screenY:n-r.top}}function h(e,t){return e[0]===t[0]&&e[1]===t[1]&&e[2]===t[2]}function g(e,t,n,r){return e.kind===`vertex`?{kind:`vertex`,startPosition:e.position,cursorScreenX:t,cursorScreenY:n,snapTargetPosition:r!==void 0&&!h(r,e.position)?r:void 0}:{kind:`line`,sourceDirection:e.direction,planeAnchor:e.planeAnchor,cursorScreenX:t,cursorScreenY:n,snapTargetPosition:r}}function _(){l!==void 0&&(window.clearTimeout(l),l=void 0)}function v(e,i,a){let o=r;o!==void 0&&(_(),r=void 0,n=o,o.kind===`line`&&(u=void 0,t.onLineTap(o.lineId)),t.onDragStart?.(),t.onDragUpdate(g(o,e,i,a)))}function y(){let{screenX:e,screenY:t}=m(a,o);v(e,t,void 0)}function b(e,n,r){let i=performance.now(),a=i-d,o=Math.sqrt((n-f)**2+(r-p)**2);if(u===e&&a<400&&o<10){u=void 0,t.onLineDoubleTap(e);return}u=e,d=i,f=n,p=r,t.onLineTap(e)}function x(e){let{screenX:u,screenY:d}=m(e.clientX,e.clientY),f=t.performInitialHitTest(u,d);return f===void 0?!1:f.kind===`vertex`&&t.hasActiveSelection()?(t.onVertexTap(f.position),!0):(i=e.pointerId,a=e.clientX,o=e.clientY,s=e.clientX,c=e.clientY,f.kind===`vertex`?(n=f,t.onDragStart?.(),t.onDragUpdate(g(f,u,d,void 0))):(r=f,l=window.setTimeout(y,250)),!0)}function S(e,i){s=e,c=i;let{screenX:l,screenY:u}=m(e,i);if(r!==void 0){Math.max(Math.abs(e-a),Math.abs(i-o))>=3&&v(l,u,t.performSnapHitTest(l,u));return}if(n===void 0)return;let d=t.performSnapHitTest(l,u);t.onDragUpdate(g(n,l,u,d))}function C(e,a){if(r!==void 0){let t=r;_(),r=void 0,i=void 0,t.kind===`line`&&b(t.lineId,e,a);return}let o=n;if(o===void 0)return;let{screenX:s,screenY:c}=m(e,a),l=t.performSnapHitTest(s,c);if(n=void 0,i=void 0,t.onDragUpdate(void 0),o.kind===`vertex`){l!==void 0&&!h(l,o.position)?t.onDragComplete(o.position,l):t.onVertexTap(o.position);return}if(l===void 0)return;let u=[l[0]+o.direction[0],l[1]+o.direction[1],l[2]+o.direction[2]];t.onDragComplete(l,u)}function w(){_(),r=void 0,n=void 0,i=void 0,t.onDragUpdate(void 0)}function T(e){if(n!==void 0||r!==void 0){i!==void 0&&t.onSecondPointer(i,s,c),w();return}e.isPrimary&&x(e)&&e.stopPropagation()}function E(e){e.pointerId===i&&(n!==void 0||r!==void 0)&&S(e.clientX,e.clientY)}function D(e){e.pointerId===i&&(n!==void 0||r!==void 0)&&C(e.clientX,e.clientY)}function O(e){e.pointerId===i&&(n!==void 0||r!==void 0)&&w()}function k(){(n!==void 0||r!==void 0)&&w()}return e.addEventListener(`pointerdown`,T,{capture:!0}),window.addEventListener(`pointermove`,E),window.addEventListener(`pointerup`,D),window.addEventListener(`pointercancel`,O),window.addEventListener(`blur`,k),()=>{_(),e.removeEventListener(`pointerdown`,T,{capture:!0}),window.removeEventListener(`pointermove`,E),window.removeEventListener(`pointerup`,D),window.removeEventListener(`pointercancel`,O),window.removeEventListener(`blur`,k)}}var et=0,tt=1,nt=0,rt=1,it=3;function at(e){return e.markerType===`circle`?rt:nt}function ot(e){let t=e.line.type===`dashed`;return{width:e.width,color:I(e.color),alpha:e.alpha,lineType:t?tt:et,dash:e.line.type===`dashed`?e.line.dash:0,gap:e.line.type===`dashed`?e.line.gap:0}}function B(e){return{size:e.size,color:I(e.color),alpha:e.alpha,strokeColor:I(e.strokeColor),strokeWidth:e.strokeWidth}}function st(e){return[`hidden`,...e]}function ct(e){return{startPosition:e.startPosition,endPosition:e.endPosition,visibleStyle:ot(P(R,`line`,e.modifiers)),hiddenStyle:ot(P(R,`line`,st(e.modifiers))),lineId:e.lineId,startVertexIndex:e.startVertexIndex,endVertexIndex:e.endVertexIndex}}function lt(e){let t=P(R,`vertex`,e.modifiers),n=P(R,`vertex`,st(e.modifiers));return{position:e.position,markerType:at(t),visibleStyle:B(t),hiddenStyle:B(n),vertexIndex:e.vertexIndex}}function ut(e){let t=P(R,`face`,[`solution`]),[n,r,i]=I(t.color),a=new Float32Array(e.vertexCount*7);for(let o=0;o<e.vertexCount;o++){let s=o*it,c=o*7;a.set(e.positions.subarray(s,s+it),c),a[c+3]=n,a[c+4]=r,a[c+5]=i,a[c+6]=t.alpha}return{vertices:a,vertexCount:e.vertexCount}}function dt(e){return{segments:e.segments.map(ct),markers:e.markers.map(lt),solutionFace:e.solutionFace===void 0?void 0:ut(e.solutionFace)}}function ft(){let e=P(R,`vertex`,[`preview`]);return{markerType:at(e),...B(e)}}function pt(){let e=P(R,`line`,[`preview`]);return{width:e.width,color:I(e.color),alpha:e.alpha}}function mt(){let[e,t,n]=I(P(R,`background`,[]).color);return{r:e,g:t,b:n,a:1}}function ht(e,t,n,r,i){let a=n*t.devicePixelRatio,o=r*t.devicePixelRatio,s=a/t.canvasWidth*2-1,c=1-o/t.canvasHeight*2,l=A.transformMat4(A.fromValues(i[0],i[1],i[2],1),e),u=l[2]/l[3],d=A.transformMat4(A.fromValues(s,c,u,1),j.inverse(e));return[d[0]/d[3],d[1]/d[3],d[2]/d[3]]}var gt=GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,V=class{device;buffer;constructor(e,t){this.device=e,this.buffer=e.createBuffer({size:t,usage:gt})}get handle(){return this.buffer}write(e){e.byteLength>this.buffer.size&&(this.buffer.destroy(),this.buffer=this.device.createBuffer({size:e.byteLength,usage:gt})),this.device.queue.writeBuffer(this.buffer,0,e)}dispose(){this.buffer.destroy()}};function _t(e,t){if(e.kind===`vertex`){let n=c(e.snapTargetPosition)?t(e.cursorScreenX,e.cursorScreenY,e.startPosition):e.snapTargetPosition;return{pointA:e.startPosition,pointB:n}}let n=c(e.snapTargetPosition)?t(e.cursorScreenX,e.cursorScreenY,e.planeAnchor):e.snapTargetPosition;return{pointA:n,pointB:[n[0]+e.sourceDirection[0],n[1]+e.sourceDirection[1],n[2]+e.sourceDirection[2]]}}var vt=4,yt=[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`},{shaderLocation:2,offset:24,format:`float32`},{shaderLocation:3,offset:28,format:`float32x3`},{shaderLocation:4,offset:40,format:`float32`},{shaderLocation:5,offset:44,format:`float32`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32`},{shaderLocation:9,offset:60,format:`float32x3`},{shaderLocation:10,offset:72,format:`float32`},{shaderLocation:11,offset:76,format:`float32`},{shaderLocation:12,offset:80,format:`float32`},{shaderLocation:13,offset:84,format:`float32`}],bt=[...yt,{shaderLocation:14,offset:88,format:`float32`},{shaderLocation:15,offset:92,format:`float32`}],xt=[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32`},{shaderLocation:2,offset:16,format:`float32`},{shaderLocation:3,offset:20,format:`float32x3`},{shaderLocation:4,offset:32,format:`float32`},{shaderLocation:5,offset:36,format:`float32x3`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32x3`},{shaderLocation:9,offset:68,format:`float32`},{shaderLocation:10,offset:72,format:`float32x3`},{shaderLocation:11,offset:84,format:`float32`},{shaderLocation:12,offset:88,format:`float32`}],St=3*vt,Ct=[{shaderLocation:0,offset:0,format:`float32x3`}],wt=7*vt,Tt=[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}];function Et(e,t,n){e[t]=n.width,e[t+1]=n.color[0],e[t+2]=n.color[1],e[t+3]=n.color[2],e[t+4]=n.alpha,e[t+5]=n.lineType,e[t+6]=n.dash,e[t+7]=n.gap}function Dt(e,t,n,r){e.set(n,t),e.set(r,t+3)}function Ot(e){let t=new Float32Array(e.length*24);return e.forEach((e,n)=>{let r=n*24;Dt(t,r,e.startPosition,e.endPosition),Et(t,r+6,e.visibleStyle),Et(t,r+14,e.hiddenStyle),t[r+22]=e.startVertexIndex,t[r+23]=e.endVertexIndex}),t}function kt(e,t,n,r){Dt(e,0,t,n),e[6]=r.width,e[7]=r.color[0],e[8]=r.color[1],e[9]=r.color[2],e[10]=r.alpha}function At(e,t,n){e[t]=n.size,e[t+1]=n.color[0],e[t+2]=n.color[1],e[t+3]=n.color[2],e[t+4]=n.alpha,e[t+5]=n.strokeColor[0],e[t+6]=n.strokeColor[1],e[t+7]=n.strokeColor[2],e[t+8]=n.strokeWidth}function jt(e,t,n,r,i,a,o){e.set(n,t),e[t+3]=r,At(e,t+4,i),At(e,t+13,a),e[t+22]=o}function Mt(e){let t=new Float32Array(e.length*24);return e.forEach((e,n)=>{jt(t,n*24,e.position,e.markerType,e.visibleStyle,e.hiddenStyle,e.vertexIndex)}),t}function Nt(e,t,n){jt(e,0,t,n.markerType,n,n,0)}var H=GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,Pt=class{device;line;startMarker;snapMarker;lineStaging=new Float32Array(24);markerStaging=new Float32Array(24);lineStyle=pt();markerStyle=ft();previewLine=void 0;hasStartMarker=!1;hasSnapTarget=!1;constructor(e){this.device=e,this.line=e.createBuffer({size:96,usage:H}),this.startMarker=e.createBuffer({size:96,usage:H}),this.snapMarker=e.createBuffer({size:96,usage:H})}writeLine({pointA:e,pointB:t}){kt(this.lineStaging,e,t,this.lineStyle),this.device.queue.writeBuffer(this.line,0,this.lineStaging)}writeStartMarker(e){this.writeMarker(this.startMarker,e)}writeSnapMarker(e){this.writeMarker(this.snapMarker,e)}writeMarker(e,t){Nt(this.markerStaging,t,this.markerStyle),this.device.queue.writeBuffer(e,0,this.markerStaging)}apply(e,t){if(c(e)){this.previewLine=void 0,this.hasStartMarker=!1,this.hasSnapTarget=!1;return}let n=_t(e,t);this.previewLine=n,this.writeLine(n),this.hasStartMarker=e.kind===`vertex`,e.kind===`vertex`&&this.writeStartMarker(e.startPosition),this.hasSnapTarget=!c(e.snapTargetPosition),c(e.snapTargetPosition)||this.writeSnapMarker(e.snapTargetPosition)}dispose(){this.line.destroy(),this.startMarker.destroy(),this.snapMarker.destroy()}};function Ft(e,t,n,r,i){return{line:e.createBindGroup({layout:t.depthBindGroupLayout,entries:[{binding:0,resource:{buffer:n}},{binding:1,resource:i.faceDepth},{binding:2,resource:r}]}),marker:e.createBindGroup({layout:t.markerBindGroupLayout,entries:[{binding:0,resource:{buffer:n}},{binding:1,resource:i.faceDepth},{binding:2,resource:r},{binding:3,resource:i.lineEndpoint},{binding:4,resource:i.lineDepth}]})}}function It(e,t){return e!==void 0&&e.depth===t.depth&&e.faceDepth===t.faceDepth&&e.lineEndpoint===t.lineEndpoint&&e.lineDepth===t.lineDepth}var Lt=class{dirty=!0;projectionScratch=j.create();mvpScratch=j.create();lastMvpMatrix=new Float32Array(16);lastViewport={canvasWidth:0,canvasHeight:0,devicePixelRatio:1};get mvpMatrix(){return this.lastMvpMatrix}get viewport(){return this.lastViewport}markDirty(){this.dirty=!0}consumeDirty(){let e=this.dirty;return this.dirty=!1,e}advance(e,t,n,r){let i=t.getViewMatrix(),a=t.getDistance(),o=_e(ge(n,Se(e.canvasWidth,e.canvasHeight),a,this.projectionScratch),i,this.mvpScratch),s=e.canvasWidth!==this.lastViewport.canvasWidth||e.canvasHeight!==this.lastViewport.canvasHeight||e.devicePixelRatio!==this.lastViewport.devicePixelRatio;if((r||s||!Rt(this.lastMvpMatrix,o))&&(this.dirty=!0),this.dirty)return this.lastMvpMatrix.set(o),this.lastViewport={canvasWidth:e.canvasWidth,canvasHeight:e.canvasHeight,devicePixelRatio:e.devicePixelRatio},{mvpMatrix:o,viewMatrix:i,cameraDistance:a}}};function Rt(e,t){for(let n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0}var U=`struct Uniforms {
    mvp: mat4x4<f32>,
    viewport: vec2<f32>,
    dpr: f32,
    cameraDistance: f32,
    cameraForward: vec3<f32>,
    cameraTarget: vec3<f32>,
    depthFadeRate: f32,
    depthFadeMin: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

/** Number of vertices per quad (2 triangles = 6 vertices) */
const VERTICES_PER_QUAD: u32 = 6u;

/** Minimum w value for near-plane clipping (prevents behind-camera artifacts) */
const NEAR_CLIP_W: f32 = 0.01;

/** Maps vertex index (0..5) to quad corner index (0..3) */
fn quadCornerIndex(vertexIndex: u32) -> u32 {
    let cornerMap = array<u32, 6>(0u, 2u, 1u, 1u, 2u, 3u);
    return cornerMap[vertexIndex];
}

/** Decodes quad corner: returns (-1 or +1) for left/right side */
fn quadSideX(corner: u32) -> f32 {
    return f32(i32(corner & 1u)) * 2.0 - 1.0;
}

/** Decodes quad corner: returns (-1 or +1) for bottom/top side */
fn quadSideY(corner: u32) -> f32 {
    return f32(i32((corner >> 1u) & 1u)) * 2.0 - 1.0;
}

/** Converts a pixel offset to NDC offset, accounting for viewport size */
fn pixelsToNdc(pixels: vec2<f32>) -> vec2<f32> {
    return pixels / (uniforms.viewport * 0.5);
}

/** Scales a CSS-pixel size to GPU pixels using device pixel ratio */
fn cssToGpuPixels(cssSize: f32) -> f32 {
    return cssSize * uniforms.dpr;
}

/** Depth fade factor from a forward distance along the camera axis (camera-target space).
 *  Only fades objects behind the target (further from camera), not in front of it.
 *  Mirrored on the CPU by \`depthFadeAt\` in domain/solution-preview.ts for the SVG previews:
 *  change both together. */
fn depthFadeFromForwardDistance(forwardDistance: f32) -> f32 {
    let normalizedDepth = forwardDistance / uniforms.cameraDistance;
    return clamp(1.0 - normalizedDepth * uniforms.depthFadeRate, uniforms.depthFadeMin, 1.0);
}

/** Computes depth fade factor based on world-space distance from camera target. */
fn computeDepthFade(worldPosition: vec3<f32>) -> f32 {
    let toPoint = worldPosition - uniforms.cameraTarget;
    return depthFadeFromForwardDistance(dot(toPoint, uniforms.cameraForward));
}

/** Projected endpoints with the parametric positions they were clamped to */
struct ProjectedEndpoints {
    clipA: vec4<f32>,
    clipB: vec4<f32>,
    /** Position of clipA along the original A→B segment (0 unless near-plane clamped) */
    paramA: f32,
    /** Position of clipB along the original A→B segment (1 unless near-plane clamped) */
    paramB: f32,
};

/**
 * Projects both endpoints to clip space with near-plane clamping and reports
 * where on the original segment each projected endpoint sits. The parameters
 * let dash phases stay anchored to the world-space segment even when an
 * endpoint is clamped (the clamp point slides along the line as the camera moves).
 */
fn projectEndpointsWithParams(startPos: vec3<f32>, endPos: vec3<f32>) -> ProjectedEndpoints {
    let rawClipA = uniforms.mvp * vec4<f32>(startPos, 1.0);
    let rawClipB = uniforms.mvp * vec4<f32>(endPos, 1.0);

    var result: ProjectedEndpoints;
    result.clipA = rawClipA;
    result.clipB = rawClipB;
    result.paramA = 0.0;
    result.paramB = 1.0;

    if (rawClipA.w < NEAR_CLIP_W) {
        let parametricT = (NEAR_CLIP_W - rawClipA.w) / (rawClipB.w - rawClipA.w);
        result.clipA = mix(rawClipA, rawClipB, parametricT);
        result.paramA = parametricT;
    }
    if (rawClipB.w < NEAR_CLIP_W) {
        let parametricT = (NEAR_CLIP_W - rawClipB.w) / (rawClipA.w - rawClipB.w);
        result.clipB = mix(rawClipB, rawClipA, parametricT);
        result.paramB = 1.0 - parametricT;
    }
    return result;
}

/** Projects both endpoints to clip space with near-plane clamping */
fn projectEndpoints(startPos: vec3<f32>, endPos: vec3<f32>) -> array<vec4<f32>, 2> {
    let projected = projectEndpointsWithParams(startPos, endPos);
    return array<vec4<f32>, 2>(projected.clipA, projected.clipB);
}

/**
 * Scales a dash pattern so an integer number of dashes fits a segment of
 * totalLen, with a dash (not a gap) touching both endpoints:
 *   totalLen = n * (dash + gap) - gap
 * Segments shorter than one dash render fully solid. totalLen is constant
 * under camera motion (world units), so the fitted pattern is stable.
 */
fn fitDashPattern(dashLen: f32, gapLen: f32, totalLen: f32) -> vec2<f32> {
    if (dashLen <= 0.0 || gapLen <= 0.0 || totalLen <= 0.0) {
        return vec2<f32>(dashLen, gapLen);
    }
    let period = dashLen + gapLen;
    let dashCount = max(1.0, round((totalLen + gapLen) / period));
    let scale = totalLen / (dashCount * period - gapLen);
    return vec2<f32>(dashLen * scale, gapLen * scale);
}

/** Computes the perpendicular offset direction in screen space */
fn computeScreenPerp(screenA: vec2<f32>, screenB: vec2<f32>) -> vec2<f32> {
    let screenDir = screenB - screenA;
    let screenLen = length(screenDir);
    let safeDir = select(screenDir / screenLen, vec2<f32>(1.0, 0.0), screenLen < 0.001);
    return vec2<f32>(-safeDir.y, safeDir.x);
}

/** Result of projecting a fragment onto the line spine (segment A→B) */
struct SpineSample {
    /** Face-depth-texture UV at the spine point */
    uv: vec2<f32>,
    /** NDC depth at the spine point */
    depth: f32,
};

/**
 * Projects a fragment position onto the line spine and returns the depth-texture
 * UV plus the interpolated NDC depth at that spine point. Used by both the color
 * line pass and the line-id pass so their occlusion classification stays in sync.
 *
 * UV is derived from the screen-space spine position (exact, no perspective error).
 * Depth is a linear interpolation of NDC depths (mathematically correct for
 * screen-space t).
 *
 * IMPORTANT: endpoint depths must stay UNCLAMPED (z/w may legitimately be ≤ 0
 * for the near-plane-clamped end of a long line). Clamping z to 0 here corrupts
 * the screen-space linear depth interpolation along the whole line and
 * misclassifies lines passing in FRONT of faces as hidden once they leave the
 * face outline (regression history: "fix: fixed line visibility depth test").
 * The vertex stage clamps quad-corner z for rasterization only — that clamp
 * must not be repeated for the depth comparison.
 */
fn computeSpineSample(
    clipStart: vec4<f32>,
    clipEnd: vec4<f32>,
    fragmentPosition: vec4<f32>
) -> SpineSample {
    let halfViewport = uniforms.viewport * 0.5;
    let screenA = (clipStart.xy / clipStart.w) * halfViewport;
    let screenB = (clipEnd.xy / clipEnd.w) * halfViewport;
    // @builtin(position).y increases downward, but NDC Y increases upward — invert Y
    let fragmentScreen = vec2<f32>(
        fragmentPosition.x - halfViewport.x,
        halfViewport.y - fragmentPosition.y
    );

    let lineDir = screenB - screenA;
    let lineLenSq = dot(lineDir, lineDir);
    let parametricT = select(
        clamp(dot(fragmentScreen - screenA, lineDir) / lineLenSq, 0.0, 1.0),
        0.5,
        lineLenSq < 0.001
    );

    let spineScreen = screenA + parametricT * lineDir;
    let spineNdc = spineScreen / halfViewport;
    let depthA = clipStart.z / clipStart.w;
    let depthB = clipEnd.z / clipEnd.w;

    var result: SpineSample;
    result.uv = spineNdc * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);
    result.depth = mix(depthA, depthB, parametricT);
    return result;
}
`,zt=`/**
 * Minimal depth-only shader for rendering solid faces into the depth buffer.
 * Color output is discarded via writeMask: 0 on the pipeline's color target.
 * Used to establish occlusion so hidden lines can be drawn with reduced alpha.
 */

@vertex
fn vs(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
    return uniforms.mvp * vec4<f32>(position, 1.0);
}

@fragment
fn fs() -> @location(0) vec4<f32> {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}
`,Bt=`/**
 * Line ID pre-pass shader: renders line endpoint vertex indices
 * into a non-MSAA texture for topology-based marker occlusion.
 *
 * The marker shader samples this texture to determine whether the
 * frontmost line at each pixel is connected to the marker vertex.
 * Connected lines do not occlude their own markers.
 */
struct LineIdInstance {
    @location(0) startPos: vec3<f32>,
    @location(1) endPos: vec3<f32>,
    @location(2) visibleWidth: f32,
    @location(3) visibleColor: vec3<f32>,
    @location(4) visibleAlpha: f32,
    @location(5) visibleLineType: f32,
    @location(6) visibleDash: f32,
    @location(7) visibleGap: f32,
    @location(8) hiddenWidth: f32,
    @location(9) hiddenColor: vec3<f32>,
    @location(10) hiddenAlpha: f32,
    @location(11) hiddenLineType: f32,
    @location(12) hiddenDash: f32,
    @location(13) hiddenGap: f32,
    @location(14) startVertexIndex: f32,
    @location(15) endVertexIndex: f32,
};

struct LineIdOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) @interpolate(flat) clipStart: vec4<f32>,
    @location(1) @interpolate(flat) clipEnd: vec4<f32>,
    @location(2) @interpolate(flat) startVertexIndex: f32,
    @location(3) @interpolate(flat) endVertexIndex: f32,
};

@group(0) @binding(1) var faceDepth: texture_depth_2d;
@group(0) @binding(2) var depthSampler: sampler;

override renderMode: u32 = 0u;

@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    line: LineIdInstance
) -> LineIdOutput {
    let lineWidth = max(cssToGpuPixels(line.visibleWidth), cssToGpuPixels(line.hiddenWidth));

    let corner = quadCornerIndex(vertexIndex);
    let isEnd = (corner & 2u) != 0u;
    let side = quadSideX(corner);

    let clips = projectEndpoints(line.startPos, line.endPos);
    let clipA = clips[0];
    let clipB = clips[1];
    let clipPos = select(clipA, clipB, isEnd);

    let halfViewport = uniforms.viewport * 0.5;
    let screenA = (clipA.xy / clipA.w) * halfViewport;
    let screenB = (clipB.xy / clipB.w) * halfViewport;
    let perp = computeScreenPerp(screenA, screenB);

    let offsetNdc = pixelsToNdc(perp * side * lineWidth * 0.5);

    var result: LineIdOutput;
    result.clipPosition = vec4<f32>(clipPos.xy + offsetNdc * clipPos.w, max(clipPos.z, 0.0), clipPos.w);
    result.clipStart = clipA;
    result.clipEnd = clipB;
    result.startVertexIndex = line.startVertexIndex;
    result.endVertexIndex = line.endVertexIndex;
    return result;
}

@fragment
fn fs(input: LineIdOutput) -> @location(0) vec2<f32> {
    // Per-fragment spine-point depth, shared with the color line pass via common.wgsl
    let spine = computeSpineSample(input.clipStart, input.clipEnd, input.clipPosition);

    let faceDepthValue = textureSampleLevel(faceDepth, depthSampler, spine.uv, 0);
    let isOccluded = faceDepthValue < spine.depth;

    if (renderMode == 1u && !isOccluded) { discard; }
    if (renderMode == 2u && isOccluded) { discard; }

    return vec2<f32>(input.startVertexIndex, input.endVertexIndex);
}
`,Vt=`/**
 * Unified line shader with per-fragment depth texture sampling.
 * Samples the face depth texture at the LINE CENTER (not the fragment position)
 * to decide visible/hidden style. This ensures the entire line width uses one style,
 * even when the line straddles a face edge.
 * The depth attachment is a separate line-only depth buffer for z-ordering.
 */
struct LineInstance {
    @location(0) startPos: vec3<f32>,
    @location(1) endPos: vec3<f32>,
    @location(2) visibleWidth: f32,
    @location(3) visibleColor: vec3<f32>,
    @location(4) visibleAlpha: f32,
    @location(5) visibleLineType: f32,
    @location(6) visibleDash: f32,
    @location(7) visibleGap: f32,
    @location(8) hiddenWidth: f32,
    @location(9) hiddenColor: vec3<f32>,
    @location(10) hiddenAlpha: f32,
    @location(11) hiddenLineType: f32,
    @location(12) hiddenDash: f32,
    @location(13) hiddenGap: f32,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    /** World-space distance along the segment; perspective-correct interpolation
     *  reconstructs the true world position, so the dash phase is anchored to
     *  the geometry and never crawls under camera motion */
    @location(0) lineDistance: f32,
    @location(1) @interpolate(flat) visibleColor: vec3<f32>,
    @location(2) @interpolate(flat) visibleAlpha: f32,
    @location(3) @interpolate(flat) visibleDash: f32,
    @location(4) @interpolate(flat) visibleGap: f32,
    @location(5) @interpolate(flat) hiddenColor: vec3<f32>,
    @location(6) @interpolate(flat) hiddenAlpha: f32,
    @location(7) @interpolate(flat) hiddenDash: f32,
    @location(8) @interpolate(flat) hiddenGap: f32,
    @location(9) worldDepth: f32,
    /** Clip-space endpoints for per-fragment spine depth computation */
    @location(10) @interpolate(flat) clipStart: vec4<f32>,
    @location(11) @interpolate(flat) clipEnd: vec4<f32>,
};

@group(0) @binding(1) var faceDepth: texture_depth_2d;
@group(0) @binding(2) var depthSampler: sampler;

/**
 * Render mode filter (pipeline-overridable constant):
 *   0 = render all fragments (default, used by preview)
 *   1 = render only hidden (occluded) fragments
 *   2 = render only visible (non-occluded) fragments
 */
override renderMode: u32 = 0u;

/** Expands a line segment into a screen-space quad using max width of both styles */
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    line: LineInstance
) -> VertexOutput {
    let lineWidth = max(cssToGpuPixels(line.visibleWidth), cssToGpuPixels(line.hiddenWidth));

    let corner = quadCornerIndex(vertexIndex);
    let isEnd = (corner & 2u) != 0u;
    let side = quadSideX(corner);

    let projected = projectEndpointsWithParams(line.startPos, line.endPos);
    let clipA = projected.clipA;
    let clipB = projected.clipB;
    let clipPos = select(clipA, clipB, isEnd);

    let halfViewport = uniforms.viewport * 0.5;
    let screenA = (clipA.xy / clipA.w) * halfViewport;
    let screenB = (clipB.xy / clipB.w) * halfViewport;
    let perp = computeScreenPerp(screenA, screenB);

    let offsetNdc = pixelsToNdc(perp * side * lineWidth * 0.5);

    let endpointPos = select(line.startPos, line.endPos, isEnd);

    // Dash pattern lives in world units along the segment: stable under camera
    // motion, with the pattern fitted so both segment endpoints end in a dash
    let worldLen = distance(line.endPos, line.startPos);
    let endpointParam = select(projected.paramA, projected.paramB, isEnd);
    let visiblePattern = fitDashPattern(line.visibleDash, line.visibleGap, worldLen);
    let hiddenPattern = fitDashPattern(line.hiddenDash, line.hiddenGap, worldLen);

    var result: VertexOutput;
    result.clipPosition = vec4<f32>(clipPos.xy + offsetNdc * clipPos.w, max(clipPos.z, 0.0), clipPos.w);
    result.lineDistance = endpointParam * worldLen;
    result.visibleColor = line.visibleColor;
    result.visibleAlpha = line.visibleAlpha;
    result.visibleDash = visiblePattern.x;
    result.visibleGap = visiblePattern.y;
    result.hiddenColor = line.hiddenColor;
    result.hiddenAlpha = line.hiddenAlpha;
    result.hiddenDash = hiddenPattern.x;
    result.hiddenGap = hiddenPattern.y;
    result.worldDepth = dot(endpointPos - uniforms.cameraTarget, uniforms.cameraForward);
    result.clipStart = clipA;
    result.clipEnd = clipB;
    return result;
}

/** Renders a line fragment with occlusion test at the line center */
@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    // Per-fragment spine-point depth, shared with the line-id pass via common.wgsl
    let spine = computeSpineSample(input.clipStart, input.clipEnd, input.clipPosition);

    let faceDepthValue = textureSampleLevel(faceDepth, depthSampler, spine.uv, 0);
    let isOccluded = faceDepthValue < spine.depth;

    // Filter by render mode: discard fragments that don't match the requested visibility
    if (renderMode == 1u && !isOccluded) { discard; }
    if (renderMode == 2u && isOccluded) { discard; }

    // Select style based on occlusion
    let color = select(input.visibleColor, input.hiddenColor, isOccluded);
    let alpha = select(input.visibleAlpha, input.hiddenAlpha, isOccluded);
    let dash = select(input.visibleDash, input.hiddenDash, isOccluded);
    let gap = select(input.visibleGap, input.hiddenGap, isOccluded);

    // Dash pattern
    let patternLength = dash + gap;
    if (patternLength > 0.0) {
        if (input.lineDistance % patternLength >= dash) {
            discard;
        }
    }

    let depthFade = depthFadeFromForwardDistance(input.worldDepth);

    return vec4<f32>(color, alpha * depthFade);
}
`,Ht=`/**
 * Renders the solved puzzle's face polygon as a flat, blended region.
 * Per-vertex RGBA is carried in vertex attributes (all vertices of a face share
 * the style, but this keeps the pipeline independent of extra uniform buffers).
 */

struct SolutionFaceOutput {
    @builtin(position) clipPos: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@vertex
fn vs(
    @location(0) position: vec3<f32>,
    @location(1) color: vec4<f32>,
) -> SolutionFaceOutput {
    var out: SolutionFaceOutput;
    out.clipPos = uniforms.mvp * vec4<f32>(position, 1.0);
    out.color = color;
    return out;
}

@fragment
fn fs(in: SolutionFaceOutput) -> @location(0) vec4<f32> {
    return in.color;
}
`,Ut=`/**
 * Per-instance marker with visible and hidden styles.
 *
 * The SVG solution previews (presentation/components/SolutionPreview.tsx) reproduce the
 * visible/hidden split and the marker look on the CPU; a change here needs a matching one there.
 * GPU depth texture sampling determines which style to use.
 * Line ID texture sampling determines topology-based occlusion.
 *
 * Layout (24 floats = 96 bytes per instance):
 *   0-2:   position (vec3)
 *   3:     markerType (0=solid, 1=circle)
 *   4:     visibleSize
 *   5-7:   visibleColor (RGB)
 *   8:     visibleAlpha
 *   9-11:  visibleStrokeColor (RGB)
 *   12:    visibleStrokeWidth
 *   13:    hiddenSize
 *   14-16: hiddenColor (RGB)
 *   17:    hiddenAlpha
 *   18-20: hiddenStrokeColor (RGB)
 *   21:    hiddenStrokeWidth
 *   22:    vertexIndex (scene vertex index for line-topology occlusion)
 *   23:    reserved
 */
struct MarkerInstance {
    @location(0) position: vec3<f32>,
    @location(1) markerType: f32,
    @location(2) visibleSize: f32,
    @location(3) visibleColor: vec3<f32>,
    @location(4) visibleAlpha: f32,
    @location(5) visibleStrokeColor: vec3<f32>,
    @location(6) visibleStrokeWidth: f32,
    @location(7) hiddenSize: f32,
    @location(8) hiddenColor: vec3<f32>,
    @location(9) hiddenAlpha: f32,
    @location(10) hiddenStrokeColor: vec3<f32>,
    @location(11) hiddenStrokeWidth: f32,
    @location(12) vertexIndex: f32,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) quadUV: vec2<f32>,
    @location(1) @interpolate(flat) fillColor: vec3<f32>,
    @location(2) @interpolate(flat) fillAlpha: f32,
    @location(3) @interpolate(flat) strokeColor: vec3<f32>,
    @location(4) @interpolate(flat) strokeWidthNormalized: f32,
    @location(5) @interpolate(flat) isCircleType: f32,
    @location(6) @interpolate(flat) isOccluded: f32,
    @location(7) @interpolate(flat) vertexIndex: f32,
};

@group(0) @binding(1) var sceneDepth: texture_depth_2d;
@group(0) @binding(2) var depthSampler: sampler;
@group(0) @binding(3) var lineEndpointTexture: texture_2d<f32>;
@group(0) @binding(4) var lineDepthTexture: texture_depth_2d;

/**
 * Render mode filter (pipeline-overridable constant):
 *   0 = render all fragments (default, used by preview)
 *   1 = render only hidden (occluded) fragments
 *   2 = render only visible (non-occluded) fragments
 */
override renderMode: u32 = 0u;

/** When 0, skip line-topology occlusion check (used by preview markers) */
override enableLineOcclusion: u32 = 1u;

/** Threshold for comparing float-encoded vertex indices */
const VERTEX_INDEX_MATCH_THRESHOLD: f32 = 0.5;

/** Tests if the marker center is occluded by scene geometry in the depth buffer */
fn isMarkerOccluded(centerClip: vec4<f32>) -> bool {
    let centerNdc = centerClip.xyz / centerClip.w;
    let centerUV = centerNdc.xy * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);
    let sceneDepthAtCenter = textureSampleLevel(sceneDepth, depthSampler, centerUV, 0);
    return sceneDepthAtCenter < centerNdc.z;
}

/** Expands a marker into a screen-space billboard quad with occlusion-based style */
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    marker: MarkerInstance,
) -> VertexOutput {
    let centerClip = uniforms.mvp * vec4<f32>(marker.position, 1.0);
    let isOccluded = isMarkerOccluded(centerClip);

    let markerSize = select(marker.visibleSize, marker.hiddenSize, isOccluded);
    let color = select(marker.visibleColor, marker.hiddenColor, isOccluded);
    let alpha = select(marker.visibleAlpha, marker.hiddenAlpha, isOccluded);
    let sColor = select(marker.visibleStrokeColor, marker.hiddenStrokeColor, isOccluded);
    let sWidth = select(marker.visibleStrokeWidth, marker.hiddenStrokeWidth, isOccluded);

    let corner = quadCornerIndex(vertexIndex);
    let sideX = quadSideX(corner);
    let sideY = quadSideY(corner);

    let halfSize = cssToGpuPixels(markerSize) * 0.5;
    let offsetNdc = pixelsToNdc(vec2<f32>(sideX * halfSize, sideY * halfSize));

    // Normalize stroke width relative to marker radius (0..1 range)
    let strokeNormalized = select(0.0, cssToGpuPixels(sWidth) / halfSize, halfSize > 0.0);

    var result: VertexOutput;
    result.clipPosition = vec4<f32>(
        centerClip.xy + offsetNdc * centerClip.w,
        centerClip.z,
        centerClip.w,
    );
    result.quadUV = vec2<f32>(sideX, sideY);
    result.fillColor = color;
    result.fillAlpha = alpha * computeDepthFade(marker.position);
    result.strokeColor = sColor;
    result.strokeWidthNormalized = strokeNormalized;
    result.isCircleType = marker.markerType;
    result.isOccluded = select(0.0, 1.0, isOccluded);
    result.vertexIndex = marker.vertexIndex;
    return result;
}

/** Renders a marker as solid circle or circle with stroke */
@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let dist = length(input.quadUV);

    if (dist > 1.0) {
        discard;
    }

    // Filter by render mode: discard fragments that don't match the requested visibility
    if (renderMode == 1u && input.isOccluded < 0.5) { discard; }
    if (renderMode == 2u && input.isOccluded >= 0.5) { discard; }

    // Line-topology occlusion: discard if an unconnected line is in front
    if (enableLineOcclusion == 1u) {
        let pixelCoords = vec2<i32>(input.clipPosition.xy);
        let lineEndpoints = textureLoad(lineEndpointTexture, pixelCoords, 0).rg;
        let lineDepthValue = textureLoad(lineDepthTexture, pixelCoords, 0);
        let markerDepth = input.clipPosition.z;

        let lineInFront = lineDepthValue < markerDepth;
        let startMatches = abs(lineEndpoints.x - input.vertexIndex) < VERTEX_INDEX_MATCH_THRESHOLD;
        let endMatches = abs(lineEndpoints.y - input.vertexIndex) < VERTEX_INDEX_MATCH_THRESHOLD;
        let isConnected = startMatches || endMatches;

        if (lineInFront && !isConnected) { discard; }
    }

    // Solid type: filled circle
    if (input.isCircleType < 0.5) {
        return vec4<f32>(input.fillColor, input.fillAlpha);
    }

    // Circle type: stroke + fill
    let innerRadius = 1.0 - input.strokeWidthNormalized;

    if (dist > innerRadius) {
        // Stroke region
        return vec4<f32>(input.strokeColor, input.fillAlpha);
    }

    // Fill region
    return vec4<f32>(input.fillColor, input.fillAlpha);
}
`,Wt=U+zt,Gt=U+Vt,Kt=U+Bt,qt=U+Ht,Jt=U+Ut,W=`depth24plus`,Yt=`rg16float`,Xt=2,Zt=1,Qt=0,G=1,K=2,q={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}};function $t(e,t){let n={binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},r=[{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:`non-filtering`}}],i=[{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`unfilterable-float`}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}}],a=e.createBindGroupLayout({entries:[n]}),o=e.createBindGroupLayout({entries:[n,...r]}),s=e.createBindGroupLayout({entries:[n,...r,...i]}),c=e.createPipelineLayout({bindGroupLayouts:[a]}),l=e.createPipelineLayout({bindGroupLayouts:[o]}),u=e.createPipelineLayout({bindGroupLayouts:[s]}),d=e.createShaderModule({code:Gt}),f=e.createShaderModule({code:Jt}),p=e.createShaderModule({code:Kt});return{uniformBindGroupLayout:a,depthBindGroupLayout:o,markerBindGroupLayout:s,depthPrePass:en(e,c),solutionFace:tn(e,t,c),hiddenLine:J(e,t,l,d,{renderMode:G,depthTest:!0}),visibleLine:J(e,t,l,d,{renderMode:K,depthTest:!0}),previewLine:J(e,t,l,d,{renderMode:Qt,depthTest:!1}),hiddenMarker:Y(e,t,u,f,{renderMode:G,lineOcclusion:!0}),visibleMarker:Y(e,t,u,f,{renderMode:K,lineOcclusion:!0}),previewMarker:Y(e,t,u,f,{renderMode:Qt,lineOcclusion:!1}),hiddenLineId:nn(e,l,p,G),visibleLineId:nn(e,l,p,K)}}function J(e,t,n,r,{renderMode:i,depthTest:a}){return e.createRenderPipeline({layout:n,vertex:{module:r,entryPoint:`vs`,buffers:[{arrayStride:96,stepMode:`instance`,attributes:[...yt]}]},fragment:{module:r,entryPoint:`fs`,constants:{renderMode:i},targets:[{format:t,blend:q}]},primitive:{topology:`triangle-list`},depthStencil:a?{depthWriteEnabled:!0,depthCompare:`less-equal`,format:W}:{depthWriteEnabled:!1,depthCompare:`always`,format:W},multisample:{count:4}})}function en(e,t){let n=e.createShaderModule({code:Wt});return e.createRenderPipeline({layout:t,vertex:{module:n,entryPoint:`vs`,buffers:[{arrayStride:St,attributes:[...Ct]}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:W,depthBias:Xt,depthBiasSlopeScale:Zt}})}function tn(e,t,n){let r=e.createShaderModule({code:qt});return e.createRenderPipeline({layout:n,vertex:{module:r,entryPoint:`vs`,buffers:[{arrayStride:wt,attributes:[...Tt]}]},fragment:{module:r,entryPoint:`fs`,targets:[{format:t,blend:q}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:W},multisample:{count:4}})}function Y(e,t,n,r,{renderMode:i,lineOcclusion:a}){return e.createRenderPipeline({layout:n,vertex:{module:r,entryPoint:`vs`,buffers:[{arrayStride:96,stepMode:`instance`,attributes:[...xt]}]},fragment:{module:r,entryPoint:`fs`,constants:{renderMode:i,enableLineOcclusion:+!!a},targets:[{format:t,blend:q}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:W},multisample:{count:4}})}function nn(e,t,n,r){return e.createRenderPipeline({layout:t,vertex:{module:n,entryPoint:`vs`,buffers:[{arrayStride:96,stepMode:`instance`,attributes:[...bt]}]},fragment:{module:n,entryPoint:`fs`,constants:{renderMode:r},targets:[{format:Yt}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:W}})}var X=1,Z=GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING,rn=class{depth=M(4,W);faceDepth=M(X,W,Z);lineEndpoint=M(X,Yt,Z);lineDepth=M(X,W,Z);ensure(e,t,n){return{depth:this.depth.ensureView(e,t,n),faceDepth:this.faceDepth.ensureView(e,t,n),lineEndpoint:this.lineEndpoint.ensureView(e,t,n),lineDepth:this.lineDepth.ensureView(e,t,n)}}dispose(){this.depth.dispose(),this.faceDepth.dispose(),this.lineEndpoint.dispose(),this.lineDepth.dispose()}},an=ue(U).uniforms.uniforms,on=class{device;buffer;view=le(an);constructor(e){this.device=e,this.buffer=e.createBuffer({size:this.view.arrayBuffer.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}write(e){this.view.set(e),this.device.queue.writeBuffer(this.buffer,0,this.view.arrayBuffer)}dispose(){this.buffer.destroy()}},sn=6,cn={r:-1,g:-1,b:0,a:0},ln=GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,un=class{camera;msaaManager;topology;fpsController;sceneCenter;projection;device;format;pipelines;uniforms;depthSampler;uniformBindGroup;bindGroups;boundViews;targets=new rn;faceVertexBuffer;faceVertexCount=0;solutionFaceBuffer;solutionFaceVertexCount=0;styledLineBuffer;styledLineCount=0;markerBuffer;markerCount=0;previewBuffers;frame=new Lt;backgroundClearColor=mt();constructor(e,t,n,r,i,a=`perspective`){this.camera=e,this.msaaManager=t,this.topology=n,this.fpsController=r,this.sceneCenter=i,this.projection=a}init(e){this.device=e.device,this.format=e.format;let t=Ge(this.topology);this.faceVertexCount=t.faceVertexCount,this.faceVertexBuffer=this.device.createBuffer({size:t.facePositions.byteLength,usage:ln}),this.device.queue.writeBuffer(this.faceVertexBuffer,0,t.facePositions),this.solutionFaceBuffer=new V(this.device,wt),this.styledLineBuffer=new V(this.device,96),this.markerBuffer=new V(this.device,96),this.previewBuffers=new Pt(this.device),this.uniforms=new on(this.device),this.pipelines=$t(this.device,this.format),this.depthSampler=this.device.createSampler({minFilter:`nearest`,magFilter:`nearest`}),this.uniformBindGroup=this.device.createBindGroup({layout:this.pipelines.uniformBindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniforms.buffer}}]})}update(e){let t=this.camera.tick();t&&this.fpsController.raise(60);let n=this.frame.advance(e,this.camera,this.projection,t);if(c(n))return;let{mvpMatrix:r,viewMatrix:i,cameraDistance:a}=n;this.uniforms.write({mvp:r,viewport:[e.canvasWidth,e.canvasHeight],dpr:e.devicePixelRatio,cameraDistance:a,cameraForward:[-i[2],-i[6],-i[10]],cameraTarget:this.sceneCenter,depthFadeRate:pe,depthFadeMin:Ie})}consumeDirty(){return this.frame.consumeDirty()}render(e,t,n){let r=this.msaaManager.ensureView(this.device,this.format,n.canvasWidth,n.canvasHeight);if(c(r))return;let i=this.targets.ensure(this.device,n.canvasWidth,n.canvasHeight);this.bindTargets(i),this.encodeDepthPrePass(e,i);let a=this.styledLineCount>0&&this.markerCount>0;a&&this.encodeLineIdPass(e,i,this.pipelines.hiddenLineId),this.encodeHiddenPass(e,r,i.depth),a&&this.encodeLineIdPass(e,i,this.pipelines.visibleLineId),this.encodeVisiblePass(e,r,t,i.depth)}bindTargets(e){this.boundViews===e||It(this.boundViews,e)||(this.boundViews=e,this.bindGroups=Ft(this.device,this.pipelines,this.uniforms.buffer,this.depthSampler,e))}encodeDepthPrePass(e,t){let n=e.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:t.faceDepth,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});n.setPipeline(this.pipelines.depthPrePass),n.setBindGroup(0,this.uniformBindGroup),n.setVertexBuffer(0,this.faceVertexBuffer),n.draw(this.faceVertexCount),n.end()}encodeLineIdPass(e,t,n){let r=e.beginRenderPass({colorAttachments:[{view:t.lineEndpoint,clearValue:cn,loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:t.lineDepth,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});this.drawLines(r,n,this.styledLineBuffer.handle,this.styledLineCount),r.end()}encodeHiddenPass(e,t,n){let r=e.beginRenderPass({colorAttachments:[{view:t,loadOp:`clear`,clearValue:this.backgroundClearColor,storeOp:`store`}],depthStencilAttachment:{view:n,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});this.solutionFaceVertexCount>0&&(r.setPipeline(this.pipelines.solutionFace),r.setBindGroup(0,this.uniformBindGroup),r.setVertexBuffer(0,this.solutionFaceBuffer.handle),r.draw(this.solutionFaceVertexCount)),this.drawLines(r,this.pipelines.hiddenLine,this.styledLineBuffer.handle,this.styledLineCount),this.drawMarkers(r,this.pipelines.hiddenMarker,this.markerBuffer.handle,this.markerCount),r.end()}encodeVisiblePass(e,t,n,r){let i=e.beginRenderPass({colorAttachments:[{view:t,resolveTarget:n,loadOp:`load`,storeOp:`discard`}],depthStencilAttachment:{view:r,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});this.drawLines(i,this.pipelines.visibleLine,this.styledLineBuffer.handle,this.styledLineCount),this.drawMarkers(i,this.pipelines.visibleMarker,this.markerBuffer.handle,this.markerCount),c(this.previewBuffers.previewLine)||this.drawLines(i,this.pipelines.previewLine,this.previewBuffers.line,1),this.previewBuffers.hasStartMarker&&this.drawMarkers(i,this.pipelines.previewMarker,this.previewBuffers.startMarker,1),this.previewBuffers.hasSnapTarget&&this.drawMarkers(i,this.pipelines.previewMarker,this.previewBuffers.snapMarker,1),i.end()}drawLines(e,t,n,r){r===0||c(this.bindGroups)||(e.setPipeline(t),e.setBindGroup(0,this.bindGroups.line),e.setVertexBuffer(0,n),e.draw(6,r))}drawMarkers(e,t,n,r){r===0||c(this.bindGroups)||(e.setPipeline(t),e.setBindGroup(0,this.bindGroups.marker),e.setVertexBuffer(0,n),e.draw(sn,r))}getPreviewLine(){return this.previewBuffers.previewLine}setDragPreview(e){this.frame.markDirty(),this.previewBuffers.apply(e,(e,t,n)=>ht(this.frame.mvpMatrix,this.frame.viewport,e,t,n))}applySceneState(e){let{markers:t,segments:n,solutionFace:r}=dt(e);this.frame.markDirty(),this.markerCount=t.length,t.length>0&&this.markerBuffer.write(Mt(t)),this.styledLineCount=n.length,n.length>0&&this.styledLineBuffer.write(Ot(n)),this.solutionFaceVertexCount=r?.vertexCount??0,!c(r)&&r.vertexCount>0&&this.solutionFaceBuffer.write(r.vertices)}dispose(){this.uniforms.dispose(),this.faceVertexBuffer.destroy(),this.solutionFaceBuffer.dispose(),this.styledLineBuffer.dispose(),this.markerBuffer.dispose(),this.previewBuffers.dispose(),this.targets.dispose()}},dn=[`vertex`,`line`];function fn(e,t,n,r,i,a,o,s,c=dn){let l=n*i,u=r*i,d=e*i,f=t*i,p=30*i,m=20*i,h=p**2,g=m**2,_=[];return c.includes(`vertex`)&&pn(a,s,d,f,l,u,p,h,_),c.includes(`line`)&&mn(a,o,d,f,l,u,m,g,_),gn(_)}function pn(e,t,n,r,i,a,o,s,c){for(let l=0;l<t.length;l++){let u=Be(e,t[l],i,a);if(u.behindCamera)continue;let d=u.screenX-n,f=u.screenY-r,p=d*d+f*f;p>=s||c.push({hit:{type:`vertex`,position:t[l]},normalizedDistance:Math.sqrt(p)/o,depth:u.depth,typeBonus:Ce})}}function mn(e,t,n,r,i,a,o,s,c){for(let l=0;l<t.length;l++){let u=t[l],[d,f]=u.kind===`edge`||u.kind===`segment`?[u.pointA,u.pointB]:Ne(u.pointA,u.pointB),p=Re(e,d,f,i,a);if(p.start.behindCamera||p.end.behindCamera)continue;let{distanceSquared:m,parameter:h}=hn(n,r,p.start.screenX,p.start.screenY,p.end.screenX,p.end.screenY);if(m>=s)continue;let g=p.start.depth*p.end.depth/((1-h)*p.end.depth+h*p.start.depth),_=u.kind===`line`?0:xe;c.push({hit:{type:`line`,lineId:u.lineId},normalizedDistance:Math.sqrt(m)/o,depth:g,typeBonus:_})}}function hn(e,t,n,r,i,a){let o=i-n,s=a-r,c=o*o+s*s;if(c===0){let i=e-n,a=t-r;return{distanceSquared:i*i+a*a,parameter:0}}let l=Math.max(0,Math.min(1,((e-n)*o+(t-r)*s)/c)),u=n+l*o,d=r+l*s,f=e-u,p=t-d;return{distanceSquared:f*f+p*p,parameter:l}}function gn(e){if(e.length===0)return;let t=1/0,n=-1/0;for(let r of e)r.depth<t&&(t=r.depth),r.depth>n&&(n=r.depth);let r=n-t,i=-1/0,a;for(let n of e){let e=1-n.normalizedDistance,o=r>0?1-(n.depth-t)/r:1,s=be*e+Fe*o+n.typeBonus;s>i&&(i=s,a=n.hit)}return a}var _n=[`vertex`];function vn(e){let{canvas:t,getMvpMatrix:n,getTopology:r}=e;function i(e,i,a){let o=r();return fn(e,i,t.clientWidth,t.clientHeight,Math.max(1,window.devicePixelRatio),n(),o.lines,o.vertices.map(e=>e.position),a)}function a(e,t){let n=i(e,t);return n?.type===`line`?{type:`line`,lineId:n.lineId}:F}function o(e,t){let n=i(e,t);if(n===void 0)return;if(n.type===`vertex`)return{kind:`vertex`,position:n.position};let a=r().lines.find(e=>e.lineId===n.lineId);if(a===void 0)return;let o=de.sub(a.pointB,a.pointA);return{kind:`line`,lineId:n.lineId,direction:[o[0],o[1],o[2]],planeAnchor:a.pointA}}function s(e,t){let n=i(e,t,_n);return n?.type===`vertex`?n.position:void 0}return{hitTestSelection:a,hitTestDragStart:o,hitTestSnapVertex:s}}var yn=100;function bn(){let e=[],t=[];return{push(n){e.push(n),t.length=0,e.length>yn&&e.shift()},undo(n){let r=e.pop();if(r!==void 0)return t.push(n),r},redo(n){let r=t.pop();if(r!==void 0)return e.push(n),r},canUndo(){return e.length>0},canRedo(){return t.length>0}}}function xn(e){let{puzzle:t,figureTopology:n}=e,r=new We,i=new Me,a=bn(),o=_({canUndo:!1,canRedo:!1}),s,c=ke(n,t.input,r),l=F,u;function d(){let e=Le(t.expected,c),r=je(n,c.lines,c.vertices,l,u,e,i);s?.applySceneState(r)}let f=v(()=>{o.canUndo=a.canUndo(),o.canRedo=a.canRedo()});function p(e){a.push(c),c=e,d(),f()}function m(){return c}function h(){return l.type!==`none`}function g(e){l=e,d()}function y(e){u=e,d()}function b(){switch(l.type){case`line`:{let e=l.lineId,t=c.lines.find(t=>t.lineId===e);return t===void 0?void 0:de.sub(t.pointB,t.pointA)}case`none`:return;default:C(l)}}function x(e,t){p(Ve(c,e,t,n,r)),g(F)}function S(e){let t=b();if(t!==void 0){let i=[e[0]+t[0],e[1]+t[1],e[2]+t[2]];p(Ve(c,e,i,n,r))}g(F)}function w(e){let t=c.lines.find(t=>t.lineId===e);if(t!==void 0)switch(l=F,t.kind){case`edge`:case`segment`:p(ze(c,e,n,r));break;case`edge-extended`:case`segment-extended`:p(Pe(c,e,n,r));break;case`line`:p(He(c,e,n,r));break;default:C(t.kind)}}function T(e){e!==void 0&&(c=e,d(),g(F),f())}function E(){T(a.undo(c))}function D(){T(a.redo(c))}function O(e){s=e,d()}return{history:o,getTopology:m,hasSelection:h,setSelection:g,setPreviewLine:y,connectVertices:x,createParallelLineAtVertex:S,toggleLineExtension:w,undo:E,redo:D,attachRenderer:O}}function Sn(e){let{canvas:t,puzzle:n,getInteractionMode:r,onFpsUpdate:i}=e,a,{topology:o}=Ee(n),s=Ze(t,n.camera,r),c=new O(10),l=n.camera?.projection??`perspective`,u=xn({puzzle:n,figureTopology:o}),d=vn({canvas:t,getTopology:u.getTopology,getMvpMatrix:()=>_e(ge(l,Se(t.clientWidth,t.clientHeight),s.getDistance()),s.getViewMatrix())});function f(e,t){u.setSelection(d.hitTestSelection(e,t))}function p(){c.raise(60)}t.addEventListener(`pointerdown`,p),t.addEventListener(`pointermove`,p),t.addEventListener(`wheel`,p);let m=Qe(t,f),h=$e(t,{performInitialHitTest:d.hitTestDragStart,performSnapHitTest:d.hitTestSnapVertex,hasActiveSelection:u.hasSelection,onDragUpdate:e=>{a?.setDragPreview(e),u.setPreviewLine(a?.getPreviewLine())},onLineTap:e=>u.setSelection({type:`line`,lineId:e}),onLineDoubleTap:u.toggleLineExtension,onVertexTap:u.createParallelLineAtVertex,onDragComplete:u.connectVertices,onSecondPointer:(e,t,n)=>{s.registerExternalPointer(e,t,n)}}),g=ce({init:()=>Cn({canvas:t,camera:s,figureTopology:o,puzzle:n,fpsController:c,onFpsUpdate:i}),onReady:({sceneLayer:e})=>{a=e,u.attachRenderer(e)},initErrorMessage:`Failed to initialize stereometry renderer`});return{history:u.history,destroy:()=>{a=void 0,s.destroy(),c.dispose(),t.removeEventListener(`pointerdown`,p),t.removeEventListener(`pointermove`,p),t.removeEventListener(`wheel`,p),m(),h(),g()},undo:u.undo,redo:u.redo}}async function Cn({canvas:e,camera:t,figureTopology:n,puzzle:r,fpsController:i,onFpsUpdate:a}){let o=await ae(e),s=E(4),c=new un(t,s,n,i,r.camera?.center??[0,0,0],r.camera?.projection??`perspective`),l=new se([c]);l.initAll(o);let u=oe({canvas:e,context:o,layerManager:l,fpsController:i,onFpsUpdate:a,shouldRender:()=>c.consumeDirty(),onResize:()=>i.raise(60)});return{cleanup:()=>{u(),l.dispose(),s.dispose(),o.device.destroy()},sceneLayer:c}}var wn=class{fps=0;interactionMode=`rotate`;session=void 0;constructor(){g(this,{session:y},{autoBind:!0})}get canUndo(){return this.session?.history.canUndo??!1}get canRedo(){return this.session?.history.canRedo??!1}attach(e){this.session=e,this.fps=0}detach(){this.session=void 0}setFps(e){this.fps=e}setInteractionMode(e){this.interactionMode=e}undo(){this.session?.undo()}redo(){this.session?.redo()}dispose(){this.detach()}},Tn=`stereometry`;function En(){let e=S(),t=e.getOrCreateFeatureStore(Tn,()=>new wn);return T(e,Tn),t}var Q=i(),Dn=(0,z.memo)(()=>{let[e,t]=(0,z.useState)(!1);return(0,Q.jsxs)(ne,{open:e,onOpenChange:t,children:[(0,Q.jsx)(x,{title:L.toolbar.help,delayDuration:300,children:(0,Q.jsx)(ie,{asChild:!0,children:(0,Q.jsx)(`button`,{type:`button`,"aria-label":L.toolbar.help,className:r(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,e?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,Q.jsx)(u,{size:20})})})}),(0,Q.jsx)(k,{children:(0,Q.jsxs)(ee,{side:`top`,sideOffset:8,align:`end`,collisionPadding:16,className:r(`z-50 w-72 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,Q.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,Q.jsx)(`span`,{className:`font-semibold text-white`,children:L.help.title}),(0,Q.jsx)(re,{"aria-label":L.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,Q.jsx)(m,{size:14})})]}),(0,Q.jsx)(`p`,{className:`mb-3 text-neutral-400`,children:L.help.description}),(0,Q.jsxs)(`ul`,{className:`space-y-1.5 text-neutral-300`,children:[(0,Q.jsxs)(`li`,{children:[(0,Q.jsx)(`strong`,{className:`text-neutral-100`,children:L.help.controlLabels.drag}),` —`,` `,L.help.controls.drag]}),(0,Q.jsxs)(`li`,{children:[(0,Q.jsx)(`strong`,{className:`text-neutral-100`,children:L.help.controlLabels.shiftDrag}),` `,`— `,L.help.controls.shiftDrag]}),(0,Q.jsxs)(`li`,{children:[(0,Q.jsx)(`strong`,{className:`text-neutral-100`,children:L.help.controlLabels.scrollPinch}),` `,`— `,L.help.controls.scrollPinch]}),(0,Q.jsxs)(`li`,{children:[(0,Q.jsx)(`strong`,{className:`text-neutral-100`,children:L.help.controlLabels.clickEdge}),` `,`— `,L.help.controls.clickEdge]}),(0,Q.jsxs)(`li`,{children:[(0,Q.jsx)(`strong`,{className:`text-neutral-100`,children:L.help.controlLabels.doubleClickEdge}),` `,`— `,L.help.controls.doubleClickEdge]}),(0,Q.jsxs)(`li`,{children:[(0,Q.jsx)(`strong`,{className:`text-neutral-100`,children:L.help.controlLabels.doubleClickLine}),` `,`— `,L.help.controls.doubleClickLine]}),(0,Q.jsxs)(`li`,{children:[(0,Q.jsx)(`strong`,{className:`text-neutral-100`,children:L.help.controlLabels.dragVertex}),` `,`— `,L.help.controls.dragVertex]}),(0,Q.jsxs)(`li`,{children:[(0,Q.jsx)(`strong`,{className:`text-neutral-100`,children:L.help.controlLabels.selectEdgeTapVertex}),` `,`— `,L.help.controls.selectEdgeTapVertex]}),(0,Q.jsxs)(`li`,{children:[(0,Q.jsx)(`strong`,{className:`text-neutral-100`,children:L.help.controlLabels.dragLineVertex}),` `,`— `,L.help.controls.dragLineVertex]})]}),(0,Q.jsx)(`p`,{className:`mt-3 text-xs text-neutral-500`,children:L.help.intersectionHint}),(0,Q.jsx)(te,{className:`fill-neutral-900`})]})})]})}),On=(0,z.memo)(({puzzle:e})=>{let[t,n]=(0,z.useState)(!1),i=L.puzzles[e.id];return i===void 0?null:(0,Q.jsxs)(ne,{open:t,onOpenChange:n,children:[(0,Q.jsx)(x,{title:L.toolbar.puzzle,delayDuration:300,children:(0,Q.jsx)(ie,{asChild:!0,children:(0,Q.jsx)(`button`,{type:`button`,"aria-label":L.toolbar.puzzle,className:r(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,t?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,Q.jsx)(Xe,{size:20})})})}),(0,Q.jsx)(k,{children:(0,Q.jsxs)(ee,{side:`top`,sideOffset:8,align:`end`,collisionPadding:16,className:r(`z-50 w-72 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,Q.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,Q.jsx)(`span`,{className:`font-semibold text-white`,children:i.name}),(0,Q.jsx)(re,{"aria-label":L.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,Q.jsx)(m,{size:14})})]}),(0,Q.jsx)(Ue,{puzzle:e,label:L.solutionImageAlt,className:`mb-3 w-full rounded-md border border-neutral-700`}),(0,Q.jsx)(`p`,{className:`text-neutral-300`,children:i.description}),(0,Q.jsx)(te,{className:`fill-neutral-900`})]})})]})}),$=(0,z.memo)(({active:e=!1,disabled:t=!1,onClick:n,children:i,label:a,tooltipDelayMs:o=300})=>(0,Q.jsx)(x,{title:a,delayDuration:o,children:(0,Q.jsx)(`button`,{type:`button`,onClick:n,disabled:t,"aria-label":a,"aria-pressed":e,className:r(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all`,t?`bg-neutral-900 text-neutral-600 cursor-not-allowed`:`hover:scale-110 active:scale-95`,!t&&e&&`bg-blue-500 text-white`,!t&&!e&&`bg-neutral-800 text-neutral-400 hover:text-white`),children:i})})),kn=D(),An=b(({puzzle:e})=>{let n=(0,z.useRef)(null),r=En(),i=t(),a=o(()=>{i(`/stereometry`)});h({label:L.nav.backToPuzzlesLabel,onActivate:a}),(0,z.useEffect)(()=>{let t=n.current;if(c(t))return;let i=Sn({canvas:t,puzzle:e,getInteractionMode:()=>r.interactionMode,onFpsUpdate:r.setFps});return r.attach(i),()=>{r.detach(),i.destroy()}},[e,r]);let s=o(()=>{r.setInteractionMode(`rotate`)}),l=o(()=>{r.setInteractionMode(`pan`)});return(0,Q.jsx)(w,{className:`h-full w-full`,children:(0,Q.jsxs)(`div`,{className:`h-full w-full`,children:[(0,Q.jsx)(`canvas`,{ref:n,className:`h-full w-full [touch-action:none]`}),!kn&&(0,Q.jsxs)(`div`,{className:`absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400`,children:[r.fps,` FPS`]}),(0,Q.jsxs)(`div`,{className:`fixed right-4 bottom-4 flex gap-2`,children:[(0,Q.jsx)(On,{puzzle:e}),(0,Q.jsx)(Dn,{}),(0,Q.jsx)($,{onClick:r.undo,label:L.toolbar.undo,disabled:!r.canUndo,children:(0,Q.jsx)(f,{size:20})}),(0,Q.jsx)($,{onClick:r.redo,label:L.toolbar.redo,disabled:!r.canRedo,children:(0,Q.jsx)(d,{size:20})}),(0,Q.jsx)($,{active:r.interactionMode===`rotate`,onClick:s,label:L.toolbar.rotate,children:(0,Q.jsx)(p,{size:20})}),(0,Q.jsx)($,{active:r.interactionMode===`pan`,onClick:l,label:L.toolbar.pan,children:(0,Q.jsx)(Ye,{size:20})})]})]})})}),jn=(0,z.memo)(()=>{let{puzzleId:e}=a(),t=De(e);return c(t)?(0,Q.jsx)(n,{to:`/stereometry`,replace:!0}):(0,Q.jsx)(An,{puzzle:t})});export{jn as Stereometry};