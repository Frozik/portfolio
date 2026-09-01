import{a as e,t}from"./c-HFhCPKiE.js";import{t as n}from"./c-CiQY6nnt.js";import{t as r}from"./c-DojpP95n.js";import{t as i}from"./c-BihXMImp.js";import{t as a}from"./c-DeSzVq1v.js";import{n as o,t as s}from"./c-Cvdc77LN.js";import{t as c}from"./c-B25VJLzq.js";import{t as l}from"./c-EfPkFKRw.js";import{Q as u,V as d,W as f,at as p,b as m,l as h,n as g,nt as _,p as v,tt as y,u as b}from"./e-DwYg-del.js";import{n as x}from"./c-QzJ--Swa.js";import{n as S,r as C}from"./c-CsxWckhG.js";import{t as ee}from"./c-hUOIOutD.js";import{t as w}from"./c-t2AJ7Sq8.js";import{t as T}from"./c-CarKf6az.js";import{a as E,i as D,n as O,o as k,r as te,s as ne}from"./c-wv84L2ul.js";import{n as re,r as ie,t as ae}from"./c-BBgIt17s.js";import{i as oe,n as A,r as j,t as M}from"./c-Dr8IWdrq.js";import{t as se}from"./c-JQa_l6qu.js";import{t as ce}from"./c-DoGnHso7.js";import{r as le,t as N}from"./c-t4MCdpTx.js";var ue=i(`move`,[[`path`,{d:`M12 2v20`,key:`t6zp3m`}],[`path`,{d:`m15 19-3 3-3-3`,key:`11eu04`}],[`path`,{d:`m19 9 3 3-3 3`,key:`1mg7y2`}],[`path`,{d:`M2 12h20`,key:`9i4pu4`}],[`path`,{d:`m5 9-3 3 3 3`,key:`j64kie`}],[`path`,{d:`m9 5 3-3 3 3`,key:`l8vdw6`}]]),de=i(`puzzle`,[[`path`,{d:`M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z`,key:`w46dr5`}]]),P=e(n(),1),fe=Math.PI/2.3,pe=Math.PI/30,me=.005,he=.003,ge=.01,_e=.95,ve=.1,ye=.1,be=.001,xe=Math.PI/4,Se=.1,Ce=Math.tan(xe/2),we=.2,Te=.1,Ee=.2,De=.1,Oe=.45,ke=.1,F={line:{color:`#FFFFFF`,width:1,alpha:1,line:{type:`solid`}},"line:hidden":{alpha:.3,line:{type:`dashed`,dash:.05,gap:.05}},"line:selected":{color:`#55AAFF`},"line:hidden:selected":{alpha:1},"line:segment":{width:3},"line:preview":{color:`#4488BB`},"line:inner":{width:3},"line:input":{color:`#FF8973`,width:3,alpha:1},"line:input:hidden":{alpha:.3},"line:segment:input:hidden":{alpha:.3},"line:input:selected":{color:`#A61A00`},"line:segment:input":{color:`#FF8973`,width:3,alpha:1},"line:segment:input:selected":{color:`#A61A00`},"line:solution":{color:`#EFBF04`},vertex:{markerType:`circle`,color:`#000000`,size:10,strokeColor:`#FFFFFF`,strokeWidth:2},"vertex:hidden":{strokeColor:`#999999`},"vertex:selected":{color:`#55AAFF`},"vertex:hidden:selected":{color:`#3388DD`},"vertex:inner":{strokeColor:`#AAFF44`,color:`#AAAAAA`},"vertex:inner:hidden":{strokeColor:`#77CC22`,color:`#000000`},"vertex:preview":{color:`#000000`,strokeColor:`#4488BB`,strokeWidth:6,size:16},"vertex:input":{markerType:`solid`,color:`#FF8973`,size:10},"vertex:input:hidden":{markerType:`solid`,color:`#FF8973`,size:10,alpha:.6},"vertex:input:selected":{markerType:`solid`,color:`#A61A00`,size:10},"vertex:solution":{markerType:`solid`,color:`#EFBF04`},"vertex:solution:hidden":{markerType:`solid`,color:`#EFBF04`},"face:solution":{color:`#EFBF04`,alpha:.1},background:{color:S}};function Ae(e){let t=[],n=[],r=[],i=new Set,a=[];for(let o of e.input.figures){let e=t.length,s=[];for(let e of o.vertices)t.push([e[0],e[1],e[2]]);for(let t of o.faces){let r=t.map(t=>t+e);n.push(r),s.push(r);for(let e=0;e<r.length;e++){let t=(e+1)%r.length,n=Math.min(r[e],r[t]),o=Math.max(r[e],r[t]),s=`${n}-${o}`;i.has(s)||(i.add(s),a.push([n,o]))}}r.push(s)}return{topology:je(t,a,n,r)}}function je(e,t,n,r){return{vertices:e,edges:t,faces:n,faceTriangles:Ne(n),figureFaceTriangles:r.map(e=>Ne(e))}}function Me(e){let{vertices:t,faceTriangles:n}=e,r=n.length*3,i=new Float32Array(r*3),a=0;for(let[e,r,o]of n)Pe(i,a,t[e]),Pe(i,a+1,t[r]),Pe(i,a+2,t[o]),a+=3;return{facePositions:i,faceVertexCount:r}}function Ne(e){let t=[];for(let n of e){if(n.length<3)continue;let e=n[0];for(let r=1;r<n.length-1;r++)t.push([e,n[r],n[r+1]])}return t}function Pe(e,t,n){let r=t*3;e[r]=n[0],e[r+1]=n[1],e[r+2]=n[2]}function Fe(e,t){let n=t?.distance?.min??3,r=t?.distance?.max??15,i=t?.distance?.initial??5,a=t?.center??[0,0,0],o=t?.angle?.azimuth??pe,s=t?.angle?.elevation??fe,c=i,l=i,u=[a[0],a[1],a[2]],d=`rotate`,f=0,p=0,m=0;function h(){return[u[0]+Math.sin(s)*Math.sin(o)*c,u[1]+Math.cos(s)*c,u[2]+Math.sin(s)*Math.cos(o)*c]}function g(){return[-Math.cos(s)*Math.sin(o),Math.sin(s),-Math.cos(s)*Math.cos(o)]}function _(){return[Math.cos(o),0,-Math.sin(o)]}function v(e){let t=-e*me;o+=t;let n=u[0]-a[0],r=u[2]-a[2],i=Math.cos(t),s=Math.sin(t);u[0]=a[0]+n*i+r*s,u[2]=a[2]-n*s+r*i}function y(e,t){let n=he*c,r=_();u[0]-=r[0]*e*n,u[1]+=t*n,u[2]-=r[2]*e*n}function b(e){return Math.max(n,Math.min(r,e))}function x(){f=0,p=0,m=0}let S=!1,C=0;function ee(e){S=e.shiftKey}function w(e,t){C=performance.now(),S||d===`pan`?(p=e,m=t,f=0,y(e,t)):(f=e,p=0,m=0,v(e))}function T(e){l=b(l*e)}function E(e){l=b(l*(1+e*ge))}function D(){S=!1,performance.now()-C>80&&x()}function O(){S=!1,x()}let k=ce(e,{onDrag:w,onPinch:T,onWheel:E,onReset:O,onGestureStart:ee,onGestureEnd:D});return{tick(){let e=Math.abs(l-c)>be;if(e?c+=(l-c)*ye:c=l,k.hasActivePointers())return!0;let t=Math.abs(f)>=ve,n=Math.abs(p)>=.1||Math.abs(m)>=.1;return!t&&!n?(x(),e):(t&&(v(f),f*=_e),n&&(y(p,m),p*=_e,m*=_e),!0)},getViewMatrix(){let e=h(),t=g();return M.lookAt(A.fromValues(e[0],e[1],e[2]),A.fromValues(u[0],u[1],u[2]),A.fromValues(t[0],t[1],t[2]))},getEyePosition(){return h()},getDistance(){return c},setInteractionMode(e){d=e,x()},registerExternalPointer(e,t,n){k.registerExternalPointer(e,t,n)},destroy(){k.destroy()}}}function Ie(e,t,n){let r=0,i=0,a=0,o,s=0,c=0,l=0;function u(e,t){let n=Math.abs(e-r),o=Math.abs(t-i),s=performance.now()-a;return n<3&&o<3&&s<300}function d(e,r){let i=performance.now(),a=i-l,o=Math.sqrt((e-s)**2+(r-c)**2);a<400&&o<10?(n(e,r),l=0):(t(e,r),s=e,c=r,l=i)}function f(e){e.isPrimary&&(o=e.pointerId,r=e.clientX,i=e.clientY,a=performance.now())}function p(t){if(t.pointerId===o&&(o=void 0,u(t.clientX,t.clientY))){let n=e.getBoundingClientRect();d(t.clientX-n.left,t.clientY-n.top)}}function m(e){e.pointerId===o&&(o=void 0)}return e.addEventListener(`pointerdown`,f),window.addEventListener(`pointerup`,p),window.addEventListener(`pointercancel`,m),()=>{e.removeEventListener(`pointerdown`,f),window.removeEventListener(`pointerup`,p),window.removeEventListener(`pointercancel`,m)}}function Le(e,t){let n,r,i=!1,a,o=0,s=0,c=0,l=0,u,d,f=0,p=0,m=0;function h(t,n){let r=e.getBoundingClientRect();return{screenX:t-r.left,screenY:n-r.top}}function g(e,t){return e[0]===t[0]&&e[1]===t[1]&&e[2]===t[2]}function _(e,t,n,r){return e.kind===`vertex`?{kind:`vertex`,startPosition:e.position,cursorScreenX:t,cursorScreenY:n,snapTargetPosition:r!==void 0&&!g(r,e.position)?r:void 0}:{kind:`line`,sourceDirection:e.direction,planeAnchor:e.planeAnchor,cursorScreenX:t,cursorScreenY:n,snapTargetPosition:r}}function v(){u!==void 0&&(window.clearTimeout(u),u=void 0)}function y(e,a,o){let s=r;s!==void 0&&(v(),r=void 0,i=!1,n=s,t.onDragStart(),t.onDragUpdate(_(s,e,a,o)))}function b(){let{screenX:e,screenY:t}=h(o,s);y(e,t,void 0)}function x(e,n,r){let i=performance.now(),a=i-f,o=Math.sqrt((n-p)**2+(r-m)**2);if(d===e&&a<400&&o<10){d=void 0,t.onLineDoubleTap(e);return}d=e,f=i,p=n,m=r,t.onLineTap(e)}function S(e){let{screenX:d,screenY:f}=h(e.clientX,e.clientY),p=t.performInitialHitTest(d,f);return p===void 0?!1:p.kind===`vertex`&&t.hasActiveSelection()?(t.onVertexTap(p.position),!0):(a=e.pointerId,o=e.clientX,s=e.clientY,c=e.clientX,l=e.clientY,p.kind===`vertex`?(n=p,t.onDragStart(),t.onDragUpdate(_(p,d,f,void 0))):(r=p,i=t.isLineSelected(p.lineId),i&&(u=window.setTimeout(b,250))),!0)}function C(e,a){c=e,l=a;let{screenX:u,screenY:d}=h(e,a);if(r!==void 0){if(!i)return;Math.max(Math.abs(e-o),Math.abs(a-s))>=3&&y(u,d,t.performSnapHitTest(u,d));return}if(n===void 0)return;let f=t.performSnapHitTest(u,d);t.onDragUpdate(_(n,u,d,f))}function ee(e,o){if(r!==void 0){let t=r;v(),r=void 0,i=!1,a=void 0,t.kind===`line`&&x(t.lineId,e,o);return}let s=n;if(s===void 0)return;let{screenX:c,screenY:l}=h(e,o),u=t.performSnapHitTest(c,l);if(n=void 0,a=void 0,t.onDragUpdate(void 0),s.kind===`vertex`){u!==void 0&&!g(u,s.position)?t.onDragComplete(s.position,u):t.onVertexTap(s.position);return}if(u!==void 0){let e=[u[0]+s.direction[0],u[1]+s.direction[1],u[2]+s.direction[2]];t.onDragComplete(u,e)}}function w(){v(),r=void 0,i=!1,n=void 0,a=void 0,t.onDragUpdate(void 0)}function T(e){if(n!==void 0||r!==void 0){a!==void 0&&t.onSecondPointer(a,c,l),w();return}e.isPrimary&&S(e)&&e.stopPropagation()}function E(e){e.pointerId===a&&(n!==void 0||r!==void 0)&&C(e.clientX,e.clientY)}function D(e){e.pointerId===a&&(n!==void 0||r!==void 0)&&ee(e.clientX,e.clientY)}function O(e){e.pointerId===a&&(n!==void 0||r!==void 0)&&w()}function k(){(n!==void 0||r!==void 0)&&w()}return e.addEventListener(`pointerdown`,T,{capture:!0}),window.addEventListener(`pointermove`,E),window.addEventListener(`pointerup`,D),window.addEventListener(`pointercancel`,O),window.addEventListener(`blur`,k),()=>{v(),e.removeEventListener(`pointerdown`,T,{capture:!0}),window.removeEventListener(`pointermove`,E),window.removeEventListener(`pointerup`,D),window.removeEventListener(`pointercancel`,O),window.removeEventListener(`blur`,k)}}var Re={color:`#FFFFFF`,width:1,size:1,alpha:1,line:{type:`solid`},markerType:`solid`,strokeColor:`#FFFFFF`,strokeWidth:0},ze=16,Be=7,Ve=255;function I(e){if(e.length!==Be||e[0]!==`#`)throw Error(`Invalid hex color: ${e}. Expected format: #RRGGBB`);return[Number.parseInt(e.slice(1,3),ze)/Ve,Number.parseInt(e.slice(3,5),ze)/Ve,Number.parseInt(e.slice(5,7),ze)/Ve]}function He(e){let t=[...e].sort(),n=[[]];for(let e of t){let t=n.length;for(let r=0;r<t;r++)n.push([...n[r],e])}return n.sort((e,t)=>e.length===t.length?e.join(`:`).localeCompare(t.join(`:`)):e.length-t.length),n}var Ue=new Map;function We(e){let t=[...e].sort().join(`:`),n=Ue.get(t);if(n!==void 0)return n;let r=He(e);return Ue.set(t,r),r}function Ge(e,t){return{color:t.color??e.color,width:t.width??e.width,size:t.size??e.size,alpha:t.alpha??e.alpha,line:t.line??e.line,markerType:t.markerType??e.markerType,strokeColor:t.strokeColor??e.strokeColor,strokeWidth:t.strokeWidth??e.strokeWidth}}function Ke(e){let t={};for(let[n,r]of Object.entries(e)){let e=n.split(`:`);if(e.length<=2){t[n]=r;continue}let i=e[0],a=e.slice(1).sort();t[`${i}:${a.join(`:`)}`]=r}return t}var qe=new WeakMap;function Je(e){let t=qe.get(e);if(t!==void 0)return t;let n={normalizedStyles:Ke(e),resolvedByKey:new Map};return qe.set(e,n),n}function Ye(e,t,n){let r=We(n),i={...Re};for(let n of r){let r=e[n.length===0?t:`${t}:${n.join(`:`)}`];r!==void 0&&(i=Ge(i,r))}return i}function L(e,t,n){let{normalizedStyles:r,resolvedByKey:i}=Je(e),a=`${t}\0${[...n].sort().join(`:`)}`,o=i.get(a);if(o!==void 0)return o;let s=Ye(r,t,n);return i.set(a,s),s}var R=`struct Uniforms {
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
 *  Only fades objects behind the target (further from camera), not in front of it. */
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
`,Xe=`/**
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
`,Ze=`/**
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
`,Qe=`/**
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
`,$e=`/**
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
`,et=`/**
 * Per-instance marker with visible and hidden styles.
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
`,tt=R+Xe,nt=R+Ze,rt=R+Qe,it=R+$e,at=R+et,z=`depth24plus`,ot=`rg16float`,B=1,st=2,ct=1,lt=0,ut=1,dt=2,ft=4,pt=24,V=96,mt=[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`},{shaderLocation:2,offset:24,format:`float32`},{shaderLocation:3,offset:28,format:`float32x3`},{shaderLocation:4,offset:40,format:`float32`},{shaderLocation:5,offset:44,format:`float32`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32`},{shaderLocation:9,offset:60,format:`float32x3`},{shaderLocation:10,offset:72,format:`float32`},{shaderLocation:11,offset:76,format:`float32`},{shaderLocation:12,offset:80,format:`float32`},{shaderLocation:13,offset:84,format:`float32`}],ht=[...mt,{shaderLocation:14,offset:88,format:`float32`},{shaderLocation:15,offset:92,format:`float32`}],gt=24,H=96,_t=3*ft,vt=28,yt=128,bt=0,xt=16,St=18,Ct=19,wt=20,Tt=24,Et=27,Dt=28,Ot=6,kt=class{camera;msaaManager;topology;fpsController;sceneCenter;projection;device;format;hiddenLinePipeline;visibleLinePipeline;previewLinePipeline;hiddenMarkerPipeline;visibleMarkerPipeline;previewMarkerPipeline;hiddenLineIdPipeline;visibleLineIdPipeline;bindGroup;lineBindGroup;markerBindGroup;depthBindGroupLayout;markerBindGroupLayout;uniformBuffer;faceVertexBuffer;styledLineBuffer;topologyVertexMarkerBuffer;previewLineBuffer;previewStartMarkerBuffer;previewSnapMarkerBuffer;depthPrePassPipeline;solutionFacePipeline;solutionFaceBuffer;solutionFaceVertexCount=0;depthSampler;faceVertexCount=0;depthTexture=null;depthTextureView=null;samplingDepthTexture=null;samplingDepthTextureView=null;lineEndpointTexture=null;lineEndpointTextureView=null;lineDepthTexture=null;lineDepthTextureView=null;dirty=!0;uniformStaging=new Float32Array(yt/ft);projectionScratch=M.create();mvpScratch=M.create();previewLineStaging=new Float32Array(pt);previewMarkerStaging=new Float32Array(gt);lastMvpMatrix=new Float32Array(16);styledLineCount=0;topologyVertexCount=0;hasDragPreview=!1;hasStartMarker=!1;currentPreviewLine;hasSnapTarget=!1;lastCanvasWidth=0;lastCanvasHeight=0;lastDevicePixelRatio=1;backgroundClearColor;vertexPreviewStyle;linePreviewStyle;constructor(e,t,n,r,i,a=`perspective`){this.camera=e,this.msaaManager=t,this.topology=n,this.fpsController=r,this.sceneCenter=i,this.projection=a;let[o,s,c]=I(L(F,`background`,[]).color);this.backgroundClearColor={r:o,g:s,b:c,a:1};let l=L(F,`vertex`,[`preview`]);this.vertexPreviewStyle={markerType:+(l.markerType===`circle`),size:l.size,color:I(l.color),alpha:l.alpha,strokeColor:I(l.strokeColor),strokeWidth:l.strokeWidth};let u=L(F,`line`,[`preview`]);this.linePreviewStyle={width:u.width,color:I(u.color),alpha:u.alpha}}init(e){this.device=e.device,this.format=e.format;let t=Me(this.topology);this.faceVertexCount=t.faceVertexCount,this.faceVertexBuffer=this.createAndWriteBuffer(t.facePositions,GPUBufferUsage.VERTEX),this.solutionFaceBuffer=this.device.createBuffer({size:vt,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.styledLineBuffer=this.device.createBuffer({size:V,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.topologyVertexMarkerBuffer=this.device.createBuffer({size:H,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewLineBuffer=this.device.createBuffer({size:V,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewStartMarkerBuffer=this.device.createBuffer({size:H,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewSnapMarkerBuffer=this.device.createBuffer({size:H,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.uniformBuffer=this.device.createBuffer({size:yt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let n=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.bindGroup=this.device.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]});let r=this.device.createPipelineLayout({bindGroupLayouts:[n]});this.depthPrePassPipeline=this.createDepthPrePassPipeline(r),this.solutionFacePipeline=this.createSolutionFacePipeline(r),this.depthBindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:`non-filtering`}}]}),this.markerBindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:`non-filtering`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`unfilterable-float`}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}}]}),this.depthSampler=this.device.createSampler({minFilter:`nearest`,magFilter:`nearest`});let i=this.device.createPipelineLayout({bindGroupLayouts:[this.depthBindGroupLayout]});this.hiddenLinePipeline=this.createLinePipeline(i,ut),this.visibleLinePipeline=this.createLinePipeline(i,dt),this.previewLinePipeline=this.createPreviewLinePipeline(i);let a=this.device.createPipelineLayout({bindGroupLayouts:[this.markerBindGroupLayout]});this.hiddenMarkerPipeline=this.createMarkerPipeline(a,ut),this.visibleMarkerPipeline=this.createMarkerPipeline(a,dt),this.previewMarkerPipeline=this.createMarkerPipeline(a,lt,!1),this.hiddenLineIdPipeline=this.createLineIdPipeline(i,ut),this.visibleLineIdPipeline=this.createLineIdPipeline(i,dt)}update(e){let t=this.camera.tick();t&&this.fpsController.raise(60);let n=this.camera.getViewMatrix(),r=this.camera.getDistance(),i=e.canvasWidth/Math.max(B,e.canvasHeight);if(this.projection===`orthographic`){let e=r*Ce,t=e*i;M.ortho(-t,t,-e,e,Se,100,this.projectionScratch)}else M.perspective(xe,i,Se,100,this.projectionScratch);let a=M.multiply(this.projectionScratch,n,this.mvpScratch),o=e.canvasWidth!==this.lastCanvasWidth||e.canvasHeight!==this.lastCanvasHeight||e.devicePixelRatio!==this.lastDevicePixelRatio;if((t||o||!At(this.lastMvpMatrix,a))&&(this.dirty=!0),!this.dirty)return;this.lastMvpMatrix.set(a),this.lastCanvasWidth=e.canvasWidth,this.lastCanvasHeight=e.canvasHeight,this.lastDevicePixelRatio=e.devicePixelRatio;let s=this.uniformStaging;s.set(a,bt),s[xt]=e.canvasWidth,s[17]=e.canvasHeight,s[St]=e.devicePixelRatio,s[Ct]=r,s[wt]=-n[2],s[21]=-n[6],s[22]=-n[10],s[Tt]=this.sceneCenter[0],s[25]=this.sceneCenter[1],s[26]=this.sceneCenter[2],s[Et]=Oe,s[Dt]=ke,this.device.queue.writeBuffer(this.uniformBuffer,0,s)}consumeDirty(){let e=this.dirty;return this.dirty=!1,e}render(e,t,n){let r=this.msaaManager.ensureView(this.device,this.format,n.canvasWidth,n.canvasHeight);if(p(r))return;let i=this.ensureDepthView(n.canvasWidth,n.canvasHeight),a=this.ensureSamplingDepthView(n.canvasWidth,n.canvasHeight),o=e.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:a,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});o.setPipeline(this.depthPrePassPipeline),o.setBindGroup(0,this.bindGroup),o.setVertexBuffer(0,this.faceVertexBuffer),o.draw(this.faceVertexCount),o.end();let s=this.ensureLineIdTextures(n.canvasWidth,n.canvasHeight,a),c={r:-1,g:-1,b:0,a:0},l=this.styledLineCount>0&&this.topologyVertexCount>0;if(l){let t=e.beginRenderPass({colorAttachments:[{view:s.endpointView,clearValue:c,loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:s.depthView,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});t.setPipeline(this.hiddenLineIdPipeline),t.setBindGroup(0,this.lineBindGroup),t.setVertexBuffer(0,this.styledLineBuffer),t.draw(6,this.styledLineCount),t.end()}let u=e.beginRenderPass({colorAttachments:[{view:r,loadOp:`clear`,clearValue:this.backgroundClearColor,storeOp:`store`}],depthStencilAttachment:{view:i,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});if(this.solutionFaceVertexCount>0&&(u.setPipeline(this.solutionFacePipeline),u.setBindGroup(0,this.bindGroup),u.setVertexBuffer(0,this.solutionFaceBuffer),u.draw(this.solutionFaceVertexCount)),this.styledLineCount>0&&(u.setPipeline(this.hiddenLinePipeline),u.setBindGroup(0,this.lineBindGroup),u.setVertexBuffer(0,this.styledLineBuffer),u.draw(6,this.styledLineCount)),this.topologyVertexCount>0&&(u.setPipeline(this.hiddenMarkerPipeline),u.setBindGroup(0,this.markerBindGroup),u.setVertexBuffer(0,this.topologyVertexMarkerBuffer),u.draw(Ot,this.topologyVertexCount)),u.end(),l){let t=e.beginRenderPass({colorAttachments:[{view:s.endpointView,clearValue:c,loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:s.depthView,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});t.setPipeline(this.visibleLineIdPipeline),t.setBindGroup(0,this.lineBindGroup),t.setVertexBuffer(0,this.styledLineBuffer),t.draw(6,this.styledLineCount),t.end()}let d=e.beginRenderPass({colorAttachments:[{view:r,resolveTarget:t,loadOp:`load`,storeOp:`discard`}],depthStencilAttachment:{view:i,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});this.styledLineCount>0&&(d.setPipeline(this.visibleLinePipeline),d.setBindGroup(0,this.lineBindGroup),d.setVertexBuffer(0,this.styledLineBuffer),d.draw(6,this.styledLineCount)),this.topologyVertexCount>0&&(d.setPipeline(this.visibleMarkerPipeline),d.setBindGroup(0,this.markerBindGroup),d.setVertexBuffer(0,this.topologyVertexMarkerBuffer),d.draw(Ot,this.topologyVertexCount)),this.hasDragPreview&&(d.setPipeline(this.previewLinePipeline),d.setBindGroup(0,this.lineBindGroup),d.setVertexBuffer(0,this.previewLineBuffer),d.draw(6,1)),this.hasStartMarker&&(d.setPipeline(this.previewMarkerPipeline),d.setBindGroup(0,this.markerBindGroup),d.setVertexBuffer(0,this.previewStartMarkerBuffer),d.draw(Ot,1)),this.hasSnapTarget&&(d.setPipeline(this.previewMarkerPipeline),d.setBindGroup(0,this.markerBindGroup),d.setVertexBuffer(0,this.previewSnapMarkerBuffer),d.draw(Ot,1)),d.end()}getLastMvpMatrix(){return this.lastMvpMatrix}getPreviewLine(){return this.currentPreviewLine}setDragPreview(e){if(this.dirty=!0,p(e)){this.hasDragPreview=!1,this.hasStartMarker=!1,this.hasSnapTarget=!1,this.currentPreviewLine=void 0;return}let{pointA:t,pointB:n}=e.kind===`vertex`?this.computeVertexDragPreviewEndpoints(e):this.computeLineDragPreviewEndpoints(e);this.currentPreviewLine={pointA:t,pointB:n},this.writePreviewLineBuffer(t,n),this.hasDragPreview=!0,e.kind===`vertex`?(this.device.queue.writeBuffer(this.previewStartMarkerBuffer,0,this.createPreviewMarkerData(e.startPosition)),this.hasStartMarker=!0):this.hasStartMarker=!1,p(e.snapTargetPosition)?this.hasSnapTarget=!1:(this.device.queue.writeBuffer(this.previewSnapMarkerBuffer,0,this.createPreviewMarkerData(e.snapTargetPosition)),this.hasSnapTarget=!0)}computeVertexDragPreviewEndpoints(e){let t=p(e.snapTargetPosition)?this.unprojectToVertexPlane(e.cursorScreenX,e.cursorScreenY,e.startPosition):e.snapTargetPosition;return{pointA:e.startPosition,pointB:t}}computeLineDragPreviewEndpoints(e){let t=p(e.snapTargetPosition)?this.unprojectToVertexPlane(e.cursorScreenX,e.cursorScreenY,e.planeAnchor):e.snapTargetPosition;return{pointA:t,pointB:[t[0]+e.sourceDirection[0],t[1]+e.sourceDirection[1],t[2]+e.sourceDirection[2]]}}writePreviewLineBuffer(e,t){let{width:n,color:r,alpha:i}=this.linePreviewStyle,a=this.previewLineStaging;a[0]=e[0],a[1]=e[1],a[2]=e[2],a[3]=t[0],a[4]=t[1],a[5]=t[2],a[6]=n,a[7]=r[0],a[8]=r[1],a[9]=r[2],a[10]=i,this.device.queue.writeBuffer(this.previewLineBuffer,0,a)}applySceneState(e){this.dirty=!0,this.applyStyledMarkers(e.markers),this.applyStyledSegments(e.segments),this.applySolutionFace(e.solutionFace)}applySolutionFace(e){if(e===void 0||e.vertexCount===0){this.solutionFaceVertexCount=0;return}let t=e.vertices.byteLength;t>this.solutionFaceBuffer.size&&(this.solutionFaceBuffer.destroy(),this.solutionFaceBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST})),this.device.queue.writeBuffer(this.solutionFaceBuffer,0,e.vertices),this.solutionFaceVertexCount=e.vertexCount}applyStyledMarkers(e){if(this.topologyVertexCount=e.length,this.topologyVertexCount===0)return;let t=this.topologyVertexCount*H;t>this.topologyVertexMarkerBuffer.size&&(this.topologyVertexMarkerBuffer.destroy(),this.topologyVertexMarkerBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}));let n=new Float32Array(e.length*gt);for(let t=0;t<e.length;t++){let r=e[t],i=t*gt;n[i]=r.position[0],n[i+1]=r.position[1],n[i+2]=r.position[2],n[i+3]=r.markerType,n[i+4]=r.visibleStyle.size,n[i+5]=r.visibleStyle.color[0],n[i+6]=r.visibleStyle.color[1],n[i+7]=r.visibleStyle.color[2],n[i+8]=r.visibleStyle.alpha,n[i+9]=r.visibleStyle.strokeColor[0],n[i+10]=r.visibleStyle.strokeColor[1],n[i+11]=r.visibleStyle.strokeColor[2],n[i+12]=r.visibleStyle.strokeWidth,n[i+13]=r.hiddenStyle.size,n[i+14]=r.hiddenStyle.color[0],n[i+15]=r.hiddenStyle.color[1],n[i+16]=r.hiddenStyle.color[2],n[i+17]=r.hiddenStyle.alpha,n[i+18]=r.hiddenStyle.strokeColor[0],n[i+19]=r.hiddenStyle.strokeColor[1],n[i+20]=r.hiddenStyle.strokeColor[2],n[i+21]=r.hiddenStyle.strokeWidth,n[i+22]=r.vertexIndex}this.device.queue.writeBuffer(this.topologyVertexMarkerBuffer,0,n)}applyStyledSegments(e){if(this.styledLineCount=e.length,this.styledLineCount===0)return;let t=this.styledLineCount*V;t>this.styledLineBuffer.size&&(this.styledLineBuffer.destroy(),this.styledLineBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}));let n=new Float32Array(this.styledLineCount*pt);for(let t=0;t<this.styledLineCount;t++)jt(n,t,e[t]);this.device.queue.writeBuffer(this.styledLineBuffer,0,n)}dispose(){this.uniformBuffer.destroy(),this.faceVertexBuffer.destroy(),this.solutionFaceBuffer.destroy(),this.styledLineBuffer.destroy(),this.topologyVertexMarkerBuffer.destroy(),this.previewLineBuffer.destroy(),this.previewStartMarkerBuffer.destroy(),this.previewSnapMarkerBuffer.destroy(),this.depthTexture?.destroy(),this.samplingDepthTexture?.destroy(),this.lineEndpointTexture?.destroy(),this.lineDepthTexture?.destroy()}unprojectToVertexPlane(e,t,n){let r=this.lastCanvasWidth,i=this.lastCanvasHeight,a=this.lastDevicePixelRatio,o=e*a,s=t*a,c=o/r*2-1,l=1-s/i*2,u=j.transformMat4(j.fromValues(n[0],n[1],n[2],1),this.lastMvpMatrix),d=u[2]/u[3],f=M.inverse(this.lastMvpMatrix),p=j.transformMat4(j.fromValues(c,l,d,1),f);return[p[0]/p[3],p[1]/p[3],p[2]/p[3]]}createAndWriteBuffer(e,t){let n=this.device.createBuffer({size:e.byteLength,usage:t|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(n,0,e),n}createLinePipeline(e,t){let n=this.device.createShaderModule({code:nt});return this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,buffers:[{arrayStride:V,stepMode:`instance`,attributes:mt}]},fragment:{module:n,entryPoint:`fs`,constants:{renderMode:t},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less-equal`,format:z},multisample:{count:4}})}createPreviewLinePipeline(e){let t=this.device.createShaderModule({code:nt});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:V,stepMode:`instance`,attributes:mt}]},fragment:{module:t,entryPoint:`fs`,constants:{renderMode:lt},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:z},multisample:{count:4}})}createDepthPrePassPipeline(e){let t=this.device.createShaderModule({code:tt});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:_t,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:z,depthBias:st,depthBiasSlopeScale:ct}})}createSolutionFacePipeline(e){let t=this.device.createShaderModule({code:it});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:vt,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}]},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:z},multisample:{count:4}})}createMarkerPipeline(e,t,n=!0){let r=this.device.createShaderModule({code:at});return this.device.createRenderPipeline({layout:e,vertex:{module:r,entryPoint:`vs`,buffers:[{arrayStride:H,stepMode:`instance`,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32`},{shaderLocation:2,offset:16,format:`float32`},{shaderLocation:3,offset:20,format:`float32x3`},{shaderLocation:4,offset:32,format:`float32`},{shaderLocation:5,offset:36,format:`float32x3`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32x3`},{shaderLocation:9,offset:68,format:`float32`},{shaderLocation:10,offset:72,format:`float32x3`},{shaderLocation:11,offset:84,format:`float32`},{shaderLocation:12,offset:88,format:`float32`}]}]},fragment:{module:r,entryPoint:`fs`,constants:{renderMode:t,enableLineOcclusion:+!!n},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:z},multisample:{count:4}})}createLineIdPipeline(e,t){let n=this.device.createShaderModule({code:rt});return this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,buffers:[{arrayStride:V,stepMode:`instance`,attributes:ht}]},fragment:{module:n,entryPoint:`fs`,constants:{renderMode:t},targets:[{format:ot}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:z}})}createPreviewMarkerData(e){let t=this.previewMarkerStaging,n=this.vertexPreviewStyle;return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=n.markerType,t[4]=n.size,t[5]=n.color[0],t[6]=n.color[1],t[7]=n.color[2],t[8]=n.alpha,t[9]=n.strokeColor[0],t[10]=n.strokeColor[1],t[11]=n.strokeColor[2],t[12]=n.strokeWidth,t[13]=n.size,t[14]=n.color[0],t[15]=n.color[1],t[16]=n.color[2],t[17]=n.alpha,t[18]=n.strokeColor[0],t[19]=n.strokeColor[1],t[20]=n.strokeColor[2],t[21]=n.strokeWidth,t}ensureDepthView(e,t){return!p(this.depthTexture)&&!p(this.depthTextureView)&&this.depthTexture.width===e&&this.depthTexture.height===t?this.depthTextureView:(this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(B,e),Math.max(B,t)],format:z,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthTextureView=this.depthTexture.createView(),this.depthTextureView)}ensureSamplingDepthView(e,t){let n=Math.max(B,e),r=Math.max(B,t);return!p(this.samplingDepthTexture)&&!p(this.samplingDepthTextureView)&&this.samplingDepthTexture.width===n&&this.samplingDepthTexture.height===r?this.samplingDepthTextureView:(this.samplingDepthTexture?.destroy(),this.samplingDepthTexture=this.device.createTexture({size:[n,r],format:z,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.samplingDepthTextureView=this.samplingDepthTexture.createView(),this.lineBindGroup=this.device.createBindGroup({layout:this.depthBindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:this.samplingDepthTextureView},{binding:2,resource:this.depthSampler}]}),this.samplingDepthTextureView)}ensureLineIdTextures(e,t,n){let r=Math.max(B,e),i=Math.max(B,t);return!p(this.lineEndpointTexture)&&!p(this.lineEndpointTextureView)&&!p(this.lineDepthTextureView)&&this.lineEndpointTexture.width===r&&this.lineEndpointTexture.height===i?{endpointView:this.lineEndpointTextureView,depthView:this.lineDepthTextureView}:(this.lineEndpointTexture?.destroy(),this.lineDepthTexture?.destroy(),this.lineEndpointTexture=this.device.createTexture({size:[r,i],format:ot,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.lineDepthTexture=this.device.createTexture({size:[r,i],format:z,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.lineEndpointTextureView=this.lineEndpointTexture.createView(),this.lineDepthTextureView=this.lineDepthTexture.createView(),this.markerBindGroup=this.device.createBindGroup({layout:this.markerBindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:n},{binding:2,resource:this.depthSampler},{binding:3,resource:this.lineEndpointTextureView},{binding:4,resource:this.lineDepthTextureView}]}),{endpointView:this.lineEndpointTextureView,depthView:this.lineDepthTextureView})}};function At(e,t){for(let n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0}function jt(e,t,n){let r=t*pt;e[r]=n.startPosition[0],e[r+1]=n.startPosition[1],e[r+2]=n.startPosition[2],e[r+3]=n.endPosition[0],e[r+4]=n.endPosition[1],e[r+5]=n.endPosition[2],e[r+6]=n.visibleStyle.width,e[r+7]=n.visibleStyle.color[0],e[r+8]=n.visibleStyle.color[1],e[r+9]=n.visibleStyle.color[2],e[r+10]=n.visibleStyle.alpha,e[r+11]=n.visibleStyle.lineType,e[r+12]=n.visibleStyle.dash,e[r+13]=n.visibleStyle.gap,e[r+14]=n.hiddenStyle.width,e[r+15]=n.hiddenStyle.color[0],e[r+16]=n.hiddenStyle.color[1],e[r+17]=n.hiddenStyle.color[2],e[r+18]=n.hiddenStyle.alpha,e[r+19]=n.hiddenStyle.lineType,e[r+20]=n.hiddenStyle.dash,e[r+21]=n.hiddenStyle.gap,e[r+22]=n.startVertexIndex,e[r+23]=n.endVertexIndex}function Mt(e,t){let n=A.sub(t,e);if(A.len(n)===0)return[[e[0],e[1],e[2]],[t[0],t[1],t[2]]];let r=A.normalize(n);return[A.addScaled(e,r,-20),A.addScaled(t,r,20)]}var U=1e-4;function Nt(e,t,n,r){let i=A.sub(n,t),a=A.sub(r,t),o=A.cross(i,a),s=A.len(o);if(s<U||Math.abs(A.dot(A.sub(e,t),o))/s>U)return!1;let c=A.dot(i,i),l=A.dot(i,a),u=A.dot(a,a),d=A.sub(e,t),f=A.dot(d,i),p=A.dot(d,a),m=c*u-l*l;if(Math.abs(m)<U*U)return!1;let h=(u*f-l*p)/m,g=(c*p-l*f)/m;return 1-h-g>=-1e-4&&h>=-1e-4&&g>=-1e-4}function Pt(e,t,n){for(let r of t)if(Nt(e,n[r[0]],n[r[1]],n[r[2]]))return!0;let r=Lt(n),i=0;for(let a of t){let t=n[a[0]],o=n[a[1]],s=n[a[2]],c=Rt(e,t,o,s),l=[(t[0]+o[0]+s[0])/3,(t[1]+o[1]+s[1])/3,(t[2]+o[2]+s[2])/3],u=A.sub(o,t),d=A.sub(s,t),f=A.cross(u,d),p=A.sub(r,l),m=A.dot(f,p)>0;i+=m?-c:c}return Math.abs(i)>2*Math.PI}function Ft(e){let t=0,n=0,r=0;for(let i of e)t+=i[0],n+=i[1],r+=i[2];let i=e.length;return[t/i,n/i,r/i]}var It=new WeakMap;function Lt(e){let t=It.get(e);if(t!==void 0)return t;let n=Ft(e);return It.set(e,n),n}function Rt(e,t,n,r){let i=A.sub(t,e),a=A.sub(n,e),o=A.sub(r,e),s=A.len(i),c=A.len(a),l=A.len(o),u=A.dot(i,A.cross(a,o)),d=s*c*l+A.dot(i,a)*l+A.dot(a,o)*s+A.dot(i,o)*c;return 2*Math.atan2(u,d)}function W(e,t,n){for(let r of t)if(A.distSq(e,r)<n)return!0;return!1}var zt=1e-6;function Bt(e,t,n,r,i){let a=A.sub(r,n),o=A.sub(i,n),s=A.cross(t,o),c=A.dot(a,s);if(Math.abs(c)<zt)return;let l=1/c,u=A.sub(e,n),d=A.dot(u,s)*l;if(d<0||d>1)return;let f=A.cross(u,a),p=A.dot(t,f)*l;if(!(p<0||d+p>1))return A.dot(o,f)*l}var Vt=[`vertex`,`line`];function Ht(e,t,n,r,i,a,o,s,c=Vt){let l=n*i,u=r*i,d=e*i,f=t*i,p=30*i,m=20*i,h=p**2,g=m**2,_=[];return c.includes(`vertex`)&&Wt(a,s,d,f,l,u,p,h,_),c.includes(`line`)&&Gt(a,o,d,f,l,u,m,g,_),Zt(_)}var Ut=.01;function Wt(e,t,n,r,i,a,o,s,c){for(let l=0;l<t.length;l++){let u=Kt(e,t[l],i,a);if(u.behindCamera)continue;let d=u.screenX-n,f=u.screenY-r,p=d*d+f*f;p>=s||c.push({hit:{type:`vertex`,position:t[l]},normalizedDistance:Math.sqrt(p)/o,depth:u.depth,typeBonus:Ee})}}function Gt(e,t,n,r,i,a,o,s,c){for(let l=0;l<t.length;l++){let u=t[l],[d,f]=u.kind===`edge`||u.kind===`segment`?[u.pointA,u.pointB]:Mt(u.pointA,u.pointB),p=qt(e,d,f,i,a);if(p.start.behindCamera||p.end.behindCamera)continue;let{distanceSquared:m,parameter:h}=Xt(n,r,p.start.screenX,p.start.screenY,p.end.screenX,p.end.screenY);if(m>=s)continue;let g=p.start.depth*p.end.depth/((1-h)*p.end.depth+h*p.start.depth),_=u.kind===`line`?0:De;c.push({hit:{type:`line`,lineId:u.lineId},normalizedDistance:Math.sqrt(m)/o,depth:g,typeBonus:_})}}function Kt(e,t,n,r){let i=j.transformMat4(j.fromValues(t[0],t[1],t[2],1),e);if(i[3]<=0)return{screenX:0,screenY:0,behindCamera:!0,depth:1/0};let a=i[0]/i[3],o=i[1]/i[3];return{screenX:(a+1)*.5*n,screenY:(1-o)*.5*r,behindCamera:!1,depth:i[3]}}function qt(e,t,n,r,i){let a=j.transformMat4(j.fromValues(t[0],t[1],t[2],1),e),o=j.transformMat4(j.fromValues(n[0],n[1],n[2],1),e);if(a[3]<=0&&o[3]<=0)return{start:{screenX:0,screenY:0,behindCamera:!0,depth:1/0},end:{screenX:0,screenY:0,behindCamera:!0,depth:1/0}};let s=a[3]<Ut?Jt(a,o):a,c=o[3]<Ut?Jt(o,a):o;return{start:Yt(s,r,i),end:Yt(c,r,i)}}function Jt(e,t){let n=(Ut-e[3])/(t[3]-e[3]);return j.lerp(e,t,n)}function Yt(e,t,n){let r=e[0]/e[3],i=e[1]/e[3];return{screenX:(r+1)*.5*t,screenY:(1-i)*.5*n,behindCamera:!1,depth:e[3]}}function Xt(e,t,n,r,i,a){let o=i-n,s=a-r,c=o*o+s*s;if(c===0){let i=e-n,a=t-r;return{distanceSquared:i*i+a*a,parameter:0}}let l=Math.max(0,Math.min(1,((e-n)*o+(t-r)*s)/c)),u=n+l*o,d=r+l*s,f=e-u,p=t-d;return{distanceSquared:f*f+p*p,parameter:l}}function Zt(e){if(e.length===0)return;let t=1/0,n=-1/0;for(let r of e)r.depth<t&&(t=r.depth),r.depth>n&&(n=r.depth);let r=n-t,i=-1/0,a;for(let n of e){let e=1-n.normalizedDistance,o=r>0?1-(n.depth-t)/r:1,s=we*e+Te*o+n.typeBonus;s>i&&(i=s,a=n.hit)}return a}var G={type:`none`},Qt=[`vertex`];function $t(e){let{canvas:t,getMvpMatrix:n,getTopology:r}=e;function i(e,i,a){let o=n();if(o===void 0)return;let s=r();return Ht(e,i,t.clientWidth,t.clientHeight,Math.max(1,window.devicePixelRatio),o,s.lines,s.vertices.map(e=>e.position),a)}function a(e,t){let n=i(e,t);return n?.type===`line`?{type:`line`,lineId:n.lineId}:G}function o(e,t){let n=i(e,t);if(n===void 0)return;if(n.type===`vertex`)return{kind:`vertex`,position:n.position};let a=r().lines.find(e=>e.lineId===n.lineId);if(a===void 0)return;let o=A.sub(a.pointB,a.pointA);return{kind:`line`,lineId:n.lineId,direction:[o[0],o[1],o[2]],planeAnchor:a.pointA}}function s(e,t){let n=i(e,t,Qt);return n?.type===`vertex`?n.position:void 0}return{hitTestSelection:a,hitTestDragStart:o,hitTestSnapVertex:s}}var en=100;function tn(){let e=[],t=[];return{push(n){e.push(n),t.length=0,e.length>en&&e.shift()},undo(n){let r=e.pop();if(r!==void 0)return t.push(n),r},redo(n){let r=t.pop();if(r!==void 0)return e.push(n),r},canUndo(){return e.length>0},canRedo(){return t.length>0}}}var nn=1e-10,rn=1e-5,an=1e-4,K=6;function on(e){let t=e.pointA,n=e.pointB,r=e.kind===`line`||e.kind===`edge-extended`||e.kind===`segment-extended`?`l`:`s`;return`${t[0].toFixed(K)},${t[1].toFixed(K)},${t[2].toFixed(K)}|${n[0].toFixed(K)},${n[1].toFixed(K)},${n[2].toFixed(K)}|${r}`}var sn=`||`;function cn(e,t){return e<t?`${e}${sn}${t}`:`${t}${sn}${e}`}function ln(e,t){return`${e}${sn}e:${t}`}function un(e,t){let n=e.indexOf(sn);if(n===-1)return!1;let r=e.slice(0,n),i=e.slice(n+2);return r===t||i===t}var dn=class{cache=new Map;previousLineKeys=new Set;compute(e,t){let n=new Map;for(let t of e){let e=on(t);n.has(e)||n.set(e,{point:t.pointA,direction:A.sub(t.pointB,t.pointA),isSegment:t.kind===`edge`||t.kind===`segment`,lineId:t.lineId})}let r=new Set(n.keys()),i=[];for(let e of r)this.previousLineKeys.has(e)||i.push(e);let a=[];for(let e of this.previousLineKeys)r.has(e)||a.push(e);if(a.length>0){let e=new Set(a);for(let t of this.cache.keys())for(let n of e)if(un(t,n)){this.cache.delete(t);break}}let o=[...r];for(let e of i){let r=n.get(e);h(r!==void 0,`Missing line definition for key: ${e}`);for(let t of o){if(t===e)continue;let i=cn(e,t);if(this.cache.has(i))continue;let a=n.get(t);h(a!==void 0,`Missing line definition for key: ${t}`);let o=hn(r,a);this.cache.set(i,o===void 0?void 0:{position:o,sourceLineIds:[r.lineId,a.lineId]})}for(let n=0;n<t.edges.length;n++){let i=ln(e,n);if(this.cache.has(i))continue;let a=hn(r,gn(n,t));this.cache.set(i,a===void 0?void 0:{position:a,sourceLineIds:[r.lineId]})}}return this.previousLineKeys=r,pn(this.cache,t.vertices)}};function fn(e,t){let n=e.map(e=>({point:e.pointA,direction:A.sub(e.pointB,e.pointA),isSegment:e.kind===`edge`||e.kind===`segment`,lineId:e.lineId})),r=new Map;for(let e=0;e<n.length;e++){for(let t=e+1;t<n.length;t++){let i=hn(n[e],n[t]);r.set(`${e}||${t}`,i===void 0?void 0:{position:i,sourceLineIds:[n[e].lineId,n[t].lineId]})}for(let i=0;i<t.edges.length;i++){let a=hn(n[e],gn(i,t));r.set(`${e}||e:${i}`,a===void 0?void 0:{position:a,sourceLineIds:[n[e].lineId]})}}return pn(r,t.vertices)}function pn(e,t){let n=[],r=[];for(let i of e.values()){if(i===void 0||W(i.position,t,rn))continue;let e=mn(i.position,r,an);if(e!==void 0){let t=n[e],r=[...new Set([...t.sourceLineIds,...i.sourceLineIds])];n[e]={position:t.position,sourceLineIds:r};continue}n.push({position:i.position,sourceLineIds:[...i.sourceLineIds]}),r.push(i.position)}return n}function mn(e,t,n){for(let r=0;r<t.length;r++)if(A.distSq(e,t[r])<n)return r}function hn(e,t){let n=_n(e.point,e.direction,t.point,t.direction);if(n!==void 0&&!(e.isSegment&&(n.parameterA<0||n.parameterA>1))&&!(t.isSegment&&(n.parameterB<0||n.parameterB>1)))return n.midpoint}function gn(e,t){let[n,r]=t.edges[e],i=t.vertices[n],a=t.vertices[r];return{point:i,direction:A.sub(a,i),isSegment:!0,lineId:-1}}function _n(e,t,n,r){let i=A.dot(t,t),a=A.dot(t,r),o=A.dot(r,r),s=i*o-a*a;if(Math.abs(s)<nn)return;let c=A.sub(e,n),l=A.dot(t,c),u=A.dot(r,c),d=(a*u-o*l)/s,f=(i*u-a*l)/s,p=A.addScaled(e,t,d),m=A.addScaled(n,r,f);if(!(A.distSq(p,m)>.01**2))return{midpoint:[(p[0]+m[0])*.5,(p[1]+m[1])*.5,(p[2]+m[2])*.5],parameterA:d,parameterB:f}}var vn=1e-5,yn=1e-10,bn=1e-8;function q(e,t,n=yn){return A.distSq(e,t)<n}function xn(e,t,n){let r=A.sub(n,t),i=A.dot(r,r);if(i<1e-10)return;let a=A.sub(e,t),o=A.dot(a,r)/i,s=A.addScaled(t,r,o);return{parameter:o,distanceSquared:A.distSq(e,s)}}function Sn(e,t,n){let r=xn(e,t,n);return r===void 0?q(e,t):r.distanceSquared<bn}function J(e,t,n){let r=xn(e,t,n);return r===void 0?q(e,t):r.parameter<-.001||r.parameter>1.001?!1:r.distanceSquared<bn}function Cn(e,t,n,r){let i=A.sub(r,n);if(A.len(i)===0)return!1;let a=A.normalize(i),o=A.sub(e,n);if(A.len(A.cross(a,o))>vn)return!1;let s=A.sub(t,n);return A.len(A.cross(a,s))<=vn}function wn(e,t){for(let n of t)if(e>n.start+1e-6&&e<n.end-1e-6)return!0;return!1}function Tn(e,t,n){for(let r of n)if(e>=r.start-1e-6&&t<=r.end+1e-6)return!0;return!1}function En(e,t){for(let n of t)if(Math.abs(e-n)<1e-6)return!0;return!1}function Dn(e){let t=[];for(let n of e)(t.length===0||Math.abs(n-t[t.length-1])>1e-6)&&t.push(n);return t}function On(e){if(e.length===0)return[];let t=[...e].sort((e,t)=>e.start-t.start),n=[t[0]];for(let e=1;e<t.length;e++){let r=t[e],i=n[n.length-1];r.start<=i.end+1e-6?n[n.length-1]={start:i.start,end:Math.max(i.end,r.end)}:n.push(r)}return n}var kn=6;function An(e){return`${e[0].toFixed(kn)},${e[1].toFixed(kn)},${e[2].toFixed(kn)}`}function jn(e){return`${e.lineId}|${[...e.modifiers].sort().join(`:`)}`}function Mn(e){return{...e,startPosition:e.endPosition,endPosition:e.startPosition,startVertexIndex:e.endVertexIndex,endVertexIndex:e.startVertexIndex}}function Nn(e){return A.normalize(A.sub(e.endPosition,e.startPosition))}function Pn(e,t){return e.endVertexIndex!==-1||t.startVertexIndex!==-1?!1:A.dot(Nn(e),Nn(t))>.999999}function Fn(e,t,n,r){let i=e,a=t.length;for(;a>0;){--a;let e=An(i.endPosition),o=n.get(e)??[];if(o.length!==2)break;let s=o.find(e=>!r[e]);if(s===void 0)break;let c=t[s];if(An(c.startPosition)!==e&&(c=Mn(c)),!Pn(i,c))break;r[s]=!0,i={...i,endPosition:c.endPosition,endVertexIndex:c.endVertexIndex}}return i}function In(e){let t=new Map,n=(e,n)=>{let r=t.get(e);r===void 0?t.set(e,[n]):r.push(n)};for(let t=0;t<e.length;t++)n(An(e[t].startPosition),t),n(An(e[t].endPosition),t);let r=[],i=Array(e.length).fill(!1);for(let n=0;n<e.length;n++){if(i[n])continue;i[n]=!0;let a=e[n];a=Fn(a,e,t,i),a=Mn(Fn(Mn(a),e,t,i)),r.push(a)}return r}function Ln(e){if(e.length<2)return e;let t=new Map;for(let n of e){let e=jn(n),r=t.get(e);r===void 0?t.set(e,[n]):r.push(n)}let n=[];for(let e of t.values())e.length===1?n.push(e[0]):n.push(...In(e));return n}var Rn={isSolved:!1,solutionVertexPositions:[],solutionLineRanges:[],solutionInfiniteLineAnchors:[],solutionFaces:[]};function zn(e,t){let n=e.vertices??[],r=e.lines??[],i=e.faces??[],a=i.flatMap(e=>e.map((t,n)=>[t,e[(n+1)%e.length]])),o=[...r,...a];if(n.length===0&&o.length===0)return Rn;for(let e of n)if(!t.vertices.some(t=>q(t.position,e)))return Rn;for(let[e,n]of o)if(!t.lines.some(t=>Bn(t,e,n)))return Rn;let s=i.flat(),c=r.flat();return{isSolved:!0,solutionVertexPositions:[...n,...c,...s],solutionLineRanges:o,solutionInfiniteLineAnchors:r,solutionFaces:i}}function Bn(e,t,n){switch(e.kind){case`line`:case`edge-extended`:case`segment-extended`:return Sn(t,e.pointA,e.pointB)&&Sn(n,e.pointA,e.pointB);case`edge`:case`segment`:return J(t,e.pointA,e.pointB)&&J(n,e.pointA,e.pointB);default:l(e.kind)}}function Vn(e,t,n,r){return J(e,n,r)&&J(t,n,r)}var Hn=1e-4,Un=new WeakMap;function Wn(e,t){let n=Un.get(e);n===void 0&&(n=new WeakMap,Un.set(e,n));let r=n.get(t);if(r!==void 0)return r;let i=e.figureFaceTriangles.some(n=>Pt(t,n,e.vertices));return n.set(t,i),i}function Gn(e,t,n,r,i,a){let o=$n(e,n,r,a);return{segments:tr(e,t,n,r,i,a).map(e=>Zn(e)),markers:o,solutionFace:qn(a)}}var Kn=7;function qn(e){if(!e?.isSolved)return;let t=e.solutionFaces??[];if(t.length===0)return;let n=L(F,`face`,[`solution`]),[r,i,a]=I(n.color),o=n.alpha,s=0;for(let e of t)e.length>=3&&(s+=e.length-2);if(s===0)return;let c=s*3,l=new Float32Array(c*Kn),u=0,d=e=>{l[u]=e[0],l[u+1]=e[1],l[u+2]=e[2],l[u+3]=r,l[u+4]=i,l[u+5]=a,l[u+6]=o,u+=Kn};for(let e of t){if(e.length<3)continue;let t=e[0];for(let n=1;n<e.length-1;n++)d(t),d(e[n]),d(e[n+1])}return{vertices:l,vertexCount:c}}function Jn(e,t){let[n,r]=e.edges[t];return[e.vertices[n],e.vertices[r]]}function Yn(e,t,n,r,i,a){return{startPosition:e,endPosition:t,modifiers:n,lineId:r,startVertexIndex:i,endVertexIndex:a}}function Xn(e){let[t,n,r]=I(e.color);return{width:e.width,color:[t,n,r],alpha:e.alpha,lineType:+(e.line.type===`dashed`),dash:e.line.type===`dashed`?e.line.dash:0,gap:e.line.type===`dashed`?e.line.gap:0}}function Zn(e){let t=[`hidden`,...e.modifiers],n=L(F,`line`,e.modifiers),r=L(F,`line`,t);return{startPosition:e.startPosition,endPosition:e.endPosition,visibleStyle:Xn(n),hiddenStyle:Xn(r),lineId:e.lineId,startVertexIndex:e.startVertexIndex,endVertexIndex:e.endVertexIndex}}function Qn(e){let[t,n,r]=I(e.color),[i,a,o]=I(e.strokeColor);return{size:e.size,color:[t,n,r],alpha:e.alpha,strokeColor:[i,a,o],strokeWidth:e.strokeWidth}}function $n(e,t,n,r){let i=[];for(let a=0;a<t.length;a++){let o=t[a],s=o.position,c=[];o.kind===`input`&&c.push(`input`),(W(s,e.vertices,1e-10)||Wn(e,s))&&c.push(`inner`),lr(o,n)&&c.push(`selected`),r?.isSolved&&r.solutionVertexPositions.some(e=>W(s,[e],1e-10))&&c.push(`solution`);let l=[`hidden`,...c],u=L(F,`vertex`,c),d=L(F,`vertex`,l);i.push({position:s,markerType:+(u.markerType===`circle`),visibleStyle:Qn(u),hiddenStyle:Qn(d),vertexIndex:a})}return i}var er=-2;function tr(e,t,n,r,i,a){let o=ar(r),s=or(r,t,e),c=[];for(let r of t){if(r.kind===`edge`)continue;let t=pr(r,e,n),i=o!==void 0&&r.lineId===o,s=r.kind===`line`||r.kind===`edge-extended`||r.kind===`segment-extended`,l=s&&a?.isSolved===!0&&a.solutionInfiniteLineAnchors.some(([e,t])=>Bn(r,e,t));for(let e of t){let t=e.modifiers.includes(`segment`);if(s&&t&&r.kind!==`edge-extended`)continue;let n=[...e.modifiers];r.kind===`edge-extended`&&t&&!n.includes(`edge`)&&n.push(`edge`),r.isInput&&r.kind!==`edge-extended`&&(r.kind===`segment-extended`?cr(e,r.pointA,r.pointB)&&n.push(`input`):n.push(`input`)),r.kind===`segment`&&!n.includes(`segment`)&&n.push(`segment`),i&&n.push(`selected`),(l||nr(e,a))&&n.push(`solution`),c.push({...e,modifiers:n})}}if(i!==void 0){let t=pr({lineId:er,pointA:i.pointA,pointB:i.pointB,kind:`line`,isInput:!1,startVertexId:-1,endVertexId:-1},e,n);for(let e of t)e.modifiers.includes(`segment`)||c.push({...e,modifiers:[...e.modifiers,`preview`]})}return Ln(rr([...dr(e,t,n,s,a),...c]))}function nr(e,t){return t?.isSolved?t.solutionLineRanges.some(([t,n])=>Vn(e.startPosition,e.endPosition,t,n)):!1}function rr(e){let t=new Map;for(let n of e){let e=ir(n.startPosition,n.endPosition),r=t.get(e);(r===void 0||n.modifiers.length>r.modifiers.length)&&t.set(e,n)}return[...t.values()]}var Y=6;function ir(e,t){let n=`${e[0].toFixed(Y)},${e[1].toFixed(Y)},${e[2].toFixed(Y)}`,r=`${t[0].toFixed(Y)},${t[1].toFixed(Y)},${t[2].toFixed(Y)}`;return n<r?`${n}|${r}`:`${r}|${n}`}function ar(e){switch(e.type){case`line`:return e.lineId;case`none`:return;default:l(e)}}function or(e,t,n){let r=new Set;switch(e.type){case`line`:{let i=e.lineId;for(let e of t)if(e.lineId===i)for(let t=0;t<n.edges.length;t++){let[i,a]=Jn(n,t);(e.kind===`line`?Cn(i,a,e.pointA,e.pointB):sr(i,a,e.pointA,e.pointB))&&r.add(t)}break}case`none`:break;default:l(e)}return r}function sr(e,t,n,r){return q(e,n)&&q(t,r)||q(e,r)&&q(t,n)}function cr(e,t,n){let r=[(e.startPosition[0]+e.endPosition[0])/2,(e.startPosition[1]+e.endPosition[1])/2,(e.startPosition[2]+e.endPosition[2])/2],i=xn(r,t,n);return i===void 0?q(r,t):i.parameter>=-.001&&i.parameter<=1.001}function lr(e,t){switch(t.type){case`none`:return!1;case`line`:return e.crossLineIds.includes(t.lineId);default:l(t)}}var ur=-1;function dr(e,t,n,r,i){let a=[],o=fr(e,t),s=new Map;for(let e=0;e<n.length;e++)s.set(n[e].vertexId,e);let c=(e,t,n,r,o)=>{let s=[...n];i?.isSolved&&i.solutionLineRanges.some(([n,r])=>Vn(e,t,n,r))&&s.push(`solution`),a.push(Yn(e,t,s,ur,r,o))};for(let t=0;t<e.edges.length;t++){let[i,a]=e.edges[t],l=e.vertices[i],u=e.vertices[a],d=o.get(t);if(d?.kind===`edge-extended`)continue;let f=[`edge`,`segment`];r.has(t)&&f.push(`selected`);let p=d===void 0?-1:s.get(d.startVertexId)??-1,m=d===void 0?-1:s.get(d.endVertexId)??-1,h=A.sub(u,l),g=A.dot(h,h);if(g<1e-6||d===void 0){c(l,u,f,p,m);continue}let _=[];for(let e=0;e<n.length;e++){let t=n[e];if(t.vertexId===d.startVertexId||t.vertexId===d.endVertexId||!t.crossLineIds.includes(d.lineId))continue;let r=A.sub(t.position,l),i=A.dot(r,h)/g;i<=1e-6||i>=1-1e-6||_.push({parameter:i,markerIndex:e})}if(_.length===0){c(l,u,f,p,m);continue}_.sort((e,t)=>e.parameter-t.parameter);let v=l,y=p;for(let e of _){let t=A.addScaled(l,h,e.parameter);c(v,t,f,y,e.markerIndex),v=t,y=e.markerIndex}c(v,u,f,y,m)}return a}function fr(e,t){let n=new Map,r=t.filter(e=>e.kind===`edge`||e.kind===`edge-extended`);for(let t=0;t<e.edges.length;t++){let[i,a]=e.edges[t],o=e.vertices[i],s=e.vertices[a];for(let e of r)if(sr(o,s,e.pointA,e.pointB)){n.set(t,e);break}}return n}function pr(e,t,n){let[r,i]=e.kind===`segment`||e.kind===`edge`?[e.pointA,e.pointB]:Mt(e.pointA,e.pointB),a=A.sub(i,r),o=A.len(a);if(o===0)return[];let s=A.normalize(a),c=mr(e,t),l=hr(r,s,o,t),u=gr(r,s,o,t),d=c.map(e=>{let[n,i]=Jn(t,e),a=X(n,r,s,o),c=X(i,r,s,o);return{start:Math.min(a,c),end:Math.max(a,c)}}),f=X(e.pointA,r,s,o),p=X(e.pointB,r,s,o),m=new Set;m.add(0),m.add(1),m.add(f),m.add(p);for(let e of l)m.add(e);for(let e of u)m.add(e.start),m.add(e.end);for(let e of d)m.add(e.start),m.add(e.end);let h=new Map;for(let e=0;e<n.length;e++){let t=n[e].position,i=X(t,r,s,o),a=Z(i,r,s,o);A.distSq(t,a)<1e-8&&(h.set(i,e),i>1e-6&&i<1-1e-6&&m.add(i))}let g=Dn([...m].sort((e,t)=>e-t)),_=On(u),v=[];for(let n=0;n<g.length-1;n++){let i=g[n],a=g[n+1];if(a-i<1e-6)continue;let c=(i+a)/2,l=Z(i,r,s,o),u=Z(a,r,s,o),f=vr(i,h),p=vr(a,h);if(Tn(i,a,d)){v.push(Yn(l,u,[`segment`],e.lineId,f,p));continue}if(wn(c,_)){v.push(Yn(l,u,[`inner`],e.lineId,f,p));continue}let m=Wn(t,Z(c,r,s,o));v.push(Yn(l,u,m?[`inner`]:[],e.lineId,f,p))}return v}function X(e,t,n,r){return A.dot(A.sub(e,t),n)/r}function Z(e,t,n,r){return A.addScaled(t,n,e*r)}function mr(e,t){let n=[];for(let r=0;r<t.edges.length;r++){let[i,a]=Jn(t,r);Cn(i,a,e.pointA,e.pointB)&&n.push(r)}return n}function hr(e,t,n,r){let i=[];for(let a of r.faceTriangles){let o=r.vertices[a[0]],s=r.vertices[a[1]],c=r.vertices[a[2]],l=Bt(e,t,o,s,c);if(l!==void 0&&l>0){let e=l/n;e>1e-6&&e<1-1e-6&&!En(e,i)&&i.push(e)}}return i}function gr(e,t,n,r){let i=[];for(let a=0;a<r.faces.length;a++){let o=r.faces[a];if(o.length<3)continue;let s=o.map(e=>r.vertices[e]),c=A.sub(s[1],s[0]),l=A.sub(s[2],s[0]),u=A.cross(c,l);if(A.len(u)<1e-6)continue;let d=A.normalize(u);if(Math.abs(A.dot(t,d))>Hn)continue;let f=A.dot(A.sub(e,s[0]),d);if(Math.abs(f)>Hn)continue;let p=_r(e,t,n,s);p!==void 0&&i.push(p)}return i}function _r(e,t,n,r){let i=0,a=1,o=A.sub(r[1],r[0]),s=A.sub(r[2],r[0]),c=A.cross(o,s);for(let o=0;o<r.length;o++){let s=(o+1)%r.length,l=r[o],u=r[s],d=A.sub(u,l),f=A.cross(c,d);if(A.len(f)<1e-6)continue;let p=A.normalize(f),m=A.dot(A.sub(e,l),p),h=A.dot(t,p)*n;if(Math.abs(h)<1e-6){if(m<-1e-6)return;continue}let g=-m/h;if(h<0?a=Math.min(a,g):i=Math.max(i,g),i>a)return}if(!(a-i<1e-6))return{start:i,end:a}}function vr(e,t){let n=t.get(e);if(n!==void 0)return n;for(let[n,r]of t)if(Math.abs(e-n)<1e-6)return r;return-1}var yr=1e-4,br=1e-5;function xr(e,t,n){let r=t?.vertices?.map(e=>[e[0],e[1],e[2]])??[],i=0,a=e.edges.map(([t,n])=>({lineId:i++,pointA:e.vertices[t],pointB:e.vertices[n],kind:`edge`,isInput:!0,startVertexId:-1,endVertexId:-1})),o=t?.lines?.map(([e,t])=>({lineId:i++,pointA:[e[0],e[1],e[2]],pointB:[t[0],t[1],t[2]],kind:`line`,isInput:!0,startVertexId:-1,endVertexId:-1}))??[],s=t?.segments?.map(([e,t])=>({lineId:i++,pointA:[e[0],e[1],e[2]],pointB:[t[0],t[1],t[2]],kind:`segment`,isInput:!0,startVertexId:-1,endVertexId:-1}))??[],c=[...a,...o,...s];return Q({figures:[e],lines:c,vertices:[],intersections:[],nextLineId:i,nextVertexId:0},e,r,n)}function Sr(e,t,n,r,i){let a=Ar(e,t,n);if(a!==void 0)return a.kind===`edge`||a.kind===`segment`?wr(e,a.lineId,r,i):e;let o={lineId:e.nextLineId,pointA:t,pointB:n,kind:`line`,isInput:!1,startVertexId:-1,endVertexId:-1};return Q({...e,lines:[...e.lines,o],nextLineId:e.nextLineId+1},r,Er(e),i)}function Cr(e,t,n,r){let i=e.lines.find(e=>e.lineId===t);return i===void 0||i.isInput?e:Q({...e,lines:e.lines.filter(e=>e.lineId!==t)},n,Er(e),r)}function wr(e,t,n,r){let i=e.lines.find(e=>e.lineId===t);if(i===void 0||i.kind!==`edge`&&i.kind!==`segment`)return e;let a=i.kind===`edge`?`edge-extended`:`segment-extended`,o=e.lines.map(e=>e.lineId===t?{...e,kind:a}:e);return Q({...e,lines:o},n,Er(e),r)}function Tr(e,t,n,r){let i=e.lines.find(e=>e.lineId===t);if(i===void 0||i.kind!==`edge-extended`&&i.kind!==`segment-extended`)return e;let a=i.kind===`edge-extended`?`edge`:`segment`,o=e.lines.map(e=>e.lineId===t?{...e,kind:a}:e);return Q({...e,lines:o},n,Er(e),r)}function Er(e){return e.vertices.filter(e=>e.kind===`input`).map(e=>e.position)}function Q(e,t,n,r){let i=r?r.compute(e.lines,t):fn(e.lines,t),{vertices:a,nextVertexId:o}=Dr(t,n,i,e.nextVertexId),s=Mr(e.lines,a),c=Or(a,s,i);return{...e,lines:s,intersections:i,vertices:c,nextVertexId:o}}function Dr(e,t,n,r){let i=r,a=e.vertices.map(e=>({vertexId:i++,position:e,kind:`figure`,crossLineIds:[]})),o=t.filter(t=>!W(t,e.vertices,br)).map(e=>({vertexId:i++,position:e,kind:`input`,crossLineIds:[]})),s=[...e.vertices,...o.map(e=>e.position)],c=n.filter(e=>!W(e.position,s,br)).map(e=>({vertexId:i++,position:e.position,kind:`intersection`,crossLineIds:[]}));return{vertices:[...a,...o,...c],nextVertexId:i}}function Or(e,t,n){let r=new Map;for(let e of n){let t=jr(e.position),n=r.get(t);if(n!==void 0)for(let t of e.sourceLineIds)n.includes(t)||n.push(t);else r.set(t,[...e.sourceLineIds])}return e.map(e=>{let n;switch(e.kind){case`intersection`:{let t=jr(e.position);n=r.get(t)??[];break}case`figure`:case`input`:{let i=[];for(let n of t)(n.startVertexId===e.vertexId||n.endVertexId===e.vertexId||kr(e.position,n))&&i.push(n.lineId);let a=jr(e.position),o=r.get(a);if(o!==void 0)for(let e of o)i.includes(e)||i.push(e);n=i;break}default:l(e.kind)}return{...e,crossLineIds:n}})}function kr(e,t){return t.kind===`edge`||t.kind===`segment`?J(e,t.pointA,t.pointB):Sn(e,t.pointA,t.pointB)}function Ar(e,t,n){for(let r of[t,n]){let i=e.vertices.find(e=>Nr(e.position,r));if(i===void 0||i.crossLineIds.length===0)continue;let a=r===t?n:t;for(let t of i.crossLineIds){let n=e.lines.find(e=>e.lineId===t);if(n!==void 0&&Sn(a,n.pointA,n.pointB))return n}}}function jr(e){return`${e[0].toFixed(6)},${e[1].toFixed(6)},${e[2].toFixed(6)}`}function Mr(e,t){return e.map(e=>{let n=-1,r=-1;for(let i of t)if(n===-1&&Nr(i.position,e.pointA)&&(n=i.vertexId),r===-1&&Nr(i.position,e.pointB)&&(r=i.vertexId),n!==-1&&r!==-1)break;return{...e,startVertexId:n,endVertexId:r}})}function Nr(e,t){return A.distSq(e,t)<yr}function Pr(e){let{puzzle:t,figureTopology:n,onHistoryChange:r}=e,i=new dn,a=tn(),o,s=xr(n,t.input,i),c=G,u;function d(){let e=zn(t.expected,s),r=Gn(n,s.lines,s.vertices,c,u,e);o?.applySceneState(r)}function f(){r(a.canUndo(),a.canRedo())}function p(e){a.push(s),s=e,d(),f()}function m(){return s}function h(){return c.type!==`none`}function g(e){return c.type===`line`&&c.lineId===e}function _(e){c=e,d()}function v(e){u=e,d()}function y(){switch(c.type){case`line`:{let e=c.lineId,t=s.lines.find(t=>t.lineId===e);return t===void 0?void 0:A.sub(t.pointB,t.pointA)}case`none`:return;default:l(c)}}function b(e,t){p(Sr(s,e,t,n,i)),_(G)}function x(e){let t=y();if(t!==void 0){let r=[e[0]+t[0],e[1]+t[1],e[2]+t[2]];p(Sr(s,e,r,n,i))}_(G)}function S(e){let t=s.lines.find(t=>t.lineId===e);if(t!==void 0)switch(c=G,t.kind){case`edge`:case`segment`:p(wr(s,e,n,i));break;case`edge-extended`:case`segment-extended`:p(Tr(s,e,n,i));break;case`line`:p(Cr(s,e,n,i));break;default:l(t.kind)}}function C(e){e!==void 0&&(s=e,d(),_(G),f())}function ee(){C(a.undo(s))}function w(){C(a.redo(s))}function T(e){o=e,d()}return{getTopology:m,hasSelection:h,isLineSelected:g,setSelection:_,setPreviewLine:v,connectVertices:b,createParallelLineAtVertex:x,toggleLineExtension:S,undo:ee,redo:w,attachRenderer:T}}function Fr(e){let{canvas:t,puzzle:n,onHistoryChange:r,onFpsUpdate:i}=e,a,{topology:o}=Ae(n),s=Fe(t,n.camera),c=new ee(10),l=Pr({puzzle:n,figureTopology:o,onHistoryChange:r}),u=$t({canvas:t,getTopology:l.getTopology,getMvpMatrix:()=>a?.getLastMvpMatrix()});function d(e,t){l.setSelection(u.hitTestSelection(e,t))}function f(){c.raise(60)}t.addEventListener(`pointerdown`,f),t.addEventListener(`pointermove`,f),t.addEventListener(`wheel`,f);let p=Ie(t,d,()=>{}),m=Le(t,{performInitialHitTest:u.hitTestDragStart,performSnapHitTest:u.hitTestSnapVertex,hasActiveSelection:l.hasSelection,isLineSelected:l.isLineSelected,onDragStart:()=>{},onDragUpdate:e=>{a?.setDragPreview(e),l.setPreviewLine(a?.getPreviewLine())},onLineTap:e=>l.setSelection({type:`line`,lineId:e}),onLineDoubleTap:l.toggleLineExtension,onVertexTap:l.createParallelLineAtVertex,onDragComplete:l.connectVertices,onSecondPointer:(e,t,n)=>{s.registerExternalPointer(e,t,n)}}),h=oe({init:()=>Ir(t,s,o,n,c,i),onReady:({sceneLayer:e})=>{a=e,l.attachRenderer(e)},initErrorMessage:`Failed to initialize stereometry renderer`});return{destroy:()=>{a=void 0,s.destroy(),c.dispose(),t.removeEventListener(`pointerdown`,f),t.removeEventListener(`pointermove`,f),t.removeEventListener(`wheel`,f),p(),m(),h()},camera:s,undo:l.undo,redo:l.redo}}async function Ir(e,t,n,r,i,a){let o=await ie(e),s=w(4),c=new kt(t,s,n,i,r.camera?.center??[0,0,0],r.camera?.projection??`perspective`),l=new re([c]);l.initAll(o);let u=ae({canvas:e,context:o,layerManager:l,fpsController:i,onFpsUpdate:a,shouldRender:()=>c.consumeDirty(),onResize:()=>i.raise(60)});return{cleanup:()=>{u(),l.dispose(),s.dispose(),o.device.destroy()},sceneLayer:c}}var Lr=class{canUndo=!1;canRedo=!1;fps=0;interactionMode=`rotate`;controls;constructor(){f(this,{controls:!1},{autoBind:!0})}attach(e){this.controls=e,this.canUndo=!1,this.canRedo=!1,this.fps=0,e.camera.setInteractionMode(this.interactionMode)}detach(){this.controls=void 0}setHistoryAvailability(e,t){this.canUndo=e,this.canRedo=t}setFps(e){this.fps=e}setInteractionMode(e){this.interactionMode=e,this.controls?.camera.setInteractionMode(e)}undo(){this.controls?.undo()}redo(){this.controls?.redo()}dispose(){this.detach()}};function Rr(e){return`stereometry:${e}`}function zr(e){let t=x(),n=Rr(e),r=t.getOrCreateFeatureStore(n,()=>new Lr);return T(t,n),r}var $=t(),Br=(0,P.memo)(()=>{let[e,t]=(0,P.useState)(!1);return(0,$.jsxs)(k,{open:e,onOpenChange:t,children:[(0,$.jsx)(m,{title:N.toolbar.help,delayDuration:300,children:(0,$.jsx)(ne,{asChild:!0,children:(0,$.jsx)(`button`,{type:`button`,"aria-label":N.toolbar.help,className:r(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,e?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,$.jsx)(a,{size:20})})})}),(0,$.jsx)(E,{children:(0,$.jsxs)(D,{side:`top`,sideOffset:8,align:`end`,collisionPadding:16,className:r(`z-50 w-72 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,$.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,$.jsx)(`span`,{className:`font-semibold text-white`,children:N.help.title}),(0,$.jsx)(te,{"aria-label":N.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,$.jsx)(v,{size:14})})]}),(0,$.jsx)(`p`,{className:`mb-3 text-neutral-400`,children:N.help.description}),(0,$.jsxs)(`ul`,{className:`space-y-1.5 text-neutral-300`,children:[(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:N.help.controlLabels.drag}),` —`,` `,N.help.controls.drag]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:N.help.controlLabels.shiftDrag}),` `,`— `,N.help.controls.shiftDrag]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:N.help.controlLabels.scrollPinch}),` `,`— `,N.help.controls.scrollPinch]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:N.help.controlLabels.clickEdge}),` `,`— `,N.help.controls.clickEdge]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:N.help.controlLabels.doubleClickEdge}),` `,`— `,N.help.controls.doubleClickEdge]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:N.help.controlLabels.doubleClickLine}),` `,`— `,N.help.controls.doubleClickLine]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:N.help.controlLabels.dragVertex}),` `,`— `,N.help.controls.dragVertex]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:N.help.controlLabels.selectEdgeTapVertex}),` `,`— `,N.help.controls.selectEdgeTapVertex]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:N.help.controlLabels.holdDragLineVertex}),` `,`— `,N.help.controls.holdDragLineVertex]})]}),(0,$.jsx)(`p`,{className:`mt-3 text-xs text-neutral-500`,children:N.help.intersectionHint}),(0,$.jsx)(O,{className:`fill-neutral-900`})]})})]})}),Vr=(0,P.memo)(({puzzle:e})=>{let[t,n]=(0,P.useState)(!1),i=N.puzzles[e.id];return i===void 0?null:(0,$.jsxs)(k,{open:t,onOpenChange:n,children:[(0,$.jsx)(m,{title:N.toolbar.puzzle,delayDuration:300,children:(0,$.jsx)(ne,{asChild:!0,children:(0,$.jsx)(`button`,{type:`button`,"aria-label":N.toolbar.puzzle,className:r(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,t?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,$.jsx)(de,{size:20})})})}),(0,$.jsx)(E,{children:(0,$.jsxs)(D,{side:`top`,sideOffset:8,align:`end`,collisionPadding:16,className:r(`z-50 w-72 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,$.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,$.jsx)(`span`,{className:`font-semibold text-white`,children:i.name}),(0,$.jsx)(te,{"aria-label":N.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,$.jsx)(v,{size:14})})]}),e.solutionImage!==void 0&&(0,$.jsx)(`img`,{src:e.solutionImage,alt:N.solutionImageAlt,className:`mb-3 w-full rounded-md border border-neutral-700 object-cover`}),(0,$.jsx)(`p`,{className:`text-neutral-300`,children:i.description}),(0,$.jsx)(O,{className:`fill-neutral-900`})]})})]})}),Hr=(0,P.memo)(({active:e=!1,disabled:t=!1,onClick:n,children:i,label:a,tooltipDelayMs:o=300})=>(0,$.jsx)(m,{title:a,delayDuration:o,children:(0,$.jsx)(`button`,{type:`button`,onClick:n,disabled:t,"aria-label":a,"aria-pressed":e,className:r(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all`,t?`bg-neutral-900 text-neutral-600 cursor-not-allowed`:`hover:scale-110 active:scale-95`,!t&&e&&`bg-blue-500 text-white`,!t&&!e&&`bg-neutral-800 text-neutral-400 hover:text-white`),children:i})})),Ur=se(),Wr=d(({puzzle:e})=>{let t=(0,P.useRef)(null),n=zr(e.id),r=y(),i=b(()=>{r(`/stereometry`)});g({label:N.nav.backToPuzzlesLabel,onActivate:i}),(0,P.useEffect)(()=>{let r=t.current;if(p(r))return;let i=Fr({canvas:r,puzzle:e,onHistoryChange:n.setHistoryAvailability,onFpsUpdate:n.setFps});return n.attach(i),()=>{n.detach(),i.destroy()}},[e,n]);let a=b(()=>{n.setInteractionMode(`rotate`)}),l=b(()=>{n.setInteractionMode(`pan`)});return(0,$.jsx)(C,{className:`h-full w-full`,children:(0,$.jsxs)(`div`,{className:`h-full w-full`,children:[(0,$.jsx)(`canvas`,{ref:t,className:`h-full w-full [touch-action:none]`}),!Ur&&(0,$.jsxs)(`div`,{className:`absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400`,children:[n.fps,` FPS`]}),(0,$.jsxs)(`div`,{className:`fixed right-4 bottom-4 flex gap-2`,children:[(0,$.jsx)(Vr,{puzzle:e}),(0,$.jsx)(Br,{}),(0,$.jsx)(Hr,{onClick:n.undo,label:N.toolbar.undo,disabled:!n.canUndo,children:(0,$.jsx)(s,{size:20})}),(0,$.jsx)(Hr,{onClick:n.redo,label:N.toolbar.redo,disabled:!n.canRedo,children:(0,$.jsx)(o,{size:20})}),(0,$.jsx)(Hr,{active:n.interactionMode===`rotate`,onClick:a,label:N.toolbar.rotate,children:(0,$.jsx)(c,{size:20})}),(0,$.jsx)(Hr,{active:n.interactionMode===`pan`,onClick:l,label:N.toolbar.pan,children:(0,$.jsx)(ue,{size:20})})]})]})})}),Gr=(0,P.memo)(()=>{let{puzzleId:e}=_(),t=le(e);return p(t)?(0,$.jsx)(u,{to:`/stereometry`,replace:!0}):(0,$.jsx)(Wr,{puzzle:t})});export{Gr as Stereometry};