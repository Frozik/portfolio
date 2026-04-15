import{r as e}from"./c-BlVx34DW.js";import{F as t,I as n,L as r,t as i,y as a}from"./c-BV2HkZqA.js";import{_ as o,d as s,g as c,h as l,m as u,p as d,v as f}from"./c-BLmXiByy.js";import{i as p,n as m,r as h,t as g}from"./c-CYmhJQ9Q.js";import{t as _}from"./c-DwE7GUG5.js";import{a as v,i as y,n as b,r as x,t as S}from"./c-wo9X1jdP.js";import{n as ee,t as C}from"./c-CjqPSPN9.js";import{t as w}from"./c-Cro6zuhI.js";var T=p(`move`,[[`path`,{d:`M12 2v20`,key:`t6zp3m`}],[`path`,{d:`m15 19-3 3-3-3`,key:`11eu04`}],[`path`,{d:`m19 9 3 3-3 3`,key:`1mg7y2`}],[`path`,{d:`M2 12h20`,key:`9i4pu4`}],[`path`,{d:`m5 9-3 3 3 3`,key:`j64kie`}],[`path`,{d:`m9 5 3-3 3 3`,key:`l8vdw6`}]]),te=p(`redo-2`,[[`path`,{d:`m15 14 5-5-5-5`,key:`12vg1m`}],[`path`,{d:`M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13`,key:`6uklza`}]]),ne=p(`rotate-ccw`,[[`path`,{d:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`1357e3`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}]]),E=e(n(),1),D=t(),re=Math.PI/2.3,ie=Math.PI/30,ae=.005,oe=.003,se=.01,ce=.95,le=.1,ue=.1,de=.001,fe=Math.PI/4,O=.1,pe=Math.tan(fe/2),k=1e3,me=1e3,he=.45,ge=.1,A={line:{color:`#FFFFFF`,width:1,alpha:1,line:{type:`solid`}},"line:hidden":{alpha:.3,line:{type:`dashed`,dash:10,gap:10}},"line:selected":{color:`#55AAFF`},"line:hidden:selected":{alpha:1},"line:segment":{width:3},"line:preview:segment":{color:`#44BB88`},"line:inner":{width:3},vertex:{markerType:`circle`,color:`#FFFFFF`,size:10,strokeColor:`#44AAFF`,strokeWidth:3},"vertex:hidden":{color:`#1A1A1F`},"vertex:selected":{color:`#55AAFF`},"vertex:hidden:selected":{alpha:1},"vertex:inner":{strokeColor:`#AAFF44`},"vertex:preview":{strokeColor:`#44BB88`,strokeWidth:6,size:16},background:{color:`#1A1A1F`}};function _e(e,t){let n=t?.distance?.min??3,r=t?.distance?.max??15,i=t?.distance?.initial??5,a=t?.center??[0,0,0],o=t?.angle?.azimuth??ie,s=t?.angle?.elevation??re,c=i,l=i,u=[a[0],a[1],a[2]],d=`rotate`,f=0,p=0,m=0;function h(){return[u[0]+Math.sin(s)*Math.sin(o)*c,u[1]+Math.cos(s)*c,u[2]+Math.sin(s)*Math.cos(o)*c]}function g(){return[-Math.cos(s)*Math.sin(o),Math.sin(s),-Math.cos(s)*Math.cos(o)]}function _(){return[Math.cos(o),0,-Math.sin(o)]}function v(e){let t=-e*ae;o+=t;let n=u[0]-a[0],r=u[2]-a[2],i=Math.cos(t),s=Math.sin(t);u[0]=a[0]+n*i+r*s,u[2]=a[2]-n*s+r*i}function y(e,t){let n=oe*c,r=_();u[0]-=r[0]*e*n,u[1]+=t*n,u[2]-=r[2]*e*n}function x(e){return Math.max(n,Math.min(r,e))}function ee(){f=0,p=0,m=0}let C=new Map,w=!1,T=0;function te(){let e=[...C.values()],t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}function ne(e){C.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),C.size===1?w=e.shiftKey:C.size===2&&(T=te())}function E(e){let t=C.get(e.pointerId);if(t===void 0)return;if(C.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),C.size===2){let e=te(),t=T/e;l=x(l*t),T=e;return}if(C.size!==1)return;let n=e.clientX-t.clientX,r=e.clientY-t.clientY;w||d===`pan`?(p=n,m=r,f=0,y(n,r)):(f=n,p=0,m=0,v(n))}function D(e){C.delete(e.pointerId),C.size===0&&(w=!1)}function fe(e){C.delete(e.pointerId)}function O(e){e.preventDefault(),l=x(l*(1+e.deltaY*se))}return e.addEventListener(`pointerdown`,ne),window.addEventListener(`pointermove`,E),window.addEventListener(`pointerup`,D),window.addEventListener(`pointercancel`,fe),e.addEventListener(`wheel`,O,{passive:!1}),{tick(){let e=Math.abs(l-c)>de;if(e?c+=(l-c)*ue:c=l,C.size>0)return!0;let t=Math.abs(f)>=le,n=Math.abs(p)>=.1||Math.abs(m)>=.1;return!t&&!n?(ee(),e):(t&&(v(f),f*=ce),n&&(y(p,m),p*=ce,m*=ce),!0)},getViewMatrix(){let e=h(),t=g();return S.lookAt(b.fromValues(e[0],e[1],e[2]),b.fromValues(u[0],u[1],u[2]),b.fromValues(t[0],t[1],t[2]))},getEyePosition(){return h()},getDistance(){return c},setInteractionMode(e){d=e,ee()},destroy(){e.removeEventListener(`pointerdown`,ne),window.removeEventListener(`pointermove`,E),window.removeEventListener(`pointerup`,D),window.removeEventListener(`pointercancel`,fe),e.removeEventListener(`wheel`,O)}}}function ve(e,t,n){let r=0,i=0,a=0,o,s=0,c=0,l=0;function u(e,t){let n=Math.abs(e-r),o=Math.abs(t-i),s=performance.now()-a;return n<3&&o<3&&s<300}function d(e,r){let i=performance.now(),a=i-l,o=Math.sqrt((e-s)**2+(r-c)**2);a<400&&o<10?(n(e,r),l=0):(t(e,r),s=e,c=r,l=i)}function f(e){e.isPrimary&&(o=e.pointerId,r=e.clientX,i=e.clientY,a=performance.now())}function p(t){if(t.pointerId===o&&(o=void 0,u(t.clientX,t.clientY))){let n=e.getBoundingClientRect();d(t.clientX-n.left,t.clientY-n.top)}}return e.addEventListener(`pointerdown`,f),window.addEventListener(`pointerup`,p),()=>{e.removeEventListener(`pointerdown`,f),window.removeEventListener(`pointerup`,p)}}function ye(e,t){let n=!1,r,i=[0,0,0];function a(t,n){let r=e.getBoundingClientRect();return{screenX:t-r.left,screenY:n-r.top}}function o(e,t){return e[0]===t[0]&&e[1]===t[1]&&e[2]===t[2]}function s(e){let{screenX:o,screenY:s}=a(e.clientX,e.clientY),c=t.performPointHitTest(o,s);return c===void 0?!1:(n=!0,r=e.pointerId,i=c,t.onDragStart(),t.onDragUpdate({startPosition:i,cursorScreenX:o,cursorScreenY:s,snapTargetPosition:void 0}),!0)}function c(e,n){let{screenX:r,screenY:s}=a(e,n),c=t.performPointHitTest(r,s);t.onDragUpdate({startPosition:i,cursorScreenX:r,cursorScreenY:s,snapTargetPosition:c!==void 0&&!o(c,i)?c:void 0})}function l(e,s){let{screenX:c,screenY:l}=a(e,s),u=t.performPointHitTest(c,l);u!==void 0&&!o(u,i)?t.onDragComplete(i,u):t.onVertexTap(i),n=!1,r=void 0,t.onDragUpdate(void 0)}function u(){n=!1,r=void 0,t.onDragUpdate(void 0)}function d(e){if(n){u(),e.stopPropagation();return}e.isPrimary&&s(e)&&e.stopPropagation()}function f(e){!n||e.pointerId!==r||c(e.clientX,e.clientY)}function p(e){!n||e.pointerId!==r||l(e.clientX,e.clientY)}return e.addEventListener(`pointerdown`,d,{capture:!0}),window.addEventListener(`pointermove`,f),window.addEventListener(`pointerup`,p),()=>{e.removeEventListener(`pointerdown`,d,{capture:!0}),window.removeEventListener(`pointermove`,f),window.removeEventListener(`pointerup`,p)}}var j=function(e){return e[e.Idle=1]=`Idle`,e[e.Resize=60]=`Resize`,e[e.Interaction=60]=`Interaction`,e[e.Animation=60]=`Animation`,e}({}),be=500,xe=class{activeLevels=new Map;fallbackFps;constructor(e=j.Idle){this.fallbackFps=e}raise(e){let t=this.activeLevels.get(e);t!==void 0&&clearTimeout(t);let n=setTimeout(()=>{this.activeLevels.delete(e)},be);this.activeLevels.set(e,n)}getFrameIntervalMs(){return me/this.getCurrentFps()}getCurrentFps(){if(this.activeLevels.size===0)return this.fallbackFps;let e=0;for(let t of this.activeLevels.keys())t>e&&(e=t);return e}dispose(){for(let e of this.activeLevels.values())clearTimeout(e);this.activeLevels.clear()}};function Se(e){let t=[],n=[],r=new Set,i=[];for(let a of e.input.figures){let e=t.length;for(let e of a.vertices)t.push([e[0],e[1],e[2]]);for(let t of a.faces){let a=t.map(t=>t+e);n.push(a);for(let e=0;e<a.length;e++){let t=(e+1)%a.length,n=Math.min(a[e],a[t]),o=Math.max(a[e],a[t]),s=`${n}-${o}`;r.has(s)||(r.add(s),i.push([n,o]))}}}let a=Ce(t,i,n);return{name:e.name,topology:a}}function Ce(e,t,n){return{vertices:e,edges:t,faces:n,faceTriangles:Te(n)}}function we(e){let{vertices:t,faceTriangles:n}=e,r=n.length*3,i=new Float32Array(r*3),a=0;for(let[e,r,o]of n)Ee(i,a,t[e]),Ee(i,a+1,t[r]),Ee(i,a+2,t[o]),a+=3;return{facePositions:i,faceVertexCount:r}}function Te(e){let t=[];for(let n of e){if(n.length<3)continue;let e=n[0];for(let r=1;r<n.length-1;r++)t.push([e,n[r],n[r+1]])}return t}function Ee(e,t,n){let r=t*3;e[r]=n[0],e[r+1]=n[1],e[r+2]=n[2]}var De=100;function Oe(){let e=[],t=[];return{push(n){e.push(n),t.length=0,e.length>De&&e.shift()},undo(n){let r=e.pop();if(r!==void 0)return t.push(n),r},redo(n){let r=t.pop();if(r!==void 0)return e.push(n),r},canUndo(){return e.length>0},canRedo(){return t.length>0}}}function M(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function N(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function P(e,t){return(e[0]-t[0])**2+(e[1]-t[1])**2+(e[2]-t[2])**2}function F(e){return Math.sqrt(e[0]*e[0]+e[1]*e[1]+e[2]*e[2])}function ke(e,t){let n=M(t,e),r=F(n);if(r!==0)return[n[0]/r,n[1]/r,n[2]/r]}function Ae(e,t){let n=ke(e,t);return n===void 0?[[e[0],e[1],e[2]],[t[0],t[1],t[2]]]:[[e[0]-n[0]*k,e[1]-n[1]*k,e[2]-n[2]*k],[t[0]+n[0]*k,t[1]+n[1]*k,t[2]+n[2]*k]]}function je(e,t,n){let r=[1,0,0],i=0;for(let a of t){let t=n[a[0]],o=n[a[1]],s=n[a[2]],c=Pe(e,r,t,o,s);c!==void 0&&c>-Ne&&i++}return i%2==1}function Me(e,t,n){for(let r of t)if(P(e,r)<n)return!0;return!1}function I(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}var Ne=1e-6;function Pe(e,t,n,r,i){let a=[r[0]-n[0],r[1]-n[1],r[2]-n[2]],o=[i[0]-n[0],i[1]-n[1],i[2]-n[2]],s=t[1]*o[2]-t[2]*o[1],c=t[2]*o[0]-t[0]*o[2],l=t[0]*o[1]-t[1]*o[0],u=a[0]*s+a[1]*c+a[2]*l;if(Math.abs(u)<Ne)return;let d=1/u,f=e[0]-n[0],p=e[1]-n[1],m=e[2]-n[2],h=(f*s+p*c+m*l)*d;if(h<0||h>1)return;let g=p*a[2]-m*a[1],_=m*a[0]-f*a[2],v=f*a[1]-p*a[0],y=(t[0]*g+t[1]*_+t[2]*v)*d;if(!(y<0||h+y>1))return(o[0]*g+o[1]*_+o[2]*v)*d}var L={type:`none`};function Fe(e,t,n,i,a,o,s,c,l){let u=n*a,d=i*a,f=e*a,p=t*a,m=(10*a)**2,h=Le(o,c,u,d),g=Be(f,p,m,s.map(([e,t])=>({start:h[e],end:h[t]})));if(!r(g))return{type:`edge`,edgeIndex:g};if(l.length>0){let e=Be(f,p,m,Re(o,l.map(e=>({startPosition:e.pointA,endPosition:e.pointB})),u,d));if(!r(e))return{type:`line`,lineIndex:e}}return L}function Ie(e,t,n,r,i,a,o){let s=n*i,c=r*i;return ze(e*i,t*i,i,Le(a,o,s,c))}function Le(e,t,n,r){return t.map(t=>{let i=x.transformMat4(x.fromValues(t[0],t[1],t[2],1),e);if(i[3]<=0)return{screenX:0,screenY:0,behindCamera:!0};let a=i[0]/i[3],o=i[1]/i[3];return{screenX:(a+1)*.5*n,screenY:(1-o)*.5*r,behindCamera:!1}})}function Re(e,t,n,r){return t.map(t=>{let[i,a]=Ae(t.startPosition,t.endPosition),o=Le(e,[i,a],n,r);return{start:o[0],end:o[1]}})}function ze(e,t,n,r){let i=(30*n)**2,a;for(let n=0;n<r.length;n++){let o=r[n];if(o.behindCamera)continue;let s=o.screenX-e,c=o.screenY-t,l=s*s+c*c;l<i&&(i=l,a=n)}return a}function Be(e,t,n,r){let i=n,a;for(let n=0;n<r.length;n++){let{start:o,end:s}=r[n];if(o.behindCamera||s.behindCamera)continue;let c=Ve(e,t,o.screenX,o.screenY,s.screenX,s.screenY);c<i&&(i=c,a=n)}return a}function Ve(e,t,n,r,i,a){let o=i-n,s=a-r,c=o*o+s*s;if(c===0){let i=e-n,a=t-r;return i*i+a*a}let l=Math.max(0,Math.min(1,((e-n)*o+(t-r)*s)/c)),u=n+l*o,d=r+l*s,f=e-u,p=t-d;return f*f+p*p}var He=`struct Uniforms {
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

/** Clamps a clip-space point to the near plane by interpolating towards the other endpoint */
fn clampToNearPlane(point: vec4<f32>, other: vec4<f32>) -> vec4<f32> {
    if (point.w >= NEAR_CLIP_W) {
        return point;
    }
    let parametricT = (NEAR_CLIP_W - point.w) / (other.w - point.w);
    return mix(point, other, parametricT);
}

/** Converts a pixel offset to NDC offset, accounting for viewport size */
fn pixelsToNdc(pixels: vec2<f32>) -> vec2<f32> {
    return pixels / (uniforms.viewport * 0.5);
}

/** Scales a CSS-pixel size to GPU pixels using device pixel ratio */
fn cssToGpuPixels(cssSize: f32) -> f32 {
    return cssSize * uniforms.dpr;
}

/** Computes depth fade factor based on world-space distance from camera target.
 *  Only fades objects behind the target (further from camera), not in front of it. */
fn computeDepthFade(worldPosition: vec3<f32>) -> f32 {
    let toPoint = worldPosition - uniforms.cameraTarget;
    let forwardDist = dot(toPoint, uniforms.cameraForward);
    let normalizedDepth = forwardDist / uniforms.cameraDistance;
    return clamp(1.0 - normalizedDepth * uniforms.depthFadeRate, uniforms.depthFadeMin, 1.0);
}
`,Ue=`/**
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
`,We=`/**
 * Per-instance line with visible and hidden styles.
 * GPU depth test determines which style each pixel uses.
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
    @location(0) @interpolate(linear) lineDistance: f32,
    @location(1) @interpolate(flat) lineColor: vec3<f32>,
    @location(2) lineAlpha: f32,
    @location(3) @interpolate(flat) lineDash: f32,
    @location(4) @interpolate(flat) lineGap: f32,
    @location(5) worldDepth: f32,
};

/** Pipeline-overridable: 0 = visible pass, 1 = hidden pass */
@id(0) override useHiddenStyle: f32 = 0.0;

/** Selects the active style (visible or hidden) and scales sizes to GPU pixels */
fn selectLineStyle(line: LineInstance) -> array<f32, 7> {
    let isHidden = useHiddenStyle > 0.5;
    return array<f32, 7>(
        cssToGpuPixels(select(line.visibleWidth, line.hiddenWidth, isHidden)),
        select(line.visibleAlpha, line.hiddenAlpha, isHidden),
        cssToGpuPixels(select(line.visibleDash, line.hiddenDash, isHidden)),
        cssToGpuPixels(select(line.visibleGap, line.hiddenGap, isHidden)),
        select(line.visibleColor.r, line.hiddenColor.r, isHidden),
        select(line.visibleColor.g, line.hiddenColor.g, isHidden),
        select(line.visibleColor.b, line.hiddenColor.b, isHidden),
    );
}

/** Projects both endpoints to clip space with near-plane clamping */
fn projectEndpoints(startPos: vec3<f32>, endPos: vec3<f32>) -> array<vec4<f32>, 2> {
    let rawClipA = uniforms.mvp * vec4<f32>(startPos, 1.0);
    let rawClipB = uniforms.mvp * vec4<f32>(endPos, 1.0);
    return array<vec4<f32>, 2>(
        clampToNearPlane(rawClipA, rawClipB),
        clampToNearPlane(rawClipB, rawClipA),
    );
}

/** Computes the perpendicular offset direction in screen space */
fn computeScreenPerp(screenA: vec2<f32>, screenB: vec2<f32>) -> vec2<f32> {
    let screenDir = screenB - screenA;
    let screenLen = length(screenDir);
    let safeDir = select(screenDir / screenLen, vec2<f32>(1.0, 0.0), screenLen < 0.001);
    return vec2<f32>(-safeDir.y, safeDir.x);
}

/** Expands a line segment into a screen-space quad */
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    line: LineInstance
) -> VertexOutput {
    let style = selectLineStyle(line);
    let lineWidth = style[0];
    let alpha = style[1];
    let dash = style[2];
    let gap = style[3];
    let color = vec3<f32>(style[4], style[5], style[6]);

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
    let screenLen = length(screenB - screenA);

    let endpointPos = select(line.startPos, line.endPos, isEnd);

    var result: VertexOutput;
    // Clamp z to near plane so lines extending towards the camera aren't clipped by the rasterizer
    result.clipPosition = vec4<f32>(clipPos.xy + offsetNdc * clipPos.w, max(clipPos.z, 0.0), clipPos.w);
    result.lineDistance = select(0.0, screenLen, isEnd);
    result.lineColor = color;
    result.lineAlpha = alpha;
    result.lineDash = dash;
    result.lineGap = gap;
    result.worldDepth = dot(endpointPos - uniforms.cameraTarget, uniforms.cameraForward);
    return result;
}

/** Renders a line fragment with dash pattern and depth fade */
@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let patternLength = input.lineDash + input.lineGap;
    if (patternLength > 0.0) {
        if (input.lineDistance % patternLength >= input.lineDash) {
            discard;
        }
    }

    let normalizedDepth = input.worldDepth / uniforms.cameraDistance;
    let depthFade = clamp(1.0 - normalizedDepth * uniforms.depthFadeRate, uniforms.depthFadeMin, 1.0);

    return vec4<f32>(input.lineColor, input.lineAlpha * depthFade);
}
`,Ge=`/**
 * Per-instance marker with visible and hidden styles.
 * GPU depth texture sampling determines which style to use.
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
 *   22-23: reserved
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
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) quadUV: vec2<f32>,
    @location(1) @interpolate(flat) fillColor: vec3<f32>,
    @location(2) @interpolate(flat) fillAlpha: f32,
    @location(3) @interpolate(flat) strokeColor: vec3<f32>,
    @location(4) @interpolate(flat) strokeWidthNormalized: f32,
    @location(5) @interpolate(flat) isCircleType: f32,
};

@group(0) @binding(1) var sceneDepth: texture_depth_2d;
@group(0) @binding(2) var depthSampler: sampler;

const DEPTH_BIAS: f32 = 0.001;

/** Tests if the marker center is occluded by scene geometry in the depth buffer */
fn isMarkerOccluded(centerClip: vec4<f32>) -> bool {
    let centerNdc = centerClip.xyz / centerClip.w;
    let centerUV = centerNdc.xy * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);
    let sceneDepthAtCenter = textureSampleLevel(sceneDepth, depthSampler, centerUV, 0);
    return sceneDepthAtCenter < (centerNdc.z - DEPTH_BIAS);
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
    return result;
}

/** Renders a marker as solid circle or circle with stroke */
@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    let dist = length(input.quadUV);

    if (dist > 1.0) {
        discard;
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
`,Ke={color:`#FFFFFF`,width:1,size:1,alpha:1,line:{type:`solid`},markerType:`solid`,strokeColor:`#FFFFFF`,strokeWidth:0},qe=16,Je=7,Ye=255;function R(e){if(e.length!==Je||e[0]!==`#`)throw Error(`Invalid hex color: ${e}. Expected format: #RRGGBB`);return[Number.parseInt(e.slice(1,3),qe)/Ye,Number.parseInt(e.slice(3,5),qe)/Ye,Number.parseInt(e.slice(5,7),qe)/Ye]}function Xe(e){let t=[...e].sort(),n=[[]];for(let e of t){let t=n.length;for(let r=0;r<t;r++)n.push([...n[r],e])}return n.sort((e,t)=>e.length===t.length?e.join(`:`).localeCompare(t.join(`:`)):e.length-t.length),n}function Ze(e,t){return{color:t.color??e.color,width:t.width??e.width,size:t.size??e.size,alpha:t.alpha??e.alpha,line:t.line??e.line,markerType:t.markerType??e.markerType,strokeColor:t.strokeColor??e.strokeColor,strokeWidth:t.strokeWidth??e.strokeWidth}}function Qe(e){let t={};for(let[n,r]of Object.entries(e)){let e=n.split(`:`);if(e.length<=2){t[n]=r;continue}let i=e[0],a=e.slice(1).sort();t[`${i}:${a.join(`:`)}`]=r}return t}function z(e,t,n){let r=Qe(e),i=Xe(n),a={...Ke};for(let e of i){let n=r[e.length===0?t:`${t}:${e.join(`:`)}`];n!==void 0&&(a=Ze(a,n))}return a}var B=1e-10,$e=1e-8;function et(e,t,n,r){let i=[];for(let a of t){let t=[];!at(a,e.vertices)&&je(a,e.faceTriangles,e.vertices)&&t.push(`inner`),nt(a,n,e,r)&&t.push(`selected`);let o=z(A,`vertex`,t),s=z(A,`vertex`,[`hidden`,...t]);i.push({position:a,markerType:o.markerType===`circle`?1:0,visibleStyle:tt(o),hiddenStyle:tt(s)})}return i}function tt(e){let[t,n,r]=R(e.color),[i,a,o]=R(e.strokeColor);return{size:e.size,color:[t,n,r],alpha:e.alpha,strokeColor:[i,a,o],strokeWidth:e.strokeWidth}}function nt(e,t,n,r){switch(t.type){case`none`:return!1;case`edge`:{let[i,a]=n.edges[t.edgeIndex],o=n.vertices[i],s=n.vertices[a];if(rt(e,o,s))return!0;for(let t of r)if(V(t.pointA,o)&&V(t.pointB,s)||V(t.pointA,s)&&V(t.pointB,o))return it(e,t.pointA,t.pointB);return!1}case`line`:{let n=r[t.lineIndex];return it(e,n.pointA,n.pointB)}}}function rt(e,t,n){let r=M(n,t),i=N(r,r);if(i<B)return P(e,t)<B;let a=N(M(e,t),r)/i;return a<-.001||a>1.001?!1:P(e,[t[0]+a*r[0],t[1]+a*r[1],t[2]+a*r[2]])<$e}function it(e,t,n){let r=M(n,t),i=N(r,r);if(i<B)return P(e,t)<B;let a=N(M(e,t),r)/i;return P(e,[t[0]+a*r[0],t[1]+a*r[1],t[2]+a*r[2]])<$e}function V(e,t){return P(e,t)<B}function at(e,t){for(let n of t)if(P(e,n)<B)return!0;return!1}var ot=He+Ue,st=He+We,ct=He+Ge,H=`depth24plus`,U=1,lt=4,W=32,G=W*lt,ut=0,K=24,q=K*lt,dt=3*lt,ft=128,pt=0,mt=64,ht=72,gt=80,_t=108,vt=96,yt=6,bt=class{device;format;depthFacesPipeline;visibleLinePipeline;hiddenLinePipeline;previewLinePipeline;markerPipeline;bindGroup;previewBindGroup;markerBindGroup;previewMarkerBindGroup;markerBindGroupLayout;uniformBuffer;previewUniformBuffer;faceVertexBuffer;styledLineBuffer;topologyVertexMarkerBuffer;previewLineBuffer;previewStartMarkerBuffer;previewSnapMarkerBuffer;depthPrePassPipeline;depthSampler;faceVertexCount=0;depthTexture=null;samplingDepthTexture=null;lastMvpMatrix=new Float32Array(16);styledLineCount=0;topologyVertexCount=0;hasDragPreview=!1;hasSnapTarget=!1;lastCanvasWidth=0;lastCanvasHeight=0;lastDevicePixelRatio=1;backgroundClearColor;vertexPreviewStyle;constructor(e,t,n,r,i,a=`perspective`){this.camera=e,this.msaaManager=t,this.topology=n,this.fpsController=r,this.sceneCenter=i,this.projection=a;let[o,s,c]=R(z(A,`background`,[]).color);this.backgroundClearColor={r:o,g:s,b:c,a:1};let l=z(A,`vertex`,[`preview`]);this.vertexPreviewStyle={markerType:l.markerType===`circle`?1:0,size:l.size,color:R(l.color),alpha:l.alpha,strokeColor:R(l.strokeColor),strokeWidth:l.strokeWidth}}init(e){this.device=e.device,this.format=e.format;let t=we(this.topology);this.faceVertexCount=t.faceVertexCount,this.faceVertexBuffer=this.createAndWriteBuffer(t.facePositions,GPUBufferUsage.VERTEX);let n=this.topology.edges.length*(this.topology.edges.length-1)/2,r=Math.max(1,this.topology.edges.length+n);this.styledLineBuffer=this.device.createBuffer({size:Math.max(G,r*G),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let i=this.topology.vertices.length+n;this.topologyVertexMarkerBuffer=this.device.createBuffer({size:i*q,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewLineBuffer=this.device.createBuffer({size:G,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewStartMarkerBuffer=this.device.createBuffer({size:q,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewSnapMarkerBuffer=this.device.createBuffer({size:q,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.uniformBuffer=this.device.createBuffer({size:ft,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.previewUniformBuffer=this.device.createBuffer({size:ft,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let a=new Float32Array([he,ge]);this.device.queue.writeBuffer(this.uniformBuffer,_t,a),this.device.queue.writeBuffer(this.previewUniformBuffer,_t,a);let o=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.bindGroup=this.device.createBindGroup({layout:o,entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]}),this.previewBindGroup=this.device.createBindGroup({layout:o,entries:[{binding:0,resource:{buffer:this.previewUniformBuffer}}]});let s=this.device.createPipelineLayout({bindGroupLayouts:[o]});this.depthFacesPipeline=this.createDepthFacesPipeline(s),this.depthPrePassPipeline=this.createDepthPrePassPipeline(s),this.visibleLinePipeline=this.createStyledLinePipeline(s,{depthCompare:`less-equal`,depthWriteEnabled:!0,useHiddenStyle:!1}),this.hiddenLinePipeline=this.createStyledLinePipeline(s,{depthCompare:`greater`,depthWriteEnabled:!1,useHiddenStyle:!0}),this.previewLinePipeline=this.createStyledLinePipeline(s,{depthCompare:`always`,depthWriteEnabled:!1,useHiddenStyle:!1}),this.markerBindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`depth`}},{binding:2,visibility:GPUShaderStage.VERTEX,sampler:{type:`non-filtering`}}]}),this.depthSampler=this.device.createSampler({minFilter:`nearest`,magFilter:`nearest`});let c=this.device.createPipelineLayout({bindGroupLayouts:[this.markerBindGroupLayout]});this.markerPipeline=this.createMarkerPipeline(c)}update(e){this.camera.tick()&&this.fpsController.raise(j.Animation);let t=this.camera.getViewMatrix(),n=this.camera.getDistance(),r=e.canvasWidth/Math.max(U,e.canvasHeight),i=this.projection===`orthographic`?(()=>{let e=n*pe,t=e*r;return S.ortho(-t,t,-e,e,O,100)})():S.perspective(fe,r,O,100),a=S.multiply(i,t);this.lastMvpMatrix.set(a),this.lastCanvasWidth=e.canvasWidth,this.lastCanvasHeight=e.canvasHeight,this.lastDevicePixelRatio=e.devicePixelRatio;let o=new Float32Array([-t[2],-t[6],-t[10]]);this.device.queue.writeBuffer(this.uniformBuffer,pt,a);let s=new Float32Array([e.canvasWidth,e.canvasHeight]);this.device.queue.writeBuffer(this.uniformBuffer,mt,s);let c=new Float32Array([e.devicePixelRatio,n]);this.device.queue.writeBuffer(this.uniformBuffer,ht,c),this.device.queue.writeBuffer(this.uniformBuffer,gt,o);let l=new Float32Array(this.sceneCenter);this.device.queue.writeBuffer(this.uniformBuffer,vt,l),this.device.queue.writeBuffer(this.previewUniformBuffer,pt,a),this.device.queue.writeBuffer(this.previewUniformBuffer,mt,s),this.device.queue.writeBuffer(this.previewUniformBuffer,ht,c),this.device.queue.writeBuffer(this.previewUniformBuffer,gt,o),this.device.queue.writeBuffer(this.previewUniformBuffer,vt,l)}render(e,t,n){let i=this.msaaManager.ensureView(this.device,this.format,n.canvasWidth,n.canvasHeight);if(r(i))return;let a=this.ensureDepthTexture(n.canvasWidth,n.canvasHeight),o=this.ensureSamplingDepthTexture(n.canvasWidth,n.canvasHeight),s=e.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:o,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});s.setPipeline(this.depthPrePassPipeline),s.setBindGroup(0,this.bindGroup),s.setVertexBuffer(0,this.faceVertexBuffer),s.draw(this.faceVertexCount),s.end();let c=e.beginRenderPass({colorAttachments:[{view:i,resolveTarget:t,loadOp:`clear`,clearValue:this.backgroundClearColor,storeOp:`discard`}],depthStencilAttachment:{view:a.createView(),depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});c.setPipeline(this.depthFacesPipeline),c.setBindGroup(0,this.bindGroup),c.setVertexBuffer(0,this.faceVertexBuffer),c.draw(this.faceVertexCount),this.styledLineCount>0&&(c.setPipeline(this.hiddenLinePipeline),c.setBindGroup(0,this.bindGroup),c.setVertexBuffer(0,this.styledLineBuffer),c.draw(6,this.styledLineCount)),this.styledLineCount>0&&(c.setPipeline(this.visibleLinePipeline),c.setBindGroup(0,this.bindGroup),c.setVertexBuffer(0,this.styledLineBuffer),c.draw(6,this.styledLineCount)),this.hasDragPreview&&(c.setPipeline(this.previewLinePipeline),c.setBindGroup(0,this.previewBindGroup),c.setVertexBuffer(0,this.previewLineBuffer),c.draw(6,1)),this.topologyVertexCount>0&&(c.setPipeline(this.markerPipeline),c.setBindGroup(0,this.markerBindGroup),c.setVertexBuffer(0,this.topologyVertexMarkerBuffer),c.draw(yt,this.topologyVertexCount)),this.hasDragPreview&&(c.setPipeline(this.markerPipeline),c.setBindGroup(0,this.previewMarkerBindGroup),c.setVertexBuffer(0,this.previewStartMarkerBuffer),c.draw(yt,1)),this.hasSnapTarget&&(c.setPipeline(this.markerPipeline),c.setBindGroup(0,this.previewMarkerBindGroup),c.setVertexBuffer(0,this.previewSnapMarkerBuffer),c.draw(yt,1)),c.end()}getLastMvpMatrix(){return this.lastMvpMatrix}setDragPreview(e){if(r(e)){this.hasDragPreview=!1,this.hasSnapTarget=!1;return}let t=r(e.snapTargetPosition)?this.unprojectToVertexPlane(e.cursorScreenX,e.cursorScreenY,e.startPosition):e.snapTargetPosition,n=z(A,`line`,[`preview`,`segment`]),[i,a,o]=R(n.color),s=new Float32Array(W);s[0]=e.startPosition[0],s[1]=e.startPosition[1],s[2]=e.startPosition[2],s[3]=t[0],s[4]=t[1],s[5]=t[2],s[6]=n.width,s[7]=i,s[8]=a,s[9]=o,s[10]=n.alpha,this.device.queue.writeBuffer(this.previewLineBuffer,0,s),this.hasDragPreview=!0,this.device.queue.writeBuffer(this.previewStartMarkerBuffer,0,this.createPreviewMarkerData(e.startPosition)),r(e.snapTargetPosition)?this.hasSnapTarget=!1:(this.device.queue.writeBuffer(this.previewSnapMarkerBuffer,0,this.createPreviewMarkerData(e.snapTargetPosition)),this.hasSnapTarget=!0)}applySceneState(e,t,n){this.applyStyledMarkers(e,n),this.applyStyledSegments(t)}applyStyledMarkers(e,t){let n=e.vertices.map(e=>e.position),r=et(this.topology,n,t,e.lines);if(this.topologyVertexCount=r.length,this.topologyVertexCount===0)return;let i=new Float32Array(r.length*K);for(let e=0;e<r.length;e++){let t=r[e],n=e*K;i[n]=t.position[0],i[n+1]=t.position[1],i[n+2]=t.position[2],i[n+3]=t.markerType,i[n+4]=t.visibleStyle.size,i[n+5]=t.visibleStyle.color[0],i[n+6]=t.visibleStyle.color[1],i[n+7]=t.visibleStyle.color[2],i[n+8]=t.visibleStyle.alpha,i[n+9]=t.visibleStyle.strokeColor[0],i[n+10]=t.visibleStyle.strokeColor[1],i[n+11]=t.visibleStyle.strokeColor[2],i[n+12]=t.visibleStyle.strokeWidth,i[n+13]=t.hiddenStyle.size,i[n+14]=t.hiddenStyle.color[0],i[n+15]=t.hiddenStyle.color[1],i[n+16]=t.hiddenStyle.color[2],i[n+17]=t.hiddenStyle.alpha,i[n+18]=t.hiddenStyle.strokeColor[0],i[n+19]=t.hiddenStyle.strokeColor[1],i[n+20]=t.hiddenStyle.strokeColor[2],i[n+21]=t.hiddenStyle.strokeWidth}this.device.queue.writeBuffer(this.topologyVertexMarkerBuffer,0,i)}applyStyledSegments(e){if(this.styledLineCount=e.length,this.styledLineCount===0)return;let t=new Float32Array(this.styledLineCount*W);for(let n=0;n<this.styledLineCount;n++){let r=e[n],i=n*W;t[i]=r.startPosition[0],t[i+1]=r.startPosition[1],t[i+2]=r.startPosition[2],t[i+3]=r.endPosition[0],t[i+4]=r.endPosition[1],t[i+5]=r.endPosition[2],t[i+6]=r.visibleStyle.width,t[i+7]=r.visibleStyle.color[0],t[i+8]=r.visibleStyle.color[1],t[i+9]=r.visibleStyle.color[2],t[i+10]=r.visibleStyle.alpha,t[i+11]=r.visibleStyle.lineType,t[i+12]=r.visibleStyle.dash,t[i+13]=r.visibleStyle.gap,t[i+14]=r.hiddenStyle.width,t[i+15]=r.hiddenStyle.color[0],t[i+16]=r.hiddenStyle.color[1],t[i+17]=r.hiddenStyle.color[2],t[i+18]=r.hiddenStyle.alpha,t[i+19]=r.hiddenStyle.lineType,t[i+20]=r.hiddenStyle.dash,t[i+21]=r.hiddenStyle.gap}this.device.queue.writeBuffer(this.styledLineBuffer,0,t)}dispose(){this.uniformBuffer.destroy(),this.previewUniformBuffer.destroy(),this.faceVertexBuffer.destroy(),this.styledLineBuffer.destroy(),this.topologyVertexMarkerBuffer.destroy(),this.previewLineBuffer.destroy(),this.previewStartMarkerBuffer.destroy(),this.previewSnapMarkerBuffer.destroy(),this.depthTexture?.destroy(),this.samplingDepthTexture?.destroy()}unprojectToVertexPlane(e,t,n){let r=this.lastCanvasWidth,i=this.lastCanvasHeight,a=this.lastDevicePixelRatio,o=e*a,s=t*a,c=o/r*2-1,l=1-s/i*2,u=x.transformMat4(x.fromValues(n[0],n[1],n[2],1),this.lastMvpMatrix),d=u[2]/u[3],f=S.inverse(this.lastMvpMatrix),p=x.transformMat4(x.fromValues(c,l,d,1),f);return[p[0]/p[3],p[1]/p[3],p[2]/p[3]]}createAndWriteBuffer(e,t){let n=this.device.createBuffer({size:e.byteLength,usage:t|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(n,0,e),n}createDepthFacesPipeline(e){let t=this.device.createShaderModule({code:ot});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:dt,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format,writeMask:0}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:H,depthBias:2,depthBiasSlopeScale:1},multisample:{count:4}})}createStyledLinePipeline(e,t){let n=this.device.createShaderModule({code:st});return this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,constants:{[ut]:t.useHiddenStyle?1:0},buffers:[{arrayStride:G,stepMode:`instance`,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`},{shaderLocation:2,offset:24,format:`float32`},{shaderLocation:3,offset:28,format:`float32x3`},{shaderLocation:4,offset:40,format:`float32`},{shaderLocation:5,offset:44,format:`float32`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32`},{shaderLocation:9,offset:60,format:`float32x3`},{shaderLocation:10,offset:72,format:`float32`},{shaderLocation:11,offset:76,format:`float32`},{shaderLocation:12,offset:80,format:`float32`},{shaderLocation:13,offset:84,format:`float32`}]}]},fragment:{module:n,entryPoint:`fs`,targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:t.depthWriteEnabled,depthCompare:t.depthCompare,format:H},multisample:{count:4}})}createDepthPrePassPipeline(e){let t=this.device.createShaderModule({code:ot});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:dt,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:H,depthBias:2,depthBiasSlopeScale:1}})}createMarkerPipeline(e){let t=this.device.createShaderModule({code:ct});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:q,stepMode:`instance`,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32`},{shaderLocation:2,offset:16,format:`float32`},{shaderLocation:3,offset:20,format:`float32x3`},{shaderLocation:4,offset:32,format:`float32`},{shaderLocation:5,offset:36,format:`float32x3`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32x3`},{shaderLocation:9,offset:68,format:`float32`},{shaderLocation:10,offset:72,format:`float32x3`},{shaderLocation:11,offset:84,format:`float32`}]}]},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:H},multisample:{count:4}})}createPreviewMarkerData(e){let t=new Float32Array(K),n=this.vertexPreviewStyle;return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=n.markerType,t[4]=n.size,t[5]=n.color[0],t[6]=n.color[1],t[7]=n.color[2],t[8]=n.alpha,t[9]=n.strokeColor[0],t[10]=n.strokeColor[1],t[11]=n.strokeColor[2],t[12]=n.strokeWidth,t[13]=n.size,t[14]=n.color[0],t[15]=n.color[1],t[16]=n.color[2],t[17]=n.alpha,t[18]=n.strokeColor[0],t[19]=n.strokeColor[1],t[20]=n.strokeColor[2],t[21]=n.strokeWidth,t}ensureDepthTexture(e,t){return!r(this.depthTexture)&&this.depthTexture.width===e&&this.depthTexture.height===t?this.depthTexture:(this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(U,e),Math.max(U,t)],format:H,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthTexture)}ensureSamplingDepthTexture(e,t){let n=Math.max(U,e),i=Math.max(U,t);if(!r(this.samplingDepthTexture)&&this.samplingDepthTexture.width===n&&this.samplingDepthTexture.height===i)return this.samplingDepthTexture.createView();this.samplingDepthTexture?.destroy(),this.samplingDepthTexture=this.device.createTexture({size:[n,i],format:H,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});let a=this.samplingDepthTexture.createView();return this.markerBindGroup=this.device.createBindGroup({layout:this.markerBindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:a},{binding:2,resource:this.depthSampler}]}),this.previewMarkerBindGroup=this.device.createBindGroup({layout:this.markerBindGroupLayout,entries:[{binding:0,resource:{buffer:this.previewUniformBuffer}},{binding:1,resource:a},{binding:2,resource:this.depthSampler}]}),this.samplingDepthTexture.createView()}},J={name:`Pentagonal Pyramid`,camera:{center:[0,-.25,0],distance:{min:3,max:10,initial:5},angle:{elevation:Math.PI/2.3,azimuth:Math.PI/30},projection:`perspective`},input:{figures:[{vertices:[[0,-.75,1],[.951057,-.75,.309017],[.587785,-.75,-.809017],[-.587785,-.75,-.809017],[-.951057,-.75,.309017],[0,.75,0]],faces:[[5,0,1],[5,1,2],[5,2,3],[5,3,4],[5,4,0],[0,1,2,3,4]]}]},expected:{}},xt=2,St=1e3,Ct=250;function wt(e){let{canvas:t,context:n,layerManager:r,fpsController:i,onFpsUpdate:a}=e,{device:o,canvasContext:s}=n,c=0,l=0,u=Math.max(1,window.devicePixelRatio);function d(){u=Math.max(1,window.devicePixelRatio);let e=Math.floor(t.clientWidth*u),n=Math.floor(t.clientHeight*u),r=t.width!==e||t.height!==n;return r&&(t.width=e,t.height=n),c=e,l=n,r}d();let f=new ResizeObserver(()=>{d(),i.raise(j.Resize)});f.observe(t);let p=0,m=!1,h=0,g=performance.now(),_=[],v=0;function y(e){let t=Math.max(St,i.getFrameIntervalMs()*3);_.push(e);let n=e-t;for(;_.length>0&&_[0]<n;)_.shift();if(e-v>=Ct){v=e;let t=_.length>1?_[_.length-1]-_[0]:0,n=t>0?Math.round((_.length-1)/t*me):0;a?.(n)}}function b(e){if(m)return;let t=i.getFrameIntervalMs();if(e-h<t-xt){p=requestAnimationFrame(b);return}if(h=e,y(e),d(),c===0||l===0){p=requestAnimationFrame(b);return}let n={time:(performance.now()-g)/me,canvasWidth:c,canvasHeight:l,devicePixelRatio:u};r.updateAll(n);let a=s.getCurrentTexture().createView(),f=o.createCommandEncoder();r.renderAll(f,a,n),o.queue.submit([f.finish()]),p=requestAnimationFrame(b)}return p=requestAnimationFrame(b),()=>{m=!0,cancelAnimationFrame(p),f.disconnect()}}var Tt=1e-10,Et=.001,Dt=1e-4;function Ot(e,t){let n=e.lines.map(e=>({point:e.pointA,direction:M(e.pointB,e.pointA)})),r=[],i=[];function a(e){e!==void 0&&(Me(e,t.vertices,Et)||Me(e,i,Dt)||(r.push({position:e}),i.push(e)))}for(let e=0;e<n.length;e++){for(let t=e+1;t<n.length;t++)a(kt(n[e],n[t]));for(let r=0;r<t.edges.length;r++)a(At(n[e],jt(r,t)))}return r}function kt(e,t){return Mt(e.point,e.direction,t.point,t.direction)?.midpoint}function At(e,t){let n=Mt(e.point,e.direction,t.point,t.direction);if(!(n===void 0||n.parameterB<0||n.parameterB>1))return n.midpoint}function jt(e,t){let[n,r]=t.edges[e],i=t.vertices[n],a=t.vertices[r];return{point:i,direction:M(a,i)}}function Mt(e,t,n,r){let i=N(t,t),a=N(t,r),o=N(r,r),s=i*o-a*a;if(Math.abs(s)<Tt)return;let c=M(e,n),l=N(t,c),u=N(r,c),d=(a*u-o*l)/s,f=(i*u-a*l)/s,p=[e[0]+d*t[0],e[1]+d*t[1],e[2]+d*t[2]],m=[n[0]+f*r[0],n[1]+f*r[1],n[2]+f*r[2]];if(!(P(p,m)>.01**2))return{midpoint:[(p[0]+m[0])*.5,(p[1]+m[1])*.5,(p[2]+m[2])*.5],parameterB:f}}var Nt=1e-4,Pt=1e-8;function Ft(e){return{vertices:e.vertices.map((e,t)=>({position:e,topologyIndex:t})),lines:[],intersections:[]}}function It(e,t,n){let[r,i]=n.edges[t],a=n.vertices[r],o=n.vertices[i],s=Vt(e.lines,a,o);if(s!==void 0){let t=e.lines.filter((e,t)=>t!==s);return Y({...e,lines:t},n)}let c={pointA:a,pointB:o};return Y({...e,lines:[...e.lines,c]},n)}function Lt(e,t,n,r){let i=Bt(t,n,r);if(i!==void 0)return It(e,i,r);if(Vt(e.lines,t,n)!==void 0)return e;let a={pointA:t,pointB:n};return Y({...e,lines:[...e.lines,a]},r)}function Rt(e,t,n){return Y({...e,lines:e.lines.filter((e,n)=>n!==t)},n)}function Y(e,t){let n={...e,intersections:[]},r=Ot(n,t);return{...n,intersections:r,vertices:zt(t,r)}}function zt(e,t){let n=e.vertices.map((e,t)=>({position:e,topologyIndex:t})),r=t.map(e=>({position:e.position,topologyIndex:void 0}));return[...n,...r]}function Bt(e,t,n){for(let r=0;r<n.edges.length;r++){let[i,a]=n.edges[r],o=n.vertices[i],s=n.vertices[a];if(Ut(e,t,o,s))return r}}function Vt(e,t,n){for(let r=0;r<e.length;r++){let i=e[r];if(Ht(i.pointA,i.pointB,t,n))return r}}function Ht(e,t,n,r){if(Ut(e,t,n,r))return!0;let i=M(t,e),a=F(i);if(a===0)return!1;let o=[i[0]/a,i[1]/a,i[2]/a],s=M(r,n),c=F(s);return c===0||F(I(o,[s[0]/c,s[1]/c,s[2]/c]))>Pt?!1:F(I(o,M(n,e)))<Pt}function Ut(e,t,n,r){let i=Wt(e,n)&&Wt(t,r),a=Wt(e,r)&&Wt(t,n);return i||a}function Wt(e,t){return P(e,t)<Nt}var Gt=1e-8,X=1e-6,Kt=1e-4;function qt(e,t){let n=[];for(let r=0;r<t.length;r++){let i=Jt(t[r],r,e);n.push(...i)}return n}function Jt(e,t,n){let[r,i]=Ae(e.pointA,e.pointB),a=M(i,r),o=F(a);if(o===0)return[];let s=[a[0]/o,a[1]/o,a[2]/o],c=Qt(e,n,s),l=$t(r,s,o,n),u=en(r,s,o,n),d=c.map(e=>{let[t,i]=n.edges[e],a=Yt(n.vertices[t],r,s,o),c=Yt(n.vertices[i],r,s,o);return{start:Math.min(a,c),end:Math.max(a,c)}}),f=Yt(e.pointA,r,s,o),p=Yt(e.pointB,r,s,o),m=new Set;m.add(0),m.add(1),m.add(f),m.add(p);for(let e of l)m.add(e);for(let e of u)m.add(e.start),m.add(e.end);for(let e of d)m.add(e.start),m.add(e.end);let h=rn([...m].sort((e,t)=>e-t)),g=an(u),_=[];for(let e=0;e<h.length-1;e++){let i=h[e],a=h[e+1];if(a-i<X)continue;let c=(i+a)/2,l=Xt(i,r,s,o),u=Xt(a,r,s,o);if(Zt(c,d)){_.push({startPosition:l,endPosition:u,modifier:`segment`,sourceLineIndex:t});continue}if(Zt(c,g)){_.push({startPosition:l,endPosition:u,modifier:`inner`,sourceLineIndex:t});continue}let f=je(Xt(c,r,s,o),n.faceTriangles,n.vertices);_.push({startPosition:l,endPosition:u,modifier:f?`inner`:void 0,sourceLineIndex:t})}return _}function Yt(e,t,n,r){return N(M(e,t),n)/r}function Xt(e,t,n,r){let i=e*r;return[t[0]+n[0]*i,t[1]+n[1]*i,t[2]+n[2]*i]}function Zt(e,t){for(let n of t)if(e>n.start+X&&e<n.end-X)return!0;return!1}function Qt(e,t,n){let r=[];for(let i=0;i<t.edges.length;i++){let[a,o]=t.edges[i],s=t.vertices[a],c=t.vertices[o],l=M(c,s),u=F(l);u!==0&&(F(I(n,[l[0]/u,l[1]/u,l[2]/u]))>Gt||F(I(n,M(s,e.pointA)))<Gt&&r.push(i))}return r}function $t(e,t,n,r){let i=[];for(let a of r.faceTriangles){let o=r.vertices[a[0]],s=r.vertices[a[1]],c=r.vertices[a[2]],l=Pe(e,t,o,s,c);if(l!==void 0&&l>0){let e=l/n;e>X&&e<1-X&&!nn(e,i)&&i.push(e)}}return i}function en(e,t,n,r){let i=[];for(let a=0;a<r.faces.length;a++){let o=r.faces[a];if(o.length<3)continue;let s=o.map(e=>r.vertices[e]),c=I(M(s[1],s[0]),M(s[2],s[0])),l=F(c);if(l<X)continue;let u=[c[0]/l,c[1]/l,c[2]/l];if(Math.abs(N(t,u))>Kt)continue;let d=N(M(e,s[0]),u);if(Math.abs(d)>Kt)continue;let f=tn(e,t,n,s);f!==void 0&&i.push(f)}return i}function tn(e,t,n,r){let i=0,a=1,o=I(M(r[1],r[0]),M(r[2],r[0]));for(let s=0;s<r.length;s++){let c=(s+1)%r.length,l=r[s],u=r[c],d=I(o,M(u,l)),f=F(d);if(f<X)continue;let p=[d[0]/f,d[1]/f,d[2]/f],m=N(M(e,l),p),h=N(t,p)*n;if(Math.abs(h)<X){if(m<-X)return;continue}let g=-m/h;if(h<0?a=Math.min(a,g):i=Math.max(i,g),i>a)return}if(!(a-i<X))return{start:i,end:a}}function nn(e,t){for(let n of t)if(Math.abs(e-n)<X)return!0;return!1}function rn(e){let t=[];for(let n of e)(t.length===0||Math.abs(n-t[t.length-1])>X)&&t.push(n);return t}function an(e){if(e.length===0)return[];let t=[...e].sort((e,t)=>e.start-t.start),n=[t[0]];for(let e=1;e<t.length;e++){let r=t[e],i=n[n.length-1];r.start<=i.end+X?n[n.length-1]={start:i.start,end:Math.max(i.end,r.end)}:n.push(r)}return n}var on=-1;function sn(e){let t=!1,n,{topology:r}=Se(J),i=_e(e,J.camera),a=new xe,o,s=Ft(r),c=L,l=Oe(),u=new Set,d=new Set;function f(){for(let e of u)e(l.canUndo(),l.canRedo())}function p(e){let t=qt(r,e.lines),n=[...un(r,ln(t,r)),...t].map(t=>fn(t,c,r,e.lines));o?.applySceneState(e,n,c)}function m(e){l.push(s),s=e,p(s),f()}function h(){if(!(t||!o))return{canvasWidth:e.clientWidth,canvasHeight:e.clientHeight,devicePixelRatio:Math.max(1,window.devicePixelRatio),mvpMatrix:o.getLastMvpMatrix()}}function g(e,t){let n=h();return n===void 0?L:Fe(e,t,n.canvasWidth,n.canvasHeight,n.devicePixelRatio,n.mvpMatrix,r.edges,r.vertices,s.lines)}function _(e,t){let n=h();if(n===void 0)return;let r=s.vertices.map(e=>e.position),i=Ie(e,t,n.canvasWidth,n.canvasHeight,n.devicePixelRatio,n.mvpMatrix,r);if(i!==void 0)return r[i]}function v(e){c=e,p(s)}function y(){switch(c.type){case`edge`:{let[e,t]=r.edges[c.edgeIndex];return M(r.vertices[t],r.vertices[e])}case`line`:{let e=s.lines[c.lineIndex];return M(e.pointB,e.pointA)}case`none`:return}}function b(e,t){v(g(e,t))}function x(e,t){let n=g(e,t);n.type===`edge`?(c=L,m(It(s,n.edgeIndex,r))):n.type===`line`&&(c=L,m(Rt(s,n.lineIndex,r)))}function S(){a.raise(j.Interaction)}e.addEventListener(`pointerdown`,S),e.addEventListener(`pointermove`,S),e.addEventListener(`wheel`,S);let ee=ve(e,b,x),C=ye(e,{performPointHitTest:_,onDragStart:()=>{},onDragUpdate:e=>{o?.setDragPreview(e)},onVertexTap:e=>{let t=y();if(t!==void 0){let n=[e[0]+t[0],e[1]+t[1],e[2]+t[2]];m(Lt(s,e,n,r))}v(L)},onDragComplete:(e,t)=>{m(Lt(s,e,t,r)),v(L)}});cn(e,i,r,a,e=>{for(let t of d)t(e)}).then(({cleanup:e,sceneLayer:r})=>{t?e():(n=e,o=r,p(s))});function w(e){e!==void 0&&(s=e,p(s),v(L),f())}return{destroy:()=>{t=!0,i.destroy(),a.dispose(),e.removeEventListener(`pointerdown`,S),e.removeEventListener(`pointermove`,S),e.removeEventListener(`wheel`,S),ee(),C(),u.clear(),d.clear(),n?.()},camera:i,undo:()=>w(l.undo(s)),redo:()=>w(l.redo(s)),subscribeHistory:e=>(u.add(e),e(l.canUndo(),l.canRedo()),()=>u.delete(e)),subscribeFps:e=>(d.add(e),()=>d.delete(e))}}async function cn(e,t,n,r,i){let a=await v(e),o=ee(4),s=new bt(t,o,n,r,J.camera?.center??[0,0,0],J.camera?.projection??`perspective`),c=new y([s]);c.initAll(a);let l=wt({canvas:e,context:a,layerManager:c,fpsController:r,onFpsUpdate:i});return{cleanup:()=>{l(),c.dispose(),o.dispose(),a.device.destroy()},sceneLayer:s}}function ln(e,t){let n=new Set,r=e.filter(e=>e.modifier===`segment`);for(let e of r)for(let r=0;r<t.edges.length;r++){let[i,a]=t.edges[r],o=t.vertices[i],s=t.vertices[a];(Z(e.startPosition,o)&&Z(e.endPosition,s)||Z(e.startPosition,s)&&Z(e.endPosition,o))&&n.add(r)}return n}function un(e,t){let n=[];for(let r=0;r<e.edges.length;r++){if(t.has(r))continue;let[i,a]=e.edges[r];n.push({startPosition:e.vertices[i],endPosition:e.vertices[a],modifier:`segment`,sourceLineIndex:on})}return n}function dn(e){let[t,n,r]=R(e.color);return{width:e.width,color:[t,n,r],alpha:e.alpha,lineType:e.line.type===`dashed`?1:0,dash:e.line.type===`dashed`?e.line.dash:0,gap:e.line.type===`dashed`?e.line.gap:0}}function fn(e,t,n,r){let i=e.modifier===void 0?[]:[e.modifier];pn(e,t,n,r)&&i.push(`selected`);let a=z(A,`line`,i),o=z(A,`line`,[`hidden`,...i]);return{startPosition:e.startPosition,endPosition:e.endPosition,visibleStyle:dn(a),hiddenStyle:dn(o),sourceLineIndex:e.sourceLineIndex}}function pn(e,t,n,r){switch(t.type){case`none`:return!1;case`line`:return e.sourceLineIndex===t.lineIndex;case`edge`:{let[i,a]=n.edges[t.edgeIndex],o=n.vertices[i],s=n.vertices[a];if(e.modifier===`segment`&&e.sourceLineIndex===on&&(Z(e.startPosition,o)&&Z(e.endPosition,s)||Z(e.startPosition,s)&&Z(e.endPosition,o)))return!0;if(e.sourceLineIndex>=0){let t=r[e.sourceLineIndex];if(Z(t.pointA,o)&&Z(t.pointB,s)||Z(t.pointA,s)&&Z(t.pointB,o))return!0}return!1}}}var mn=1e-6;function Z(e,t){return Math.abs(e[0]-t[0])<mn&&Math.abs(e[1]-t[1])<mn&&Math.abs(e[2]-t[2])<mn}var Q=i({en:{toolbar:{undo:`Undo`,redo:`Redo`,rotate:`Rotate`,pan:`Pan`,help:`Help`,close:`Close`},help:{title:`Stereometry`,description:`Interactive 3D geometry game — construct auxiliary lines, find intersection points of lines and faces, and build cross-sections of solids.`,controls:{drag:`rotate the camera`,shiftDrag:`pan the view`,scrollPinch:`zoom in and out`,clickEdge:`select it`,doubleClickEdge:`extend edge into an infinite line (or remove it)`,doubleClickLine:`remove the line`,dragVertex:`draw a construction line between two points`,selectEdgeTapVertex:`draw a parallel line through that vertex`},controlLabels:{drag:`Drag`,shiftDrag:`Shift+Drag`,scrollPinch:`Scroll / Pinch`,clickEdge:`Click edge/line`,doubleClickEdge:`Double-click edge`,doubleClickLine:`Double-click line`,dragVertex:`Drag vertex → vertex`,selectEdgeTapVertex:`Select edge/line + tap vertex`},intersectionHint:`Intersection points appear automatically where lines cross.`}},ru:{toolbar:{undo:`Отменить`,redo:`Повторить`,rotate:`Вращение`,pan:`Перемещение`,help:`Справка`,close:`Закрыть`},help:{title:`Стереометрия`,description:`Интерактивная 3D-игра по стереометрии — стройте вспомогательные линии, находите точки пересечения прямых и граней, выполняйте сечения фигур.`,controls:{drag:`вращение камеры`,shiftDrag:`перемещение вида`,scrollPinch:`приближение и отдаление`,clickEdge:`выделить ребро`,doubleClickEdge:`продлить ребро в бесконечную прямую (или убрать)`,doubleClickLine:`удалить линию`,dragVertex:`провести вспомогательную линию между двумя точками`,selectEdgeTapVertex:`провести параллельную прямую через эту вершину`},controlLabels:{drag:`Перетаскивание`,shiftDrag:`Shift+Перетаскивание`,scrollPinch:`Прокрутка / Щипок`,clickEdge:`Клик по ребру/линии`,doubleClickEdge:`Двойной клик по ребру`,doubleClickLine:`Двойной клик по линии`,dragVertex:`Перетащить вершину → вершину`,selectEdgeTapVertex:`Выделить ребро + нажать на вершину`},intersectionHint:`Точки пересечения появляются автоматически при пересечении линий.`}}}),hn=a(),$=20,gn=14,_n=(0,E.memo)(()=>{let e=(0,E.useRef)(null),t=(0,E.useRef)(null),[n,r]=(0,E.useState)(`rotate`),[i,a]=(0,E.useState)(!1),[o,c]=(0,E.useState)(!1),[l,u]=(0,E.useState)(0);(0,E.useEffect)(()=>{if(e.current){let n=sn(e.current);t.current=n;let r=n.subscribeHistory((e,t)=>{a(e),c(t)}),i=n.subscribeFps(u);return()=>{t.current=null,r(),i(),n.destroy()}}},[]);let d=s(()=>{r(`rotate`),t.current?.camera.setInteractionMode(`rotate`)}),f=s(()=>{r(`pan`),t.current?.camera.setInteractionMode(`pan`)}),p=s(()=>{t.current?.undo()}),m=s(()=>{t.current?.redo()});return(0,D.jsx)(C,{className:w.fixedContainer,children:(0,D.jsxs)(`div`,{className:w.fixedContainer,children:[(0,D.jsx)(`canvas`,{ref:e,className:`h-full w-full [touch-action:none]`}),!hn&&(0,D.jsxs)(`div`,{className:`absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400`,children:[l,` FPS`]}),(0,D.jsxs)(`div`,{className:`fixed right-4 bottom-4 flex gap-2`,children:[(0,D.jsx)(yn,{}),(0,D.jsx)(vn,{onClick:p,label:Q.toolbar.undo,disabled:!i,children:(0,D.jsx)(_,{size:$})}),(0,D.jsx)(vn,{onClick:m,label:Q.toolbar.redo,disabled:!o,children:(0,D.jsx)(te,{size:$})}),(0,D.jsx)(vn,{active:n===`rotate`,onClick:d,label:Q.toolbar.rotate,children:(0,D.jsx)(ne,{size:$})}),(0,D.jsx)(vn,{active:n===`pan`,onClick:f,label:Q.toolbar.pan,children:(0,D.jsx)(T,{size:$})})]})]})})}),vn=(0,E.memo)(({active:e=!1,disabled:t=!1,onClick:n,children:r,label:i})=>(0,D.jsx)(`button`,{type:`button`,onClick:n,disabled:t,"aria-label":i,"aria-pressed":e,className:g(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all`,t?`bg-neutral-900 text-neutral-600 cursor-not-allowed`:`hover:scale-110 active:scale-95`,!t&&e&&`bg-blue-500 text-white`,!t&&!e&&`bg-neutral-800 text-neutral-400 hover:text-white`),children:r})),yn=(0,E.memo)(()=>{let[e,t]=(0,E.useState)(!1);return(0,D.jsxs)(o,{open:e,onOpenChange:t,children:[(0,D.jsx)(f,{asChild:!0,children:(0,D.jsx)(`button`,{type:`button`,"aria-label":Q.toolbar.help,className:g(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,e?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,D.jsx)(h,{size:$})})}),(0,D.jsx)(c,{children:(0,D.jsxs)(l,{side:`top`,sideOffset:8,align:`end`,className:g(`z-50 w-72 rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,D.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,D.jsx)(`span`,{className:`font-semibold text-white`,children:Q.help.title}),(0,D.jsx)(u,{"aria-label":Q.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,D.jsx)(m,{size:gn})})]}),(0,D.jsx)(`p`,{className:`mb-3 text-neutral-400`,children:Q.help.description}),(0,D.jsxs)(`ul`,{className:`space-y-1.5 text-neutral-300`,children:[(0,D.jsxs)(`li`,{children:[(0,D.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.drag}),` —`,` `,Q.help.controls.drag]}),(0,D.jsxs)(`li`,{children:[(0,D.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.shiftDrag}),` `,`— `,Q.help.controls.shiftDrag]}),(0,D.jsxs)(`li`,{children:[(0,D.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.scrollPinch}),` `,`— `,Q.help.controls.scrollPinch]}),(0,D.jsxs)(`li`,{children:[(0,D.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.clickEdge}),` `,`— `,Q.help.controls.clickEdge]}),(0,D.jsxs)(`li`,{children:[(0,D.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.doubleClickEdge}),` `,`— `,Q.help.controls.doubleClickEdge]}),(0,D.jsxs)(`li`,{children:[(0,D.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.doubleClickLine}),` `,`— `,Q.help.controls.doubleClickLine]}),(0,D.jsxs)(`li`,{children:[(0,D.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.dragVertex}),` `,`— `,Q.help.controls.dragVertex]}),(0,D.jsxs)(`li`,{children:[(0,D.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.selectEdgeTapVertex}),` `,`— `,Q.help.controls.selectEdgeTapVertex]})]}),(0,D.jsx)(`p`,{className:`mt-3 text-xs text-neutral-500`,children:Q.help.intersectionHint}),(0,D.jsx)(d,{className:`fill-neutral-900`})]})})]})});export{_n as Stereometry};