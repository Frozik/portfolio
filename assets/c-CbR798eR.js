import{a as e,t}from"./c-BuTfruC8.js";import{t as n}from"./c-oF12xhiC.js";import{t as r}from"./c-DpbFSzKL.js";import{t as i}from"./c-DS2GebDn.js";import{t as a}from"./c-DMshPcI6.js";import{t as o}from"./c-DAytbQ4X.js";import{t as s}from"./c-BJa7MY5v.js";import{t as c}from"./c-B3tI7tUu.js";import{t as l}from"./c-CKAb7U81.js";import{t as u}from"./c-DkGOca_l2.js";import{M as d,O as f,j as p,n as m}from"./e-D5L6WJem.js";import{n as h,t as g}from"./c-D69FVEAv2.js";import{t as _}from"./c-DBlWlVzk2.js";import{t as v}from"./c-DJFav91z2.js";import{t as y}from"./c-DPs6xZlg.js";import{a as b,i as x,n as S,o as C,r as w,s as T}from"./c-Bx9JDJSV.js";import{a as E,i as D,n as O,o as k,r as A,t as j}from"./c-C6RyINpf.js";import{r as ee,t as M}from"./c-_PoVMGgb.js";import{t as te}from"./c-CHI5AxV6.js";var ne=o(`move`,[[`path`,{d:`M12 2v20`,key:`t6zp3m`}],[`path`,{d:`m15 19-3 3-3-3`,key:`11eu04`}],[`path`,{d:`m19 9 3 3-3 3`,key:`1mg7y2`}],[`path`,{d:`M2 12h20`,key:`9i4pu4`}],[`path`,{d:`m5 9-3 3 3 3`,key:`j64kie`}],[`path`,{d:`m9 5 3-3 3 3`,key:`l8vdw6`}]]),re=o(`puzzle`,[[`path`,{d:`M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z`,key:`w46dr5`}]]),ie=o(`redo-2`,[[`path`,{d:`m15 14 5-5-5-5`,key:`12vg1m`}],[`path`,{d:`M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13`,key:`6uklza`}]]),ae=o(`undo-2`,[[`path`,{d:`M9 14 4 9l5-5`,key:`102s5s`}],[`path`,{d:`M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11`,key:`f3b9sd`}]]),N=e(r(),1),oe=Math.PI/2.3,se=Math.PI/30,ce=.005,le=.003,ue=.01,de=.95,fe=.1,pe=.1,me=.001,he=Math.PI/4,ge=.1,_e=Math.tan(he/2),ve=.2,ye=.1,be=.2,xe=.1,Se=.45,Ce=.1,P={line:{color:`#FFFFFF`,width:1,alpha:1,line:{type:`solid`}},"line:hidden":{alpha:.3,line:{type:`dashed`,dash:.05,gap:.05}},"line:selected":{color:`#55AAFF`},"line:hidden:selected":{alpha:1},"line:segment":{width:3},"line:preview":{color:`#4488BB`},"line:inner":{width:3},"line:input":{color:`#FF8973`,width:3,alpha:1},"line:input:hidden":{alpha:.3},"line:segment:input:hidden":{alpha:.3},"line:input:selected":{color:`#A61A00`},"line:segment:input":{color:`#FF8973`,width:3,alpha:1},"line:segment:input:selected":{color:`#A61A00`},"line:solution":{color:`#EFBF04`},vertex:{markerType:`circle`,color:`#000000`,size:10,strokeColor:`#FFFFFF`,strokeWidth:2},"vertex:hidden":{strokeColor:`#999999`},"vertex:selected":{color:`#55AAFF`},"vertex:hidden:selected":{color:`#3388DD`},"vertex:inner":{strokeColor:`#AAFF44`,color:`#AAAAAA`},"vertex:inner:hidden":{strokeColor:`#77CC22`,color:`#000000`},"vertex:preview":{color:`#000000`,strokeColor:`#4488BB`,strokeWidth:6,size:16},"vertex:input":{markerType:`solid`,color:`#FF8973`,size:10},"vertex:input:hidden":{markerType:`solid`,color:`#FF8973`,size:10,alpha:.6},"vertex:input:selected":{markerType:`solid`,color:`#A61A00`,size:10},"vertex:solution":{markerType:`solid`,color:`#EFBF04`},"vertex:solution:hidden":{markerType:`solid`,color:`#EFBF04`},"face:solution":{color:`#EFBF04`,alpha:.1},background:{color:`#07090c`}};function we(e,t){let n=t?.distance?.min??3,r=t?.distance?.max??15,i=t?.distance?.initial??5,a=t?.center??[0,0,0],o=t?.angle?.azimuth??se,s=t?.angle?.elevation??oe,c=i,l=i,u=[a[0],a[1],a[2]],d=`rotate`,f=0,p=0,m=0;function h(){return[u[0]+Math.sin(s)*Math.sin(o)*c,u[1]+Math.cos(s)*c,u[2]+Math.sin(s)*Math.cos(o)*c]}function g(){return[-Math.cos(s)*Math.sin(o),Math.sin(s),-Math.cos(s)*Math.cos(o)]}function _(){return[Math.cos(o),0,-Math.sin(o)]}function v(e){let t=-e*ce;o+=t;let n=u[0]-a[0],r=u[2]-a[2],i=Math.cos(t),s=Math.sin(t);u[0]=a[0]+n*i+r*s,u[2]=a[2]-n*s+r*i}function y(e,t){let n=le*c,r=_();u[0]-=r[0]*e*n,u[1]+=t*n,u[2]-=r[2]*e*n}function b(e){return Math.max(n,Math.min(r,e))}function x(){f=0,p=0,m=0}let S=new Map,C=!1,w=0,T=0;function E(){let e=[...S.values()],t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}function D(t){S.set(t.pointerId,{clientX:t.clientX,clientY:t.clientY});try{e.setPointerCapture(t.pointerId)}catch{}S.size===1?C=t.shiftKey:S.size===2&&(w=E())}function k(e){let t=S.get(e.pointerId);if(t===void 0)return;if(S.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),S.size===2){let e=E();if(e<1)return;let t=w/e;l=b(l*t),w=e;return}if(S.size!==1)return;let n=e.clientX-t.clientX,r=e.clientY-t.clientY;T=performance.now(),C||d===`pan`?(p=n,m=r,f=0,y(n,r)):(f=n,p=0,m=0,v(n))}function A(e){S.delete(e.pointerId),S.size===0&&(C=!1,performance.now()-T>80&&x())}function ee(e){S.delete(e.pointerId)}function M(){S.clear(),C=!1,x()}function te(e){e.preventDefault(),l=b(l*(1+e.deltaY*ue))}return e.addEventListener(`pointerdown`,D),window.addEventListener(`pointermove`,k),window.addEventListener(`pointerup`,A),window.addEventListener(`pointercancel`,ee),window.addEventListener(`blur`,M),e.addEventListener(`wheel`,te,{passive:!1}),{tick(){let e=Math.abs(l-c)>me;if(e?c+=(l-c)*pe:c=l,S.size>0)return!0;let t=Math.abs(f)>=fe,n=Math.abs(p)>=.1||Math.abs(m)>=.1;return!t&&!n?(x(),e):(t&&(v(f),f*=de),n&&(y(p,m),p*=de,m*=de),!0)},getViewMatrix(){let e=h(),t=g();return j.lookAt(O.fromValues(e[0],e[1],e[2]),O.fromValues(u[0],u[1],u[2]),O.fromValues(t[0],t[1],t[2]))},getEyePosition(){return h()},getDistance(){return c},setInteractionMode(e){d=e,x()},registerExternalPointer(e,t,n){S.has(e)||(S.set(e,{clientX:t,clientY:n}),S.size===2&&(w=E()))},destroy(){e.removeEventListener(`pointerdown`,D),window.removeEventListener(`pointermove`,k),window.removeEventListener(`pointerup`,A),window.removeEventListener(`pointercancel`,ee),window.removeEventListener(`blur`,M),e.removeEventListener(`wheel`,te)}}}function Te(e,t,n){let r=0,i=0,a=0,o,s=0,c=0,l=0;function u(e,t){let n=Math.abs(e-r),o=Math.abs(t-i),s=performance.now()-a;return n<3&&o<3&&s<300}function d(e,r){let i=performance.now(),a=i-l,o=Math.sqrt((e-s)**2+(r-c)**2);a<400&&o<10?(n(e,r),l=0):(t(e,r),s=e,c=r,l=i)}function f(e){e.isPrimary&&(o=e.pointerId,r=e.clientX,i=e.clientY,a=performance.now())}function p(t){if(t.pointerId===o&&(o=void 0,u(t.clientX,t.clientY))){let n=e.getBoundingClientRect();d(t.clientX-n.left,t.clientY-n.top)}}return e.addEventListener(`pointerdown`,f),window.addEventListener(`pointerup`,p),()=>{e.removeEventListener(`pointerdown`,f),window.removeEventListener(`pointerup`,p)}}function Ee(e,t){let n,r,i=!1,a,o=0,s=0,c=0,l=0,u,d,f=0,p=0,m=0;function h(t,n){let r=e.getBoundingClientRect();return{screenX:t-r.left,screenY:n-r.top}}function g(e,t){return e[0]===t[0]&&e[1]===t[1]&&e[2]===t[2]}function _(e,t,n,r){return e.kind===`vertex`?{kind:`vertex`,startPosition:e.position,cursorScreenX:t,cursorScreenY:n,snapTargetPosition:r!==void 0&&!g(r,e.position)?r:void 0}:{kind:`line`,sourceDirection:e.direction,planeAnchor:e.planeAnchor,cursorScreenX:t,cursorScreenY:n,snapTargetPosition:r}}function v(){u!==void 0&&(window.clearTimeout(u),u=void 0)}function y(e,a,o){let s=r;s!==void 0&&(v(),r=void 0,i=!1,n=s,t.onDragStart(),t.onDragUpdate(_(s,e,a,o)))}function b(){let{screenX:e,screenY:t}=h(o,s);y(e,t,void 0)}function x(e,n,r){let i=performance.now(),a=i-f,o=Math.sqrt((n-p)**2+(r-m)**2);if(d===e&&a<400&&o<10){d=void 0,t.onLineDoubleTap(e);return}d=e,f=i,p=n,m=r,t.onLineTap(e)}function S(e){let{screenX:d,screenY:f}=h(e.clientX,e.clientY),p=t.performInitialHitTest(d,f);return p===void 0?!1:p.kind===`vertex`&&t.hasActiveSelection()?(t.onVertexTap(p.position),!0):(a=e.pointerId,o=e.clientX,s=e.clientY,c=e.clientX,l=e.clientY,p.kind===`vertex`?(n=p,t.onDragStart(),t.onDragUpdate(_(p,d,f,void 0))):(r=p,i=t.isLineSelected(p.lineId),i&&(u=window.setTimeout(b,250))),!0)}function C(e,a){c=e,l=a;let{screenX:u,screenY:d}=h(e,a);if(r!==void 0){if(!i)return;Math.max(Math.abs(e-o),Math.abs(a-s))>=3&&y(u,d,t.performSnapHitTest(u,d));return}if(n===void 0)return;let f=t.performSnapHitTest(u,d);t.onDragUpdate(_(n,u,d,f))}function w(e,o){if(r!==void 0){let t=r;v(),r=void 0,i=!1,a=void 0,t.kind===`line`&&x(t.lineId,e,o);return}let s=n;if(s===void 0)return;let{screenX:c,screenY:l}=h(e,o),u=t.performSnapHitTest(c,l);if(n=void 0,a=void 0,t.onDragUpdate(void 0),s.kind===`vertex`){u!==void 0&&!g(u,s.position)?t.onDragComplete(s.position,u):t.onVertexTap(s.position);return}if(u!==void 0){let e=[u[0]+s.direction[0],u[1]+s.direction[1],u[2]+s.direction[2]];t.onDragComplete(u,e)}}function T(){v(),r=void 0,i=!1,n=void 0,a=void 0,t.onDragUpdate(void 0)}function E(e){if(n!==void 0||r!==void 0){a!==void 0&&t.onSecondPointer(a,c,l),T();return}e.isPrimary&&S(e)&&e.stopPropagation()}function D(e){e.pointerId===a&&(n===void 0&&r===void 0||C(e.clientX,e.clientY))}function O(e){e.pointerId===a&&(n===void 0&&r===void 0||w(e.clientX,e.clientY))}return e.addEventListener(`pointerdown`,E,{capture:!0}),window.addEventListener(`pointermove`,D),window.addEventListener(`pointerup`,O),()=>{v(),e.removeEventListener(`pointerdown`,E,{capture:!0}),window.removeEventListener(`pointermove`,D),window.removeEventListener(`pointerup`,O)}}function De(e){let t=[],n=[],r=[],i=new Set,a=[];for(let o of e.input.figures){let e=t.length,s=[];for(let e of o.vertices)t.push([e[0],e[1],e[2]]);for(let t of o.faces){let r=t.map(t=>t+e);n.push(r),s.push(r);for(let e=0;e<r.length;e++){let t=(e+1)%r.length,n=Math.min(r[e],r[t]),o=Math.max(r[e],r[t]),s=`${n}-${o}`;i.has(s)||(i.add(s),a.push([n,o]))}}r.push(s)}return{topology:Oe(t,a,n,r)}}function Oe(e,t,n,r){return{vertices:e,edges:t,faces:n,faceTriangles:Ae(n),figureFaceTriangles:r.map(e=>Ae(e))}}function ke(e){let{vertices:t,faceTriangles:n}=e,r=n.length*3,i=new Float32Array(r*3),a=0;for(let[e,r,o]of n)je(i,a,t[e]),je(i,a+1,t[r]),je(i,a+2,t[o]),a+=3;return{facePositions:i,faceVertexCount:r}}function Ae(e){let t=[];for(let n of e){if(n.length<3)continue;let e=n[0];for(let r=1;r<n.length-1;r++)t.push([e,n[r],n[r+1]])}return t}function je(e,t,n){let r=t*3;e[r]=n[0],e[r+1]=n[1],e[r+2]=n[2]}var Me=100;function Ne(){let e=[],t=[];return{push(n){e.push(n),t.length=0,e.length>Me&&e.shift()},undo(n){let r=e.pop();if(r!==void 0)return t.push(n),r},redo(n){let r=t.pop();if(r!==void 0)return e.push(n),r},canUndo(){return e.length>0},canRedo(){return t.length>0}}}function Pe(e,t){let n=O.sub(t,e);if(O.len(n)===0)return[[e[0],e[1],e[2]],[t[0],t[1],t[2]]];let r=O.normalize(n);return[O.addScaled(e,r,-20),O.addScaled(t,r,20)]}var F=1e-4;function Fe(e,t,n,r){let i=O.sub(n,t),a=O.sub(r,t),o=O.cross(i,a),s=O.len(o);if(s<F||Math.abs(O.dot(O.sub(e,t),o))/s>F)return!1;let c=O.dot(i,i),l=O.dot(i,a),u=O.dot(a,a),d=O.sub(e,t),f=O.dot(d,i),p=O.dot(d,a),m=c*u-l*l;if(Math.abs(m)<F*F)return!1;let h=(u*f-l*p)/m,g=(c*p-l*f)/m;return 1-h-g>=-F&&h>=-F&&g>=-F}function Ie(e,t,n){for(let r of t)if(Fe(e,n[r[0]],n[r[1]],n[r[2]]))return!0;let r=Le(n),i=0;for(let a of t){let t=n[a[0]],o=n[a[1]],s=n[a[2]],c=Re(e,t,o,s),l=[(t[0]+o[0]+s[0])/3,(t[1]+o[1]+s[1])/3,(t[2]+o[2]+s[2])/3],u=O.sub(o,t),d=O.sub(s,t),f=O.cross(u,d),p=O.sub(r,l),m=O.dot(f,p)>0;i+=m?-c:c}return Math.abs(i)>2*Math.PI}function Le(e){let t=0,n=0,r=0;for(let i of e)t+=i[0],n+=i[1],r+=i[2];let i=e.length;return[t/i,n/i,r/i]}function Re(e,t,n,r){let i=O.sub(t,e),a=O.sub(n,e),o=O.sub(r,e),s=O.len(i),c=O.len(a),l=O.len(o),u=O.dot(i,O.cross(a,o)),d=s*c*l+O.dot(i,a)*l+O.dot(a,o)*s+O.dot(i,o)*c;return 2*Math.atan2(u,d)}function I(e,t,n){for(let r of t)if(O.distSq(e,r)<n)return!0;return!1}var ze=1e-6;function Be(e,t,n,r,i){let a=O.sub(r,n),o=O.sub(i,n),s=O.cross(t,o),c=O.dot(a,s);if(Math.abs(c)<ze)return;let l=1/c,u=O.sub(e,n),d=O.dot(u,s)*l;if(d<0||d>1)return;let f=O.cross(u,a),p=O.dot(t,f)*l;if(!(p<0||d+p>1))return O.dot(o,f)*l}var Ve=[`vertex`,`line`];function He(e,t,n,r,i,a,o,s,c=Ve){let l=n*i,u=r*i,d=e*i,f=t*i,p=30*i,m=20*i,h=p**2,g=m**2,_=[];return c.includes(`vertex`)&&We(a,s,d,f,l,u,p,h,_),c.includes(`line`)&&Ge(a,o,d,f,l,u,m,g,_),Ze(_)}var Ue=.01;function We(e,t,n,r,i,a,o,s,c){for(let l=0;l<t.length;l++){let u=Ke(e,t[l],i,a);if(u.behindCamera)continue;let d=u.screenX-n,f=u.screenY-r,p=d*d+f*f;p>=s||c.push({hit:{type:`vertex`,position:t[l]},normalizedDistance:Math.sqrt(p)/o,depth:u.depth,typeBonus:be})}}function Ge(e,t,n,r,i,a,o,s,c){for(let l=0;l<t.length;l++){let u=t[l],[d,f]=u.kind===`edge`||u.kind===`segment`?[u.pointA,u.pointB]:Pe(u.pointA,u.pointB),p=qe(e,d,f,i,a);if(p.start.behindCamera||p.end.behindCamera)continue;let{distanceSquared:m,parameter:h}=Xe(n,r,p.start.screenX,p.start.screenY,p.end.screenX,p.end.screenY);if(m>=s)continue;let g=p.start.depth*p.end.depth/((1-h)*p.end.depth+h*p.start.depth),_=u.kind===`line`?0:xe;c.push({hit:{type:`line`,lineId:u.lineId},normalizedDistance:Math.sqrt(m)/o,depth:g,typeBonus:_})}}function Ke(e,t,n,r){let i=A.transformMat4(A.fromValues(t[0],t[1],t[2],1),e);if(i[3]<=0)return{screenX:0,screenY:0,behindCamera:!0,depth:1/0};let a=i[0]/i[3],o=i[1]/i[3];return{screenX:(a+1)*.5*n,screenY:(1-o)*.5*r,behindCamera:!1,depth:i[3]}}function qe(e,t,n,r,i){let a=A.transformMat4(A.fromValues(t[0],t[1],t[2],1),e),o=A.transformMat4(A.fromValues(n[0],n[1],n[2],1),e);if(a[3]<=0&&o[3]<=0)return{start:{screenX:0,screenY:0,behindCamera:!0,depth:1/0},end:{screenX:0,screenY:0,behindCamera:!0,depth:1/0}};let s=a[3]<Ue?Je(a,o):a,c=o[3]<Ue?Je(o,a):o;return{start:Ye(s,r,i),end:Ye(c,r,i)}}function Je(e,t){let n=(Ue-e[3])/(t[3]-e[3]);return A.lerp(e,t,n)}function Ye(e,t,n){let r=e[0]/e[3],i=e[1]/e[3];return{screenX:(r+1)*.5*t,screenY:(1-i)*.5*n,behindCamera:!1,depth:e[3]}}function Xe(e,t,n,r,i,a){let o=i-n,s=a-r,c=o*o+s*s;if(c===0){let i=e-n,a=t-r;return{distanceSquared:i*i+a*a,parameter:0}}let l=Math.max(0,Math.min(1,((e-n)*o+(t-r)*s)/c)),u=n+l*o,d=r+l*s,f=e-u,p=t-d;return{distanceSquared:f*f+p*p,parameter:l}}function Ze(e){if(e.length===0)return;let t=1/0,n=-1/0;for(let r of e)r.depth<t&&(t=r.depth),r.depth>n&&(n=r.depth);let r=n-t,i=-1/0,a;for(let n of e){let e=1-n.normalizedDistance,o=r>0?1-(n.depth-t)/r:1,s=ve*e+ye*o+n.typeBonus;s>i&&(i=s,a=n.hit)}return a}var Qe=1e-10,$e=1e-5,et=1e-4,L=6;function tt(e){let t=e.pointA,n=e.pointB,r=e.kind===`line`||e.kind===`edge-extended`||e.kind===`segment-extended`?`l`:`s`;return`${t[0].toFixed(L)},${t[1].toFixed(L)},${t[2].toFixed(L)}|${n[0].toFixed(L)},${n[1].toFixed(L)},${n[2].toFixed(L)}|${r}`}var nt=`||`;function rt(e,t){return e<t?`${e}${nt}${t}`:`${t}${nt}${e}`}function it(e,t){return`${e}${nt}e:${t}`}function at(e,t){let n=e.indexOf(nt);if(n===-1)return!1;let r=e.slice(0,n),i=e.slice(n+2);return r===t||i===t}var ot=class{cache=new Map;previousLineKeys=new Set;compute(e,t){let n=new Map;for(let t of e){let e=tt(t);n.has(e)||n.set(e,{point:t.pointA,direction:O.sub(t.pointB,t.pointA),isSegment:t.kind===`edge`||t.kind===`segment`,lineId:t.lineId})}let r=new Set(n.keys()),i=[];for(let e of r)this.previousLineKeys.has(e)||i.push(e);let a=[];for(let e of this.previousLineKeys)r.has(e)||a.push(e);if(a.length>0){let e=new Set(a);for(let t of this.cache.keys())for(let n of e)if(at(t,n)){this.cache.delete(t);break}}let o=[...r];for(let e of i){let r=n.get(e);u(r!==void 0,`Missing line definition for key: ${e}`);for(let t of o){if(t===e)continue;let i=rt(e,t);if(this.cache.has(i))continue;let a=n.get(t);u(a!==void 0,`Missing line definition for key: ${t}`);let o=ut(r,a);this.cache.set(i,o===void 0?void 0:{position:o,sourceLineIds:[r.lineId,a.lineId]})}for(let n=0;n<t.edges.length;n++){let i=it(e,n);if(this.cache.has(i))continue;let a=ut(r,dt(n,t));this.cache.set(i,a===void 0?void 0:{position:a,sourceLineIds:[r.lineId]})}}return this.previousLineKeys=r,ct(this.cache,t.vertices)}};function st(e,t){let n=e.map(e=>({point:e.pointA,direction:O.sub(e.pointB,e.pointA),isSegment:e.kind===`edge`||e.kind===`segment`,lineId:e.lineId})),r=new Map;for(let e=0;e<n.length;e++){for(let t=e+1;t<n.length;t++){let i=ut(n[e],n[t]);r.set(`${e}||${t}`,i===void 0?void 0:{position:i,sourceLineIds:[n[e].lineId,n[t].lineId]})}for(let i=0;i<t.edges.length;i++){let a=ut(n[e],dt(i,t));r.set(`${e}||e:${i}`,a===void 0?void 0:{position:a,sourceLineIds:[n[e].lineId]})}}return ct(r,t.vertices)}function ct(e,t){let n=[],r=[];for(let i of e.values()){if(i===void 0||I(i.position,t,$e))continue;let e=lt(i.position,r,et);if(e!==void 0){let t=n[e],r=[...new Set([...t.sourceLineIds,...i.sourceLineIds])];n[e]={position:t.position,sourceLineIds:r};continue}n.push({position:i.position,sourceLineIds:[...i.sourceLineIds]}),r.push(i.position)}return n}function lt(e,t,n){for(let r=0;r<t.length;r++)if(O.distSq(e,t[r])<n)return r}function ut(e,t){let n=ft(e.point,e.direction,t.point,t.direction);if(n!==void 0&&!(e.isSegment&&(n.parameterA<0||n.parameterA>1))&&!(t.isSegment&&(n.parameterB<0||n.parameterB>1)))return n.midpoint}function dt(e,t){let[n,r]=t.edges[e],i=t.vertices[n],a=t.vertices[r];return{point:i,direction:O.sub(a,i),isSegment:!0,lineId:-1}}function ft(e,t,n,r){let i=O.dot(t,t),a=O.dot(t,r),o=O.dot(r,r),s=i*o-a*a;if(Math.abs(s)<Qe)return;let c=O.sub(e,n),l=O.dot(t,c),u=O.dot(r,c),d=(a*u-o*l)/s,f=(i*u-a*l)/s,p=O.addScaled(e,t,d),m=O.addScaled(n,r,f);if(!(O.distSq(p,m)>.01**2))return{midpoint:[(p[0]+m[0])*.5,(p[1]+m[1])*.5,(p[2]+m[2])*.5],parameterA:d,parameterB:f}}var R=`struct Uniforms {
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
`,pt=`/**
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
`,mt=`/**
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
`,ht=`/**
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
`,gt=`/**
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
`,_t=`/**
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
`,vt={color:`#FFFFFF`,width:1,size:1,alpha:1,line:{type:`solid`},markerType:`solid`,strokeColor:`#FFFFFF`,strokeWidth:0},yt=16,bt=7,xt=255;function z(e){if(e.length!==bt||e[0]!==`#`)throw Error(`Invalid hex color: ${e}. Expected format: #RRGGBB`);return[Number.parseInt(e.slice(1,3),yt)/xt,Number.parseInt(e.slice(3,5),yt)/xt,Number.parseInt(e.slice(5,7),yt)/xt]}function St(e){let t=[...e].sort(),n=[[]];for(let e of t){let t=n.length;for(let r=0;r<t;r++)n.push([...n[r],e])}return n.sort((e,t)=>e.length===t.length?e.join(`:`).localeCompare(t.join(`:`)):e.length-t.length),n}function Ct(e,t){return{color:t.color??e.color,width:t.width??e.width,size:t.size??e.size,alpha:t.alpha??e.alpha,line:t.line??e.line,markerType:t.markerType??e.markerType,strokeColor:t.strokeColor??e.strokeColor,strokeWidth:t.strokeWidth??e.strokeWidth}}function wt(e){let t={};for(let[n,r]of Object.entries(e)){let e=n.split(`:`);if(e.length<=2){t[n]=r;continue}let i=e[0],a=e.slice(1).sort();t[`${i}:${a.join(`:`)}`]=r}return t}function B(e,t,n){let r=wt(e),i=St(n),a={...vt};for(let e of i){let n=r[e.length===0?t:`${t}:${e.join(`:`)}`];n!==void 0&&(a=Ct(a,n))}return a}var Tt=R+pt,Et=R+mt,Dt=R+ht,Ot=R+gt,kt=R+_t,V=`depth24plus`,At=`rg16float`,H=1,jt=2,Mt=1,Nt=0,Pt=1,Ft=2,U=4,W=24,G=W*U,It=[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`},{shaderLocation:2,offset:24,format:`float32`},{shaderLocation:3,offset:28,format:`float32x3`},{shaderLocation:4,offset:40,format:`float32`},{shaderLocation:5,offset:44,format:`float32`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32`},{shaderLocation:9,offset:60,format:`float32x3`},{shaderLocation:10,offset:72,format:`float32`},{shaderLocation:11,offset:76,format:`float32`},{shaderLocation:12,offset:80,format:`float32`},{shaderLocation:13,offset:84,format:`float32`}],Lt=[...It,{shaderLocation:14,offset:88,format:`float32`},{shaderLocation:15,offset:92,format:`float32`}],Rt=24,K=Rt*U,zt=3*U,Bt=7*U,Vt=128,Ht=0,Ut=16,Wt=18,Gt=19,Kt=20,qt=24,Jt=27,Yt=28,Xt=6,Zt=class{device;format;hiddenLinePipeline;visibleLinePipeline;previewLinePipeline;hiddenMarkerPipeline;visibleMarkerPipeline;previewMarkerPipeline;hiddenLineIdPipeline;visibleLineIdPipeline;bindGroup;lineBindGroup;markerBindGroup;depthBindGroupLayout;markerBindGroupLayout;uniformBuffer;faceVertexBuffer;styledLineBuffer;topologyVertexMarkerBuffer;previewLineBuffer;previewStartMarkerBuffer;previewSnapMarkerBuffer;depthPrePassPipeline;solutionFacePipeline;solutionFaceBuffer;solutionFaceVertexCount=0;depthSampler;faceVertexCount=0;depthTexture=null;depthTextureView=null;samplingDepthTexture=null;samplingDepthTextureView=null;lineEndpointTexture=null;lineEndpointTextureView=null;lineDepthTexture=null;lineDepthTextureView=null;dirty=!0;uniformStaging=new Float32Array(Vt/U);projectionScratch=j.create();mvpScratch=j.create();previewLineStaging=new Float32Array(W);previewMarkerStaging=new Float32Array(Rt);lastMvpMatrix=new Float32Array(16);styledLineCount=0;topologyVertexCount=0;hasDragPreview=!1;hasStartMarker=!1;currentPreviewLine;hasSnapTarget=!1;lastCanvasWidth=0;lastCanvasHeight=0;lastDevicePixelRatio=1;backgroundClearColor;vertexPreviewStyle;linePreviewStyle;constructor(e,t,n,r,i,a=`perspective`){this.camera=e,this.msaaManager=t,this.topology=n,this.fpsController=r,this.sceneCenter=i,this.projection=a;let[o,s,c]=z(B(P,`background`,[]).color);this.backgroundClearColor={r:o,g:s,b:c,a:1};let l=B(P,`vertex`,[`preview`]);this.vertexPreviewStyle={markerType:l.markerType===`circle`?1:0,size:l.size,color:z(l.color),alpha:l.alpha,strokeColor:z(l.strokeColor),strokeWidth:l.strokeWidth};let u=B(P,`line`,[`preview`]);this.linePreviewStyle={width:u.width,color:z(u.color),alpha:u.alpha}}init(e){this.device=e.device,this.format=e.format;let t=ke(this.topology);this.faceVertexCount=t.faceVertexCount,this.faceVertexBuffer=this.createAndWriteBuffer(t.facePositions,GPUBufferUsage.VERTEX),this.solutionFaceBuffer=this.device.createBuffer({size:Bt,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.styledLineBuffer=this.device.createBuffer({size:G,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.topologyVertexMarkerBuffer=this.device.createBuffer({size:K,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewLineBuffer=this.device.createBuffer({size:G,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewStartMarkerBuffer=this.device.createBuffer({size:K,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewSnapMarkerBuffer=this.device.createBuffer({size:K,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.uniformBuffer=this.device.createBuffer({size:Vt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let n=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.bindGroup=this.device.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]});let r=this.device.createPipelineLayout({bindGroupLayouts:[n]});this.depthPrePassPipeline=this.createDepthPrePassPipeline(r),this.solutionFacePipeline=this.createSolutionFacePipeline(r),this.depthBindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:`non-filtering`}}]}),this.markerBindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:`non-filtering`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`unfilterable-float`}},{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}}]}),this.depthSampler=this.device.createSampler({minFilter:`nearest`,magFilter:`nearest`});let i=this.device.createPipelineLayout({bindGroupLayouts:[this.depthBindGroupLayout]});this.hiddenLinePipeline=this.createLinePipeline(i,Pt),this.visibleLinePipeline=this.createLinePipeline(i,Ft),this.previewLinePipeline=this.createPreviewLinePipeline(i);let a=this.device.createPipelineLayout({bindGroupLayouts:[this.markerBindGroupLayout]});this.hiddenMarkerPipeline=this.createMarkerPipeline(a,Pt),this.visibleMarkerPipeline=this.createMarkerPipeline(a,Ft),this.previewMarkerPipeline=this.createMarkerPipeline(a,Nt,!1),this.hiddenLineIdPipeline=this.createLineIdPipeline(i,Pt),this.visibleLineIdPipeline=this.createLineIdPipeline(i,Ft)}update(e){let t=this.camera.tick();t&&this.fpsController.raise(60);let n=this.camera.getViewMatrix(),r=this.camera.getDistance(),i=e.canvasWidth/Math.max(H,e.canvasHeight);if(this.projection===`orthographic`){let e=r*_e,t=e*i;j.ortho(-t,t,-e,e,ge,100,this.projectionScratch)}else j.perspective(he,i,ge,100,this.projectionScratch);let a=j.multiply(this.projectionScratch,n,this.mvpScratch),o=e.canvasWidth!==this.lastCanvasWidth||e.canvasHeight!==this.lastCanvasHeight||e.devicePixelRatio!==this.lastDevicePixelRatio;if((t||o||!Qt(this.lastMvpMatrix,a))&&(this.dirty=!0),!this.dirty)return;this.lastMvpMatrix.set(a),this.lastCanvasWidth=e.canvasWidth,this.lastCanvasHeight=e.canvasHeight,this.lastDevicePixelRatio=e.devicePixelRatio;let s=this.uniformStaging;s.set(a,Ht),s[Ut]=e.canvasWidth,s[Ut+1]=e.canvasHeight,s[Wt]=e.devicePixelRatio,s[Gt]=r,s[Kt]=-n[2],s[Kt+1]=-n[6],s[Kt+2]=-n[10],s[qt]=this.sceneCenter[0],s[qt+1]=this.sceneCenter[1],s[qt+2]=this.sceneCenter[2],s[Jt]=Se,s[Yt]=Ce,this.device.queue.writeBuffer(this.uniformBuffer,0,s)}consumeDirty(){let e=this.dirty;return this.dirty=!1,e}render(e,t,r){let i=this.msaaManager.ensureView(this.device,this.format,r.canvasWidth,r.canvasHeight);if(n(i))return;let a=this.ensureDepthView(r.canvasWidth,r.canvasHeight),o=this.ensureSamplingDepthView(r.canvasWidth,r.canvasHeight),s=e.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:o,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});s.setPipeline(this.depthPrePassPipeline),s.setBindGroup(0,this.bindGroup),s.setVertexBuffer(0,this.faceVertexBuffer),s.draw(this.faceVertexCount),s.end();let c=this.ensureLineIdTextures(r.canvasWidth,r.canvasHeight,o),l={r:-1,g:-1,b:0,a:0},u=this.styledLineCount>0&&this.topologyVertexCount>0;if(u){let t=e.beginRenderPass({colorAttachments:[{view:c.endpointView,clearValue:l,loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:c.depthView,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});t.setPipeline(this.hiddenLineIdPipeline),t.setBindGroup(0,this.lineBindGroup),t.setVertexBuffer(0,this.styledLineBuffer),t.draw(6,this.styledLineCount),t.end()}let d=e.beginRenderPass({colorAttachments:[{view:i,loadOp:`clear`,clearValue:this.backgroundClearColor,storeOp:`store`}],depthStencilAttachment:{view:a,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});if(this.solutionFaceVertexCount>0&&(d.setPipeline(this.solutionFacePipeline),d.setBindGroup(0,this.bindGroup),d.setVertexBuffer(0,this.solutionFaceBuffer),d.draw(this.solutionFaceVertexCount)),this.styledLineCount>0&&(d.setPipeline(this.hiddenLinePipeline),d.setBindGroup(0,this.lineBindGroup),d.setVertexBuffer(0,this.styledLineBuffer),d.draw(6,this.styledLineCount)),this.topologyVertexCount>0&&(d.setPipeline(this.hiddenMarkerPipeline),d.setBindGroup(0,this.markerBindGroup),d.setVertexBuffer(0,this.topologyVertexMarkerBuffer),d.draw(Xt,this.topologyVertexCount)),d.end(),u){let t=e.beginRenderPass({colorAttachments:[{view:c.endpointView,clearValue:l,loadOp:`clear`,storeOp:`store`}],depthStencilAttachment:{view:c.depthView,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});t.setPipeline(this.visibleLineIdPipeline),t.setBindGroup(0,this.lineBindGroup),t.setVertexBuffer(0,this.styledLineBuffer),t.draw(6,this.styledLineCount),t.end()}let f=e.beginRenderPass({colorAttachments:[{view:i,resolveTarget:t,loadOp:`load`,storeOp:`discard`}],depthStencilAttachment:{view:a,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});this.styledLineCount>0&&(f.setPipeline(this.visibleLinePipeline),f.setBindGroup(0,this.lineBindGroup),f.setVertexBuffer(0,this.styledLineBuffer),f.draw(6,this.styledLineCount)),this.topologyVertexCount>0&&(f.setPipeline(this.visibleMarkerPipeline),f.setBindGroup(0,this.markerBindGroup),f.setVertexBuffer(0,this.topologyVertexMarkerBuffer),f.draw(Xt,this.topologyVertexCount)),this.hasDragPreview&&(f.setPipeline(this.previewLinePipeline),f.setBindGroup(0,this.lineBindGroup),f.setVertexBuffer(0,this.previewLineBuffer),f.draw(6,1)),this.hasStartMarker&&(f.setPipeline(this.previewMarkerPipeline),f.setBindGroup(0,this.markerBindGroup),f.setVertexBuffer(0,this.previewStartMarkerBuffer),f.draw(Xt,1)),this.hasSnapTarget&&(f.setPipeline(this.previewMarkerPipeline),f.setBindGroup(0,this.markerBindGroup),f.setVertexBuffer(0,this.previewSnapMarkerBuffer),f.draw(Xt,1)),f.end()}getLastMvpMatrix(){return this.lastMvpMatrix}getPreviewLine(){return this.currentPreviewLine}setDragPreview(e){if(this.dirty=!0,n(e)){this.hasDragPreview=!1,this.hasStartMarker=!1,this.hasSnapTarget=!1,this.currentPreviewLine=void 0;return}let{pointA:t,pointB:r}=e.kind===`vertex`?this.computeVertexDragPreviewEndpoints(e):this.computeLineDragPreviewEndpoints(e);this.currentPreviewLine={pointA:t,pointB:r},this.writePreviewLineBuffer(t,r),this.hasDragPreview=!0,e.kind===`vertex`?(this.device.queue.writeBuffer(this.previewStartMarkerBuffer,0,this.createPreviewMarkerData(e.startPosition)),this.hasStartMarker=!0):this.hasStartMarker=!1,n(e.snapTargetPosition)?this.hasSnapTarget=!1:(this.device.queue.writeBuffer(this.previewSnapMarkerBuffer,0,this.createPreviewMarkerData(e.snapTargetPosition)),this.hasSnapTarget=!0)}computeVertexDragPreviewEndpoints(e){let t=n(e.snapTargetPosition)?this.unprojectToVertexPlane(e.cursorScreenX,e.cursorScreenY,e.startPosition):e.snapTargetPosition;return{pointA:e.startPosition,pointB:t}}computeLineDragPreviewEndpoints(e){let t=n(e.snapTargetPosition)?this.unprojectToVertexPlane(e.cursorScreenX,e.cursorScreenY,e.planeAnchor):e.snapTargetPosition;return{pointA:t,pointB:[t[0]+e.sourceDirection[0],t[1]+e.sourceDirection[1],t[2]+e.sourceDirection[2]]}}writePreviewLineBuffer(e,t){let{width:n,color:r,alpha:i}=this.linePreviewStyle,a=this.previewLineStaging;a[0]=e[0],a[1]=e[1],a[2]=e[2],a[3]=t[0],a[4]=t[1],a[5]=t[2],a[6]=n,a[7]=r[0],a[8]=r[1],a[9]=r[2],a[10]=i,this.device.queue.writeBuffer(this.previewLineBuffer,0,a)}applySceneState(e){this.dirty=!0,this.applyStyledMarkers(e.markers),this.applyStyledSegments(e.segments),this.applySolutionFace(e.solutionFace)}applySolutionFace(e){if(e===void 0||e.vertexCount===0){this.solutionFaceVertexCount=0;return}let t=e.vertices.byteLength;t>this.solutionFaceBuffer.size&&(this.solutionFaceBuffer.destroy(),this.solutionFaceBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST})),this.device.queue.writeBuffer(this.solutionFaceBuffer,0,e.vertices),this.solutionFaceVertexCount=e.vertexCount}applyStyledMarkers(e){if(this.topologyVertexCount=e.length,this.topologyVertexCount===0)return;let t=this.topologyVertexCount*K;t>this.topologyVertexMarkerBuffer.size&&(this.topologyVertexMarkerBuffer.destroy(),this.topologyVertexMarkerBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}));let n=new Float32Array(e.length*Rt);for(let t=0;t<e.length;t++){let r=e[t],i=t*Rt;n[i]=r.position[0],n[i+1]=r.position[1],n[i+2]=r.position[2],n[i+3]=r.markerType,n[i+4]=r.visibleStyle.size,n[i+5]=r.visibleStyle.color[0],n[i+6]=r.visibleStyle.color[1],n[i+7]=r.visibleStyle.color[2],n[i+8]=r.visibleStyle.alpha,n[i+9]=r.visibleStyle.strokeColor[0],n[i+10]=r.visibleStyle.strokeColor[1],n[i+11]=r.visibleStyle.strokeColor[2],n[i+12]=r.visibleStyle.strokeWidth,n[i+13]=r.hiddenStyle.size,n[i+14]=r.hiddenStyle.color[0],n[i+15]=r.hiddenStyle.color[1],n[i+16]=r.hiddenStyle.color[2],n[i+17]=r.hiddenStyle.alpha,n[i+18]=r.hiddenStyle.strokeColor[0],n[i+19]=r.hiddenStyle.strokeColor[1],n[i+20]=r.hiddenStyle.strokeColor[2],n[i+21]=r.hiddenStyle.strokeWidth,n[i+22]=r.vertexIndex}this.device.queue.writeBuffer(this.topologyVertexMarkerBuffer,0,n)}applyStyledSegments(e){if(this.styledLineCount=e.length,this.styledLineCount===0)return;let t=this.styledLineCount*G;t>this.styledLineBuffer.size&&(this.styledLineBuffer.destroy(),this.styledLineBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}));let n=new Float32Array(this.styledLineCount*W);for(let t=0;t<this.styledLineCount;t++)$t(n,t,e[t]);this.device.queue.writeBuffer(this.styledLineBuffer,0,n)}dispose(){this.uniformBuffer.destroy(),this.faceVertexBuffer.destroy(),this.solutionFaceBuffer.destroy(),this.styledLineBuffer.destroy(),this.topologyVertexMarkerBuffer.destroy(),this.previewLineBuffer.destroy(),this.previewStartMarkerBuffer.destroy(),this.previewSnapMarkerBuffer.destroy(),this.depthTexture?.destroy(),this.samplingDepthTexture?.destroy(),this.lineEndpointTexture?.destroy(),this.lineDepthTexture?.destroy()}unprojectToVertexPlane(e,t,n){let r=this.lastCanvasWidth,i=this.lastCanvasHeight,a=this.lastDevicePixelRatio,o=e*a,s=t*a,c=o/r*2-1,l=1-s/i*2,u=A.transformMat4(A.fromValues(n[0],n[1],n[2],1),this.lastMvpMatrix),d=u[2]/u[3],f=j.inverse(this.lastMvpMatrix),p=A.transformMat4(A.fromValues(c,l,d,1),f);return[p[0]/p[3],p[1]/p[3],p[2]/p[3]]}createAndWriteBuffer(e,t){let n=this.device.createBuffer({size:e.byteLength,usage:t|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(n,0,e),n}createLinePipeline(e,t){let n=this.device.createShaderModule({code:Et});return this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,buffers:[{arrayStride:G,stepMode:`instance`,attributes:It}]},fragment:{module:n,entryPoint:`fs`,constants:{renderMode:t},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less-equal`,format:V},multisample:{count:4}})}createPreviewLinePipeline(e){let t=this.device.createShaderModule({code:Et});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:G,stepMode:`instance`,attributes:It}]},fragment:{module:t,entryPoint:`fs`,constants:{renderMode:Nt},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:V},multisample:{count:4}})}createDepthPrePassPipeline(e){let t=this.device.createShaderModule({code:Tt});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:zt,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:V,depthBias:jt,depthBiasSlopeScale:Mt}})}createSolutionFacePipeline(e){let t=this.device.createShaderModule({code:Ot});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:Bt,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}]},fragment:{module:t,entryPoint:`fs`,targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:V},multisample:{count:4}})}createMarkerPipeline(e,t,n=!0){let r=this.device.createShaderModule({code:kt});return this.device.createRenderPipeline({layout:e,vertex:{module:r,entryPoint:`vs`,buffers:[{arrayStride:K,stepMode:`instance`,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32`},{shaderLocation:2,offset:16,format:`float32`},{shaderLocation:3,offset:20,format:`float32x3`},{shaderLocation:4,offset:32,format:`float32`},{shaderLocation:5,offset:36,format:`float32x3`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32x3`},{shaderLocation:9,offset:68,format:`float32`},{shaderLocation:10,offset:72,format:`float32x3`},{shaderLocation:11,offset:84,format:`float32`},{shaderLocation:12,offset:88,format:`float32`}]}]},fragment:{module:r,entryPoint:`fs`,constants:{renderMode:t,enableLineOcclusion:n?1:0},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:V},multisample:{count:4}})}createLineIdPipeline(e,t){let n=this.device.createShaderModule({code:Dt});return this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,buffers:[{arrayStride:G,stepMode:`instance`,attributes:Lt}]},fragment:{module:n,entryPoint:`fs`,constants:{renderMode:t},targets:[{format:At}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:V}})}createPreviewMarkerData(e){let t=this.previewMarkerStaging,n=this.vertexPreviewStyle;return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=n.markerType,t[4]=n.size,t[5]=n.color[0],t[6]=n.color[1],t[7]=n.color[2],t[8]=n.alpha,t[9]=n.strokeColor[0],t[10]=n.strokeColor[1],t[11]=n.strokeColor[2],t[12]=n.strokeWidth,t[13]=n.size,t[14]=n.color[0],t[15]=n.color[1],t[16]=n.color[2],t[17]=n.alpha,t[18]=n.strokeColor[0],t[19]=n.strokeColor[1],t[20]=n.strokeColor[2],t[21]=n.strokeWidth,t}ensureDepthView(e,t){return!n(this.depthTexture)&&!n(this.depthTextureView)&&this.depthTexture.width===e&&this.depthTexture.height===t?this.depthTextureView:(this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(H,e),Math.max(H,t)],format:V,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthTextureView=this.depthTexture.createView(),this.depthTextureView)}ensureSamplingDepthView(e,t){let r=Math.max(H,e),i=Math.max(H,t);return!n(this.samplingDepthTexture)&&!n(this.samplingDepthTextureView)&&this.samplingDepthTexture.width===r&&this.samplingDepthTexture.height===i?this.samplingDepthTextureView:(this.samplingDepthTexture?.destroy(),this.samplingDepthTexture=this.device.createTexture({size:[r,i],format:V,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.samplingDepthTextureView=this.samplingDepthTexture.createView(),this.lineBindGroup=this.device.createBindGroup({layout:this.depthBindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:this.samplingDepthTextureView},{binding:2,resource:this.depthSampler}]}),this.samplingDepthTextureView)}ensureLineIdTextures(e,t,r){let i=Math.max(H,e),a=Math.max(H,t);return!n(this.lineEndpointTexture)&&!n(this.lineEndpointTextureView)&&!n(this.lineDepthTextureView)&&this.lineEndpointTexture.width===i&&this.lineEndpointTexture.height===a?{endpointView:this.lineEndpointTextureView,depthView:this.lineDepthTextureView}:(this.lineEndpointTexture?.destroy(),this.lineDepthTexture?.destroy(),this.lineEndpointTexture=this.device.createTexture({size:[i,a],format:At,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.lineDepthTexture=this.device.createTexture({size:[i,a],format:V,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),this.lineEndpointTextureView=this.lineEndpointTexture.createView(),this.lineDepthTextureView=this.lineDepthTexture.createView(),this.markerBindGroup=this.device.createBindGroup({layout:this.markerBindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:r},{binding:2,resource:this.depthSampler},{binding:3,resource:this.lineEndpointTextureView},{binding:4,resource:this.lineDepthTextureView}]}),{endpointView:this.lineEndpointTextureView,depthView:this.lineDepthTextureView})}};function Qt(e,t){for(let n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0}function $t(e,t,n){let r=t*W;e[r]=n.startPosition[0],e[r+1]=n.startPosition[1],e[r+2]=n.startPosition[2],e[r+3]=n.endPosition[0],e[r+4]=n.endPosition[1],e[r+5]=n.endPosition[2],e[r+6]=n.visibleStyle.width,e[r+7]=n.visibleStyle.color[0],e[r+8]=n.visibleStyle.color[1],e[r+9]=n.visibleStyle.color[2],e[r+10]=n.visibleStyle.alpha,e[r+11]=n.visibleStyle.lineType,e[r+12]=n.visibleStyle.dash,e[r+13]=n.visibleStyle.gap,e[r+14]=n.hiddenStyle.width,e[r+15]=n.hiddenStyle.color[0],e[r+16]=n.hiddenStyle.color[1],e[r+17]=n.hiddenStyle.color[2],e[r+18]=n.hiddenStyle.alpha,e[r+19]=n.hiddenStyle.lineType,e[r+20]=n.hiddenStyle.dash,e[r+21]=n.hiddenStyle.gap,e[r+22]=n.startVertexIndex,e[r+23]=n.endVertexIndex}var en=1e-5,tn=1e-10,nn=1e-8;function q(e,t,n=tn){return O.distSq(e,t)<n}function rn(e,t,n){let r=O.sub(n,t),i=O.dot(r,r);if(i<1e-10)return;let a=O.sub(e,t),o=O.dot(a,r)/i,s=O.addScaled(t,r,o);return{parameter:o,distanceSquared:O.distSq(e,s)}}function an(e,t,n){let r=rn(e,t,n);return r===void 0?q(e,t):r.distanceSquared<nn}function J(e,t,n){let r=rn(e,t,n);return r===void 0?q(e,t):r.parameter<-.001||r.parameter>1.001?!1:r.distanceSquared<nn}function on(e,t,n,r){let i=O.sub(r,n);if(O.len(i)===0)return!1;let a=O.normalize(i),o=O.sub(e,n);if(O.len(O.cross(a,o))>en)return!1;let s=O.sub(t,n);return O.len(O.cross(a,s))<=en}function sn(e,t){for(let n of t)if(e>n.start+1e-6&&e<n.end-1e-6)return!0;return!1}function cn(e,t,n){for(let r of n)if(e>=r.start-1e-6&&t<=r.end+1e-6)return!0;return!1}function ln(e,t){for(let n of t)if(Math.abs(e-n)<1e-6)return!0;return!1}function un(e){let t=[];for(let n of e)(t.length===0||Math.abs(n-t[t.length-1])>1e-6)&&t.push(n);return t}function dn(e){if(e.length===0)return[];let t=[...e].sort((e,t)=>e.start-t.start),n=[t[0]];for(let e=1;e<t.length;e++){let r=t[e],i=n[n.length-1];r.start<=i.end+1e-6?n[n.length-1]={start:i.start,end:Math.max(i.end,r.end)}:n.push(r)}return n}var fn=1e-6,pn=6;function mn(e){return`${e[0].toFixed(pn)},${e[1].toFixed(pn)},${e[2].toFixed(pn)}`}function hn(e){return`${e.lineId}|${[...e.modifiers].sort().join(`:`)}`}function gn(e){return{...e,startPosition:e.endPosition,endPosition:e.startPosition,startVertexIndex:e.endVertexIndex,endVertexIndex:e.startVertexIndex}}function _n(e){return O.normalize(O.sub(e.endPosition,e.startPosition))}function vn(e,t){return e.endVertexIndex!==-1||t.startVertexIndex!==-1?!1:O.dot(_n(e),_n(t))>1-fn}function yn(e,t,n,r){let i=e,a=t.length;for(;a>0;){--a;let e=mn(i.endPosition),o=n.get(e)??[];if(o.length!==2)break;let s=o.find(e=>!r[e]);if(s===void 0)break;let c=t[s];if(mn(c.startPosition)!==e&&(c=gn(c)),!vn(i,c))break;r[s]=!0,i={...i,endPosition:c.endPosition,endVertexIndex:c.endVertexIndex}}return i}function bn(e){let t=new Map,n=(e,n)=>{let r=t.get(e);r===void 0?t.set(e,[n]):r.push(n)};for(let t=0;t<e.length;t++)n(mn(e[t].startPosition),t),n(mn(e[t].endPosition),t);let r=[],i=Array(e.length).fill(!1);for(let n=0;n<e.length;n++){if(i[n])continue;i[n]=!0;let a=e[n];a=yn(a,e,t,i),a=gn(yn(gn(a),e,t,i)),r.push(a)}return r}function xn(e){if(e.length<2)return e;let t=new Map;for(let n of e){let e=hn(n),r=t.get(e);r===void 0?t.set(e,[n]):r.push(n)}let n=[];for(let e of t.values())e.length===1?n.push(e[0]):n.push(...bn(e));return n}var Sn={isSolved:!1,solutionVertexPositions:[],solutionLineRanges:[],solutionInfiniteLineAnchors:[],solutionFaces:[]};function Cn(e,t){let n=e.vertices??[],r=e.lines??[],i=e.faces??[],a=i.flatMap(e=>e.map((t,n)=>[t,e[(n+1)%e.length]])),o=[...r,...a];if(n.length===0&&o.length===0)return Sn;for(let e of n)if(!t.vertices.some(t=>q(t.position,e)))return Sn;for(let[e,n]of o)if(!t.lines.some(t=>wn(t,e,n)))return Sn;let s=i.flat(),c=r.flat();return{isSolved:!0,solutionVertexPositions:[...n,...c,...s],solutionLineRanges:o,solutionInfiniteLineAnchors:r,solutionFaces:i}}function wn(e,t,n){switch(e.kind){case`line`:case`edge-extended`:case`segment-extended`:return an(t,e.pointA,e.pointB)&&an(n,e.pointA,e.pointB);case`edge`:case`segment`:return J(t,e.pointA,e.pointB)&&J(n,e.pointA,e.pointB);default:_(e.kind)}}function Tn(e,t,n,r){return J(e,n,r)&&J(t,n,r)}var Y={type:`none`},En=1e-4;function Dn(e,t,n,r,i,a){let o=Fn(e,n,r,a);return{segments:Ln(e,t,n,r,i,a).map(e=>Nn(e)),markers:o,solutionFace:kn(a)}}var On=7;function kn(e){if(!e?.isSolved)return;let t=e.solutionFaces??[];if(t.length===0)return;let n=B(P,`face`,[`solution`]),[r,i,a]=z(n.color),o=n.alpha,s=0;for(let e of t)e.length>=3&&(s+=e.length-2);if(s===0)return;let c=s*3,l=new Float32Array(c*On),u=0,d=e=>{l[u]=e[0],l[u+1]=e[1],l[u+2]=e[2],l[u+3]=r,l[u+4]=i,l[u+5]=a,l[u+6]=o,u+=On};for(let e of t){if(e.length<3)continue;let t=e[0];for(let n=1;n<e.length-1;n++)d(t),d(e[n]),d(e[n+1])}return{vertices:l,vertexCount:c}}function An(e,t){let[n,r]=e.edges[t];return[e.vertices[n],e.vertices[r]]}function jn(e,t,n,r,i,a){return{startPosition:e,endPosition:t,modifiers:n,lineId:r,startVertexIndex:i,endVertexIndex:a}}function Mn(e){let[t,n,r]=z(e.color);return{width:e.width,color:[t,n,r],alpha:e.alpha,lineType:e.line.type===`dashed`?1:0,dash:e.line.type===`dashed`?e.line.dash:0,gap:e.line.type===`dashed`?e.line.gap:0}}function Nn(e){let t=B(P,`line`,e.modifiers),n=B(P,`line`,[`hidden`,...e.modifiers]);return{startPosition:e.startPosition,endPosition:e.endPosition,visibleStyle:Mn(t),hiddenStyle:Mn(n),lineId:e.lineId,startVertexIndex:e.startVertexIndex,endVertexIndex:e.endVertexIndex}}function Pn(e){let[t,n,r]=z(e.color),[i,a,o]=z(e.strokeColor);return{size:e.size,color:[t,n,r],alpha:e.alpha,strokeColor:[i,a,o],strokeWidth:e.strokeWidth}}function Fn(e,t,n,r){let i=[];for(let a=0;a<t.length;a++){let o=t[a],s=o.position,c=[];o.kind===`input`&&c.push(`input`),(I(s,e.vertices,1e-10)||e.figureFaceTriangles.some(t=>Ie(s,t,e.vertices)))&&c.push(`inner`),Gn(o,n)&&c.push(`selected`),r?.isSolved&&r.solutionVertexPositions.some(e=>I(s,[e],1e-10))&&c.push(`solution`);let l=B(P,`vertex`,c),u=B(P,`vertex`,[`hidden`,...c]);i.push({position:s,markerType:l.markerType===`circle`?1:0,visibleStyle:Pn(l),hiddenStyle:Pn(u),vertexIndex:a})}return i}var In=-2;function Ln(e,t,n,r,i,a){let o=Vn(r),s=Hn(r,t,e),c=[];for(let r of t){if(r.kind===`edge`)continue;let t=Yn(r,e,n),i=o!==void 0&&r.lineId===o,s=r.kind===`line`||r.kind===`edge-extended`||r.kind===`segment-extended`,l=s&&a?.isSolved===!0&&a.solutionInfiniteLineAnchors.some(([e,t])=>wn(r,e,t));for(let e of t){let t=e.modifiers.includes(`segment`);if(s&&t&&r.kind!==`edge-extended`)continue;let n=[...e.modifiers];r.kind===`edge-extended`&&t&&!n.includes(`edge`)&&n.push(`edge`),r.isInput&&r.kind!==`edge-extended`&&(r.kind===`segment-extended`?Wn(e,r.pointA,r.pointB)&&n.push(`input`):n.push(`input`)),r.kind===`segment`&&!n.includes(`segment`)&&n.push(`segment`),i&&n.push(`selected`),(l||Rn(e,a))&&n.push(`solution`),c.push({...e,modifiers:n})}}if(i!==void 0){let t=Yn({lineId:In,pointA:i.pointA,pointB:i.pointB,kind:`line`,isInput:!1,startVertexId:-1,endVertexId:-1},e,n);for(let e of t)e.modifiers.includes(`segment`)||c.push({...e,modifiers:[...e.modifiers,`preview`]})}return xn(zn([...qn(e,t,n,s,a),...c]))}function Rn(e,t){return t?.isSolved?t.solutionLineRanges.some(([t,n])=>Tn(e.startPosition,e.endPosition,t,n)):!1}function zn(e){let t=new Map;for(let n of e){let e=Bn(n.startPosition,n.endPosition),r=t.get(e);(r===void 0||n.modifiers.length>r.modifiers.length)&&t.set(e,n)}return[...t.values()]}var X=6;function Bn(e,t){let n=`${e[0].toFixed(X)},${e[1].toFixed(X)},${e[2].toFixed(X)}`,r=`${t[0].toFixed(X)},${t[1].toFixed(X)},${t[2].toFixed(X)}`;return n<r?`${n}|${r}`:`${r}|${n}`}function Vn(e){switch(e.type){case`line`:return e.lineId;case`none`:return;default:_(e)}}function Hn(e,t,n){let r=new Set;switch(e.type){case`line`:{let i=e.lineId;for(let e of t)if(e.lineId===i)for(let t=0;t<n.edges.length;t++){let[i,a]=An(n,t);(e.kind===`line`?on(i,a,e.pointA,e.pointB):Un(i,a,e.pointA,e.pointB))&&r.add(t)}break}case`none`:break;default:_(e)}return r}function Un(e,t,n,r){return q(e,n)&&q(t,r)||q(e,r)&&q(t,n)}function Wn(e,t,n){let r=[(e.startPosition[0]+e.endPosition[0])/2,(e.startPosition[1]+e.endPosition[1])/2,(e.startPosition[2]+e.endPosition[2])/2],i=rn(r,t,n);if(i===void 0)return q(r,t);let a=.001;return i.parameter>=-a&&i.parameter<=1+a}function Gn(e,t){switch(t.type){case`none`:return!1;case`line`:return e.crossLineIds.includes(t.lineId);default:_(t)}}var Kn=-1;function qn(e,t,n,r,i){let a=[],o=Jn(e,t),s=new Map;for(let e=0;e<n.length;e++)s.set(n[e].vertexId,e);let c=(e,t,n,r,o)=>{let s=[...n];i?.isSolved&&i.solutionLineRanges.some(([n,r])=>Tn(e,t,n,r))&&s.push(`solution`),a.push(jn(e,t,s,Kn,r,o))};for(let t=0;t<e.edges.length;t++){let[i,a]=e.edges[t],l=e.vertices[i],u=e.vertices[a],d=o.get(t);if(d?.kind===`edge-extended`)continue;let f=[`edge`,`segment`];r.has(t)&&f.push(`selected`);let p=d===void 0?-1:s.get(d.startVertexId)??-1,m=d===void 0?-1:s.get(d.endVertexId)??-1,h=O.sub(u,l),g=O.dot(h,h);if(g<1e-6||d===void 0){c(l,u,f,p,m);continue}let _=[];for(let e=0;e<n.length;e++){let t=n[e];if(t.vertexId===d.startVertexId||t.vertexId===d.endVertexId||!t.crossLineIds.includes(d.lineId))continue;let r=O.sub(t.position,l),i=O.dot(r,h)/g;i<=1e-6||i>=.999999||_.push({parameter:i,markerIndex:e})}if(_.length===0){c(l,u,f,p,m);continue}_.sort((e,t)=>e.parameter-t.parameter);let v=l,y=p;for(let e of _){let t=O.addScaled(l,h,e.parameter);c(v,t,f,y,e.markerIndex),v=t,y=e.markerIndex}c(v,u,f,y,m)}return a}function Jn(e,t){let n=new Map,r=t.filter(e=>e.kind===`edge`||e.kind===`edge-extended`);for(let t=0;t<e.edges.length;t++){let[i,a]=e.edges[t],o=e.vertices[i],s=e.vertices[a];for(let e of r)if(Un(o,s,e.pointA,e.pointB)){n.set(t,e);break}}return n}function Yn(e,t,n){let[r,i]=e.kind===`segment`||e.kind===`edge`?[e.pointA,e.pointB]:Pe(e.pointA,e.pointB),a=O.sub(i,r),o=O.len(a);if(o===0)return[];let s=O.normalize(a),c=Zn(e,t),l=Qn(r,s,o,t),u=$n(r,s,o,t),d=c.map(e=>{let[n,i]=An(t,e),a=Z(n,r,s,o),c=Z(i,r,s,o);return{start:Math.min(a,c),end:Math.max(a,c)}}),f=Z(e.pointA,r,s,o),p=Z(e.pointB,r,s,o),m=new Set;m.add(0),m.add(1),m.add(f),m.add(p);for(let e of l)m.add(e);for(let e of u)m.add(e.start),m.add(e.end);for(let e of d)m.add(e.start),m.add(e.end);let h=new Map;for(let e=0;e<n.length;e++){let t=n[e].position,i=Z(t,r,s,o),a=Xn(i,r,s,o);O.distSq(t,a)<1e-8&&(h.set(i,e),i>1e-6&&i<.999999&&m.add(i))}let g=un([...m].sort((e,t)=>e-t)),_=dn(u),v=[];for(let n=0;n<g.length-1;n++){let i=g[n],a=g[n+1];if(a-i<1e-6)continue;let c=(i+a)/2,l=Xn(i,r,s,o),u=Xn(a,r,s,o),f=tr(i,h),p=tr(a,h);if(cn(i,a,d)){v.push(jn(l,u,[`segment`],e.lineId,f,p));continue}if(sn(c,_)){v.push(jn(l,u,[`inner`],e.lineId,f,p));continue}let m=Xn(c,r,s,o),y=t.figureFaceTriangles.some(e=>Ie(m,e,t.vertices));v.push(jn(l,u,y?[`inner`]:[],e.lineId,f,p))}return v}function Z(e,t,n,r){return O.dot(O.sub(e,t),n)/r}function Xn(e,t,n,r){return O.addScaled(t,n,e*r)}function Zn(e,t){let n=[];for(let r=0;r<t.edges.length;r++){let[i,a]=An(t,r);on(i,a,e.pointA,e.pointB)&&n.push(r)}return n}function Qn(e,t,n,r){let i=[];for(let a of r.faceTriangles){let o=r.vertices[a[0]],s=r.vertices[a[1]],c=r.vertices[a[2]],l=Be(e,t,o,s,c);if(l!==void 0&&l>0){let e=l/n;e>1e-6&&e<.999999&&!ln(e,i)&&i.push(e)}}return i}function $n(e,t,n,r){let i=[];for(let a=0;a<r.faces.length;a++){let o=r.faces[a];if(o.length<3)continue;let s=o.map(e=>r.vertices[e]),c=O.sub(s[1],s[0]),l=O.sub(s[2],s[0]),u=O.cross(c,l);if(O.len(u)<1e-6)continue;let d=O.normalize(u);if(Math.abs(O.dot(t,d))>En)continue;let f=O.dot(O.sub(e,s[0]),d);if(Math.abs(f)>En)continue;let p=er(e,t,n,s);p!==void 0&&i.push(p)}return i}function er(e,t,n,r){let i=0,a=1,o=O.sub(r[1],r[0]),s=O.sub(r[2],r[0]),c=O.cross(o,s);for(let o=0;o<r.length;o++){let s=(o+1)%r.length,l=r[o],u=r[s],d=O.sub(u,l),f=O.cross(c,d);if(O.len(f)<1e-6)continue;let p=O.normalize(f),m=O.dot(O.sub(e,l),p),h=O.dot(t,p)*n;if(Math.abs(h)<1e-6){if(m<-1e-6)return;continue}let g=-m/h;if(h<0?a=Math.min(a,g):i=Math.max(i,g),i>a)return}if(!(a-i<1e-6))return{start:i,end:a}}function tr(e,t){let n=t.get(e);if(n!==void 0)return n;for(let[n,r]of t)if(Math.abs(e-n)<1e-6)return r;return-1}var nr=1e-4,rr=1e-5;function ir(e,t,n){let r=t?.vertices?.map(e=>[e[0],e[1],e[2]])??[],i=0,a=e.edges.map(([t,n])=>({lineId:i++,pointA:e.vertices[t],pointB:e.vertices[n],kind:`edge`,isInput:!0,startVertexId:-1,endVertexId:-1})),o=t?.lines?.map(([e,t])=>({lineId:i++,pointA:[e[0],e[1],e[2]],pointB:[t[0],t[1],t[2]],kind:`line`,isInput:!0,startVertexId:-1,endVertexId:-1}))??[],s=t?.segments?.map(([e,t])=>({lineId:i++,pointA:[e[0],e[1],e[2]],pointB:[t[0],t[1],t[2]],kind:`segment`,isInput:!0,startVertexId:-1,endVertexId:-1}))??[],c=[...a,...o,...s];return Q({figures:[e],lines:c,vertices:[],intersections:[],nextLineId:i,nextVertexId:0},e,r,n)}function ar(e,t,n,r,i){let a=pr(e,t,n);if(a!==void 0)return a.kind===`edge`||a.kind===`segment`?sr(e,a.lineId,r,i):e;let o={lineId:e.nextLineId,pointA:t,pointB:n,kind:`line`,isInput:!1,startVertexId:-1,endVertexId:-1};return Q({...e,lines:[...e.lines,o],nextLineId:e.nextLineId+1},r,lr(e),i)}function or(e,t,n,r){let i=e.lines.find(e=>e.lineId===t);return i===void 0||i.isInput?e:Q({...e,lines:e.lines.filter(e=>e.lineId!==t)},n,lr(e),r)}function sr(e,t,n,r){let i=e.lines.find(e=>e.lineId===t);if(i===void 0||i.kind!==`edge`&&i.kind!==`segment`)return e;let a=i.kind===`edge`?`edge-extended`:`segment-extended`,o=e.lines.map(e=>e.lineId===t?{...e,kind:a}:e);return Q({...e,lines:o},n,lr(e),r)}function cr(e,t,n,r){let i=e.lines.find(e=>e.lineId===t);if(i===void 0||i.kind!==`edge-extended`&&i.kind!==`segment-extended`)return e;let a=i.kind===`edge-extended`?`edge`:`segment`,o=e.lines.map(e=>e.lineId===t?{...e,kind:a}:e);return Q({...e,lines:o},n,lr(e),r)}function lr(e){return e.vertices.filter(e=>e.kind===`input`).map(e=>e.position)}function Q(e,t,n,r){let i=r?r.compute(e.lines,t):st(e.lines,t),{vertices:a,nextVertexId:o}=ur(t,n,i,e.nextVertexId),s=hr(e.lines,a),c=dr(a,s,i);return{...e,lines:s,intersections:i,vertices:c,nextVertexId:o}}function ur(e,t,n,r){let i=r,a=e.vertices.map(e=>({vertexId:i++,position:e,kind:`figure`,crossLineIds:[]})),o=t.filter(t=>!I(t,e.vertices,rr)).map(e=>({vertexId:i++,position:e,kind:`input`,crossLineIds:[]})),s=[...e.vertices,...o.map(e=>e.position)],c=n.filter(e=>!I(e.position,s,rr)).map(e=>({vertexId:i++,position:e.position,kind:`intersection`,crossLineIds:[]}));return{vertices:[...a,...o,...c],nextVertexId:i}}function dr(e,t,n){let r=new Map;for(let e of n){let t=mr(e.position),n=r.get(t);if(n!==void 0)for(let t of e.sourceLineIds)n.includes(t)||n.push(t);else r.set(t,[...e.sourceLineIds])}return e.map(e=>{let n;switch(e.kind){case`intersection`:{let t=mr(e.position);n=r.get(t)??[];break}case`figure`:case`input`:{let i=[];for(let n of t)(n.startVertexId===e.vertexId||n.endVertexId===e.vertexId||fr(e.position,n))&&i.push(n.lineId);let a=mr(e.position),o=r.get(a);if(o!==void 0)for(let e of o)i.includes(e)||i.push(e);n=i;break}default:_(e.kind)}return{...e,crossLineIds:n}})}function fr(e,t){return t.kind===`edge`||t.kind===`segment`?J(e,t.pointA,t.pointB):an(e,t.pointA,t.pointB)}function pr(e,t,n){for(let r of[t,n]){let i=e.vertices.find(e=>gr(e.position,r));if(i===void 0||i.crossLineIds.length===0)continue;let a=r===t?n:t;for(let t of i.crossLineIds){let n=e.lines.find(e=>e.lineId===t);if(n!==void 0&&an(a,n.pointA,n.pointB))return n}}}function mr(e){return`${e[0].toFixed(6)},${e[1].toFixed(6)},${e[2].toFixed(6)}`}function hr(e,t){return e.map(e=>{let n=-1,r=-1;for(let i of t)if(n===-1&&gr(i.position,e.pointA)&&(n=i.vertexId),r===-1&&gr(i.position,e.pointB)&&(r=i.vertexId),n!==-1&&r!==-1)break;return{...e,startVertexId:n,endVertexId:r}})}function gr(e,t){return O.distSq(e,t)<nr}var _r=[`vertex`];function vr(e,t){let n=!1,r,{topology:i}=De(t),a=we(e,t.camera),o=new v(10),s=new ot,c,l=ir(i,t.input,s),u=Y,d,f=Ne(),p=new Set,m=new Set;function h(){for(let e of p)e(f.canUndo(),f.canRedo())}function g(e){let n=Cn(t.expected,e),r=Dn(i,e.lines,e.vertices,u,d,n);c?.applySceneState(r)}function y(e){f.push(l),l=e,g(l),h()}function b(){if(!(n||!c))return{canvasWidth:e.clientWidth,canvasHeight:e.clientHeight,devicePixelRatio:Math.max(1,window.devicePixelRatio),mvpMatrix:c.getLastMvpMatrix()}}function x(e,t,n){let r=b();if(r!==void 0)return He(e,t,r.canvasWidth,r.canvasHeight,r.devicePixelRatio,r.mvpMatrix,l.lines,l.vertices.map(e=>e.position),n)}function S(e,t){let n=x(e,t);return n?.type===`line`?{type:`line`,lineId:n.lineId}:Y}function C(e,t){let n=x(e,t);if(n===void 0)return;if(n.type===`vertex`)return{kind:`vertex`,position:n.position};let r=l.lines.find(e=>e.lineId===n.lineId);if(r===void 0)return;let i=O.sub(r.pointB,r.pointA);return{kind:`line`,lineId:n.lineId,direction:[i[0],i[1],i[2]],planeAnchor:r.pointA}}function w(e,t){let n=x(e,t,_r);return n?.type===`vertex`?n.position:void 0}function T(e){u=e,g(l)}function E(){switch(u.type){case`line`:{let e=u.lineId,t=l.lines.find(t=>t.lineId===e);return t===void 0?void 0:O.sub(t.pointB,t.pointA)}case`none`:return;default:_(u)}}function D(e,t){T(S(e,t))}function k(e){let t=l.lines.find(t=>t.lineId===e);if(t!==void 0)switch(u=Y,t.kind){case`edge`:case`segment`:y(sr(l,e,i,s));break;case`edge-extended`:case`segment-extended`:y(cr(l,e,i,s));break;case`line`:y(or(l,e,i,s));break;default:_(t.kind)}}function A(){o.raise(60)}e.addEventListener(`pointerdown`,A),e.addEventListener(`pointermove`,A),e.addEventListener(`wheel`,A);let j=Te(e,D,()=>{}),ee=Ee(e,{performInitialHitTest:C,performSnapHitTest:w,hasActiveSelection:()=>u.type!==`none`,isLineSelected:e=>u.type===`line`&&u.lineId===e,onDragStart:()=>{},onDragUpdate:e=>{c?.setDragPreview(e),d=c?.getPreviewLine(),g(l)},onLineTap:e=>T({type:`line`,lineId:e}),onLineDoubleTap:k,onVertexTap:e=>{let t=E();if(t!==void 0){let n=[e[0]+t[0],e[1]+t[1],e[2]+t[2]];y(ar(l,e,n,i,s))}T(Y)},onDragComplete:(e,t)=>{y(ar(l,e,t,i,s)),T(Y)},onSecondPointer:(e,t,n)=>{a.registerExternalPointer(e,t,n)}});yr(e,a,i,t,o,e=>{for(let t of m)t(e)}).then(({cleanup:e,sceneLayer:t})=>{n?e():(r=e,c=t,g(l))});function M(e){e!==void 0&&(l=e,g(l),T(Y),h())}return{destroy:()=>{n=!0,a.destroy(),o.dispose(),e.removeEventListener(`pointerdown`,A),e.removeEventListener(`pointermove`,A),e.removeEventListener(`wheel`,A),j(),ee(),p.clear(),m.clear(),r?.()},camera:a,undo:()=>M(f.undo(l)),redo:()=>M(f.redo(l)),subscribeHistory:e=>(p.add(e),e(f.canUndo(),f.canRedo()),()=>p.delete(e)),subscribeFps:e=>(m.add(e),()=>m.delete(e))}}async function yr(e,t,n,r,i,a){let o=await k(e),s=g(4),c=new Zt(t,s,n,i,r.camera?.center??[0,0,0],r.camera?.projection??`perspective`),l=new E([c]);l.initAll(o);let u=D({canvas:e,context:o,layerManager:l,fpsController:i,onFpsUpdate:a,shouldRender:()=>c.consumeDirty(),onResize:()=>i.raise(60)});return{cleanup:()=>{u(),l.dispose(),s.dispose(),o.device.destroy()},sceneLayer:c}}var $=t(),br=(0,N.memo)(()=>{let[e,t]=(0,N.useState)(!1);return(0,$.jsxs)(C,{open:e,onOpenChange:t,children:[(0,$.jsx)(y,{title:M.toolbar.help,delayDuration:300,children:(0,$.jsx)(T,{asChild:!0,children:(0,$.jsx)(`button`,{type:`button`,"aria-label":M.toolbar.help,className:i(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,e?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,$.jsx)(s,{size:20})})})}),(0,$.jsx)(b,{children:(0,$.jsxs)(x,{side:`top`,sideOffset:8,align:`end`,collisionPadding:16,className:i(`z-50 w-72 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,$.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,$.jsx)(`span`,{className:`font-semibold text-white`,children:M.help.title}),(0,$.jsx)(w,{"aria-label":M.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,$.jsx)(l,{size:14})})]}),(0,$.jsx)(`p`,{className:`mb-3 text-neutral-400`,children:M.help.description}),(0,$.jsxs)(`ul`,{className:`space-y-1.5 text-neutral-300`,children:[(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:M.help.controlLabels.drag}),` —`,` `,M.help.controls.drag]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:M.help.controlLabels.shiftDrag}),` `,`— `,M.help.controls.shiftDrag]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:M.help.controlLabels.scrollPinch}),` `,`— `,M.help.controls.scrollPinch]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:M.help.controlLabels.clickEdge}),` `,`— `,M.help.controls.clickEdge]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:M.help.controlLabels.doubleClickEdge}),` `,`— `,M.help.controls.doubleClickEdge]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:M.help.controlLabels.doubleClickLine}),` `,`— `,M.help.controls.doubleClickLine]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:M.help.controlLabels.dragVertex}),` `,`— `,M.help.controls.dragVertex]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:M.help.controlLabels.selectEdgeTapVertex}),` `,`— `,M.help.controls.selectEdgeTapVertex]}),(0,$.jsxs)(`li`,{children:[(0,$.jsx)(`strong`,{className:`text-neutral-100`,children:M.help.controlLabels.holdDragLineVertex}),` `,`— `,M.help.controls.holdDragLineVertex]})]}),(0,$.jsx)(`p`,{className:`mt-3 text-xs text-neutral-500`,children:M.help.intersectionHint}),(0,$.jsx)(S,{className:`fill-neutral-900`})]})})]})}),xr=(0,N.memo)(({puzzle:e})=>{let[t,n]=(0,N.useState)(!1),r=M.puzzles[e.id];return r===void 0?null:(0,$.jsxs)(C,{open:t,onOpenChange:n,children:[(0,$.jsx)(y,{title:M.toolbar.puzzle,delayDuration:300,children:(0,$.jsx)(T,{asChild:!0,children:(0,$.jsx)(`button`,{type:`button`,"aria-label":M.toolbar.puzzle,className:i(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,t?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,$.jsx)(re,{size:20})})})}),(0,$.jsx)(b,{children:(0,$.jsxs)(x,{side:`top`,sideOffset:8,align:`end`,collisionPadding:16,className:i(`z-50 w-72 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,$.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,$.jsx)(`span`,{className:`font-semibold text-white`,children:r.name}),(0,$.jsx)(w,{"aria-label":M.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,$.jsx)(l,{size:14})})]}),e.solutionImage!==void 0&&(0,$.jsx)(`img`,{src:e.solutionImage,alt:M.solutionImageAlt,className:`mb-3 w-full rounded-md border border-neutral-700 object-cover`}),(0,$.jsx)(`p`,{className:`text-neutral-300`,children:r.description}),(0,$.jsx)(S,{className:`fill-neutral-900`})]})})]})}),Sr=(0,N.memo)(({active:e=!1,disabled:t=!1,onClick:n,children:r,label:a,tooltipDelayMs:o=300})=>(0,$.jsx)(y,{title:a,delayDuration:o,children:(0,$.jsx)(`button`,{type:`button`,onClick:n,disabled:t,"aria-label":a,"aria-pressed":e,className:i(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all`,t?`bg-neutral-900 text-neutral-600 cursor-not-allowed`:`hover:scale-110 active:scale-95`,!t&&e&&`bg-blue-500 text-white`,!t&&!e&&`bg-neutral-800 text-neutral-400 hover:text-white`),children:r})})),Cr=te(),wr=(0,N.memo)(({puzzle:e})=>{let t=(0,N.useRef)(null),n=(0,N.useRef)(null),[r,i]=(0,N.useState)(`rotate`),[o,s]=(0,N.useState)(!1),[l,u]=(0,N.useState)(!1),[d,f]=(0,N.useState)(0),g=p(),_=a(()=>{g(`/stereometry`)});m({label:M.nav.backToPuzzlesLabel,onActivate:_}),(0,N.useEffect)(()=>{if(t.current){let r=vr(t.current,e);n.current=r;let i=r.subscribeHistory((e,t)=>{s(e),u(t)}),a=r.subscribeFps(f);return()=>{n.current=null,i(),a(),r.destroy()}}},[e]);let v=a(()=>{i(`rotate`),n.current?.camera.setInteractionMode(`rotate`)}),y=a(()=>{i(`pan`),n.current?.camera.setInteractionMode(`pan`)}),b=a(()=>{n.current?.undo()}),x=a(()=>{n.current?.redo()});return(0,$.jsx)(h,{className:`h-full w-full`,children:(0,$.jsxs)(`div`,{className:`h-full w-full`,children:[(0,$.jsx)(`canvas`,{ref:t,className:`h-full w-full [touch-action:none]`}),!Cr&&(0,$.jsxs)(`div`,{className:`absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400`,children:[d,` FPS`]}),(0,$.jsxs)(`div`,{className:`fixed right-4 bottom-4 flex gap-2`,children:[(0,$.jsx)(xr,{puzzle:e}),(0,$.jsx)(br,{}),(0,$.jsx)(Sr,{onClick:b,label:M.toolbar.undo,disabled:!o,children:(0,$.jsx)(ae,{size:20})}),(0,$.jsx)(Sr,{onClick:x,label:M.toolbar.redo,disabled:!l,children:(0,$.jsx)(ie,{size:20})}),(0,$.jsx)(Sr,{active:r===`rotate`,onClick:v,label:M.toolbar.rotate,children:(0,$.jsx)(c,{size:20})}),(0,$.jsx)(Sr,{active:r===`pan`,onClick:y,label:M.toolbar.pan,children:(0,$.jsx)(ne,{size:20})})]})]})})}),Tr=(0,N.memo)(()=>{let{puzzleId:e}=d(),t=ee(e);return n(t)?(0,$.jsx)(f,{to:`/stereometry`,replace:!0}):(0,$.jsx)(wr,{puzzle:t})});export{Tr as Stereometry};