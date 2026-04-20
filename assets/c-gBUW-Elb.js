import{G as e,K as t,L as n,T as r,U as i,W as a,a as o,bt as s,i as c,o as l,q as u,r as d,t as f}from"./c-lahOAW2I.js";import{_ as p,d as m,g as h,h as g,m as _,p as v,v as y}from"./c-Dc6GhsSi.js";import{i as b,n as x,r as S,t as C}from"./c-BwYBi10U.js";import{t as w}from"./c-lB8ovjTD.js";import{t as T}from"./c-rc86jWN7.js";import{t as E}from"./c-BdIG0Mup.js";import{n as D,r as O,t as k}from"./c-K9g4nGQa.js";var A=b(`move`,[[`path`,{d:`M12 2v20`,key:`t6zp3m`}],[`path`,{d:`m15 19-3 3-3-3`,key:`11eu04`}],[`path`,{d:`m19 9 3 3-3 3`,key:`1mg7y2`}],[`path`,{d:`M2 12h20`,key:`9i4pu4`}],[`path`,{d:`m5 9-3 3 3 3`,key:`j64kie`}],[`path`,{d:`m9 5 3-3 3 3`,key:`l8vdw6`}]]),j=b(`puzzle`,[[`path`,{d:`M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z`,key:`w46dr5`}]]),ee=b(`redo-2`,[[`path`,{d:`m15 14 5-5-5-5`,key:`12vg1m`}],[`path`,{d:`M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13`,key:`6uklza`}]]),te=b(`rotate-ccw`,[[`path`,{d:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`1357e3`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}]]),M=s(t(),1),N=e(),ne=Math.PI/2.3,re=Math.PI/30,ie=.005,ae=.003,oe=.01,se=.95,ce=.1,le=.1,ue=.001,de=Math.PI/4,fe=.1,pe=Math.tan(de/2),me=.2,he=.1,ge=.2,_e=.1,ve=.45,ye=.1,P={line:{color:`#FFFFFF`,width:1,alpha:1,line:{type:`solid`}},"line:hidden":{alpha:.3,line:{type:`dashed`,dash:10,gap:10}},"line:selected":{color:`#55AAFF`},"line:hidden:selected":{alpha:1},"line:segment":{width:3},"line:preview":{color:`#4488BB`},"line:inner":{width:3},"line:input":{color:`#FF8973`,width:3,alpha:1},"line:input:selected":{color:`#A61A00`},"line:segment:input":{color:`#FF8973`,width:3,alpha:1},"line:segment:input:selected":{color:`#A61A00`},"line:solution":{color:`#EFBF04`},vertex:{markerType:`circle`,color:`#000000`,size:10,strokeColor:`#FFFFFF`,strokeWidth:2},"vertex:hidden":{strokeColor:`#999999`},"vertex:selected":{color:`#55AAFF`},"vertex:hidden:selected":{color:`#3388DD`},"vertex:inner":{strokeColor:`#AAFF44`,color:`#AAAAAA`},"vertex:inner:hidden":{strokeColor:`#77CC22`,color:`#000000`},"vertex:preview":{color:`#000000`,strokeColor:`#4488BB`,strokeWidth:6,size:16},"vertex:input":{markerType:`solid`,color:`#FF8973`,size:10},"vertex:input:hidden":{markerType:`solid`,color:`#FF8973`,size:10},"vertex:input:selected":{markerType:`solid`,color:`#A61A00`,size:10},"vertex:solution":{markerType:`solid`,color:`#EFBF04`},"vertex:solution:hidden":{markerType:`solid`,color:`#EFBF04`},"face:solution":{color:`#EFBF04`,alpha:.1},background:{color:`#1A1A1F`}};function be(e,t){let n=t?.distance?.min??3,r=t?.distance?.max??15,i=t?.distance?.initial??5,a=t?.center??[0,0,0],o=t?.angle?.azimuth??re,s=t?.angle?.elevation??ne,c=i,l=i,u=[a[0],a[1],a[2]],d=`rotate`,f=0,p=0,m=0;function h(){return[u[0]+Math.sin(s)*Math.sin(o)*c,u[1]+Math.cos(s)*c,u[2]+Math.sin(s)*Math.cos(o)*c]}function g(){return[-Math.cos(s)*Math.sin(o),Math.sin(s),-Math.cos(s)*Math.cos(o)]}function _(){return[Math.cos(o),0,-Math.sin(o)]}function v(e){let t=-e*ie;o+=t;let n=u[0]-a[0],r=u[2]-a[2],i=Math.cos(t),s=Math.sin(t);u[0]=a[0]+n*i+r*s,u[2]=a[2]-n*s+r*i}function y(e,t){let n=ae*c,r=_();u[0]-=r[0]*e*n,u[1]+=t*n,u[2]-=r[2]*e*n}function b(e){return Math.max(n,Math.min(r,e))}function x(){f=0,p=0,m=0}let S=new Map,C=!1,w=0;function T(){let e=[...S.values()],t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}function E(e){S.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),S.size===1?C=e.shiftKey:S.size===2&&(w=T())}function O(e){let t=S.get(e.pointerId);if(t===void 0)return;if(S.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),S.size===2){let e=T(),t=w/e;l=b(l*t),w=e;return}if(S.size!==1)return;let n=e.clientX-t.clientX,r=e.clientY-t.clientY;C||d===`pan`?(p=n,m=r,f=0,y(n,r)):(f=n,p=0,m=0,v(n))}function A(e){S.delete(e.pointerId),S.size===0&&(C=!1)}function j(e){S.delete(e.pointerId)}function ee(e){e.preventDefault(),l=b(l*(1+e.deltaY*oe))}return e.addEventListener(`pointerdown`,E),window.addEventListener(`pointermove`,O),window.addEventListener(`pointerup`,A),window.addEventListener(`pointercancel`,j),e.addEventListener(`wheel`,ee,{passive:!1}),{tick(){let e=Math.abs(l-c)>ue;if(e?c+=(l-c)*le:c=l,S.size>0)return!0;let t=Math.abs(f)>=ce,n=Math.abs(p)>=.1||Math.abs(m)>=.1;return!t&&!n?(x(),e):(t&&(v(f),f*=se),n&&(y(p,m),p*=se,m*=se),!0)},getViewMatrix(){let e=h(),t=g();return k.lookAt(D.fromValues(e[0],e[1],e[2]),D.fromValues(u[0],u[1],u[2]),D.fromValues(t[0],t[1],t[2]))},getEyePosition(){return h()},getDistance(){return c},setInteractionMode(e){d=e,x()},registerExternalPointer(e,t,n){S.has(e)||(S.set(e,{clientX:t,clientY:n}),S.size===2&&(w=T()))},destroy(){e.removeEventListener(`pointerdown`,E),window.removeEventListener(`pointermove`,O),window.removeEventListener(`pointerup`,A),window.removeEventListener(`pointercancel`,j),e.removeEventListener(`wheel`,ee)}}}function xe(e,t,n){let r=0,i=0,a=0,o,s=0,c=0,l=0;function u(e,t){let n=Math.abs(e-r),o=Math.abs(t-i),s=performance.now()-a;return n<3&&o<3&&s<300}function d(e,r){let i=performance.now(),a=i-l,o=Math.sqrt((e-s)**2+(r-c)**2);a<400&&o<10?(n(e,r),l=0):(t(e,r),s=e,c=r,l=i)}function f(e){e.isPrimary&&(o=e.pointerId,r=e.clientX,i=e.clientY,a=performance.now())}function p(t){if(t.pointerId===o&&(o=void 0,u(t.clientX,t.clientY))){let n=e.getBoundingClientRect();d(t.clientX-n.left,t.clientY-n.top)}}return e.addEventListener(`pointerdown`,f),window.addEventListener(`pointerup`,p),()=>{e.removeEventListener(`pointerdown`,f),window.removeEventListener(`pointerup`,p)}}function Se(e,t){let n,r,i=!1,a,o=0,s=0,c=0,l=0,u,d,f=0,p=0,m=0;function h(t,n){let r=e.getBoundingClientRect();return{screenX:t-r.left,screenY:n-r.top}}function g(e,t){return e[0]===t[0]&&e[1]===t[1]&&e[2]===t[2]}function _(e,t,n,r){return e.kind===`vertex`?{kind:`vertex`,startPosition:e.position,cursorScreenX:t,cursorScreenY:n,snapTargetPosition:r!==void 0&&!g(r,e.position)?r:void 0}:{kind:`line`,sourceDirection:e.direction,planeAnchor:e.planeAnchor,cursorScreenX:t,cursorScreenY:n,snapTargetPosition:r}}function v(){u!==void 0&&(window.clearTimeout(u),u=void 0)}function y(e,a,o){let s=r;s!==void 0&&(v(),r=void 0,i=!1,n=s,t.onDragStart(),t.onDragUpdate(_(s,e,a,o)))}function b(){let{screenX:e,screenY:t}=h(o,s);y(e,t,void 0)}function x(e,n,r){let i=performance.now(),a=i-f,o=Math.sqrt((n-p)**2+(r-m)**2);if(d===e&&a<400&&o<10){d=void 0,t.onLineDoubleTap(e);return}d=e,f=i,p=n,m=r,t.onLineTap(e)}function S(e){let{screenX:d,screenY:f}=h(e.clientX,e.clientY),p=t.performInitialHitTest(d,f);return p===void 0?!1:p.kind===`vertex`&&t.hasActiveSelection()?(t.onVertexTap(p.position),!0):(a=e.pointerId,o=e.clientX,s=e.clientY,c=e.clientX,l=e.clientY,p.kind===`vertex`?(n=p,t.onDragStart(),t.onDragUpdate(_(p,d,f,void 0))):(r=p,i=t.isLineSelected(p.lineId),i&&(u=window.setTimeout(b,250))),!0)}function C(e,a){c=e,l=a;let{screenX:u,screenY:d}=h(e,a);if(r!==void 0){if(!i)return;Math.max(Math.abs(e-o),Math.abs(a-s))>=3&&y(u,d,t.performSnapHitTest(u,d));return}if(n===void 0)return;let f=t.performSnapHitTest(u,d);t.onDragUpdate(_(n,u,d,f))}function w(e,o){if(r!==void 0){let t=r;v(),r=void 0,i=!1,a=void 0,t.kind===`line`&&x(t.lineId,e,o);return}let s=n;if(s===void 0)return;let{screenX:c,screenY:l}=h(e,o),u=t.performSnapHitTest(c,l);if(n=void 0,a=void 0,t.onDragUpdate(void 0),s.kind===`vertex`){u!==void 0&&!g(u,s.position)?t.onDragComplete(s.position,u):t.onVertexTap(s.position);return}if(u!==void 0){let e=[u[0]+s.direction[0],u[1]+s.direction[1],u[2]+s.direction[2]];t.onDragComplete(u,e)}}function T(){v(),r=void 0,i=!1,n=void 0,a=void 0,t.onDragUpdate(void 0)}function E(e){if(n!==void 0||r!==void 0){a!==void 0&&t.onSecondPointer(a,c,l),T();return}e.isPrimary&&S(e)&&e.stopPropagation()}function D(e){e.pointerId===a&&(n===void 0&&r===void 0||C(e.clientX,e.clientY))}function O(e){e.pointerId===a&&(n===void 0&&r===void 0||w(e.clientX,e.clientY))}return e.addEventListener(`pointerdown`,E,{capture:!0}),window.addEventListener(`pointermove`,D),window.addEventListener(`pointerup`,O),()=>{v(),e.removeEventListener(`pointerdown`,E,{capture:!0}),window.removeEventListener(`pointermove`,D),window.removeEventListener(`pointerup`,O)}}function Ce(e){let t=[],n=[],r=[],i=new Set,a=[];for(let o of e.input.figures){let e=t.length,s=[];for(let e of o.vertices)t.push([e[0],e[1],e[2]]);for(let t of o.faces){let r=t.map(t=>t+e);n.push(r),s.push(r);for(let e=0;e<r.length;e++){let t=(e+1)%r.length,n=Math.min(r[e],r[t]),o=Math.max(r[e],r[t]),s=`${n}-${o}`;i.has(s)||(i.add(s),a.push([n,o]))}}r.push(s)}return{topology:we(t,a,n,r)}}function we(e,t,n,r){return{vertices:e,edges:t,faces:n,faceTriangles:Ee(n),figureFaceTriangles:r.map(e=>Ee(e))}}function Te(e){let{vertices:t,faceTriangles:n}=e,r=n.length*3,i=new Float32Array(r*3),a=0;for(let[e,r,o]of n)De(i,a,t[e]),De(i,a+1,t[r]),De(i,a+2,t[o]),a+=3;return{facePositions:i,faceVertexCount:r}}function Ee(e){let t=[];for(let n of e){if(n.length<3)continue;let e=n[0];for(let r=1;r<n.length-1;r++)t.push([e,n[r],n[r+1]])}return t}function De(e,t,n){let r=t*3;e[r]=n[0],e[r+1]=n[1],e[r+2]=n[2]}var Oe=100;function ke(){let e=[],t=[];return{push(n){e.push(n),t.length=0,e.length>Oe&&e.shift()},undo(n){let r=e.pop();if(r!==void 0)return t.push(n),r},redo(n){let r=t.pop();if(r!==void 0)return e.push(n),r},canUndo(){return e.length>0},canRedo(){return t.length>0}}}function Ae(e,t){let n=D.sub(t,e);if(D.len(n)===0)return[[e[0],e[1],e[2]],[t[0],t[1],t[2]]];let r=D.normalize(n);return[D.addScaled(e,r,-20),D.addScaled(t,r,20)]}var F=1e-4;function je(e,t,n,r){let i=D.sub(n,t),a=D.sub(r,t),o=D.cross(i,a),s=D.len(o);if(s<F||Math.abs(D.dot(D.sub(e,t),o))/s>F)return!1;let c=D.dot(i,i),l=D.dot(i,a),u=D.dot(a,a),d=D.sub(e,t),f=D.dot(d,i),p=D.dot(d,a),m=c*u-l*l;if(Math.abs(m)<F*F)return!1;let h=(u*f-l*p)/m,g=(c*p-l*f)/m;return 1-h-g>=-F&&h>=-F&&g>=-F}function Me(e,t,n){for(let r of t)if(je(e,n[r[0]],n[r[1]],n[r[2]]))return!0;let r=Ne(n),i=0;for(let a of t){let t=n[a[0]],o=n[a[1]],s=n[a[2]],c=Pe(e,t,o,s),l=[(t[0]+o[0]+s[0])/3,(t[1]+o[1]+s[1])/3,(t[2]+o[2]+s[2])/3],u=D.sub(o,t),d=D.sub(s,t),f=D.cross(u,d),p=D.sub(r,l),m=D.dot(f,p)>0;i+=m?-c:c}return Math.abs(i)>2*Math.PI}function Ne(e){let t=0,n=0,r=0;for(let i of e)t+=i[0],n+=i[1],r+=i[2];let i=e.length;return[t/i,n/i,r/i]}function Pe(e,t,n,r){let i=D.sub(t,e),a=D.sub(n,e),o=D.sub(r,e),s=D.len(i),c=D.len(a),l=D.len(o),u=D.dot(i,D.cross(a,o)),d=s*c*l+D.dot(i,a)*l+D.dot(a,o)*s+D.dot(i,o)*c;return 2*Math.atan2(u,d)}function I(e,t,n){for(let r of t)if(D.distSq(e,r)<n)return!0;return!1}var Fe=1e-6;function Ie(e,t,n,r,i){let a=D.sub(r,n),o=D.sub(i,n),s=D.cross(t,o),c=D.dot(a,s);if(Math.abs(c)<Fe)return;let l=1/c,u=D.sub(e,n),d=D.dot(u,s)*l;if(d<0||d>1)return;let f=D.cross(u,a),p=D.dot(t,f)*l;if(!(p<0||d+p>1))return D.dot(o,f)*l}var Le=[`vertex`,`line`];function Re(e,t,n,r,i,a,o,s,c=Le){let l=n*i,u=r*i,d=e*i,f=t*i,p=30*i,m=20*i,h=p**2,g=m**2,_=[];return c.includes(`vertex`)&&Be(a,s,d,f,l,u,p,h,_),c.includes(`line`)&&Ve(a,o,d,f,l,u,m,g,_),qe(_)}var ze=.01;function Be(e,t,n,r,i,a,o,s,c){for(let l=0;l<t.length;l++){let u=He(e,t[l],i,a);if(u.behindCamera)continue;let d=u.screenX-n,f=u.screenY-r,p=d*d+f*f;p>=s||c.push({hit:{type:`vertex`,position:t[l]},normalizedDistance:Math.sqrt(p)/o,depth:u.depth,typeBonus:ge})}}function Ve(e,t,n,r,i,a,o,s,c){for(let l=0;l<t.length;l++){let u=t[l],[d,f]=u.kind===`edge`||u.kind===`segment`?[u.pointA,u.pointB]:Ae(u.pointA,u.pointB),p=Ue(e,d,f,i,a);if(p.start.behindCamera||p.end.behindCamera)continue;let{distanceSquared:m,parameter:h}=Ke(n,r,p.start.screenX,p.start.screenY,p.end.screenX,p.end.screenY);if(m>=s)continue;let g=p.start.depth*p.end.depth/((1-h)*p.end.depth+h*p.start.depth),_=u.kind===`line`?0:_e;c.push({hit:{type:`line`,lineId:u.lineId},normalizedDistance:Math.sqrt(m)/o,depth:g,typeBonus:_})}}function He(e,t,n,r){let i=O.transformMat4(O.fromValues(t[0],t[1],t[2],1),e);if(i[3]<=0)return{screenX:0,screenY:0,behindCamera:!0,depth:1/0};let a=i[0]/i[3],o=i[1]/i[3];return{screenX:(a+1)*.5*n,screenY:(1-o)*.5*r,behindCamera:!1,depth:i[3]}}function Ue(e,t,n,r,i){let a=O.transformMat4(O.fromValues(t[0],t[1],t[2],1),e),o=O.transformMat4(O.fromValues(n[0],n[1],n[2],1),e);if(a[3]<=0&&o[3]<=0)return{start:{screenX:0,screenY:0,behindCamera:!0,depth:1/0},end:{screenX:0,screenY:0,behindCamera:!0,depth:1/0}};let s=a[3]<ze?We(a,o):a,c=o[3]<ze?We(o,a):o;return{start:Ge(s,r,i),end:Ge(c,r,i)}}function We(e,t){let n=(ze-e[3])/(t[3]-e[3]);return O.lerp(e,t,n)}function Ge(e,t,n){let r=e[0]/e[3],i=e[1]/e[3];return{screenX:(r+1)*.5*t,screenY:(1-i)*.5*n,behindCamera:!1,depth:e[3]}}function Ke(e,t,n,r,i,a){let o=i-n,s=a-r,c=o*o+s*s;if(c===0){let i=e-n,a=t-r;return{distanceSquared:i*i+a*a,parameter:0}}let l=Math.max(0,Math.min(1,((e-n)*o+(t-r)*s)/c)),u=n+l*o,d=r+l*s,f=e-u,p=t-d;return{distanceSquared:f*f+p*p,parameter:l}}function qe(e){if(e.length===0)return;let t=1/0,n=-1/0;for(let r of e)r.depth<t&&(t=r.depth),r.depth>n&&(n=r.depth);let r=n-t,i=-1/0,a;for(let n of e){let e=1-n.normalizedDistance,o=r>0?1-(n.depth-t)/r:1,s=me*e+he*o+n.typeBonus;s>i&&(i=s,a=n.hit)}return a}var Je=1e-10,Ye=1e-5,Xe=1e-4,L=6;function Ze(e){let t=e.pointA,n=e.pointB,r=e.kind===`line`||e.kind===`edge-extended`||e.kind===`segment-extended`?`l`:`s`;return`${t[0].toFixed(L)},${t[1].toFixed(L)},${t[2].toFixed(L)}|${n[0].toFixed(L)},${n[1].toFixed(L)},${n[2].toFixed(L)}|${r}`}function Qe(e,t){return e<t?`${e}||${t}`:`${t}||${e}`}function $e(e,t){return`${e}||e:${t}`}var et=class{cache=new Map;previousLineKeys=new Set;compute(e,t){let n=new Map;for(let t of e){let e=Ze(t);n.has(e)||n.set(e,{point:t.pointA,direction:D.sub(t.pointB,t.pointA),isSegment:t.kind===`edge`||t.kind===`segment`,lineId:t.lineId})}let r=new Set(n.keys()),i=[];for(let e of r)this.previousLineKeys.has(e)||i.push(e);let o=[];for(let e of this.previousLineKeys)r.has(e)||o.push(e);if(o.length>0){let e=new Set(o);for(let t of this.cache.keys())for(let n of e)if(t.includes(n)){this.cache.delete(t);break}}let s=[...r];for(let e of i){let r=n.get(e);a(r!==void 0,`Missing line definition for key: ${e}`);for(let t of s){if(t===e)continue;let i=Qe(e,t);if(this.cache.has(i))continue;let o=n.get(t);a(o!==void 0,`Missing line definition for key: ${t}`);let s=it(r,o);this.cache.set(i,s===void 0?void 0:{position:s,sourceLineIds:[r.lineId,o.lineId]})}for(let n=0;n<t.edges.length;n++){let i=$e(e,n);if(this.cache.has(i))continue;let a=it(r,at(n,t));this.cache.set(i,a===void 0?void 0:{position:a,sourceLineIds:[r.lineId]})}}return this.previousLineKeys=r,nt(this.cache,t.vertices)}};function tt(e,t){let n=e.map(e=>({point:e.pointA,direction:D.sub(e.pointB,e.pointA),isSegment:e.kind===`edge`||e.kind===`segment`,lineId:e.lineId})),r=new Map;for(let e=0;e<n.length;e++){for(let t=e+1;t<n.length;t++){let i=it(n[e],n[t]);r.set(`${e}||${t}`,i===void 0?void 0:{position:i,sourceLineIds:[n[e].lineId,n[t].lineId]})}for(let i=0;i<t.edges.length;i++){let a=it(n[e],at(i,t));r.set(`${e}||e:${i}`,a===void 0?void 0:{position:a,sourceLineIds:[n[e].lineId]})}}return nt(r,t.vertices)}function nt(e,t){let n=[],r=[];for(let i of e.values()){if(i===void 0||I(i.position,t,Ye))continue;let e=rt(i.position,r,Xe);if(e!==void 0){let t=n[e],r=[...new Set([...t.sourceLineIds,...i.sourceLineIds])];n[e]={position:t.position,sourceLineIds:r};continue}n.push({position:i.position,sourceLineIds:[...i.sourceLineIds]}),r.push(i.position)}return n}function rt(e,t,n){for(let r=0;r<t.length;r++)if(D.distSq(e,t[r])<n)return r}function it(e,t){let n=ot(e.point,e.direction,t.point,t.direction);if(n!==void 0&&!(e.isSegment&&(n.parameterA<0||n.parameterA>1))&&!(t.isSegment&&(n.parameterB<0||n.parameterB>1)))return n.midpoint}function at(e,t){let[n,r]=t.edges[e],i=t.vertices[n],a=t.vertices[r];return{point:i,direction:D.sub(a,i),isSegment:!0,lineId:-1}}function ot(e,t,n,r){let i=D.dot(t,t),a=D.dot(t,r),o=D.dot(r,r),s=i*o-a*a;if(Math.abs(s)<Je)return;let c=D.sub(e,n),l=D.dot(t,c),u=D.dot(r,c),d=(a*u-o*l)/s,f=(i*u-a*l)/s,p=D.addScaled(e,t,d),m=D.addScaled(n,r,f);if(!(D.distSq(p,m)>.01**2))return{midpoint:[(p[0]+m[0])*.5,(p[1]+m[1])*.5,(p[2]+m[2])*.5],parameterA:d,parameterB:f}}var R=`struct Uniforms {
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
`,st=`/**
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
`,ct=`/**
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
    @location(0) @interpolate(linear) lineDistance: f32,
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
    result.clipPosition = vec4<f32>(clipPos.xy + offsetNdc * clipPos.w, max(clipPos.z, 0.0), clipPos.w);
    result.lineDistance = select(0.0, screenLen, isEnd);
    result.visibleColor = line.visibleColor;
    result.visibleAlpha = line.visibleAlpha;
    result.visibleDash = cssToGpuPixels(line.visibleDash);
    result.visibleGap = cssToGpuPixels(line.visibleGap);
    result.hiddenColor = line.hiddenColor;
    result.hiddenAlpha = line.hiddenAlpha;
    result.hiddenDash = cssToGpuPixels(line.hiddenDash);
    result.hiddenGap = cssToGpuPixels(line.hiddenGap);
    result.worldDepth = dot(endpointPos - uniforms.cameraTarget, uniforms.cameraForward);
    result.clipStart = clipA;
    result.clipEnd = clipB;
    return result;
}

/** Renders a line fragment with occlusion test at the line center */
@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    // Per-fragment spine-point depth: project fragment onto line spine,
    // compute UV from screen position and depth from NDC interpolation.
    let halfVP = uniforms.viewport * 0.5;
    let screenA = (input.clipStart.xy / input.clipStart.w) * halfVP;
    let screenB = (input.clipEnd.xy / input.clipEnd.w) * halfVP;
    // @builtin(position).y increases downward, but NDC Y increases upward — invert Y
    let fragmentScreen = vec2<f32>(input.clipPosition.x - halfVP.x, halfVP.y - input.clipPosition.y);

    let lineDir = screenB - screenA;
    let lineLenSq = dot(lineDir, lineDir);
    let t = select(
        clamp(dot(fragmentScreen - screenA, lineDir) / lineLenSq, 0.0, 1.0),
        0.5,
        lineLenSq < 0.001
    );

    // UV: derived from screen-space spine position (exact, no perspective error)
    let spineScreen = screenA + t * lineDir;
    let spineNdc = spineScreen / halfVP;
    let spineUV = spineNdc * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);

    // Depth: linear interpolation of NDC depths (mathematically correct for screen-space t)
    let depthA = input.clipStart.z / input.clipStart.w;
    let depthB = input.clipEnd.z / input.clipEnd.w;
    let spineDepth = mix(depthA, depthB, t);

    let faceDepthValue = textureSampleLevel(faceDepth, depthSampler, spineUV, 0);
    let isOccluded = faceDepthValue < spineDepth;

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

    // Depth fade
    let normalizedDepth = input.worldDepth / uniforms.cameraDistance;
    let depthFade = clamp(1.0 - normalizedDepth * uniforms.depthFadeRate, uniforms.depthFadeMin, 1.0);

    return vec4<f32>(color, alpha * depthFade);
}
`,lt=`/**
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
    // Per-fragment spine-point depth (same as line.wgsl)
    let halfVP = uniforms.viewport * 0.5;
    let screenA = (input.clipStart.xy / input.clipStart.w) * halfVP;
    let screenB = (input.clipEnd.xy / input.clipEnd.w) * halfVP;
    let fragmentScreen = vec2<f32>(input.clipPosition.x - halfVP.x, halfVP.y - input.clipPosition.y);

    let lineDir = screenB - screenA;
    let lineLenSq = dot(lineDir, lineDir);
    let t = select(
        clamp(dot(fragmentScreen - screenA, lineDir) / lineLenSq, 0.0, 1.0),
        0.5,
        lineLenSq < 0.001
    );

    let spineScreen = screenA + t * lineDir;
    let spineNdc = spineScreen / halfVP;
    let spineUV = spineNdc * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);

    let depthA = max(input.clipStart.z, 0.0) / input.clipStart.w;
    let depthB = max(input.clipEnd.z, 0.0) / input.clipEnd.w;
    let spineDepth = mix(depthA, depthB, t);

    let faceDepthValue = textureSampleLevel(faceDepth, depthSampler, spineUV, 0);
    let isOccluded = faceDepthValue < spineDepth;

    if (renderMode == 1u && !isOccluded) { discard; }
    if (renderMode == 2u && isOccluded) { discard; }

    return vec2<f32>(input.startVertexIndex, input.endVertexIndex);
}
`,ut=`/**
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
`,dt=`/**
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
`,ft={color:`#FFFFFF`,width:1,size:1,alpha:1,line:{type:`solid`},markerType:`solid`,strokeColor:`#FFFFFF`,strokeWidth:0},pt=16,mt=7,ht=255;function z(e){if(e.length!==mt||e[0]!==`#`)throw Error(`Invalid hex color: ${e}. Expected format: #RRGGBB`);return[Number.parseInt(e.slice(1,3),pt)/ht,Number.parseInt(e.slice(3,5),pt)/ht,Number.parseInt(e.slice(5,7),pt)/ht]}function gt(e){let t=[...e].sort(),n=[[]];for(let e of t){let t=n.length;for(let r=0;r<t;r++)n.push([...n[r],e])}return n.sort((e,t)=>e.length===t.length?e.join(`:`).localeCompare(t.join(`:`)):e.length-t.length),n}function _t(e,t){return{color:t.color??e.color,width:t.width??e.width,size:t.size??e.size,alpha:t.alpha??e.alpha,line:t.line??e.line,markerType:t.markerType??e.markerType,strokeColor:t.strokeColor??e.strokeColor,strokeWidth:t.strokeWidth??e.strokeWidth}}function vt(e){let t={};for(let[n,r]of Object.entries(e)){let e=n.split(`:`);if(e.length<=2){t[n]=r;continue}let i=e[0],a=e.slice(1).sort();t[`${i}:${a.join(`:`)}`]=r}return t}function B(e,t,n){let r=vt(e),i=gt(n),a={...ft};for(let e of i){let n=r[e.length===0?t:`${t}:${e.join(`:`)}`];n!==void 0&&(a=_t(a,n))}return a}var yt=R+st,bt=R+ct,xt=R+lt,St=R+ut,Ct=R+dt,V=`depth24plus`,wt=`rg32float`,H=1,Tt=2,Et=1,Dt=0,Ot=1,kt=2,U=4,At=32,W=At*U,jt=[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`},{shaderLocation:2,offset:24,format:`float32`},{shaderLocation:3,offset:28,format:`float32x3`},{shaderLocation:4,offset:40,format:`float32`},{shaderLocation:5,offset:44,format:`float32`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32`},{shaderLocation:9,offset:60,format:`float32x3`},{shaderLocation:10,offset:72,format:`float32`},{shaderLocation:11,offset:76,format:`float32`},{shaderLocation:12,offset:80,format:`float32`},{shaderLocation:13,offset:84,format:`float32`}],Mt=[...jt,{shaderLocation:14,offset:88,format:`float32`},{shaderLocation:15,offset:92,format:`float32`}],Nt=24,G=Nt*U,Pt=3*U,Ft=7*U,It=128,Lt=0,Rt=64,zt=72,Bt=80,Vt=108,Ht=96,Ut=6,Wt=class{device;format;hiddenLinePipeline;visibleLinePipeline;previewLinePipeline;hiddenMarkerPipeline;visibleMarkerPipeline;previewMarkerPipeline;hiddenLineIdPipeline;visibleLineIdPipeline;bindGroup;lineBindGroup;previewLineBindGroup;markerBindGroup;previewMarkerBindGroup;depthBindGroupLayout;markerBindGroupLayout;uniformBuffer;previewUniformBuffer;faceVertexBuffer;styledLineBuffer;topologyVertexMarkerBuffer;previewLineBuffer;previewStartMarkerBuffer;previewSnapMarkerBuffer;depthPrePassPipeline;solutionFacePipeline;solutionFaceBuffer;solutionFaceVertexCount=0;depthSampler;faceVertexCount=0;depthTexture=null;samplingDepthTexture=null;lineEndpointTexture=null;lineDepthTexture=null;lastMvpMatrix=new Float32Array(16);styledLineCount=0;topologyVertexCount=0;hasDragPreview=!1;hasStartMarker=!1;currentPreviewLine;hasSnapTarget=!1;lastCanvasWidth=0;lastCanvasHeight=0;lastDevicePixelRatio=1;backgroundClearColor;vertexPreviewStyle;constructor(e,t,n,r,i,a=`perspective`){this.camera=e,this.msaaManager=t,this.topology=n,this.fpsController=r,this.sceneCenter=i,this.projection=a;let[o,s,c]=z(B(P,`background`,[]).color);this.backgroundClearColor={r:o,g:s,b:c,a:1};let l=B(P,`vertex`,[`preview`]);this.vertexPreviewStyle={markerType:l.markerType===`circle`?1:0,size:l.size,color:z(l.color),alpha:l.alpha,strokeColor:z(l.strokeColor),strokeWidth:l.strokeWidth}}init(e){this.device=e.device,this.format=e.format;let t=Te(this.topology);this.faceVertexCount=t.faceVertexCount,this.faceVertexBuffer=this.createAndWriteBuffer(t.facePositions,GPUBufferUsage.VERTEX),this.solutionFaceBuffer=this.device.createBuffer({size:Ft,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let n=this.topology.edges.length*(this.topology.edges.length-1)/2,r=Math.max(1,this.topology.edges.length+n);this.styledLineBuffer=this.device.createBuffer({size:Math.max(W,r*W),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let i=this.topology.vertices.length+n;this.topologyVertexMarkerBuffer=this.device.createBuffer({size:i*G,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewLineBuffer=this.device.createBuffer({size:W,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewStartMarkerBuffer=this.device.createBuffer({size:G,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewSnapMarkerBuffer=this.device.createBuffer({size:G,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.uniformBuffer=this.device.createBuffer({size:It,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.previewUniformBuffer=this.device.createBuffer({size:It,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let a=new Float32Array([ve,ye]);this.device.queue.writeBuffer(this.uniformBuffer,Vt,a),this.device.queue.writeBuffer(this.previewUniformBuffer,Vt,a);let o=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.bindGroup=this.device.createBindGroup({layout:o,entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]});let s=this.device.createPipelineLayout({bindGroupLayouts:[o]});this.depthPrePassPipeline=this.createDepthPrePassPipeline(s),this.solutionFacePipeline=this.createSolutionFacePipeline(s),this.depthBindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:`non-filtering`}}]}),this.markerBindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:`non-filtering`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`unfilterable-float`}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}}]}),this.depthSampler=this.device.createSampler({minFilter:`nearest`,magFilter:`nearest`});let c=this.device.createPipelineLayout({bindGroupLayouts:[this.depthBindGroupLayout]});this.hiddenLinePipeline=this.createLinePipeline(c,Ot),this.visibleLinePipeline=this.createLinePipeline(c,kt),this.previewLinePipeline=this.createPreviewLinePipeline(c);let l=this.device.createPipelineLayout({bindGroupLayouts:[this.markerBindGroupLayout]});this.hiddenMarkerPipeline=this.createMarkerPipeline(l,Ot),this.visibleMarkerPipeline=this.createMarkerPipeline(l,kt),this.previewMarkerPipeline=this.createMarkerPipeline(l,Dt,!1),this.hiddenLineIdPipeline=this.createLineIdPipeline(c,Ot),this.visibleLineIdPipeline=this.createLineIdPipeline(c,kt)}update(e){this.camera.tick()&&this.fpsController.raise(60);let t=this.camera.getViewMatrix(),n=this.camera.getDistance(),r=e.canvasWidth/Math.max(H,e.canvasHeight),i=this.projection===`orthographic`?(()=>{let e=n*pe,t=e*r;return k.ortho(-t,t,-e,e,fe,100)})():k.perspective(de,r,fe,100),a=k.multiply(i,t);this.lastMvpMatrix.set(a),this.lastCanvasWidth=e.canvasWidth,this.lastCanvasHeight=e.canvasHeight,this.lastDevicePixelRatio=e.devicePixelRatio;let o=new Float32Array([-t[2],-t[6],-t[10]]);this.device.queue.writeBuffer(this.uniformBuffer,Lt,a);let s=new Float32Array([e.canvasWidth,e.canvasHeight]);this.device.queue.writeBuffer(this.uniformBuffer,Rt,s);let c=new Float32Array([e.devicePixelRatio,n]);this.device.queue.writeBuffer(this.uniformBuffer,zt,c),this.device.queue.writeBuffer(this.uniformBuffer,Bt,o);let l=new Float32Array(this.sceneCenter);this.device.queue.writeBuffer(this.uniformBuffer,Ht,l),this.device.queue.writeBuffer(this.previewUniformBuffer,Lt,a),this.device.queue.writeBuffer(this.previewUniformBuffer,Rt,s),this.device.queue.writeBuffer(this.previewUniformBuffer,zt,c),this.device.queue.writeBuffer(this.previewUniformBuffer,Bt,o),this.device.queue.writeBuffer(this.previewUniformBuffer,Ht,l)}render(e,t,n){let r=this.msaaManager.ensureView(this.device,this.format,n.canvasWidth,n.canvasHeight);if(u(r))return;let i=this.ensureDepthTexture(n.canvasWidth,n.canvasHeight),a=this.ensureSamplingDepthTexture(n.canvasWidth,n.canvasHeight),o=e.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:a,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});o.setPipeline(this.depthPrePassPipeline),o.setBindGroup(0,this.bindGroup),o.setVertexBuffer(0,this.faceVertexBuffer),o.draw(this.faceVertexCount),o.end();let s=this.ensureLineIdTextures(n.canvasWidth,n.canvasHeight,a),c=i.createView(),l={r:-1,g:-1,b:0,a:0};if(this.styledLineCount>0){let t=e.beginRenderPass({colorAttachments:[{view:s.endpointView,clearValue:l,loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:s.depthView,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});t.setPipeline(this.hiddenLineIdPipeline),t.setBindGroup(0,this.lineBindGroup),t.setVertexBuffer(0,this.styledLineBuffer),t.draw(6,this.styledLineCount),t.end()}let d=e.beginRenderPass({colorAttachments:[{view:r,loadOp:`clear`,clearValue:this.backgroundClearColor,storeOp:`store`}],depthStencilAttachment:{view:c,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});if(this.solutionFaceVertexCount>0&&(d.setPipeline(this.solutionFacePipeline),d.setBindGroup(0,this.bindGroup),d.setVertexBuffer(0,this.solutionFaceBuffer),d.draw(this.solutionFaceVertexCount)),this.styledLineCount>0&&(d.setPipeline(this.hiddenLinePipeline),d.setBindGroup(0,this.lineBindGroup),d.setVertexBuffer(0,this.styledLineBuffer),d.draw(6,this.styledLineCount)),this.topologyVertexCount>0&&(d.setPipeline(this.hiddenMarkerPipeline),d.setBindGroup(0,this.markerBindGroup),d.setVertexBuffer(0,this.topologyVertexMarkerBuffer),d.draw(Ut,this.topologyVertexCount)),d.end(),this.styledLineCount>0){let t=e.beginRenderPass({colorAttachments:[{view:s.endpointView,clearValue:l,loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:s.depthView,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});t.setPipeline(this.visibleLineIdPipeline),t.setBindGroup(0,this.lineBindGroup),t.setVertexBuffer(0,this.styledLineBuffer),t.draw(6,this.styledLineCount),t.end()}let f=e.beginRenderPass({colorAttachments:[{view:r,resolveTarget:t,loadOp:`load`,storeOp:`discard`}],depthStencilAttachment:{view:c,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});this.styledLineCount>0&&(f.setPipeline(this.visibleLinePipeline),f.setBindGroup(0,this.lineBindGroup),f.setVertexBuffer(0,this.styledLineBuffer),f.draw(6,this.styledLineCount)),this.topologyVertexCount>0&&(f.setPipeline(this.visibleMarkerPipeline),f.setBindGroup(0,this.markerBindGroup),f.setVertexBuffer(0,this.topologyVertexMarkerBuffer),f.draw(Ut,this.topologyVertexCount)),this.hasDragPreview&&(f.setPipeline(this.previewLinePipeline),f.setBindGroup(0,this.previewLineBindGroup),f.setVertexBuffer(0,this.previewLineBuffer),f.draw(6,1)),this.hasStartMarker&&(f.setPipeline(this.previewMarkerPipeline),f.setBindGroup(0,this.previewMarkerBindGroup),f.setVertexBuffer(0,this.previewStartMarkerBuffer),f.draw(Ut,1)),this.hasSnapTarget&&(f.setPipeline(this.previewMarkerPipeline),f.setBindGroup(0,this.previewMarkerBindGroup),f.setVertexBuffer(0,this.previewSnapMarkerBuffer),f.draw(Ut,1)),f.end()}getLastMvpMatrix(){return this.lastMvpMatrix}getPreviewLine(){return this.currentPreviewLine}setDragPreview(e){if(u(e)){this.hasDragPreview=!1,this.hasStartMarker=!1,this.hasSnapTarget=!1,this.currentPreviewLine=void 0;return}let{pointA:t,pointB:n}=e.kind===`vertex`?this.computeVertexDragPreviewEndpoints(e):this.computeLineDragPreviewEndpoints(e);this.currentPreviewLine={pointA:t,pointB:n},this.writePreviewLineBuffer(t,n),this.hasDragPreview=!0,e.kind===`vertex`?(this.device.queue.writeBuffer(this.previewStartMarkerBuffer,0,this.createPreviewMarkerData(e.startPosition)),this.hasStartMarker=!0):this.hasStartMarker=!1,u(e.snapTargetPosition)?this.hasSnapTarget=!1:(this.device.queue.writeBuffer(this.previewSnapMarkerBuffer,0,this.createPreviewMarkerData(e.snapTargetPosition)),this.hasSnapTarget=!0)}computeVertexDragPreviewEndpoints(e){let t=u(e.snapTargetPosition)?this.unprojectToVertexPlane(e.cursorScreenX,e.cursorScreenY,e.startPosition):e.snapTargetPosition;return{pointA:e.startPosition,pointB:t}}computeLineDragPreviewEndpoints(e){let t=u(e.snapTargetPosition)?this.unprojectToVertexPlane(e.cursorScreenX,e.cursorScreenY,e.planeAnchor):e.snapTargetPosition;return{pointA:t,pointB:[t[0]+e.sourceDirection[0],t[1]+e.sourceDirection[1],t[2]+e.sourceDirection[2]]}}writePreviewLineBuffer(e,t){let n=B(P,`line`,[`preview`]),[r,i,a]=z(n.color),o=new Float32Array(At);o[0]=e[0],o[1]=e[1],o[2]=e[2],o[3]=t[0],o[4]=t[1],o[5]=t[2],o[6]=n.width,o[7]=r,o[8]=i,o[9]=a,o[10]=n.alpha,this.device.queue.writeBuffer(this.previewLineBuffer,0,o)}applySceneState(e){this.applyStyledMarkers(e.markers),this.applyStyledSegments(e.segments),this.applySolutionFace(e.solutionFace)}applySolutionFace(e){if(e===void 0||e.vertexCount===0){this.solutionFaceVertexCount=0;return}let t=e.vertices.byteLength;t>this.solutionFaceBuffer.size&&(this.solutionFaceBuffer.destroy(),this.solutionFaceBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST})),this.device.queue.writeBuffer(this.solutionFaceBuffer,0,e.vertices),this.solutionFaceVertexCount=e.vertexCount}applyStyledMarkers(e){if(this.topologyVertexCount=e.length,this.topologyVertexCount===0)return;let t=this.topologyVertexCount*G;t>this.topologyVertexMarkerBuffer.size&&(this.topologyVertexMarkerBuffer.destroy(),this.topologyVertexMarkerBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}));let n=new Float32Array(e.length*Nt);for(let t=0;t<e.length;t++){let r=e[t],i=t*Nt;n[i]=r.position[0],n[i+1]=r.position[1],n[i+2]=r.position[2],n[i+3]=r.markerType,n[i+4]=r.visibleStyle.size,n[i+5]=r.visibleStyle.color[0],n[i+6]=r.visibleStyle.color[1],n[i+7]=r.visibleStyle.color[2],n[i+8]=r.visibleStyle.alpha,n[i+9]=r.visibleStyle.strokeColor[0],n[i+10]=r.visibleStyle.strokeColor[1],n[i+11]=r.visibleStyle.strokeColor[2],n[i+12]=r.visibleStyle.strokeWidth,n[i+13]=r.hiddenStyle.size,n[i+14]=r.hiddenStyle.color[0],n[i+15]=r.hiddenStyle.color[1],n[i+16]=r.hiddenStyle.color[2],n[i+17]=r.hiddenStyle.alpha,n[i+18]=r.hiddenStyle.strokeColor[0],n[i+19]=r.hiddenStyle.strokeColor[1],n[i+20]=r.hiddenStyle.strokeColor[2],n[i+21]=r.hiddenStyle.strokeWidth,n[i+22]=r.vertexIndex}this.device.queue.writeBuffer(this.topologyVertexMarkerBuffer,0,n)}applyStyledSegments(e){if(this.styledLineCount=e.length,this.styledLineCount===0)return;let t=this.styledLineCount*W;t>this.styledLineBuffer.size&&(this.styledLineBuffer.destroy(),this.styledLineBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}));let n=new Float32Array(this.styledLineCount*At);for(let t=0;t<this.styledLineCount;t++)Gt(n,t,e[t]);this.device.queue.writeBuffer(this.styledLineBuffer,0,n)}dispose(){this.uniformBuffer.destroy(),this.previewUniformBuffer.destroy(),this.faceVertexBuffer.destroy(),this.solutionFaceBuffer.destroy(),this.styledLineBuffer.destroy(),this.topologyVertexMarkerBuffer.destroy(),this.previewLineBuffer.destroy(),this.previewStartMarkerBuffer.destroy(),this.previewSnapMarkerBuffer.destroy(),this.depthTexture?.destroy(),this.samplingDepthTexture?.destroy(),this.lineEndpointTexture?.destroy(),this.lineDepthTexture?.destroy()}unprojectToVertexPlane(e,t,n){let r=this.lastCanvasWidth,i=this.lastCanvasHeight,a=this.lastDevicePixelRatio,o=e*a,s=t*a,c=o/r*2-1,l=1-s/i*2,u=O.transformMat4(O.fromValues(n[0],n[1],n[2],1),this.lastMvpMatrix),d=u[2]/u[3],f=k.inverse(this.lastMvpMatrix),p=O.transformMat4(O.fromValues(c,l,d,1),f);return[p[0]/p[3],p[1]/p[3],p[2]/p[3]]}createAndWriteBuffer(e,t){let n=this.device.createBuffer({size:e.byteLength,usage:t|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(n,0,e),n}createLinePipeline(e,t){let n=this.device.createShaderModule({code:bt});return this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,buffers:[{arrayStride:W,stepMode:`instance`,attributes:jt}]},fragment:{module:n,entryPoint:`fs`,constants:{renderMode:t},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less-equal`,format:V},multisample:{count:4}})}createPreviewLinePipeline(e){let t=this.device.createShaderModule({code:bt});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:W,stepMode:`instance`,attributes:jt}]},fragment:{module:t,entryPoint:`fs`,constants:{renderMode:Dt},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:V},multisample:{count:4}})}createDepthPrePassPipeline(e){let t=this.device.createShaderModule({code:yt});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:Pt,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:V,depthBias:Tt,depthBiasSlopeScale:Et}})}createSolutionFacePipeline(e){let t=this.device.createShaderModule({code:St});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:Ft,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}]},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:V},multisample:{count:4}})}createMarkerPipeline(e,t,n=!0){let r=this.device.createShaderModule({code:Ct});return this.device.createRenderPipeline({layout:e,vertex:{module:r,entryPoint:`vs`,buffers:[{arrayStride:G,stepMode:`instance`,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32`},{shaderLocation:2,offset:16,format:`float32`},{shaderLocation:3,offset:20,format:`float32x3`},{shaderLocation:4,offset:32,format:`float32`},{shaderLocation:5,offset:36,format:`float32x3`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32x3`},{shaderLocation:9,offset:68,format:`float32`},{shaderLocation:10,offset:72,format:`float32x3`},{shaderLocation:11,offset:84,format:`float32`},{shaderLocation:12,offset:88,format:`float32`}]}]},fragment:{module:r,entryPoint:`fs`,constants:{renderMode:t,enableLineOcclusion:n?1:0},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:V},multisample:{count:4}})}createLineIdPipeline(e,t){let n=this.device.createShaderModule({code:xt});return this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,buffers:[{arrayStride:W,stepMode:`instance`,attributes:Mt}]},fragment:{module:n,entryPoint:`fs`,constants:{renderMode:t},targets:[{format:wt}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:V}})}createPreviewMarkerData(e){let t=new Float32Array(Nt),n=this.vertexPreviewStyle;return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=n.markerType,t[4]=n.size,t[5]=n.color[0],t[6]=n.color[1],t[7]=n.color[2],t[8]=n.alpha,t[9]=n.strokeColor[0],t[10]=n.strokeColor[1],t[11]=n.strokeColor[2],t[12]=n.strokeWidth,t[13]=n.size,t[14]=n.color[0],t[15]=n.color[1],t[16]=n.color[2],t[17]=n.alpha,t[18]=n.strokeColor[0],t[19]=n.strokeColor[1],t[20]=n.strokeColor[2],t[21]=n.strokeWidth,t}ensureDepthTexture(e,t){return!u(this.depthTexture)&&this.depthTexture.width===e&&this.depthTexture.height===t?this.depthTexture:(this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(H,e),Math.max(H,t)],format:V,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthTexture)}ensureSamplingDepthTexture(e,t){let n=Math.max(H,e),r=Math.max(H,t);if(!u(this.samplingDepthTexture)&&this.samplingDepthTexture.width===n&&this.samplingDepthTexture.height===r)return this.samplingDepthTexture.createView();this.samplingDepthTexture?.destroy(),this.samplingDepthTexture=this.device.createTexture({size:[n,r],format:V,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});let i=this.samplingDepthTexture.createView(),a=e=>[{binding:0,resource:{buffer:e}},{binding:1,resource:i},{binding:2,resource:this.depthSampler}];return this.lineBindGroup=this.device.createBindGroup({layout:this.depthBindGroupLayout,entries:a(this.uniformBuffer)}),this.previewLineBindGroup=this.device.createBindGroup({layout:this.depthBindGroupLayout,entries:a(this.previewUniformBuffer)}),this.samplingDepthTexture.createView()}ensureLineIdTextures(e,t,n){let r=Math.max(H,e),i=Math.max(H,t);if(!u(this.lineEndpointTexture)&&!u(this.lineDepthTexture)&&this.lineEndpointTexture.width===r&&this.lineEndpointTexture.height===i)return{endpointView:this.lineEndpointTexture.createView(),depthView:this.lineDepthTexture.createView()};this.lineEndpointTexture?.destroy(),this.lineDepthTexture?.destroy(),this.lineEndpointTexture=this.device.createTexture({size:[r,i],format:wt,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.lineDepthTexture=this.device.createTexture({size:[r,i],format:V,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});let a=this.lineEndpointTexture.createView(),o=this.lineDepthTexture.createView(),s=e=>[{binding:0,resource:{buffer:e}},{binding:1,resource:n},{binding:2,resource:this.depthSampler},{binding:3,resource:a},{binding:4,resource:o}];return this.markerBindGroup=this.device.createBindGroup({layout:this.markerBindGroupLayout,entries:s(this.uniformBuffer)}),this.previewMarkerBindGroup=this.device.createBindGroup({layout:this.markerBindGroupLayout,entries:s(this.previewUniformBuffer)}),{endpointView:a,depthView:o}}};function Gt(e,t,n){let r=t*At;e[r]=n.startPosition[0],e[r+1]=n.startPosition[1],e[r+2]=n.startPosition[2],e[r+3]=n.endPosition[0],e[r+4]=n.endPosition[1],e[r+5]=n.endPosition[2],e[r+6]=n.visibleStyle.width,e[r+7]=n.visibleStyle.color[0],e[r+8]=n.visibleStyle.color[1],e[r+9]=n.visibleStyle.color[2],e[r+10]=n.visibleStyle.alpha,e[r+11]=n.visibleStyle.lineType,e[r+12]=n.visibleStyle.dash,e[r+13]=n.visibleStyle.gap,e[r+14]=n.hiddenStyle.width,e[r+15]=n.hiddenStyle.color[0],e[r+16]=n.hiddenStyle.color[1],e[r+17]=n.hiddenStyle.color[2],e[r+18]=n.hiddenStyle.alpha,e[r+19]=n.hiddenStyle.lineType,e[r+20]=n.hiddenStyle.dash,e[r+21]=n.hiddenStyle.gap,e[r+22]=n.startVertexIndex,e[r+23]=n.endVertexIndex}var Kt=2,qt=1e3,Jt=250;function Yt(e){let{canvas:t,context:r,layerManager:i,fpsController:a,onFpsUpdate:o}=e,{device:s,canvasContext:c}=r,l=0,u=0,d=Math.max(1,window.devicePixelRatio);function f(){d=Math.max(1,window.devicePixelRatio);let e=Math.floor(t.clientWidth*d),n=Math.floor(t.clientHeight*d),r=t.width!==e||t.height!==n;return r&&(t.width=e,t.height=n),l=e,u=n,r}f();let p=new ResizeObserver(()=>{f(),a.raise(60)});p.observe(t);let m=0,h=!1,g=0,_=performance.now(),v=[],y=0;function b(e){let t=Math.max(qt,a.getFrameIntervalMs()*3);v.push(e);let r=e-t;for(;v.length>0&&v[0]<r;)v.shift();if(e-y>=Jt){y=e;let t=v.length>1?v[v.length-1]-v[0]:0,r=t>0?Math.round((v.length-1)/t*n):0;o?.(r)}}function x(e){if(h)return;a.tick();let t=a.getFrameIntervalMs();if(e-g<t-Kt){m=requestAnimationFrame(x);return}if(g=e,b(e),f(),l===0||u===0){m=requestAnimationFrame(x);return}let r={time:(performance.now()-_)/n,canvasWidth:l,canvasHeight:u,devicePixelRatio:d};i.updateAll(r);let o=c.getCurrentTexture().createView(),p=s.createCommandEncoder();i.renderAll(p,o,r),s.queue.submit([p.finish()]),m=requestAnimationFrame(x)}return m=requestAnimationFrame(x),()=>{h=!0,cancelAnimationFrame(m),p.disconnect()}}var Xt=1e-5,Zt=1e-10,Qt=1e-8;function K(e,t,n=Zt){return D.distSq(e,t)<n}function $t(e,t,n){let r=D.sub(n,t),i=D.dot(r,r);if(i<1e-10)return;let a=D.sub(e,t),o=D.dot(a,r)/i,s=D.addScaled(t,r,o);return{parameter:o,distanceSquared:D.distSq(e,s)}}function en(e,t,n){let r=$t(e,t,n);return r===void 0?K(e,t):r.distanceSquared<Qt}function q(e,t,n){let r=$t(e,t,n);return r===void 0?K(e,t):r.parameter<-.001||r.parameter>1.001?!1:r.distanceSquared<Qt}function tn(e,t,n,r){let i=D.sub(r,n);if(D.len(i)===0)return!1;let a=D.normalize(i),o=D.sub(e,n);if(D.len(D.cross(a,o))>Xt)return!1;let s=D.sub(t,n);return D.len(D.cross(a,s))<=Xt}function nn(e,t){for(let n of t)if(e>n.start+1e-6&&e<n.end-1e-6)return!0;return!1}function rn(e,t,n){for(let r of n)if(e>=r.start-1e-6&&t<=r.end+1e-6)return!0;return!1}function an(e,t){for(let n of t)if(Math.abs(e-n)<1e-6)return!0;return!1}function on(e){let t=[];for(let n of e)(t.length===0||Math.abs(n-t[t.length-1])>1e-6)&&t.push(n);return t}function sn(e){if(e.length===0)return[];let t=[...e].sort((e,t)=>e.start-t.start),n=[t[0]];for(let e=1;e<t.length;e++){let r=t[e],i=n[n.length-1];r.start<=i.end+1e-6?n[n.length-1]={start:i.start,end:Math.max(i.end,r.end)}:n.push(r)}return n}var cn={isSolved:!1,solutionVertexPositions:[],solutionLineRanges:[],solutionFaces:[]};function ln(e,t){let n=e.vertices??[],r=e.lines??[],i=e.faces??[],a=i.flatMap(e=>e.map((t,n)=>[t,e[(n+1)%e.length]])),o=[...r,...a];if(n.length===0&&o.length===0)return cn;for(let e of n)if(!t.vertices.some(t=>K(t.position,e)))return cn;for(let[e,n]of o)if(!t.lines.some(t=>un(t,e,n)))return cn;let s=i.flat(),c=r.flat();return{isSolved:!0,solutionVertexPositions:[...n,...c,...s],solutionLineRanges:o,solutionFaces:i}}function un(e,t,n){switch(e.kind){case`line`:case`edge-extended`:case`segment-extended`:return en(t,e.pointA,e.pointB)&&en(n,e.pointA,e.pointB);case`edge`:case`segment`:return q(t,e.pointA,e.pointB)&&q(n,e.pointA,e.pointB);default:i(e.kind)}}function dn(e,t,n,r){return q(e,n,r)&&q(t,n,r)}var J={type:`none`},fn=1e-4;function pn(e,t,n,r,i,a){let o=xn(e,n,r,a);return{segments:Cn(e,t,n,r,i,a).map(e=>yn(e)),markers:o,solutionFace:hn(a)}}var mn=7;function hn(e){if(!e?.isSolved)return;let t=e.solutionFaces??[];if(t.length===0)return;let n=B(P,`face`,[`solution`]),[r,i,a]=z(n.color),o=n.alpha,s=0;for(let e of t)e.length>=3&&(s+=e.length-2);if(s===0)return;let c=s*3,l=new Float32Array(c*mn),u=0,d=e=>{l[u]=e[0],l[u+1]=e[1],l[u+2]=e[2],l[u+3]=r,l[u+4]=i,l[u+5]=a,l[u+6]=o,u+=mn};for(let e of t){if(e.length<3)continue;let t=e[0];for(let n=1;n<e.length-1;n++)d(t),d(e[n]),d(e[n+1])}return{vertices:l,vertexCount:c}}function gn(e,t){let[n,r]=e.edges[t];return[e.vertices[n],e.vertices[r]]}function _n(e,t,n,r,i,a){return{startPosition:e,endPosition:t,modifiers:n,lineId:r,startVertexIndex:i,endVertexIndex:a}}function vn(e){let[t,n,r]=z(e.color);return{width:e.width,color:[t,n,r],alpha:e.alpha,lineType:e.line.type===`dashed`?1:0,dash:e.line.type===`dashed`?e.line.dash:0,gap:e.line.type===`dashed`?e.line.gap:0}}function yn(e){let t=B(P,`line`,e.modifiers),n=B(P,`line`,[`hidden`,...e.modifiers]);return{startPosition:e.startPosition,endPosition:e.endPosition,visibleStyle:vn(t),hiddenStyle:vn(n),lineId:e.lineId,startVertexIndex:e.startVertexIndex,endVertexIndex:e.endVertexIndex}}function bn(e){let[t,n,r]=z(e.color),[i,a,o]=z(e.strokeColor);return{size:e.size,color:[t,n,r],alpha:e.alpha,strokeColor:[i,a,o],strokeWidth:e.strokeWidth}}function xn(e,t,n,r){let i=[];for(let a=0;a<t.length;a++){let o=t[a],s=o.position,c=[];o.kind===`input`&&c.push(`input`),(I(s,e.vertices,1e-10)||e.figureFaceTriangles.some(t=>Me(s,t,e.vertices)))&&c.push(`inner`),jn(o,n)&&c.push(`selected`),r?.isSolved&&r.solutionVertexPositions.some(e=>I(s,[e],1e-10))&&c.push(`solution`);let l=B(P,`vertex`,c),u=B(P,`vertex`,[`hidden`,...c]);i.push({position:s,markerType:l.markerType===`circle`?1:0,visibleStyle:bn(l),hiddenStyle:bn(u),vertexIndex:a})}return i}var Sn=-2;function Cn(e,t,n,r,i,a){let o=Dn(r),s=On(r,t,e),c=[];for(let r of t){if(r.kind===`edge`)continue;let t=Fn(r,e,n),i=o!==void 0&&r.lineId===o;for(let e of t){let t=r.kind===`line`||r.kind===`edge-extended`||r.kind===`segment-extended`,n=e.modifiers.includes(`segment`);if(t&&n&&r.kind!==`edge-extended`)continue;let o=[...e.modifiers];r.kind===`edge-extended`&&n&&!o.includes(`edge`)&&o.push(`edge`),r.isInput&&r.kind!==`edge-extended`&&(r.kind===`segment-extended`?An(e,r.pointA,r.pointB)&&o.push(`input`):o.push(`input`)),r.kind===`segment`&&!o.includes(`segment`)&&o.push(`segment`),i&&o.push(`selected`),wn(e,a)&&o.push(`solution`),c.push({...e,modifiers:o})}}if(i!==void 0){let t=Fn({lineId:Sn,pointA:i.pointA,pointB:i.pointB,kind:`line`,isInput:!1,startVertexId:-1,endVertexId:-1},e,n);for(let e of t)e.modifiers.includes(`segment`)||c.push({...e,modifiers:[...e.modifiers,`preview`]})}return Tn([...Nn(e,t,n,s,a),...c])}function wn(e,t){return t?.isSolved?t.solutionLineRanges.some(([t,n])=>dn(e.startPosition,e.endPosition,t,n)):!1}function Tn(e){let t=new Map;for(let n of e){let e=En(n.startPosition,n.endPosition),r=t.get(e);(r===void 0||n.modifiers.length>r.modifiers.length)&&t.set(e,n)}return[...t.values()]}var Y=6;function En(e,t){let n=`${e[0].toFixed(Y)},${e[1].toFixed(Y)},${e[2].toFixed(Y)}`,r=`${t[0].toFixed(Y)},${t[1].toFixed(Y)},${t[2].toFixed(Y)}`;return n<r?`${n}|${r}`:`${r}|${n}`}function Dn(e){switch(e.type){case`line`:return e.lineId;case`none`:return;default:i(e)}}function On(e,t,n){let r=new Set;switch(e.type){case`line`:{let i=e.lineId;for(let e of t)if(e.lineId===i)for(let t=0;t<n.edges.length;t++){let[i,a]=gn(n,t);(e.kind===`line`?tn(i,a,e.pointA,e.pointB):kn(i,a,e.pointA,e.pointB))&&r.add(t)}break}case`none`:break;default:i(e)}return r}function kn(e,t,n,r){return K(e,n)&&K(t,r)||K(e,r)&&K(t,n)}function An(e,t,n){let r=[(e.startPosition[0]+e.endPosition[0])/2,(e.startPosition[1]+e.endPosition[1])/2,(e.startPosition[2]+e.endPosition[2])/2],i=$t(r,t,n);if(i===void 0)return K(r,t);let a=.001;return i.parameter>=-a&&i.parameter<=1+a}function jn(e,t){switch(t.type){case`none`:return!1;case`line`:return e.crossLineIds.includes(t.lineId);default:i(t)}}var Mn=-1;function Nn(e,t,n,r,i){let a=[],o=Pn(e,t),s=new Map;for(let e=0;e<n.length;e++)s.set(n[e].vertexId,e);let c=(e,t,n,r,o)=>{let s=[...n];i?.isSolved&&i.solutionLineRanges.some(([n,r])=>dn(e,t,n,r))&&s.push(`solution`),a.push(_n(e,t,s,Mn,r,o))};for(let t=0;t<e.edges.length;t++){let[i,a]=e.edges[t],l=e.vertices[i],u=e.vertices[a],d=o.get(t);if(d?.kind===`edge-extended`)continue;let f=[`edge`,`segment`];r.has(t)&&f.push(`selected`);let p=d===void 0?-1:s.get(d.startVertexId)??-1,m=d===void 0?-1:s.get(d.endVertexId)??-1,h=D.sub(u,l),g=D.dot(h,h);if(g<1e-6||d===void 0){c(l,u,f,p,m);continue}let _=[];for(let e=0;e<n.length;e++){let t=n[e];if(t.vertexId===d.startVertexId||t.vertexId===d.endVertexId||!t.crossLineIds.includes(d.lineId))continue;let r=D.sub(t.position,l),i=D.dot(r,h)/g;i<=1e-6||i>=.999999||_.push({parameter:i,markerIndex:e})}if(_.length===0){c(l,u,f,p,m);continue}_.sort((e,t)=>e.parameter-t.parameter);let v=l,y=p;for(let e of _){let t=D.addScaled(l,h,e.parameter);c(v,t,f,y,e.markerIndex),v=t,y=e.markerIndex}c(v,u,f,y,m)}return a}function Pn(e,t){let n=new Map,r=t.filter(e=>e.kind===`edge`||e.kind===`edge-extended`);for(let t=0;t<e.edges.length;t++){let[i,a]=e.edges[t],o=e.vertices[i],s=e.vertices[a];for(let e of r)if(kn(o,s,e.pointA,e.pointB)){n.set(t,e);break}}return n}function Fn(e,t,n){let[r,i]=e.kind===`segment`||e.kind===`edge`?[e.pointA,e.pointB]:Ae(e.pointA,e.pointB),a=D.sub(i,r),o=D.len(a);if(o===0)return[];let s=D.normalize(a),c=Ln(e,t),l=Rn(r,s,o,t),u=zn(r,s,o,t),d=c.map(e=>{let[n,i]=gn(t,e),a=X(n,r,s,o),c=X(i,r,s,o);return{start:Math.min(a,c),end:Math.max(a,c)}}),f=X(e.pointA,r,s,o),p=X(e.pointB,r,s,o),m=new Set;m.add(0),m.add(1),m.add(f),m.add(p);for(let e of l)m.add(e);for(let e of u)m.add(e.start),m.add(e.end);for(let e of d)m.add(e.start),m.add(e.end);let h=new Map;for(let e=0;e<n.length;e++){let t=n[e].position,i=X(t,r,s,o),a=In(i,r,s,o);D.distSq(t,a)<1e-8&&(h.set(i,e),i>1e-6&&i<.999999&&m.add(i))}let g=on([...m].sort((e,t)=>e-t)),_=sn(u),v=[];for(let n=0;n<g.length-1;n++){let i=g[n],a=g[n+1];if(a-i<1e-6)continue;let c=(i+a)/2,l=In(i,r,s,o),u=In(a,r,s,o),f=Vn(i,h),p=Vn(a,h);if(rn(i,a,d)){v.push(_n(l,u,[`segment`],e.lineId,f,p));continue}if(nn(c,_)){v.push(_n(l,u,[`inner`],e.lineId,f,p));continue}let m=In(c,r,s,o),y=t.figureFaceTriangles.some(e=>Me(m,e,t.vertices));v.push(_n(l,u,y?[`inner`]:[],e.lineId,f,p))}return v}function X(e,t,n,r){return D.dot(D.sub(e,t),n)/r}function In(e,t,n,r){return D.addScaled(t,n,e*r)}function Ln(e,t){let n=[];for(let r=0;r<t.edges.length;r++){let[i,a]=gn(t,r);tn(i,a,e.pointA,e.pointB)&&n.push(r)}return n}function Rn(e,t,n,r){let i=[];for(let a of r.faceTriangles){let o=r.vertices[a[0]],s=r.vertices[a[1]],c=r.vertices[a[2]],l=Ie(e,t,o,s,c);if(l!==void 0&&l>0){let e=l/n;e>1e-6&&e<.999999&&!an(e,i)&&i.push(e)}}return i}function zn(e,t,n,r){let i=[];for(let a=0;a<r.faces.length;a++){let o=r.faces[a];if(o.length<3)continue;let s=o.map(e=>r.vertices[e]),c=D.sub(s[1],s[0]),l=D.sub(s[2],s[0]),u=D.cross(c,l);if(D.len(u)<1e-6)continue;let d=D.normalize(u);if(Math.abs(D.dot(t,d))>fn)continue;let f=D.dot(D.sub(e,s[0]),d);if(Math.abs(f)>fn)continue;let p=Bn(e,t,n,s);p!==void 0&&i.push(p)}return i}function Bn(e,t,n,r){let i=0,a=1,o=D.sub(r[1],r[0]),s=D.sub(r[2],r[0]),c=D.cross(o,s);for(let o=0;o<r.length;o++){let s=(o+1)%r.length,l=r[o],u=r[s],d=D.sub(u,l),f=D.cross(c,d);if(D.len(f)<1e-6)continue;let p=D.normalize(f),m=D.dot(D.sub(e,l),p),h=D.dot(t,p)*n;if(Math.abs(h)<1e-6){if(m<-1e-6)return;continue}let g=-m/h;if(h<0?a=Math.min(a,g):i=Math.max(i,g),i>a)return}if(!(a-i<1e-6))return{start:i,end:a}}function Vn(e,t){let n=t.get(e);if(n!==void 0)return n;for(let[n,r]of t)if(Math.abs(e-n)<1e-6)return r;return-1}var Hn=1e-4,Un=1e-5;function Wn(e,t,n){let r=t?.vertices?.map(e=>[e[0],e[1],e[2]])??[],i=0,a=e.edges.map(([t,n])=>({lineId:i++,pointA:e.vertices[t],pointB:e.vertices[n],kind:`edge`,isInput:!0,startVertexId:-1,endVertexId:-1})),o=t?.lines?.map(([e,t])=>({lineId:i++,pointA:[e[0],e[1],e[2]],pointB:[t[0],t[1],t[2]],kind:`line`,isInput:!0,startVertexId:-1,endVertexId:-1}))??[],s=t?.segments?.map(([e,t])=>({lineId:i++,pointA:[e[0],e[1],e[2]],pointB:[t[0],t[1],t[2]],kind:`segment`,isInput:!0,startVertexId:-1,endVertexId:-1}))??[],c=[...a,...o,...s];return Z({figures:[e],lines:c,vertices:[],intersections:[],nextLineId:i,nextVertexId:0},e,r,n)}function Gn(e,t,n,r,i){let a=$n(e,t,n);if(a!==void 0)return a.kind===`edge`||a.kind===`segment`?qn(e,a.lineId,r,i):e;let o={lineId:e.nextLineId,pointA:t,pointB:n,kind:`line`,isInput:!1,startVertexId:-1,endVertexId:-1};return Z({...e,lines:[...e.lines,o],nextLineId:e.nextLineId+1},r,Yn(e),i)}function Kn(e,t,n,r){let i=e.lines.find(e=>e.lineId===t);return i===void 0||i.isInput?e:Z({...e,lines:e.lines.filter(e=>e.lineId!==t)},n,Yn(e),r)}function qn(e,t,n,r){let i=e.lines.find(e=>e.lineId===t);if(i===void 0||i.kind!==`edge`&&i.kind!==`segment`)return e;let a=i.kind===`edge`?`edge-extended`:`segment-extended`,o=e.lines.map(e=>e.lineId===t?{...e,kind:a}:e);return Z({...e,lines:o},n,Yn(e),r)}function Jn(e,t,n,r){let i=e.lines.find(e=>e.lineId===t);if(i===void 0||i.kind!==`edge-extended`&&i.kind!==`segment-extended`)return e;let a=i.kind===`edge-extended`?`edge`:`segment`,o=e.lines.map(e=>e.lineId===t?{...e,kind:a}:e);return Z({...e,lines:o},n,Yn(e),r)}function Yn(e){return e.vertices.filter(e=>e.kind===`input`).map(e=>e.position)}function Z(e,t,n,r){let i=r?r.compute(e.lines,t):tt(e.lines,t),{vertices:a,nextVertexId:o}=Xn(t,n,i,e.nextVertexId),s=tr(e.lines,a),c=Zn(a,s,i);return{...e,lines:s,intersections:i,vertices:c,nextVertexId:o}}function Xn(e,t,n,r){let i=r,a=e.vertices.map(e=>({vertexId:i++,position:e,kind:`figure`,crossLineIds:[]})),o=t.filter(t=>!I(t,e.vertices,Un)).map(e=>({vertexId:i++,position:e,kind:`input`,crossLineIds:[]})),s=[...e.vertices,...o.map(e=>e.position)],c=n.filter(e=>!I(e.position,s,Un)).map(e=>({vertexId:i++,position:e.position,kind:`intersection`,crossLineIds:[]}));return{vertices:[...a,...o,...c],nextVertexId:i}}function Zn(e,t,n){let r=new Map;for(let e of n){let t=er(e.position),n=r.get(t);if(n!==void 0)for(let t of e.sourceLineIds)n.includes(t)||n.push(t);else r.set(t,[...e.sourceLineIds])}return e.map(e=>{let n;switch(e.kind){case`intersection`:{let t=er(e.position);n=r.get(t)??[];break}case`figure`:case`input`:{let i=[];for(let n of t)(n.startVertexId===e.vertexId||n.endVertexId===e.vertexId||Qn(e.position,n))&&i.push(n.lineId);let a=er(e.position),o=r.get(a);if(o!==void 0)for(let e of o)i.includes(e)||i.push(e);n=i;break}default:i(e.kind)}return{...e,crossLineIds:n}})}function Qn(e,t){return t.kind===`edge`||t.kind===`segment`?q(e,t.pointA,t.pointB):en(e,t.pointA,t.pointB)}function $n(e,t,n){for(let r of[t,n]){let i=e.vertices.find(e=>nr(e.position,r));if(i===void 0||i.crossLineIds.length===0)continue;let a=r===t?n:t;for(let t of i.crossLineIds){let n=e.lines.find(e=>e.lineId===t);if(n!==void 0&&en(a,n.pointA,n.pointB))return n}}}function er(e){return`${e[0].toFixed(6)},${e[1].toFixed(6)},${e[2].toFixed(6)}`}function tr(e,t){return e.map(e=>{let n=-1,r=-1;for(let i of t)if(n===-1&&nr(i.position,e.pointA)&&(n=i.vertexId),r===-1&&nr(i.position,e.pointB)&&(r=i.vertexId),n!==-1&&r!==-1)break;return{...e,startVertexId:n,endVertexId:r}})}function nr(e,t){return D.distSq(e,t)<Hn}var rr=[`vertex`];function ir(e,t){let n=!1,r,{topology:a}=Ce(t),s=be(e,t.camera),c=new o(10),l=new et,u,d=Wn(a,t.input,l),f=J,p,m=ke(),h=new Set,g=new Set;function _(){for(let e of h)e(m.canUndo(),m.canRedo())}function v(e){let n=ln(t.expected,e),r=pn(a,e.lines,e.vertices,f,p,n);u?.applySceneState(r)}function y(e){m.push(d),d=e,v(d),_()}function b(){if(!(n||!u))return{canvasWidth:e.clientWidth,canvasHeight:e.clientHeight,devicePixelRatio:Math.max(1,window.devicePixelRatio),mvpMatrix:u.getLastMvpMatrix()}}function x(e,t,n){let r=b();if(r!==void 0)return Re(e,t,r.canvasWidth,r.canvasHeight,r.devicePixelRatio,r.mvpMatrix,d.lines,d.vertices.map(e=>e.position),n)}function S(e,t){let n=x(e,t);return n?.type===`line`?{type:`line`,lineId:n.lineId}:J}function C(e,t){let n=x(e,t);if(n===void 0)return;if(n.type===`vertex`)return{kind:`vertex`,position:n.position};let r=d.lines.find(e=>e.lineId===n.lineId);if(r===void 0)return;let i=D.sub(r.pointB,r.pointA);return{kind:`line`,lineId:n.lineId,direction:[i[0],i[1],i[2]],planeAnchor:r.pointA}}function w(e,t){let n=x(e,t,rr);return n?.type===`vertex`?n.position:void 0}function T(e){f=e,v(d)}function E(){switch(f.type){case`line`:{let e=f.lineId,t=d.lines.find(t=>t.lineId===e);return t===void 0?void 0:D.sub(t.pointB,t.pointA)}case`none`:return;default:i(f)}}function O(e,t){T(S(e,t))}function k(e){let t=d.lines.find(t=>t.lineId===e);if(t!==void 0)switch(f=J,t.kind){case`edge`:case`segment`:y(qn(d,e,a,l));break;case`edge-extended`:case`segment-extended`:y(Jn(d,e,a,l));break;case`line`:y(Kn(d,e,a,l));break;default:i(t.kind)}}function A(){c.raise(60)}e.addEventListener(`pointerdown`,A),e.addEventListener(`pointermove`,A),e.addEventListener(`wheel`,A);let j=xe(e,O,()=>{}),ee=Se(e,{performInitialHitTest:C,performSnapHitTest:w,hasActiveSelection:()=>f.type!==`none`,isLineSelected:e=>f.type===`line`&&f.lineId===e,onDragStart:()=>{},onDragUpdate:e=>{u?.setDragPreview(e),p=u?.getPreviewLine(),v(d)},onLineTap:e=>T({type:`line`,lineId:e}),onLineDoubleTap:k,onVertexTap:e=>{let t=E();if(t!==void 0){let n=[e[0]+t[0],e[1]+t[1],e[2]+t[2]];y(Gn(d,e,n,a,l))}T(J)},onDragComplete:(e,t)=>{y(Gn(d,e,t,a,l)),T(J)},onSecondPointer:(e,t,n)=>{s.registerExternalPointer(e,t,n)}});ar(e,s,a,t,c,e=>{for(let t of g)t(e)}).then(({cleanup:e,sceneLayer:t})=>{n?e():(r=e,u=t,v(d))});function te(e){e!==void 0&&(d=e,v(d),T(J),_())}return{destroy:()=>{n=!0,s.destroy(),c.dispose(),e.removeEventListener(`pointerdown`,A),e.removeEventListener(`pointermove`,A),e.removeEventListener(`wheel`,A),j(),ee(),h.clear(),g.clear(),r?.()},camera:s,undo:()=>te(m.undo(d)),redo:()=>te(m.redo(d)),subscribeHistory:e=>(h.add(e),e(m.canUndo(),m.canRedo()),()=>h.delete(e)),subscribeFps:e=>(g.add(e),()=>g.delete(e))}}async function ar(e,t,n,r,i,a){let o=await l(e),s=c(4),u=new Wt(t,s,n,i,r.camera?.center??[0,0,0],r.camera?.projection??`perspective`),f=new d([u]);f.initAll(o);let p=Yt({canvas:e,context:o,layerManager:f,fpsController:i,onFpsUpdate:a});return{cleanup:()=>{p(),f.dispose(),s.dispose(),o.device.destroy()},sceneLayer:u}}var or={id:`puzzle_1_1`,solutionImage:`/portfolio/assets/a-Y7PfvzzG.png`,camera:{center:[0,-.25,0],distance:{min:3,max:10,initial:5},angle:{elevation:Math.PI/2.3,azimuth:Math.PI/30},projection:`perspective`},input:{vertices:[[.205725,.225,-.283156]],lines:[[[1.5,-.75,1.5],[-1.5,-.75,1]]],segments:[[[-.293893,0,-.404509],[-.475529,-.75,.654509]]],figures:[{vertices:[[0,-.75,1],[.951057,-.75,.309017],[.587785,-.75,-.809017],[-.587785,-.75,-.809017],[-.951057,-.75,.309017],[0,.75,0]],faces:[[5,0,1],[5,1,2],[5,2,3],[5,3,4],[5,4,0],[0,1,2,3,4]]}]},expected:{faces:[[[.205725,.225,-.283156],[.506437,-.048748,.164551],[0,-.624467,.916312],[-.600268,-.196738,.195039],[-.219674,.189403,-.302355]]]}},Q=f({en:{toolbar:{undo:`Undo`,redo:`Redo`,rotate:`Rotate`,pan:`Pan`,help:`Help`,puzzle:`Puzzle`,close:`Close`},puzzles:{puzzle_1_1:{name:`Section of a pentagonal pyramid`,description:`Construct a cross-section of the pyramid through the given point, parallel to the two given lines.`}},solutionImageAlt:`Expected solution illustration`,help:{title:`Stereometry`,description:`Interactive 3D geometry game — construct auxiliary lines, find intersection points of lines and faces, and build cross-sections of solids.`,controls:{drag:`rotate the camera`,shiftDrag:`pan the view`,scrollPinch:`zoom in and out`,clickEdge:`select it`,doubleClickEdge:`extend edge into an infinite line (or remove it)`,doubleClickLine:`remove the line`,dragVertex:`draw a construction line between two points`,selectEdgeTapVertex:`draw a parallel line through that vertex`,holdDragLineVertex:`preview and place a parallel line through the target vertex`},controlLabels:{drag:`Drag`,shiftDrag:`Shift+Drag`,scrollPinch:`Scroll / Pinch`,clickEdge:`Click edge/line`,doubleClickEdge:`Double-click edge`,doubleClickLine:`Double-click line`,dragVertex:`Drag vertex → vertex`,selectEdgeTapVertex:`Select edge/line + tap vertex`,holdDragLineVertex:`Hold selected line → drag to vertex`},intersectionHint:`Intersection points appear automatically where lines cross.`}},ru:{toolbar:{undo:`Отменить`,redo:`Повторить`,rotate:`Вращение`,pan:`Перемещение`,help:`Справка`,puzzle:`Задача`,close:`Закрыть`},puzzles:{puzzle_1_1:{name:`Сечение пятиугольной пирамиды`,description:`Постройте сечение пирамиды, проходящее через заданную точку и параллельное двум заданным прямым.`}},solutionImageAlt:`Изображение ожидаемого решения`,help:{title:`Стереометрия`,description:`Интерактивная 3D-игра по стереометрии — стройте вспомогательные линии, находите точки пересечения прямых и граней, выполняйте сечения фигур.`,controls:{drag:`вращение камеры`,shiftDrag:`перемещение вида`,scrollPinch:`приближение и отдаление`,clickEdge:`выделить ребро`,doubleClickEdge:`продлить ребро в бесконечную прямую (или убрать)`,doubleClickLine:`удалить линию`,dragVertex:`провести вспомогательную линию между двумя точками`,selectEdgeTapVertex:`провести параллельную прямую через эту вершину`,holdDragLineVertex:`предпросмотр и построение параллельной прямой через целевую вершину`},controlLabels:{drag:`Перетаскивание`,shiftDrag:`Shift+Перетаскивание`,scrollPinch:`Прокрутка / Щипок`,clickEdge:`Клик по ребру/линии`,doubleClickEdge:`Двойной клик по ребру`,doubleClickLine:`Двойной клик по линии`,dragVertex:`Перетащить вершину → вершину`,selectEdgeTapVertex:`Выделить ребро + нажать на вершину`,holdDragLineVertex:`Удержать выделенную линию → до вершины`},intersectionHint:`Точки пересечения появляются автоматически при пересечении линий.`}}}),sr=r(),$=20,cr=14,lr=(0,M.memo)(()=>{let e=(0,M.useRef)(null),t=(0,M.useRef)(null),[n,r]=(0,M.useState)(`rotate`),[i,a]=(0,M.useState)(!1),[o,s]=(0,M.useState)(!1),[c]=(0,M.useState)(or),[l,u]=(0,M.useState)(0);(0,M.useEffect)(()=>{if(e.current){let n=ir(e.current,c);t.current=n;let r=n.subscribeHistory((e,t)=>{a(e),s(t)}),i=n.subscribeFps(u);return()=>{t.current=null,r(),i(),n.destroy()}}},[c]);let d=m(()=>{r(`rotate`),t.current?.camera.setInteractionMode(`rotate`)}),f=m(()=>{r(`pan`),t.current?.camera.setInteractionMode(`pan`)}),p=m(()=>{t.current?.undo()}),h=m(()=>{t.current?.redo()});return(0,N.jsx)(T,{className:E.fixedContainer,children:(0,N.jsxs)(`div`,{className:E.fixedContainer,children:[(0,N.jsx)(`canvas`,{ref:e,className:`h-full w-full [touch-action:none]`}),!sr&&(0,N.jsxs)(`div`,{className:`absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400`,children:[l,` FPS`]}),(0,N.jsxs)(`div`,{className:`fixed right-4 bottom-4 flex gap-2`,children:[(0,N.jsx)(dr,{puzzle:c}),(0,N.jsx)(fr,{}),(0,N.jsx)(ur,{onClick:p,label:Q.toolbar.undo,disabled:!i,children:(0,N.jsx)(w,{size:$})}),(0,N.jsx)(ur,{onClick:h,label:Q.toolbar.redo,disabled:!o,children:(0,N.jsx)(ee,{size:$})}),(0,N.jsx)(ur,{active:n===`rotate`,onClick:d,label:Q.toolbar.rotate,children:(0,N.jsx)(te,{size:$})}),(0,N.jsx)(ur,{active:n===`pan`,onClick:f,label:Q.toolbar.pan,children:(0,N.jsx)(A,{size:$})})]})]})})}),ur=(0,M.memo)(({active:e=!1,disabled:t=!1,onClick:n,children:r,label:i})=>(0,N.jsx)(`button`,{type:`button`,onClick:n,disabled:t,"aria-label":i,"aria-pressed":e,className:C(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all`,t?`bg-neutral-900 text-neutral-600 cursor-not-allowed`:`hover:scale-110 active:scale-95`,!t&&e&&`bg-blue-500 text-white`,!t&&!e&&`bg-neutral-800 text-neutral-400 hover:text-white`),children:r})),dr=(0,M.memo)(({puzzle:e})=>{let[t,n]=(0,M.useState)(!1),r=Q.puzzles[e.id];return r===void 0?null:(0,N.jsxs)(p,{open:t,onOpenChange:n,children:[(0,N.jsx)(y,{asChild:!0,children:(0,N.jsx)(`button`,{type:`button`,"aria-label":Q.toolbar.puzzle,className:C(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,t?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,N.jsx)(j,{size:$})})}),(0,N.jsx)(h,{children:(0,N.jsxs)(g,{side:`top`,sideOffset:8,align:`end`,collisionPadding:16,className:C(`z-50 w-72 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,N.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,N.jsx)(`span`,{className:`font-semibold text-white`,children:r.name}),(0,N.jsx)(_,{"aria-label":Q.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,N.jsx)(x,{size:cr})})]}),e.solutionImage!==void 0&&(0,N.jsx)(`img`,{src:e.solutionImage,alt:Q.solutionImageAlt,className:`mb-3 w-full rounded-md border border-neutral-700 object-cover`}),(0,N.jsx)(`p`,{className:`text-neutral-300`,children:r.description}),(0,N.jsx)(v,{className:`fill-neutral-900`})]})})]})}),fr=(0,M.memo)(()=>{let[e,t]=(0,M.useState)(!1);return(0,N.jsxs)(p,{open:e,onOpenChange:t,children:[(0,N.jsx)(y,{asChild:!0,children:(0,N.jsx)(`button`,{type:`button`,"aria-label":Q.toolbar.help,className:C(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,e?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,N.jsx)(S,{size:$})})}),(0,N.jsx)(h,{children:(0,N.jsxs)(g,{side:`top`,sideOffset:8,align:`end`,collisionPadding:16,className:C(`z-50 w-72 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,N.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,N.jsx)(`span`,{className:`font-semibold text-white`,children:Q.help.title}),(0,N.jsx)(_,{"aria-label":Q.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,N.jsx)(x,{size:cr})})]}),(0,N.jsx)(`p`,{className:`mb-3 text-neutral-400`,children:Q.help.description}),(0,N.jsxs)(`ul`,{className:`space-y-1.5 text-neutral-300`,children:[(0,N.jsxs)(`li`,{children:[(0,N.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.drag}),` —`,` `,Q.help.controls.drag]}),(0,N.jsxs)(`li`,{children:[(0,N.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.shiftDrag}),` `,`— `,Q.help.controls.shiftDrag]}),(0,N.jsxs)(`li`,{children:[(0,N.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.scrollPinch}),` `,`— `,Q.help.controls.scrollPinch]}),(0,N.jsxs)(`li`,{children:[(0,N.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.clickEdge}),` `,`— `,Q.help.controls.clickEdge]}),(0,N.jsxs)(`li`,{children:[(0,N.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.doubleClickEdge}),` `,`— `,Q.help.controls.doubleClickEdge]}),(0,N.jsxs)(`li`,{children:[(0,N.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.doubleClickLine}),` `,`— `,Q.help.controls.doubleClickLine]}),(0,N.jsxs)(`li`,{children:[(0,N.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.dragVertex}),` `,`— `,Q.help.controls.dragVertex]}),(0,N.jsxs)(`li`,{children:[(0,N.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.selectEdgeTapVertex}),` `,`— `,Q.help.controls.selectEdgeTapVertex]}),(0,N.jsxs)(`li`,{children:[(0,N.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.holdDragLineVertex}),` `,`— `,Q.help.controls.holdDragLineVertex]})]}),(0,N.jsx)(`p`,{className:`mt-3 text-xs text-neutral-500`,children:Q.help.intersectionHint}),(0,N.jsx)(v,{className:`fill-neutral-900`})]})})]})});export{lr as Stereometry};