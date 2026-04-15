import{r as e}from"./c-BlVx34DW.js";import{F as t,I as n,L as r,t as i,y as a}from"./c-BV2HkZqA.js";import{_ as o,d as s,g as c,h as l,m as u,p as d,v as f}from"./c-BLmXiByy.js";import{i as p,n as m,r as h,t as g}from"./c-CYmhJQ9Q.js";import{t as _}from"./c-DwE7GUG5.js";import{a as v,i as y,n as b,r as x,t as S}from"./c-wo9X1jdP.js";import{n as ee,t as C}from"./c-CjqPSPN9.js";import{t as w}from"./c-79FAfWPB.js";var T=p(`move`,[[`path`,{d:`M12 2v20`,key:`t6zp3m`}],[`path`,{d:`m15 19-3 3-3-3`,key:`11eu04`}],[`path`,{d:`m19 9 3 3-3 3`,key:`1mg7y2`}],[`path`,{d:`M2 12h20`,key:`9i4pu4`}],[`path`,{d:`m5 9-3 3 3 3`,key:`j64kie`}],[`path`,{d:`m9 5 3-3 3 3`,key:`l8vdw6`}]]),E=p(`redo-2`,[[`path`,{d:`m15 14 5-5-5-5`,key:`12vg1m`}],[`path`,{d:`M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13`,key:`6uklza`}]]),te=p(`rotate-ccw`,[[`path`,{d:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`1357e3`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}]]),D=e(n(),1),O=t(),ne=Math.PI/2.3,re=Math.PI/30,ie=.005,ae=.003,oe=.01,se=.95,ce=.1,le=.1,ue=.001,k=Math.PI/4,A=.1,de=Math.tan(k/2),j=1e3,fe=1e3,pe=.45,me=.1,M={line:{color:`#FFFFFF`,width:1,alpha:1,line:{type:`solid`}},"line:hidden":{alpha:.3,line:{type:`dashed`,dash:10,gap:10}},"line:selected":{color:`#55AAFF`},"line:hidden:selected":{alpha:1},"line:segment":{width:3},"line:preview":{color:`#4488BB`},"line:inner":{width:3},vertex:{markerType:`circle`,color:`#000000`,size:10,strokeColor:`#FFFFFF`,strokeWidth:2},"vertex:hidden":{strokeColor:`#999999`},"vertex:selected":{color:`#55AAFF`},"vertex:hidden:selected":{color:`#3388DD`},"vertex:inner":{strokeColor:`#AAFF44`,color:`#AAAAAA`},"vertex:inner:hidden":{color:`#000000`},"vertex:preview":{color:`#000000`,strokeColor:`#4488BB`,strokeWidth:6,size:16},background:{color:`#1A1A1F`}};function he(e,t){let n=t?.distance?.min??3,r=t?.distance?.max??15,i=t?.distance?.initial??5,a=t?.center??[0,0,0],o=t?.angle?.azimuth??re,s=t?.angle?.elevation??ne,c=i,l=i,u=[a[0],a[1],a[2]],d=`rotate`,f=0,p=0,m=0;function h(){return[u[0]+Math.sin(s)*Math.sin(o)*c,u[1]+Math.cos(s)*c,u[2]+Math.sin(s)*Math.cos(o)*c]}function g(){return[-Math.cos(s)*Math.sin(o),Math.sin(s),-Math.cos(s)*Math.cos(o)]}function _(){return[Math.cos(o),0,-Math.sin(o)]}function v(e){let t=-e*ie;o+=t;let n=u[0]-a[0],r=u[2]-a[2],i=Math.cos(t),s=Math.sin(t);u[0]=a[0]+n*i+r*s,u[2]=a[2]-n*s+r*i}function y(e,t){let n=ae*c,r=_();u[0]-=r[0]*e*n,u[1]+=t*n,u[2]-=r[2]*e*n}function x(e){return Math.max(n,Math.min(r,e))}function ee(){f=0,p=0,m=0}let C=new Map,w=!1,T=0;function E(){let e=[...C.values()],t=e[0].clientX-e[1].clientX,n=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+n*n)}function te(e){C.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),C.size===1?w=e.shiftKey:C.size===2&&(T=E())}function D(e){let t=C.get(e.pointerId);if(t===void 0)return;if(C.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY}),C.size===2){let e=E(),t=T/e;l=x(l*t),T=e;return}if(C.size!==1)return;let n=e.clientX-t.clientX,r=e.clientY-t.clientY;w||d===`pan`?(p=n,m=r,f=0,y(n,r)):(f=n,p=0,m=0,v(n))}function O(e){C.delete(e.pointerId),C.size===0&&(w=!1)}function k(e){C.delete(e.pointerId)}function A(e){e.preventDefault(),l=x(l*(1+e.deltaY*oe))}return e.addEventListener(`pointerdown`,te),window.addEventListener(`pointermove`,D),window.addEventListener(`pointerup`,O),window.addEventListener(`pointercancel`,k),e.addEventListener(`wheel`,A,{passive:!1}),{tick(){let e=Math.abs(l-c)>ue;if(e?c+=(l-c)*le:c=l,C.size>0)return!0;let t=Math.abs(f)>=ce,n=Math.abs(p)>=.1||Math.abs(m)>=.1;return!t&&!n?(ee(),e):(t&&(v(f),f*=se),n&&(y(p,m),p*=se,m*=se),!0)},getViewMatrix(){let e=h(),t=g();return S.lookAt(b.fromValues(e[0],e[1],e[2]),b.fromValues(u[0],u[1],u[2]),b.fromValues(t[0],t[1],t[2]))},getEyePosition(){return h()},getDistance(){return c},setInteractionMode(e){d=e,ee()},destroy(){e.removeEventListener(`pointerdown`,te),window.removeEventListener(`pointermove`,D),window.removeEventListener(`pointerup`,O),window.removeEventListener(`pointercancel`,k),e.removeEventListener(`wheel`,A)}}}function ge(e,t,n){let r=0,i=0,a=0,o,s=0,c=0,l=0;function u(e,t){let n=Math.abs(e-r),o=Math.abs(t-i),s=performance.now()-a;return n<3&&o<3&&s<300}function d(e,r){let i=performance.now(),a=i-l,o=Math.sqrt((e-s)**2+(r-c)**2);a<400&&o<10?(n(e,r),l=0):(t(e,r),s=e,c=r,l=i)}function f(e){e.isPrimary&&(o=e.pointerId,r=e.clientX,i=e.clientY,a=performance.now())}function p(t){if(t.pointerId===o&&(o=void 0,u(t.clientX,t.clientY))){let n=e.getBoundingClientRect();d(t.clientX-n.left,t.clientY-n.top)}}return e.addEventListener(`pointerdown`,f),window.addEventListener(`pointerup`,p),()=>{e.removeEventListener(`pointerdown`,f),window.removeEventListener(`pointerup`,p)}}function _e(e,t){let n=!1,r,i=[0,0,0];function a(t,n){let r=e.getBoundingClientRect();return{screenX:t-r.left,screenY:n-r.top}}function o(e,t){return e[0]===t[0]&&e[1]===t[1]&&e[2]===t[2]}function s(e){let{screenX:o,screenY:s}=a(e.clientX,e.clientY),c=t.performPointHitTest(o,s);return c===void 0?!1:(n=!0,r=e.pointerId,i=c,t.onDragStart(),t.onDragUpdate({startPosition:i,cursorScreenX:o,cursorScreenY:s,snapTargetPosition:void 0}),!0)}function c(e,n){let{screenX:r,screenY:s}=a(e,n),c=t.performPointHitTest(r,s);t.onDragUpdate({startPosition:i,cursorScreenX:r,cursorScreenY:s,snapTargetPosition:c!==void 0&&!o(c,i)?c:void 0})}function l(e,s){let{screenX:c,screenY:l}=a(e,s),u=t.performPointHitTest(c,l);u!==void 0&&!o(u,i)?t.onDragComplete(i,u):t.onVertexTap(i),n=!1,r=void 0,t.onDragUpdate(void 0)}function u(){n=!1,r=void 0,t.onDragUpdate(void 0)}function d(e){if(n){u(),e.stopPropagation();return}e.isPrimary&&s(e)&&e.stopPropagation()}function f(e){!n||e.pointerId!==r||c(e.clientX,e.clientY)}function p(e){!n||e.pointerId!==r||l(e.clientX,e.clientY)}return e.addEventListener(`pointerdown`,d,{capture:!0}),window.addEventListener(`pointermove`,f),window.addEventListener(`pointerup`,p),()=>{e.removeEventListener(`pointerdown`,d,{capture:!0}),window.removeEventListener(`pointermove`,f),window.removeEventListener(`pointerup`,p)}}var N=function(e){return e[e.Idle=1]=`Idle`,e[e.Resize=60]=`Resize`,e[e.Interaction=60]=`Interaction`,e[e.Animation=60]=`Animation`,e}({}),ve=500,ye=class{activeLevels=new Map;fallbackFps;constructor(e=N.Idle){this.fallbackFps=e}raise(e){let t=this.activeLevels.get(e);t!==void 0&&clearTimeout(t);let n=setTimeout(()=>{this.activeLevels.delete(e)},ve);this.activeLevels.set(e,n)}getFrameIntervalMs(){return fe/this.getCurrentFps()}getCurrentFps(){if(this.activeLevels.size===0)return this.fallbackFps;let e=0;for(let t of this.activeLevels.keys())t>e&&(e=t);return e}dispose(){for(let e of this.activeLevels.values())clearTimeout(e);this.activeLevels.clear()}};function be(e){let t=[],n=[],r=[],i=new Set,a=[];for(let o of e.input.figures){let e=t.length,s=[];for(let e of o.vertices)t.push([e[0],e[1],e[2]]);for(let t of o.faces){let r=t.map(t=>t+e);n.push(r),s.push(r);for(let e=0;e<r.length;e++){let t=(e+1)%r.length,n=Math.min(r[e],r[t]),o=Math.max(r[e],r[t]),s=`${n}-${o}`;i.has(s)||(i.add(s),a.push([n,o]))}}r.push(s)}let o=xe(t,a,n,r);return{name:e.name,topology:o}}function xe(e,t,n,r){return{vertices:e,edges:t,faces:n,faceTriangles:Ce(n),figureFaceTriangles:r.map(e=>Ce(e))}}function Se(e){let{vertices:t,faceTriangles:n}=e,r=n.length*3,i=new Float32Array(r*3),a=0;for(let[e,r,o]of n)we(i,a,t[e]),we(i,a+1,t[r]),we(i,a+2,t[o]),a+=3;return{facePositions:i,faceVertexCount:r}}function Ce(e){let t=[];for(let n of e){if(n.length<3)continue;let e=n[0];for(let r=1;r<n.length-1;r++)t.push([e,n[r],n[r+1]])}return t}function we(e,t,n){let r=t*3;e[r]=n[0],e[r+1]=n[1],e[r+2]=n[2]}function Te(e,t){let n=b.sub(t,e),r=b.len(n);if(r===0)return[[e[0],e[1],e[2]],[t[0],t[1],t[2]]];let i=b.scale(n,1/r);return[[e[0]-i[0]*j,e[1]-i[1]*j,e[2]-i[2]*j],[t[0]+i[0]*j,t[1]+i[1]*j,t[2]+i[2]*j]]}function Ee(e,t,n,r){let i=b.sub(n,t),a=b.sub(r,t),o=b.cross(i,a),s=b.len(o);if(s<P||Math.abs(b.dot(b.sub(e,t),o))/s>P)return!1;let c=b.dot(i,i),l=b.dot(i,a),u=b.dot(a,a),d=b.sub(e,t),f=b.dot(d,i),p=b.dot(d,a),m=c*u-l*l;if(Math.abs(m)<P*P)return!1;let h=(u*f-l*p)/m,g=(c*p-l*f)/m;return 1-h-g>=-P&&h>=-P&&g>=-P}var P=1e-4;function De(e,t,n){for(let r of t)if(Ee(e,n[r[0]],n[r[1]],n[r[2]]))return!0;let r=[1,0,0],i=0;for(let a of t){let t=n[a[0]],o=n[a[1]],s=n[a[2]],c=Ae(e,r,t,o,s);c!==void 0&&c>-ke&&i++}return i%2==1}function Oe(e,t,n){for(let r of t)if(b.distSq(e,r)<n)return!0;return!1}var ke=1e-6;function Ae(e,t,n,r,i){let a=[r[0]-n[0],r[1]-n[1],r[2]-n[2]],o=[i[0]-n[0],i[1]-n[1],i[2]-n[2]],s=t[1]*o[2]-t[2]*o[1],c=t[2]*o[0]-t[0]*o[2],l=t[0]*o[1]-t[1]*o[0],u=a[0]*s+a[1]*c+a[2]*l;if(Math.abs(u)<ke)return;let d=1/u,f=e[0]-n[0],p=e[1]-n[1],m=e[2]-n[2],h=(f*s+p*c+m*l)*d;if(h<0||h>1)return;let g=p*a[2]-m*a[1],_=m*a[0]-f*a[2],v=f*a[1]-p*a[0],y=(t[0]*g+t[1]*_+t[2]*v)*d;if(!(y<0||h+y>1))return(o[0]*g+o[1]*_+o[2]*v)*d}var je={color:`#FFFFFF`,width:1,size:1,alpha:1,line:{type:`solid`},markerType:`solid`,strokeColor:`#FFFFFF`,strokeWidth:0},Me=16,Ne=7,Pe=255;function F(e){if(e.length!==Ne||e[0]!==`#`)throw Error(`Invalid hex color: ${e}. Expected format: #RRGGBB`);return[Number.parseInt(e.slice(1,3),Me)/Pe,Number.parseInt(e.slice(3,5),Me)/Pe,Number.parseInt(e.slice(5,7),Me)/Pe]}function Fe(e){let t=[...e].sort(),n=[[]];for(let e of t){let t=n.length;for(let r=0;r<t;r++)n.push([...n[r],e])}return n.sort((e,t)=>e.length===t.length?e.join(`:`).localeCompare(t.join(`:`)):e.length-t.length),n}function Ie(e,t){return{color:t.color??e.color,width:t.width??e.width,size:t.size??e.size,alpha:t.alpha??e.alpha,line:t.line??e.line,markerType:t.markerType??e.markerType,strokeColor:t.strokeColor??e.strokeColor,strokeWidth:t.strokeWidth??e.strokeWidth}}function Le(e){let t={};for(let[n,r]of Object.entries(e)){let e=n.split(`:`);if(e.length<=2){t[n]=r;continue}let i=e[0],a=e.slice(1).sort();t[`${i}:${a.join(`:`)}`]=r}return t}function I(e,t,n){let r=Le(e),i=Fe(n),a={...je};for(let e of i){let n=r[e.length===0?t:`${t}:${e.join(`:`)}`];n!==void 0&&(a=Ie(a,n))}return a}var L=1e-8,R=1e-6,Re=1e-4,ze=-1,z=1e-10,Be=1e-8;function Ve(e,t,n,r){let i=t.vertices.map(e=>e.position),a=Ge(e,i,n,t.lines);return{segments:Ke(e,t.lines,n,i,r).map(e=>Ue(e)),markers:a}}function He(e){let[t,n,r]=F(e.color);return{width:e.width,color:[t,n,r],alpha:e.alpha,lineType:e.line.type===`dashed`?1:0,dash:e.line.type===`dashed`?e.line.dash:0,gap:e.line.type===`dashed`?e.line.gap:0}}function Ue(e){let t=I(M,`line`,e.modifiers),n=I(M,`line`,[`hidden`,...e.modifiers]);return{startPosition:e.startPosition,endPosition:e.endPosition,visibleStyle:He(t),hiddenStyle:He(n),sourceLineIndex:e.sourceLineIndex,isTopologyEdge:e.modifiers.includes(`segment`)}}function We(e){let[t,n,r]=F(e.color),[i,a,o]=F(e.strokeColor);return{size:e.size,color:[t,n,r],alpha:e.alpha,strokeColor:[i,a,o],strokeWidth:e.strokeWidth}}function Ge(e,t,n,r){let i=[];for(let a=0;a<t.length;a++){let o=t[a],s=[];(dt(o,e.vertices)||e.figureFaceTriangles.some(t=>De(o,t,e.vertices)))&&s.push(`inner`),ct(o,n,e,r)&&s.push(`selected`);let c=I(M,`vertex`,s),l=I(M,`vertex`,[`hidden`,...s]);i.push({position:o,markerType:c.markerType===`circle`?1:0,visibleStyle:We(c),hiddenStyle:We(l)})}return i}function Ke(e,t,n,r,i){let a=Ye(n,t,e),o=Xe(n,t,e),s=[];for(let n=0;n<t.length;n++){let i=$e(t[n],n,e,r),o=a.has(n);for(let e of i){if(e.modifiers.includes(`segment`))continue;let t=o?[...e.modifiers,`selected`]:e.modifiers;s.push({...e,modifiers:t})}}if(i!==void 0){let t=$e(i,-2,e,r);for(let e of t)e.modifiers.includes(`segment`)||s.push({...e,modifiers:[...e.modifiers,`preview`]})}return qe([...Qe(e,o),...s])}function qe(e){let t=new Map;for(let n of e){let e=Je(n.startPosition,n.endPosition),r=t.get(e);(r===void 0||n.modifiers.length>r.modifiers.length)&&t.set(e,n)}return[...t.values()]}function Je(e,t){let n=`${e[0].toFixed(6)},${e[1].toFixed(6)},${e[2].toFixed(6)}`,r=`${t[0].toFixed(6)},${t[1].toFixed(6)},${t[2].toFixed(6)}`;return n<r?`${n}|${r}`:`${r}|${n}`}function Ye(e,t,n){let r=new Set;switch(e.type){case`line`:r.add(e.lineIndex);break;case`edge`:{let[i,a]=n.edges[e.edgeIndex],o=n.vertices[i],s=n.vertices[a];for(let e=0;e<t.length;e++){let n=t[e];(B(n.pointA,o)&&B(n.pointB,s)||B(n.pointA,s)&&B(n.pointB,o))&&r.add(e)}break}case`none`:break}return r}function Xe(e,t,n){let r=new Set;switch(e.type){case`edge`:r.add(e.edgeIndex);break;case`line`:{let i=t[e.lineIndex];for(let e=0;e<n.edges.length;e++){let[t,a]=n.edges[e],o=n.vertices[t],s=n.vertices[a];Ze(o,s,i.pointA,i.pointB)&&r.add(e)}break}case`none`:break}return r}function Ze(e,t,n,r){let i=b.sub(r,n),a=b.len(i);if(a===0)return!1;let o=[i[0]/a,i[1]/a,i[2]/a],s=b.sub(e,n),c=b.cross(o,s);if(b.len(c)>L)return!1;let l=b.sub(t,n),u=b.cross(o,l);return b.len(u)<=L}function B(e,t){return Math.abs(e[0]-t[0])<R&&Math.abs(e[1]-t[1])<R&&Math.abs(e[2]-t[2])<R}function Qe(e,t){return e.edges.map(([n,r],i)=>{let a=[`segment`];return t.has(i)&&a.push(`selected`),{startPosition:e.vertices[n],endPosition:e.vertices[r],modifiers:a,sourceLineIndex:ze}})}function $e(e,t,n,r){let[i,a]=Te(e.pointA,e.pointB),o=b.sub(a,i),s=b.len(o);if(s===0)return[];let c=[o[0]/s,o[1]/s,o[2]/s],l=tt(e,n,c),u=nt(i,c,s,n),d=rt(i,c,s,n),f=l.map(e=>{let[t,r]=n.edges[e],a=V(n.vertices[t],i,c,s),o=V(n.vertices[r],i,c,s);return{start:Math.min(a,o),end:Math.max(a,o)}}),p=V(e.pointA,i,c,s),m=V(e.pointB,i,c,s),h=new Set;h.add(0),h.add(1),h.add(p),h.add(m);for(let e of u)h.add(e);for(let e of d)h.add(e.start),h.add(e.end);for(let e of f)h.add(e.start),h.add(e.end);for(let e of r){let t=V(e,i,c,s);if(t>R&&t<1-R){let n=H(t,i,c,s);b.distSq(e,n)<Be&&h.add(t)}}let g=ot([...h].sort((e,t)=>e-t)),_=st(d),v=[];for(let e=0;e<g.length-1;e++){let r=g[e],a=g[e+1];if(a-r<R)continue;let o=(r+a)/2,l=H(r,i,c,s),u=H(a,i,c,s);if(et(o,f)){v.push({startPosition:l,endPosition:u,modifiers:[`segment`],sourceLineIndex:t});continue}if(et(o,_)){v.push({startPosition:l,endPosition:u,modifiers:[`inner`],sourceLineIndex:t});continue}let d=H(o,i,c,s),p=n.figureFaceTriangles.some(e=>De(d,e,n.vertices));v.push({startPosition:l,endPosition:u,modifiers:p?[`inner`]:[],sourceLineIndex:t})}return v}function V(e,t,n,r){return b.dot(b.sub(e,t),n)/r}function H(e,t,n,r){let i=e*r;return[t[0]+n[0]*i,t[1]+n[1]*i,t[2]+n[2]*i]}function et(e,t){for(let n of t)if(e>n.start+R&&e<n.end-R)return!0;return!1}function tt(e,t,n){let r=[];for(let i=0;i<t.edges.length;i++){let[a,o]=t.edges[i],s=t.vertices[a],c=t.vertices[o],l=b.sub(c,s),u=b.len(l);if(u===0)continue;let d=[l[0]/u,l[1]/u,l[2]/u],f=b.cross(n,d);if(b.len(f)>L)continue;let p=b.sub(s,e.pointA),m=b.cross(n,p);b.len(m)<L&&r.push(i)}return r}function nt(e,t,n,r){let i=[];for(let a of r.faceTriangles){let o=r.vertices[a[0]],s=r.vertices[a[1]],c=r.vertices[a[2]],l=Ae(e,t,o,s,c);if(l!==void 0&&l>0){let e=l/n;e>R&&e<1-R&&!at(e,i)&&i.push(e)}}return i}function rt(e,t,n,r){let i=[];for(let a=0;a<r.faces.length;a++){let o=r.faces[a];if(o.length<3)continue;let s=o.map(e=>r.vertices[e]),c=b.sub(s[1],s[0]),l=b.sub(s[2],s[0]),u=b.cross(c,l),d=b.len(u);if(d<R)continue;let f=[u[0]/d,u[1]/d,u[2]/d];if(Math.abs(b.dot(t,f))>Re)continue;let p=b.dot(b.sub(e,s[0]),f);if(Math.abs(p)>Re)continue;let m=it(e,t,n,s);m!==void 0&&i.push(m)}return i}function it(e,t,n,r){let i=0,a=1,o=b.sub(r[1],r[0]),s=b.sub(r[2],r[0]),c=b.cross(o,s);for(let o=0;o<r.length;o++){let s=(o+1)%r.length,l=r[o],u=r[s],d=b.sub(u,l),f=b.cross(c,d),p=b.len(f);if(p<R)continue;let m=[f[0]/p,f[1]/p,f[2]/p],h=b.dot(b.sub(e,l),m),g=b.dot(t,m)*n;if(Math.abs(g)<R){if(h<-R)return;continue}let _=-h/g;if(g<0?a=Math.min(a,_):i=Math.max(i,_),i>a)return}if(!(a-i<R))return{start:i,end:a}}function at(e,t){for(let n of t)if(Math.abs(e-n)<R)return!0;return!1}function ot(e){let t=[];for(let n of e)(t.length===0||Math.abs(n-t[t.length-1])>R)&&t.push(n);return t}function st(e){if(e.length===0)return[];let t=[...e].sort((e,t)=>e.start-t.start),n=[t[0]];for(let e=1;e<t.length;e++){let r=t[e],i=n[n.length-1];r.start<=i.end+R?n[n.length-1]={start:i.start,end:Math.max(i.end,r.end)}:n.push(r)}return n}function ct(e,t,n,r){switch(t.type){case`none`:return!1;case`edge`:{let[i,a]=n.edges[t.edgeIndex],o=n.vertices[i],s=n.vertices[a];if(lt(e,o,s))return!0;for(let t of r)if(U(t.pointA,o)&&U(t.pointB,s)||U(t.pointA,s)&&U(t.pointB,o))return ut(e,t.pointA,t.pointB);return!1}case`line`:{let n=r[t.lineIndex];return ut(e,n.pointA,n.pointB)}}}function lt(e,t,n){let r=b.sub(n,t),i=b.dot(r,r);if(i<z)return b.distSq(e,t)<z;let a=b.sub(e,t),o=b.dot(a,r)/i;if(o<-.001||o>1.001)return!1;let s=[t[0]+o*r[0],t[1]+o*r[1],t[2]+o*r[2]];return b.distSq(e,s)<Be}function ut(e,t,n){let r=b.sub(n,t),i=b.dot(r,r);if(i<z)return b.distSq(e,t)<z;let a=b.sub(e,t),o=b.dot(a,r)/i,s=[t[0]+o*r[0],t[1]+o*r[1],t[2]+o*r[2]];return b.distSq(e,s)<Be}function U(e,t){return b.distSq(e,t)<z}function dt(e,t){for(let n of t)if(b.distSq(e,n)<z)return!0;return!1}var ft=100;function pt(){let e=[],t=[];return{push(n){e.push(n),t.length=0,e.length>ft&&e.shift()},undo(n){let r=e.pop();if(r!==void 0)return t.push(n),r},redo(n){let r=t.pop();if(r!==void 0)return e.push(n),r},canUndo(){return e.length>0},canRedo(){return t.length>0}}}var W={type:`none`};function mt(e,t,n,i,a,o,s,c,l){let u=n*a,d=i*a,f=e*a,p=t*a,m=(30*a)**2,h=_t(o,c,u,d),g=Ct(f,p,m,s.map(([e,t])=>({start:h[e],end:h[t]})));if(!r(g))return{type:`edge`,edgeIndex:g};if(l.length>0){let e=Ct(f,p,m,xt(o,l.map(e=>({startPosition:e.pointA,endPosition:e.pointB})),u,d));if(!r(e))return{type:`line`,lineIndex:e}}return W}function ht(e,t,n,r,i,a,o){let s=n*i,c=r*i;return St(e*i,t*i,i,_t(a,o,s,c))}var gt=.01;function _t(e,t,n,r){return t.map(t=>{let i=x.transformMat4(x.fromValues(t[0],t[1],t[2],1),e);if(i[3]<=0)return{screenX:0,screenY:0,behindCamera:!0};let a=i[0]/i[3],o=i[1]/i[3];return{screenX:(a+1)*.5*n,screenY:(1-o)*.5*r,behindCamera:!1}})}function vt(e,t,n,r,i){let a=x.transformMat4(x.fromValues(t[0],t[1],t[2],1),e),o=x.transformMat4(x.fromValues(n[0],n[1],n[2],1),e);if(a[3]<=0&&o[3]<=0)return{start:{screenX:0,screenY:0,behindCamera:!0},end:{screenX:0,screenY:0,behindCamera:!0}};let s=a[3]<gt?yt(a,o):a,c=o[3]<gt?yt(o,a):o;return{start:bt(s,r,i),end:bt(c,r,i)}}function yt(e,t){let n=(gt-e[3])/(t[3]-e[3]);return x.lerp(e,t,n)}function bt(e,t,n){let r=e[0]/e[3],i=e[1]/e[3];return{screenX:(r+1)*.5*t,screenY:(1-i)*.5*n,behindCamera:!1}}function xt(e,t,n,r){return t.map(t=>{let[i,a]=Te(t.startPosition,t.endPosition);return vt(e,i,a,n,r)})}function St(e,t,n,r){let i=(30*n)**2,a;for(let n=0;n<r.length;n++){let o=r[n];if(o.behindCamera)continue;let s=o.screenX-e,c=o.screenY-t,l=s*s+c*c;l<i&&(i=l,a=n)}return a}function Ct(e,t,n,r){let i=n,a;for(let n=0;n<r.length;n++){let{start:o,end:s}=r[n];if(o.behindCamera||s.behindCamera)continue;let c=wt(e,t,o.screenX,o.screenY,s.screenX,s.screenY);c<i&&(i=c,a=n)}return a}function wt(e,t,n,r,i,a){let o=i-n,s=a-r,c=o*o+s*s;if(c===0){let i=e-n,a=t-r;return i*i+a*a}let l=Math.max(0,Math.min(1,((e-n)*o+(t-r)*s)/c)),u=n+l*o,d=r+l*s,f=e-u,p=t-d;return f*f+p*p}var Tt=`struct Uniforms {
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
`,Et=`/**
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
`,Dt=`/**
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
    /** Line center UV for depth sampling (without width offset) */
    @location(10) @interpolate(linear) lineCenterUV: vec2<f32>,
    /** Line center NDC depth for occlusion comparison */
    @location(11) @interpolate(linear) lineCenterDepth: f32,
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

    // Line center position (without perpendicular width offset)
    let centerNdcXY = clipPos.xy / clipPos.w;
    let centerUV = centerNdcXY * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5);
    let centerDepth = max(clipPos.z, 0.0) / clipPos.w;

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
    result.lineCenterUV = centerUV;
    result.lineCenterDepth = centerDepth;
    return result;
}

/** Renders a line fragment with occlusion test at the line center */
@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
    // Sample face depth at the LINE CENTER, not the fragment position.
    // This makes the entire line width use one style (visible or hidden).
    let faceDepthValue = textureSampleLevel(faceDepth, depthSampler, input.lineCenterUV, 0);
    let isOccluded = faceDepthValue < input.lineCenterDepth;

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
`,Ot=`/**
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
    @location(6) @interpolate(flat) isOccluded: f32,
};

@group(0) @binding(1) var sceneDepth: texture_depth_2d;
@group(0) @binding(2) var depthSampler: sampler;

/**
 * Render mode filter (pipeline-overridable constant):
 *   0 = render all fragments (default, used by preview)
 *   1 = render only hidden (occluded) fragments
 *   2 = render only visible (non-occluded) fragments
 */
override renderMode: u32 = 0u;

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
    result.isOccluded = select(0.0, 1.0, isOccluded);
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
`,kt=Tt+Et,At=Tt+Dt,jt=Tt+Ot,G=`depth24plus`,K=1,Mt=0,Nt=1,Pt=2,Ft=4,q=32,J=q*Ft,It=[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`},{shaderLocation:2,offset:24,format:`float32`},{shaderLocation:3,offset:28,format:`float32x3`},{shaderLocation:4,offset:40,format:`float32`},{shaderLocation:5,offset:44,format:`float32`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32`},{shaderLocation:9,offset:60,format:`float32x3`},{shaderLocation:10,offset:72,format:`float32`},{shaderLocation:11,offset:76,format:`float32`},{shaderLocation:12,offset:80,format:`float32`},{shaderLocation:13,offset:84,format:`float32`}],Y=24,X=Y*Ft,Lt=3*Ft,Rt=128,zt=0,Bt=64,Vt=72,Ht=80,Ut=108,Wt=96,Z=6,Gt=class{device;format;hiddenLinePipeline;visibleLinePipeline;previewLinePipeline;hiddenMarkerPipeline;visibleMarkerPipeline;previewMarkerPipeline;bindGroup;lineBindGroup;previewLineBindGroup;markerBindGroup;previewMarkerBindGroup;depthBindGroupLayout;uniformBuffer;previewUniformBuffer;faceVertexBuffer;styledLineBuffer;topologyVertexMarkerBuffer;previewLineBuffer;previewStartMarkerBuffer;previewSnapMarkerBuffer;depthPrePassPipeline;depthSampler;faceVertexCount=0;depthTexture=null;samplingDepthTexture=null;lastMvpMatrix=new Float32Array(16);styledLineCount=0;topologyVertexCount=0;hasDragPreview=!1;currentPreviewLine;hasSnapTarget=!1;lastCanvasWidth=0;lastCanvasHeight=0;lastDevicePixelRatio=1;backgroundClearColor;vertexPreviewStyle;constructor(e,t,n,r,i,a=`perspective`){this.camera=e,this.msaaManager=t,this.topology=n,this.fpsController=r,this.sceneCenter=i,this.projection=a;let[o,s,c]=F(I(M,`background`,[]).color);this.backgroundClearColor={r:o,g:s,b:c,a:1};let l=I(M,`vertex`,[`preview`]);this.vertexPreviewStyle={markerType:l.markerType===`circle`?1:0,size:l.size,color:F(l.color),alpha:l.alpha,strokeColor:F(l.strokeColor),strokeWidth:l.strokeWidth}}init(e){this.device=e.device,this.format=e.format;let t=Se(this.topology);this.faceVertexCount=t.faceVertexCount,this.faceVertexBuffer=this.createAndWriteBuffer(t.facePositions,GPUBufferUsage.VERTEX);let n=this.topology.edges.length*(this.topology.edges.length-1)/2,r=Math.max(1,this.topology.edges.length+n);this.styledLineBuffer=this.device.createBuffer({size:Math.max(J,r*J),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});let i=this.topology.vertices.length+n;this.topologyVertexMarkerBuffer=this.device.createBuffer({size:i*X,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewLineBuffer=this.device.createBuffer({size:J,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewStartMarkerBuffer=this.device.createBuffer({size:X,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.previewSnapMarkerBuffer=this.device.createBuffer({size:X,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.uniformBuffer=this.device.createBuffer({size:Rt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.previewUniformBuffer=this.device.createBuffer({size:Rt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let a=new Float32Array([pe,me]);this.device.queue.writeBuffer(this.uniformBuffer,Ut,a),this.device.queue.writeBuffer(this.previewUniformBuffer,Ut,a);let o=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});this.bindGroup=this.device.createBindGroup({layout:o,entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]});let s=this.device.createPipelineLayout({bindGroupLayouts:[o]});this.depthPrePassPipeline=this.createDepthPrePassPipeline(s),this.depthBindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,texture:{sampleType:`depth`}},{binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,sampler:{type:`non-filtering`}}]}),this.depthSampler=this.device.createSampler({minFilter:`nearest`,magFilter:`nearest`});let c=this.device.createPipelineLayout({bindGroupLayouts:[this.depthBindGroupLayout]});this.hiddenLinePipeline=this.createLinePipeline(c,Nt),this.visibleLinePipeline=this.createLinePipeline(c,Pt),this.previewLinePipeline=this.createPreviewLinePipeline(c),this.hiddenMarkerPipeline=this.createMarkerPipeline(c,Nt),this.visibleMarkerPipeline=this.createMarkerPipeline(c,Pt),this.previewMarkerPipeline=this.createMarkerPipeline(c,Mt)}update(e){this.camera.tick()&&this.fpsController.raise(N.Animation);let t=this.camera.getViewMatrix(),n=this.camera.getDistance(),r=e.canvasWidth/Math.max(K,e.canvasHeight),i=this.projection===`orthographic`?(()=>{let e=n*de,t=e*r;return S.ortho(-t,t,-e,e,A,100)})():S.perspective(k,r,A,100),a=S.multiply(i,t);this.lastMvpMatrix.set(a),this.lastCanvasWidth=e.canvasWidth,this.lastCanvasHeight=e.canvasHeight,this.lastDevicePixelRatio=e.devicePixelRatio;let o=new Float32Array([-t[2],-t[6],-t[10]]);this.device.queue.writeBuffer(this.uniformBuffer,zt,a);let s=new Float32Array([e.canvasWidth,e.canvasHeight]);this.device.queue.writeBuffer(this.uniformBuffer,Bt,s);let c=new Float32Array([e.devicePixelRatio,n]);this.device.queue.writeBuffer(this.uniformBuffer,Vt,c),this.device.queue.writeBuffer(this.uniformBuffer,Ht,o);let l=new Float32Array(this.sceneCenter);this.device.queue.writeBuffer(this.uniformBuffer,Wt,l),this.device.queue.writeBuffer(this.previewUniformBuffer,zt,a),this.device.queue.writeBuffer(this.previewUniformBuffer,Bt,s),this.device.queue.writeBuffer(this.previewUniformBuffer,Vt,c),this.device.queue.writeBuffer(this.previewUniformBuffer,Ht,o),this.device.queue.writeBuffer(this.previewUniformBuffer,Wt,l)}render(e,t,n){let i=this.msaaManager.ensureView(this.device,this.format,n.canvasWidth,n.canvasHeight);if(r(i))return;let a=this.ensureDepthTexture(n.canvasWidth,n.canvasHeight),o=this.ensureSamplingDepthTexture(n.canvasWidth,n.canvasHeight),s=e.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:o,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`store`}});s.setPipeline(this.depthPrePassPipeline),s.setBindGroup(0,this.bindGroup),s.setVertexBuffer(0,this.faceVertexBuffer),s.draw(this.faceVertexCount),s.end();let c=a.createView(),l=e.beginRenderPass({colorAttachments:[{view:i,loadOp:`clear`,clearValue:this.backgroundClearColor,storeOp:`store`}],depthStencilAttachment:{view:c,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});this.styledLineCount>0&&(l.setPipeline(this.hiddenLinePipeline),l.setBindGroup(0,this.lineBindGroup),l.setVertexBuffer(0,this.styledLineBuffer),l.draw(6,this.styledLineCount)),this.topologyVertexCount>0&&(l.setPipeline(this.hiddenMarkerPipeline),l.setBindGroup(0,this.markerBindGroup),l.setVertexBuffer(0,this.topologyVertexMarkerBuffer),l.draw(Z,this.topologyVertexCount)),l.end();let u=e.beginRenderPass({colorAttachments:[{view:i,resolveTarget:t,loadOp:`load`,storeOp:`discard`}],depthStencilAttachment:{view:c,depthClearValue:1,depthLoadOp:`clear`,depthStoreOp:`discard`}});this.styledLineCount>0&&(u.setPipeline(this.visibleLinePipeline),u.setBindGroup(0,this.lineBindGroup),u.setVertexBuffer(0,this.styledLineBuffer),u.draw(6,this.styledLineCount)),this.topologyVertexCount>0&&(u.setPipeline(this.visibleMarkerPipeline),u.setBindGroup(0,this.markerBindGroup),u.setVertexBuffer(0,this.topologyVertexMarkerBuffer),u.draw(Z,this.topologyVertexCount)),this.hasDragPreview&&(u.setPipeline(this.previewLinePipeline),u.setBindGroup(0,this.previewLineBindGroup),u.setVertexBuffer(0,this.previewLineBuffer),u.draw(6,1)),this.hasDragPreview&&(u.setPipeline(this.previewMarkerPipeline),u.setBindGroup(0,this.previewMarkerBindGroup),u.setVertexBuffer(0,this.previewStartMarkerBuffer),u.draw(Z,1)),this.hasSnapTarget&&(u.setPipeline(this.previewMarkerPipeline),u.setBindGroup(0,this.previewMarkerBindGroup),u.setVertexBuffer(0,this.previewSnapMarkerBuffer),u.draw(Z,1)),u.end()}getLastMvpMatrix(){return this.lastMvpMatrix}getPreviewLine(){return this.currentPreviewLine}setDragPreview(e){if(r(e)){this.hasDragPreview=!1,this.hasSnapTarget=!1,this.currentPreviewLine=void 0;return}let t=r(e.snapTargetPosition)?this.unprojectToVertexPlane(e.cursorScreenX,e.cursorScreenY,e.startPosition):e.snapTargetPosition;this.currentPreviewLine={pointA:e.startPosition,pointB:t};let n=I(M,`line`,[`preview`,`segment`]),[i,a,o]=F(n.color),s=new Float32Array(q);s[0]=e.startPosition[0],s[1]=e.startPosition[1],s[2]=e.startPosition[2],s[3]=t[0],s[4]=t[1],s[5]=t[2],s[6]=n.width,s[7]=i,s[8]=a,s[9]=o,s[10]=n.alpha,this.device.queue.writeBuffer(this.previewLineBuffer,0,s),this.hasDragPreview=!0,this.device.queue.writeBuffer(this.previewStartMarkerBuffer,0,this.createPreviewMarkerData(e.startPosition)),r(e.snapTargetPosition)?this.hasSnapTarget=!1:(this.device.queue.writeBuffer(this.previewSnapMarkerBuffer,0,this.createPreviewMarkerData(e.snapTargetPosition)),this.hasSnapTarget=!0)}applySceneState(e){this.applyStyledMarkers(e.markers),this.applyStyledSegments(e.segments)}applyStyledMarkers(e){if(this.topologyVertexCount=e.length,this.topologyVertexCount===0)return;let t=this.topologyVertexCount*X;t>this.topologyVertexMarkerBuffer.size&&(this.topologyVertexMarkerBuffer.destroy(),this.topologyVertexMarkerBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}));let n=new Float32Array(e.length*Y);for(let t=0;t<e.length;t++){let r=e[t],i=t*Y;n[i]=r.position[0],n[i+1]=r.position[1],n[i+2]=r.position[2],n[i+3]=r.markerType,n[i+4]=r.visibleStyle.size,n[i+5]=r.visibleStyle.color[0],n[i+6]=r.visibleStyle.color[1],n[i+7]=r.visibleStyle.color[2],n[i+8]=r.visibleStyle.alpha,n[i+9]=r.visibleStyle.strokeColor[0],n[i+10]=r.visibleStyle.strokeColor[1],n[i+11]=r.visibleStyle.strokeColor[2],n[i+12]=r.visibleStyle.strokeWidth,n[i+13]=r.hiddenStyle.size,n[i+14]=r.hiddenStyle.color[0],n[i+15]=r.hiddenStyle.color[1],n[i+16]=r.hiddenStyle.color[2],n[i+17]=r.hiddenStyle.alpha,n[i+18]=r.hiddenStyle.strokeColor[0],n[i+19]=r.hiddenStyle.strokeColor[1],n[i+20]=r.hiddenStyle.strokeColor[2],n[i+21]=r.hiddenStyle.strokeWidth}this.device.queue.writeBuffer(this.topologyVertexMarkerBuffer,0,n)}applyStyledSegments(e){if(this.styledLineCount=e.length,this.styledLineCount===0)return;let t=this.styledLineCount*J;t>this.styledLineBuffer.size&&(this.styledLineBuffer.destroy(),this.styledLineBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}));let n=new Float32Array(this.styledLineCount*q);for(let t=0;t<this.styledLineCount;t++)Kt(n,t,e[t]);this.device.queue.writeBuffer(this.styledLineBuffer,0,n)}dispose(){this.uniformBuffer.destroy(),this.previewUniformBuffer.destroy(),this.faceVertexBuffer.destroy(),this.styledLineBuffer.destroy(),this.topologyVertexMarkerBuffer.destroy(),this.previewLineBuffer.destroy(),this.previewStartMarkerBuffer.destroy(),this.previewSnapMarkerBuffer.destroy(),this.depthTexture?.destroy(),this.samplingDepthTexture?.destroy()}unprojectToVertexPlane(e,t,n){let r=this.lastCanvasWidth,i=this.lastCanvasHeight,a=this.lastDevicePixelRatio,o=e*a,s=t*a,c=o/r*2-1,l=1-s/i*2,u=x.transformMat4(x.fromValues(n[0],n[1],n[2],1),this.lastMvpMatrix),d=u[2]/u[3],f=S.inverse(this.lastMvpMatrix),p=x.transformMat4(x.fromValues(c,l,d,1),f);return[p[0]/p[3],p[1]/p[3],p[2]/p[3]]}createAndWriteBuffer(e,t){let n=this.device.createBuffer({size:e.byteLength,usage:t|GPUBufferUsage.COPY_DST});return this.device.queue.writeBuffer(n,0,e),n}createLinePipeline(e,t){let n=this.device.createShaderModule({code:At});return this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,buffers:[{arrayStride:J,stepMode:`instance`,attributes:It}]},fragment:{module:n,entryPoint:`fs`,constants:{renderMode:t},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less-equal`,format:G},multisample:{count:4}})}createPreviewLinePipeline(e){let t=this.device.createShaderModule({code:At});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:J,stepMode:`instance`,attributes:It}]},fragment:{module:t,entryPoint:`fs`,constants:{renderMode:Mt},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:G},multisample:{count:4}})}createDepthPrePassPipeline(e){let t=this.device.createShaderModule({code:kt});return this.device.createRenderPipeline({layout:e,vertex:{module:t,entryPoint:`vs`,buffers:[{arrayStride:Lt,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{depthWriteEnabled:!0,depthCompare:`less`,format:G,depthBias:2,depthBiasSlopeScale:1}})}createMarkerPipeline(e,t){let n=this.device.createShaderModule({code:jt});return this.device.createRenderPipeline({layout:e,vertex:{module:n,entryPoint:`vs`,buffers:[{arrayStride:X,stepMode:`instance`,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32`},{shaderLocation:2,offset:16,format:`float32`},{shaderLocation:3,offset:20,format:`float32x3`},{shaderLocation:4,offset:32,format:`float32`},{shaderLocation:5,offset:36,format:`float32x3`},{shaderLocation:6,offset:48,format:`float32`},{shaderLocation:7,offset:52,format:`float32`},{shaderLocation:8,offset:56,format:`float32x3`},{shaderLocation:9,offset:68,format:`float32`},{shaderLocation:10,offset:72,format:`float32x3`},{shaderLocation:11,offset:84,format:`float32`}]}]},fragment:{module:n,entryPoint:`fs`,constants:{renderMode:t},targets:[{format:this.format,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},depthStencil:{depthWriteEnabled:!1,depthCompare:`always`,format:G},multisample:{count:4}})}createPreviewMarkerData(e){let t=new Float32Array(Y),n=this.vertexPreviewStyle;return t[0]=e[0],t[1]=e[1],t[2]=e[2],t[3]=n.markerType,t[4]=n.size,t[5]=n.color[0],t[6]=n.color[1],t[7]=n.color[2],t[8]=n.alpha,t[9]=n.strokeColor[0],t[10]=n.strokeColor[1],t[11]=n.strokeColor[2],t[12]=n.strokeWidth,t[13]=n.size,t[14]=n.color[0],t[15]=n.color[1],t[16]=n.color[2],t[17]=n.alpha,t[18]=n.strokeColor[0],t[19]=n.strokeColor[1],t[20]=n.strokeColor[2],t[21]=n.strokeWidth,t}ensureDepthTexture(e,t){return!r(this.depthTexture)&&this.depthTexture.width===e&&this.depthTexture.height===t?this.depthTexture:(this.depthTexture?.destroy(),this.depthTexture=this.device.createTexture({size:[Math.max(K,e),Math.max(K,t)],format:G,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthTexture)}ensureSamplingDepthTexture(e,t){let n=Math.max(K,e),i=Math.max(K,t);if(!r(this.samplingDepthTexture)&&this.samplingDepthTexture.width===n&&this.samplingDepthTexture.height===i)return this.samplingDepthTexture.createView();this.samplingDepthTexture?.destroy(),this.samplingDepthTexture=this.device.createTexture({size:[n,i],format:G,sampleCount:1,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});let a=this.samplingDepthTexture.createView(),o=e=>[{binding:0,resource:{buffer:e}},{binding:1,resource:a},{binding:2,resource:this.depthSampler}];return this.lineBindGroup=this.device.createBindGroup({layout:this.depthBindGroupLayout,entries:o(this.uniformBuffer)}),this.previewLineBindGroup=this.device.createBindGroup({layout:this.depthBindGroupLayout,entries:o(this.previewUniformBuffer)}),this.markerBindGroup=this.device.createBindGroup({layout:this.depthBindGroupLayout,entries:o(this.uniformBuffer)}),this.previewMarkerBindGroup=this.device.createBindGroup({layout:this.depthBindGroupLayout,entries:o(this.previewUniformBuffer)}),this.samplingDepthTexture.createView()}};function Kt(e,t,n){let r=t*q;e[r]=n.startPosition[0],e[r+1]=n.startPosition[1],e[r+2]=n.startPosition[2],e[r+3]=n.endPosition[0],e[r+4]=n.endPosition[1],e[r+5]=n.endPosition[2],e[r+6]=n.visibleStyle.width,e[r+7]=n.visibleStyle.color[0],e[r+8]=n.visibleStyle.color[1],e[r+9]=n.visibleStyle.color[2],e[r+10]=n.visibleStyle.alpha,e[r+11]=n.visibleStyle.lineType,e[r+12]=n.visibleStyle.dash,e[r+13]=n.visibleStyle.gap,e[r+14]=n.hiddenStyle.width,e[r+15]=n.hiddenStyle.color[0],e[r+16]=n.hiddenStyle.color[1],e[r+17]=n.hiddenStyle.color[2],e[r+18]=n.hiddenStyle.alpha,e[r+19]=n.hiddenStyle.lineType,e[r+20]=n.hiddenStyle.dash,e[r+21]=n.hiddenStyle.gap}var qt={name:`Pentagonal Pyramid`,camera:{center:[0,-.25,0],distance:{min:3,max:10,initial:5},angle:{elevation:Math.PI/2.3,azimuth:Math.PI/30},projection:`perspective`},input:{figures:[{vertices:[[0,-.75,1],[.951057,-.75,.309017],[.587785,-.75,-.809017],[-.587785,-.75,-.809017],[-.951057,-.75,.309017],[0,.75,0]],faces:[[5,0,1],[5,1,2],[5,2,3],[5,3,4],[5,4,0],[0,1,2,3,4]]}]},expected:{}},Jt=2,Yt=1e3,Xt=250;function Zt(e){let{canvas:t,context:n,layerManager:r,fpsController:i,onFpsUpdate:a}=e,{device:o,canvasContext:s}=n,c=0,l=0,u=Math.max(1,window.devicePixelRatio);function d(){u=Math.max(1,window.devicePixelRatio);let e=Math.floor(t.clientWidth*u),n=Math.floor(t.clientHeight*u),r=t.width!==e||t.height!==n;return r&&(t.width=e,t.height=n),c=e,l=n,r}d();let f=new ResizeObserver(()=>{d(),i.raise(N.Resize)});f.observe(t);let p=0,m=!1,h=0,g=performance.now(),_=[],v=0;function y(e){let t=Math.max(Yt,i.getFrameIntervalMs()*3);_.push(e);let n=e-t;for(;_.length>0&&_[0]<n;)_.shift();if(e-v>=Xt){v=e;let t=_.length>1?_[_.length-1]-_[0]:0,n=t>0?Math.round((_.length-1)/t*fe):0;a?.(n)}}function b(e){if(m)return;let t=i.getFrameIntervalMs();if(e-h<t-Jt){p=requestAnimationFrame(b);return}if(h=e,y(e),d(),c===0||l===0){p=requestAnimationFrame(b);return}let n={time:(performance.now()-g)/fe,canvasWidth:c,canvasHeight:l,devicePixelRatio:u};r.updateAll(n);let a=s.getCurrentTexture().createView(),f=o.createCommandEncoder();r.renderAll(f,a,n),o.queue.submit([f.finish()]),p=requestAnimationFrame(b)}return p=requestAnimationFrame(b),()=>{m=!0,cancelAnimationFrame(p),f.disconnect()}}var Qt=1e-10,$t=.001,en=1e-4;function tn(e,t){let n=e.lines.map(e=>({point:e.pointA,direction:b.sub(e.pointB,e.pointA)})),r=[],i=[];function a(e){e!==void 0&&(Oe(e,t.vertices,$t)||Oe(e,i,en)||(r.push({position:e}),i.push(e)))}for(let e=0;e<n.length;e++){for(let t=e+1;t<n.length;t++)a(nn(n[e],n[t]));for(let r=0;r<t.edges.length;r++)a(rn(n[e],an(r,t)))}return r}function nn(e,t){return on(e.point,e.direction,t.point,t.direction)?.midpoint}function rn(e,t){let n=on(e.point,e.direction,t.point,t.direction);if(!(n===void 0||n.parameterB<0||n.parameterB>1))return n.midpoint}function an(e,t){let[n,r]=t.edges[e],i=t.vertices[n],a=t.vertices[r];return{point:i,direction:b.sub(a,i)}}function on(e,t,n,r){let i=b.dot(t,t),a=b.dot(t,r),o=b.dot(r,r),s=i*o-a*a;if(Math.abs(s)<Qt)return;let c=b.sub(e,n),l=b.dot(t,c),u=b.dot(r,c),d=(a*u-o*l)/s,f=(i*u-a*l)/s,p=[e[0]+d*t[0],e[1]+d*t[1],e[2]+d*t[2]],m=[n[0]+f*r[0],n[1]+f*r[1],n[2]+f*r[2]];if(!(b.distSq(p,m)>.01**2))return{midpoint:[(p[0]+m[0])*.5,(p[1]+m[1])*.5,(p[2]+m[2])*.5],parameterB:f}}var sn=1e-4,cn=1e-8;function ln(e){return{vertices:e.vertices.map((e,t)=>({position:e,topologyIndex:t})),lines:[],intersections:[]}}function un(e,t,n){let[r,i]=n.edges[t],a=n.vertices[r],o=n.vertices[i],s=gn(e.lines,a,o);if(s!==void 0){let t=e.lines.filter((e,t)=>t!==s);return pn({...e,lines:t},n)}let c={pointA:a,pointB:o};return pn({...e,lines:[...e.lines,c]},n)}function dn(e,t,n,r){let i=hn(t,n,r);if(i!==void 0)return un(e,i,r);if(gn(e.lines,t,n)!==void 0)return e;let a={pointA:t,pointB:n};return pn({...e,lines:[...e.lines,a]},r)}function fn(e,t,n){return pn({...e,lines:e.lines.filter((e,n)=>n!==t)},n)}function pn(e,t){let n={...e,intersections:[]},r=tn(n,t);return{...n,intersections:r,vertices:mn(t,r)}}function mn(e,t){let n=e.vertices.map((e,t)=>({position:e,topologyIndex:t})),r=t.map(e=>({position:e.position,topologyIndex:void 0}));return[...n,...r]}function hn(e,t,n){for(let r=0;r<n.edges.length;r++){let[i,a]=n.edges[r],o=n.vertices[i],s=n.vertices[a];if(vn(e,t,o,s))return r}}function gn(e,t,n){for(let r=0;r<e.length;r++){let i=e[r];if(_n(i.pointA,i.pointB,t,n))return r}}function _n(e,t,n,r){if(vn(e,t,n,r))return!0;let i=b.sub(t,e),a=b.len(i);if(a===0)return!1;let o=[i[0]/a,i[1]/a,i[2]/a],s=b.sub(r,n),c=b.len(s);if(c===0)return!1;let l=[s[0]/c,s[1]/c,s[2]/c],u=b.cross(o,l);if(b.len(u)>cn)return!1;let d=b.sub(n,e),f=b.cross(o,d);return b.len(f)<cn}function vn(e,t,n,r){let i=yn(e,n)&&yn(t,r),a=yn(e,r)&&yn(t,n);return i||a}function yn(e,t){return b.distSq(e,t)<sn}function bn(e){let t=!1,n,{topology:r}=be(qt),i=he(e,qt.camera),a=new ye,o,s=ln(r),c=W,l,u=pt(),d=new Set,f=new Set;function p(){for(let e of d)e(u.canUndo(),u.canRedo())}function m(e){let t=Ve(r,e,c,l);o?.applySceneState(t)}function h(e){u.push(s),s=e,m(s),p()}function g(){if(!(t||!o))return{canvasWidth:e.clientWidth,canvasHeight:e.clientHeight,devicePixelRatio:Math.max(1,window.devicePixelRatio),mvpMatrix:o.getLastMvpMatrix()}}function _(e,t){let n=g();return n===void 0?W:mt(e,t,n.canvasWidth,n.canvasHeight,n.devicePixelRatio,n.mvpMatrix,r.edges,r.vertices,s.lines)}function v(e,t){let n=g();if(n===void 0)return;let r=s.vertices.map(e=>e.position),i=ht(e,t,n.canvasWidth,n.canvasHeight,n.devicePixelRatio,n.mvpMatrix,r);if(i!==void 0)return r[i]}function y(e){c=e,m(s)}function x(){switch(c.type){case`edge`:{let[e,t]=r.edges[c.edgeIndex];return b.sub(r.vertices[t],r.vertices[e])}case`line`:{let e=s.lines[c.lineIndex];return b.sub(e.pointB,e.pointA)}case`none`:return}}function S(e,t){y(_(e,t))}function ee(e,t){let n=_(e,t);n.type===`edge`?(c=W,h(un(s,n.edgeIndex,r))):n.type===`line`&&(c=W,h(fn(s,n.lineIndex,r)))}function C(){a.raise(N.Interaction)}e.addEventListener(`pointerdown`,C),e.addEventListener(`pointermove`,C),e.addEventListener(`wheel`,C);let w=ge(e,S,ee),T=_e(e,{performPointHitTest:v,onDragStart:()=>{},onDragUpdate:e=>{o?.setDragPreview(e),l=o?.getPreviewLine(),m(s)},onVertexTap:e=>{let t=x();if(t!==void 0){let n=[e[0]+t[0],e[1]+t[1],e[2]+t[2]];h(dn(s,e,n,r))}y(W)},onDragComplete:(e,t)=>{h(dn(s,e,t,r)),y(W)}});xn(e,i,r,a,e=>{for(let t of f)t(e)}).then(({cleanup:e,sceneLayer:r})=>{t?e():(n=e,o=r,m(s))});function E(e){e!==void 0&&(s=e,m(s),y(W),p())}return{destroy:()=>{t=!0,i.destroy(),a.dispose(),e.removeEventListener(`pointerdown`,C),e.removeEventListener(`pointermove`,C),e.removeEventListener(`wheel`,C),w(),T(),d.clear(),f.clear(),n?.()},camera:i,undo:()=>E(u.undo(s)),redo:()=>E(u.redo(s)),subscribeHistory:e=>(d.add(e),e(u.canUndo(),u.canRedo()),()=>d.delete(e)),subscribeFps:e=>(f.add(e),()=>f.delete(e))}}async function xn(e,t,n,r,i){let a=await v(e),o=ee(4),s=new Gt(t,o,n,r,qt.camera?.center??[0,0,0],qt.camera?.projection??`perspective`),c=new y([s]);c.initAll(a);let l=Zt({canvas:e,context:a,layerManager:c,fpsController:r,onFpsUpdate:i});return{cleanup:()=>{l(),c.dispose(),o.dispose(),a.device.destroy()},sceneLayer:s}}var Q=i({en:{toolbar:{undo:`Undo`,redo:`Redo`,rotate:`Rotate`,pan:`Pan`,help:`Help`,close:`Close`},help:{title:`Stereometry`,description:`Interactive 3D geometry game — construct auxiliary lines, find intersection points of lines and faces, and build cross-sections of solids.`,controls:{drag:`rotate the camera`,shiftDrag:`pan the view`,scrollPinch:`zoom in and out`,clickEdge:`select it`,doubleClickEdge:`extend edge into an infinite line (or remove it)`,doubleClickLine:`remove the line`,dragVertex:`draw a construction line between two points`,selectEdgeTapVertex:`draw a parallel line through that vertex`},controlLabels:{drag:`Drag`,shiftDrag:`Shift+Drag`,scrollPinch:`Scroll / Pinch`,clickEdge:`Click edge/line`,doubleClickEdge:`Double-click edge`,doubleClickLine:`Double-click line`,dragVertex:`Drag vertex → vertex`,selectEdgeTapVertex:`Select edge/line + tap vertex`},intersectionHint:`Intersection points appear automatically where lines cross.`}},ru:{toolbar:{undo:`Отменить`,redo:`Повторить`,rotate:`Вращение`,pan:`Перемещение`,help:`Справка`,close:`Закрыть`},help:{title:`Стереометрия`,description:`Интерактивная 3D-игра по стереометрии — стройте вспомогательные линии, находите точки пересечения прямых и граней, выполняйте сечения фигур.`,controls:{drag:`вращение камеры`,shiftDrag:`перемещение вида`,scrollPinch:`приближение и отдаление`,clickEdge:`выделить ребро`,doubleClickEdge:`продлить ребро в бесконечную прямую (или убрать)`,doubleClickLine:`удалить линию`,dragVertex:`провести вспомогательную линию между двумя точками`,selectEdgeTapVertex:`провести параллельную прямую через эту вершину`},controlLabels:{drag:`Перетаскивание`,shiftDrag:`Shift+Перетаскивание`,scrollPinch:`Прокрутка / Щипок`,clickEdge:`Клик по ребру/линии`,doubleClickEdge:`Двойной клик по ребру`,doubleClickLine:`Двойной клик по линии`,dragVertex:`Перетащить вершину → вершину`,selectEdgeTapVertex:`Выделить ребро + нажать на вершину`},intersectionHint:`Точки пересечения появляются автоматически при пересечении линий.`}}}),Sn=a(),$=20,Cn=14,wn=(0,D.memo)(()=>{let e=(0,D.useRef)(null),t=(0,D.useRef)(null),[n,r]=(0,D.useState)(`rotate`),[i,a]=(0,D.useState)(!1),[o,c]=(0,D.useState)(!1),[l,u]=(0,D.useState)(0);(0,D.useEffect)(()=>{if(e.current){let n=bn(e.current);t.current=n;let r=n.subscribeHistory((e,t)=>{a(e),c(t)}),i=n.subscribeFps(u);return()=>{t.current=null,r(),i(),n.destroy()}}},[]);let d=s(()=>{r(`rotate`),t.current?.camera.setInteractionMode(`rotate`)}),f=s(()=>{r(`pan`),t.current?.camera.setInteractionMode(`pan`)}),p=s(()=>{t.current?.undo()}),m=s(()=>{t.current?.redo()});return(0,O.jsx)(C,{className:w.fixedContainer,children:(0,O.jsxs)(`div`,{className:w.fixedContainer,children:[(0,O.jsx)(`canvas`,{ref:e,className:`h-full w-full [touch-action:none]`}),!Sn&&(0,O.jsxs)(`div`,{className:`absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-neutral-400`,children:[l,` FPS`]}),(0,O.jsxs)(`div`,{className:`fixed right-4 bottom-4 flex gap-2`,children:[(0,O.jsx)(En,{}),(0,O.jsx)(Tn,{onClick:p,label:Q.toolbar.undo,disabled:!i,children:(0,O.jsx)(_,{size:$})}),(0,O.jsx)(Tn,{onClick:m,label:Q.toolbar.redo,disabled:!o,children:(0,O.jsx)(E,{size:$})}),(0,O.jsx)(Tn,{active:n===`rotate`,onClick:d,label:Q.toolbar.rotate,children:(0,O.jsx)(te,{size:$})}),(0,O.jsx)(Tn,{active:n===`pan`,onClick:f,label:Q.toolbar.pan,children:(0,O.jsx)(T,{size:$})})]})]})})}),Tn=(0,D.memo)(({active:e=!1,disabled:t=!1,onClick:n,children:r,label:i})=>(0,O.jsx)(`button`,{type:`button`,onClick:n,disabled:t,"aria-label":i,"aria-pressed":e,className:g(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all`,t?`bg-neutral-900 text-neutral-600 cursor-not-allowed`:`hover:scale-110 active:scale-95`,!t&&e&&`bg-blue-500 text-white`,!t&&!e&&`bg-neutral-800 text-neutral-400 hover:text-white`),children:r})),En=(0,D.memo)(()=>{let[e,t]=(0,D.useState)(!1);return(0,O.jsxs)(o,{open:e,onOpenChange:t,children:[(0,O.jsx)(f,{asChild:!0,children:(0,O.jsx)(`button`,{type:`button`,"aria-label":Q.toolbar.help,className:g(`flex size-10 items-center justify-center rounded-lg shadow-lg`,`transition-all hover:scale-110 active:scale-95`,e?`bg-blue-500 text-white scale-110`:`bg-neutral-800 text-neutral-400 hover:text-white`),children:(0,O.jsx)(h,{size:$})})}),(0,O.jsx)(c,{children:(0,O.jsxs)(l,{side:`top`,sideOffset:8,align:`end`,className:g(`z-50 w-72 rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl`,`border border-neutral-700`,`data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,`data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`),children:[(0,O.jsxs)(`div`,{className:`mb-2 flex items-center justify-between`,children:[(0,O.jsx)(`span`,{className:`font-semibold text-white`,children:Q.help.title}),(0,O.jsx)(u,{"aria-label":Q.toolbar.close,className:`text-neutral-500 hover:text-white transition-colors`,children:(0,O.jsx)(m,{size:Cn})})]}),(0,O.jsx)(`p`,{className:`mb-3 text-neutral-400`,children:Q.help.description}),(0,O.jsxs)(`ul`,{className:`space-y-1.5 text-neutral-300`,children:[(0,O.jsxs)(`li`,{children:[(0,O.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.drag}),` —`,` `,Q.help.controls.drag]}),(0,O.jsxs)(`li`,{children:[(0,O.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.shiftDrag}),` `,`— `,Q.help.controls.shiftDrag]}),(0,O.jsxs)(`li`,{children:[(0,O.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.scrollPinch}),` `,`— `,Q.help.controls.scrollPinch]}),(0,O.jsxs)(`li`,{children:[(0,O.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.clickEdge}),` `,`— `,Q.help.controls.clickEdge]}),(0,O.jsxs)(`li`,{children:[(0,O.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.doubleClickEdge}),` `,`— `,Q.help.controls.doubleClickEdge]}),(0,O.jsxs)(`li`,{children:[(0,O.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.doubleClickLine}),` `,`— `,Q.help.controls.doubleClickLine]}),(0,O.jsxs)(`li`,{children:[(0,O.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.dragVertex}),` `,`— `,Q.help.controls.dragVertex]}),(0,O.jsxs)(`li`,{children:[(0,O.jsx)(`strong`,{className:`text-neutral-100`,children:Q.help.controlLabels.selectEdgeTapVertex}),` `,`— `,Q.help.controls.selectEdgeTapVertex]})]}),(0,O.jsx)(`p`,{className:`mt-3 text-xs text-neutral-500`,children:Q.help.intersectionHint}),(0,O.jsx)(d,{className:`fill-neutral-900`})]})})]})});export{wn as Stereometry};