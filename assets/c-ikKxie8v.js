import{A as e,G as t,H as n,K as r,W as i,a,bt as o,ft as s,i as c,k as l,lt as u,mt as d,pt as f,q as p,s as m,t as h,ut as g}from"./c-lahOAW2I.js";import{A as _,C as v,D as y,M as b,O as x,S,_ as ee,a as te,b as ne,c as re,d as ie,f as ae,g as oe,h as C,i as se,j as ce,k as le,l as w,m as ue,n as de,o as fe,p as T,r as pe,s as me,t as he,u as E,v as ge,w as D,x as _e,y as O}from"./c-D2KXPfnT.js";import{D as ve,O as ye,T as be,b as k,d as A,k as xe}from"./c-Dc6GhsSi.js";import{n as Se,o as Ce,r as we,s as j}from"./e-CSMH3PbX.js";import{t as Te}from"./c-rc86jWN7.js";import{t as Ee}from"./c-BdIG0Mup.js";import{n as De,t as Oe}from"./c-HliAEYt9.js";var ke=`[object String]`;function Ae(e){return typeof e==`string`||!g(e)&&f(e)&&d(e)==ke}var je=4294967294,Me=Math.floor,Ne=Math.min;function Pe(e,t,n,r){var i=0,a=e==null?0:e.length;if(a===0)return 0;t=n(t);for(var o=t!==t,c=t===null,l=s(t),u=t===void 0;i<a;){var d=Me((i+a)/2),f=n(e[d]),p=f!==void 0,m=f===null,h=f===f,g=s(f);if(o)var _=r||h;else _=u?h&&(r||p):c?h&&p&&(r||!m):l?h&&p&&!m&&(r||!g):m||g?!1:r?f<=t:f<t;_?i=d+1:a=d}return Ne(a,je)}function Fe(e,t,n){return Pe(e,t,ce(n,2))}function M(e,t){var n=_(e)?e:function(){return e},r=function(e){return e.error(n())};return new D(t?function(e){return t.schedule(r,0,e)}:r)}var Ie=le(function(e){return function(t){t===void 0&&(t=null),e(this),this.message=`Timeout has occurred`,this.name=`TimeoutError`,this.info=t}});function Le(e,t){var n=ie(e)?{first:e}:typeof e==`number`?{each:e}:e,r=n.first,i=n.each,a=n.with,o=a===void 0?Re:a,s=n.scheduler,c=s===void 0?t??ge:s,l=n.meta,u=l===void 0?null:l;if(r==null&&i==null)throw TypeError(`No timeout provided.`);return v(function(e,t){var n,a,s=null,l=0,d=function(e){a=ue(t,c,function(){try{n.unsubscribe(),C(o({meta:u,lastValue:s,seen:l})).subscribe(t)}catch(e){t.error(e)}},e)};n=e.subscribe(S(t,function(e){a?.unsubscribe(),l++,t.next(s=e),i>0&&d(i)},void 0,void 0,function(){a?.closed||a?.unsubscribe(),s=null})),!l&&d(r==null?i:typeof r==`number`?r:+r-c.now())})}function Re(e){throw new Ie(e)}var ze=Array.isArray;function Be(e,t){return ze(t)?e.apply(void 0,xe([],ve(t))):e(t)}function Ve(e){return E(function(t){return Be(e,t)})}function He(){return re(1)}function N(){var e=[...arguments];return He()(T(e,ee(e)))}function P(e){return new D(function(t){C(e()).subscribe(t)})}var Ue=[`addListener`,`removeListener`],We=[`addEventListener`,`removeEventListener`],Ge=[`on`,`off`];function F(e,t,n,r){if(_(n)&&(r=n,n=void 0),r)return F(e,t,n).pipe(Ve(r));var i=ve(Ye(e)?We.map(function(r){return function(i){return e[r](t,i,n)}}):qe(e)?Ue.map(Ke(e,t)):Je(e)?Ge.map(Ke(e,t)):[],2),a=i[0],o=i[1];if(!a&&oe(e))return w(function(e){return F(e,t,n)})(C(e));if(!a)throw TypeError(`Invalid event target`);return new D(function(e){var t=function(){var t=[...arguments];return e.next(1<t.length?t:t[0])};return a(t),function(){return o(t)}})}function Ke(e,t){return function(n){return function(r){return e[n](t,r)}}}function qe(e){return _(e.addListener)&&_(e.removeListener)}function Je(e){return _(e.on)&&_(e.off)}function Ye(e){return _(e.addEventListener)&&_(e.removeEventListener)}function Xe(e,t,n,r,i){return function(a,o){var s=n,c=t,l=0;a.subscribe(S(o,function(t){var n=l++;c=s?e(c,t,n):(s=!0,t),r&&o.next(c)},i&&(function(){s&&o.next(c),o.complete()})))}}function Ze(e,t){return _(t)?w(e,t,1):w(e,1)}function Qe(){var e=[...arguments];return function(t){return N(t,ae.apply(void 0,xe([],ve(e))))}}function $e(e){return v(function(t,n){try{t.subscribe(n)}finally{n.add(e)}})}function et(e,t){return v(Xe(e,t,arguments.length>=2,!0))}var I=o(r(),1),tt=16384,nt=8192,rt=1024,it=.02,at=.18,ot=.95,st=1e3,ct=.1,lt=.2,ut=1e3,dt=.45,ft=.35,pt=.2,mt=1024,ht=`#ccc`,L=`#aaa`,gt=`#444`,_t=`monospace`,vt=`#141414`,yt=`#2a2a2a`,bt=`rgba(46, 160, 67, 0.55)`,xt=`rgba(229, 57, 53, 0.55)`,St=2048,Ct=4e4,wt=[.08,.5,.18,1],Tt=[.6,.12,.12,1],Et=[0,0,0,1],Dt=`rgba(230, 230, 230, 0.7)`,Ot=[4,4],kt=`#404a63`,At=`#ffffff`;function jt(e,t,n){let r=t*n;return Math.floor(e/r)*r}function R(e,t,n){return e+(t-e)*n}function z(e){return Math.max(1,e-150)}function Mt(e,t){return Math.max(1,e-150*t)}function Nt(e){return e>=16384?{textureWidth:tt,rowsPerBlock:1,snapshotsPerRow:128}:{textureWidth:nt,rowsPerBlock:2,snapshotsPerRow:64}}var Pt=60*1e3,Ft=3,It=1,Lt=4,Rt=80,zt=2,Bt=2,Vt=2,Ht=`rgba(26, 26, 26, 0.85)`,B=3,V=2,H=[1e3,2*1e3,5*1e3,10*1e3,15*1e3,30*1e3,60*1e3,120*1e3,300*1e3,600*1e3,900*1e3,1800*1e3,3600*1e3];function Ut(e,t){let n=e/Math.max(zt,Math.floor(t/Rt));for(let e of H)if(e>=n)return e;return H[H.length-1]}function Wt(e){let t=new Date(e);return`${t.getUTCHours().toString().padStart(Vt,`0`)}:${t.getUTCMinutes().toString().padStart(Vt,`0`)}:${t.getUTCSeconds().toString().padStart(Vt,`0`)}`}function Gt(e){return e>=1?0:Math.min(8,Math.ceil(-Math.log10(e)))}function Kt(e){let t=e.canvasWidthPx/e.devicePixelRatio,n=e.canvasHeightPx/e.devicePixelRatio;return{left:0,right:z(t),top:0,bottom:n}}function qt(e){let t=e.canvasWidthPx/e.devicePixelRatio,n=e.canvasHeightPx/e.devicePixelRatio;return{left:z(t),right:t,top:0,bottom:n}}function U(e,t,n,r){let i=r-n;if(i<=0)return t.bottom;let a=t.bottom-t.top,o=(e-n)/i;return t.bottom-o*a}function Jt(e){let{ctx:t,devicePixelRatio:n}=e;t.save(),t.scale(n,n);let r=Kt(e);t.strokeStyle=gt,t.lineWidth=1,Xt(t,r,e),Zt(t,r,e),t.restore()}function Yt(e){let{ctx:t,devicePixelRatio:n}=e;t.save(),t.scale(n,n);let r=Kt(e),i=qt(e);t.font=`11px ${_t}`,t.strokeStyle=L,t.lineWidth=1,Qt(t,r,e),$t(t,i,e),an(t,r,i,e),t.restore()}function Xt(e,t,n){let{viewTimeStartMs:r,viewTimeEndMs:i}=n,a=t.right-t.left,o=i-r;if(o<=0||a<=0)return;let s=Ut(o,a),c=Math.ceil(r/s)*s;for(let n=c;n<=i;n+=s){let i=(n-r)/o,s=t.left+i*a;e.lineWidth=n%Pt===0?Ft:It,e.beginPath(),e.moveTo(s,t.top),e.lineTo(s,t.bottom),e.stroke()}e.lineWidth=It}function Zt(e,t,n){let{priceMin:r,priceMax:i,priceStep:a}=n;if(i-r<=0||a<=0)return;let o=Math.ceil((r+a/2)/a)*a;for(let n=o;n<=i+a/2;n+=a){let o=U(n-a/2,t,r,i);e.beginPath(),e.moveTo(t.left,o),e.lineTo(t.right,o),e.stroke()}}function Qt(e,t,n){let{viewTimeStartMs:r,viewTimeEndMs:i}=n,a=t.right-t.left,o=i-r;if(o<=0||a<=0)return;e.beginPath(),e.moveTo(t.left,t.bottom),e.lineTo(t.right,t.bottom),e.stroke(),e.textAlign=`center`,e.textBaseline=`bottom`;let s=Ut(o,a),c=Math.ceil(r/s)*s,l=t.bottom-Lt-V;for(let n=c;n<=i;n+=s){let i=(n-r)/o,s=t.left+i*a;e.strokeStyle=L,e.beginPath(),e.moveTo(s,t.bottom),e.lineTo(s,t.bottom-Lt),e.stroke();let c=Wt(n),u=e.measureText(c);e.fillStyle=Ht,e.fillRect(s-u.width/2-B,l-11-V,u.width+2*B,11+2*V),e.fillStyle=ht,e.fillText(c,s,l)}}function $t(e,t,n){let{priceMin:r,priceMax:i,priceStep:a}=n,o=t.bottom-t.top,s=t.right-t.left,c=i-r;if(o<=0||s<=0||c<=0||a<=0)return;e.fillStyle=vt,e.fillRect(t.left,t.top,s,o),e.strokeStyle=L,e.lineWidth=1,e.beginPath(),e.moveTo(t.left+.5,t.top),e.lineTo(t.left+.5,t.bottom),e.stroke();let l=a/c*o,u=11+2*V,d=l>=u?1:Math.max(1,Math.ceil(u/l)),f=Math.ceil(r/a)*a,p=Math.max(Bt,Gt(a));e.textAlign=`right`,e.textBaseline=`middle`;let m=i.toFixed(p),h=e.measureText(m).width,g=t.left+B+h,_=11+2*V;rn(e,t,n,g+B);let v=0;for(let n=f;n<=i;n+=a,v++){let o=U(n+a/2,t,r,i),s=U(n-a/2,t,r,i);if(e.strokeStyle=yt,e.beginPath(),e.moveTo(t.left,Math.round(o)+.5),e.lineTo(t.right,Math.round(o)+.5),e.stroke(),v%d!==0)continue;let c=(o+s)/2;c<t.top+_/2||c>t.bottom-_/2||(e.fillStyle=ht,e.fillText(n.toFixed(p),g,c))}}function en(e){return e>=1e6?`${(e/1e6).toFixed(3)}M`:e>=1e3?`${(e/1e3).toFixed(3)}K`:e.toFixed(2)}var tn=`#ffffff`,nn=3;function rn(e,t,n,r){let{lastSnapshot:i,priceMin:a,priceMax:o,priceStep:s}=n;if(i===void 0)return;let c=t.bottom-t.top,l=o-a;if(c<=0||l<=0||s<=0)return;let u=[],d=0;for(let[e,t]of i.bids)t>0&&e>=a&&e<=o&&(u.push({price:e,volume:t,side:`bid`}),t>d&&(d=t));for(let[e,t]of i.asks)t>0&&e>=a&&e<=o&&(u.push({price:e,volume:t,side:`ask`}),t>d&&(d=t));if(u.length===0||d<=0)return;let f=t.right-4,p=Math.max(0,f-r);if(p<=0)return;let m=s/l*c,h=Math.max(2,m>3?m-1:m),g=m>=13;e.save(),e.textAlign=`right`,e.textBaseline=`middle`;for(let n of u){let r=n.volume/d,i=Math.max(2,r*p),s=U(n.price,t,a,o),c=s-h/2;e.fillStyle=n.side===`bid`?bt:xt,e.fillRect(f-i,c,i,h),g&&(e.fillStyle=tn,e.fillText(en(n.volume),f-nn,s))}e.restore()}function an(e,t,n,r){let{cursorCss:i,viewTimeStartMs:a,viewTimeEndMs:o,priceMin:s,priceMax:c,priceStep:l}=r;if(i===void 0)return;let u=t.right-t.left,d=t.bottom-t.top,f=o-a,p=c-s;if(u<=0||d<=0||f<=0||p<=0||i.y<t.top||i.y>t.bottom)return;let m=i.x>=t.left&&i.x<=t.right;if(e.save(),e.lineWidth=1,e.strokeStyle=Dt,e.setLineDash([...Ot]),e.beginPath(),e.moveTo(t.left,i.y),e.lineTo(n.left,i.y),e.stroke(),m&&(e.beginPath(),e.moveTo(i.x,t.top),e.lineTo(i.x,t.bottom),e.stroke()),e.setLineDash([]),e.font=`11px ${_t}`,m){let n=a+(i.x-t.left)/u*f,r=Math.floor(n/1e3)*1e3;on(e,t,i.x,Wt(r))}let h=c-(i.y-t.top)/d*p,g=Math.max(Bt,Gt(l));sn(e,n,i.y,h,c,g),e.restore()}function on(e,t,n,r){let i=e.measureText(r).width+2*B,a=11+2*V,o=n-i/2,s=Math.max(t.left,Math.min(t.right-i,o)),c=t.bottom-a;e.fillStyle=kt,e.fillRect(s,c,i,a),e.fillStyle=At,e.textAlign=`center`,e.textBaseline=`middle`,e.fillText(r,s+i/2,c+a/2)}function sn(e,t,n,r,i,a){let o=r.toFixed(a),s=t.right-t.left,c=11+2*V,l=n-c/2,u=Math.max(t.top,Math.min(t.bottom-c,l));e.fillStyle=kt,e.fillRect(t.left,u,s,c),e.textAlign=`right`,e.textBaseline=`middle`;let d=i.toFixed(a),f=e.measureText(d).width,p=t.left+B+f;e.fillStyle=At,e.fillText(o,p,u+c/2)}var cn=9,ln=class{tree=new De(cn);byId=new Map;upsert(e){let t=this.byId.get(e.blockId);t!==void 0&&this.tree.remove(t),this.byId.set(e.blockId,e),this.tree.insert(e)}searchRange(e,t){return this.tree.search({minX:e,maxX:t,minY:0,maxY:0}).slice().sort((e,t)=>e.minX-t.minX)}remove(e){let t=this.byId.get(e);t!==void 0&&(this.tree.remove(t),this.byId.delete(e))}get(e){return this.byId.get(e)}oldestStartMs(){let e;for(let t of this.byId.values())(e===void 0||t.minX<e)&&(e=t.minX);return e}all(){return Array.from(this.byId.values())}clear(){this.tree.clear(),this.byId.clear()}get size(){return this.byId.size}},un=class{items=[];upsert(e){let t=this.findIndex(e.blockId);if(t>=0){let n=this.items[t];n.lastTimestampMs=e.lastTimestampMs,n.count=e.count,n.textureRowIndex=e.textureRowIndex;return}let n=Fe(this.items,e,e=>e.firstTimestampMs);this.items.splice(n,0,e)}searchRange(e,t){let n=[];for(let r of this.items)r.lastTimestampMs<e||r.firstTimestampMs>t||n.push(r);return n}get(e){let t=this.findIndex(e);return t>=0?this.items[t]:void 0}remove(e){let t=this.findIndex(e);t>=0&&this.items.splice(t,1)}oldestStartMs(){return this.items.length>0?this.items[0].firstTimestampMs:void 0}all(){return this.items}clear(){this.items.length=0}get size(){return this.items.length}findIndex(e){for(let t=0;t<this.items.length;t++)if(this.items[t].blockId===e)return t;return-1}};function dn(e,t){return{uniformsBuffer:e.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`heatmap.uniforms`}),descriptorsBuffer:e.createBuffer({size:16*Math.max(t,1),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST,label:`heatmap.descriptors`})}}function fn(e){return e.createBindGroupLayout({label:`heatmap.bindGroupLayout`,entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]})}function pn(e,t,n,r){return e.createBindGroup({label:`heatmap.bindGroup`,layout:t,entries:[{binding:0,resource:{buffer:n.uniformsBuffer}},{binding:1,resource:r},{binding:2,resource:{buffer:n.descriptorsBuffer}}]})}function mn(e){let{device:t,module:n,layout:r,format:i,layoutConfig:a}=e;return{label:`heatmap.pipeline`,layout:t.createPipelineLayout({bindGroupLayouts:[r]}),vertex:{module:n,entryPoint:`vsHeatmap`,constants:{SNAPSHOT_SLOTS:128,SNAPSHOTS_PER_ROW:a.snapshotsPerRow,ROWS_PER_BLOCK:a.rowsPerBlock}},fragment:{module:n,entryPoint:`fsHeatmap`,constants:{STRIPE_PERIOD_PX:8,STRIPE_DARK_FACTOR:dt,CELL_ALPHA_LOW:ft},targets:[{format:i,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},multisample:{count:4}}}function hn(e,t,n){let r=new ArrayBuffer(64),i=new Float32Array(r),a=new Uint32Array(r);i[0]=n.canvasWidth,i[1]=n.canvasHeight,i[2]=n.viewTimeStartDeltaMs,i[3]=n.viewTimeEndDeltaMs,i[4]=n.timeStepMs,i[5]=n.priceStep,i[6]=n.priceMin,i[7]=n.priceMax,i[8]=n.magnitudeMin,i[9]=n.magnitudeMax,a[10]=n.blockCount,i[11]=n.plotWidthPx,e.queue.writeBuffer(t,0,r)}function gn(e,t,n,r){if(i(n.length>0?t.size>=16*n.length:!0,`descriptors buffer too small for visible blocks`),n.length===0)return{totalCells:0,totalInstances:0};let a=16*n.length,o=new ArrayBuffer(a),s=new Uint32Array(o),c=new Float32Array(o),l=0;for(let e=0;e<n.length;e++){let t=n[e],i=t.meta.count*128,a=e*4;s[a+0]=t.textureRowIndex,s[a+1]=t.meta.count,s[a+2]=l,c[a+3]=t.meta.firstTimestampMs-r,l+=i}return e.queue.writeBuffer(t,0,o),{totalCells:l,totalInstances:l}}function _n(e,t){return{uniformsBuffer:e.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`mid-price.uniforms`}),descriptorsBuffer:e.createBuffer({size:16*Math.max(t,1),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST,label:`mid-price.descriptors`})}}function vn(e){return e.createBindGroupLayout({label:`mid-price.bindGroupLayout`,entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]})}function yn(e,t,n,r){return e.createBindGroup({label:`mid-price.bindGroup`,layout:t,entries:[{binding:0,resource:{buffer:n.uniformsBuffer}},{binding:1,resource:r},{binding:2,resource:{buffer:n.descriptorsBuffer}}]})}function bn(e){let{device:t,module:n,layout:r,format:i,label:a,fragmentEntryPoint:o}=e;return{label:a,layout:t.createPipelineLayout({bindGroupLayouts:[r]}),vertex:{module:n,entryPoint:`vsMidPrice`},fragment:{module:n,entryPoint:o,targets:[{format:i,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`triangle-list`},multisample:{count:4}}}function xn(e){return bn({...e,label:`mid-price.interior.pipeline`,fragmentEntryPoint:`fsMidPriceInterior`})}function Sn(e){return bn({...e,label:`mid-price.outline.pipeline`,fragmentEntryPoint:`fsMidPriceOutline`})}function Cn(e,t,n){let r=new ArrayBuffer(64),i=new Float32Array(r),a=new Uint32Array(r);i[0]=n.canvasWidth,i[1]=n.canvasHeight,i[2]=n.plotWidthPx,i[3]=n.viewTimeStartDeltaMs,i[4]=n.viewTimeEndDeltaMs,i[5]=n.priceMin,i[6]=n.priceMax,i[7]=10,i[8]=10,i[9]=Ct,a[10]=n.blockCount,a[11]=St,i[12]=4,e.queue.writeBuffer(t,0,r)}function wn(e,t,n,r){if(i(n.length>0?t.size>=16*n.length:!0,`mid-price: descriptors buffer too small for visible blocks`),n.length===0)return{totalSamples:0,totalSegments:0};let a=16*n.length,o=new ArrayBuffer(a),s=new Uint32Array(o),c=new Float32Array(o),l=0,u=0;for(let e=0;e<n.length;e++){let t=n[e],i=e*4;s[i+0]=t.textureOffset,s[i+1]=t.item.count,c[i+2]=t.item.firstTimestampMs-r,c[i+3]=t.item.basePrice,l+=t.item.count,t.item.count>=2&&(u+=t.item.count-1)}return e.queue.writeBuffer(t,0,o),{totalSamples:l,totalSegments:u}}var Tn=12,En=`rgba32float`,Dn=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC,On=4;Math.floor(St/256);var kn=class{device;textureWidth;samplesPerBlock;slotsPerRow;maxRows;onEvict;texture;capacityRows;highWaterMark=0;freeSlots=[];lru;blockToSlot=new Map;constructor(e){this.device=e.device,this.textureWidth=e.textureWidth??2048,this.samplesPerBlock=e.samplesPerBlock??256,this.slotsPerRow=Math.floor(this.textureWidth/this.samplesPerBlock),this.capacityRows=e.initialRows??2,this.maxRows=e.maxRows??2,this.onEvict=e.onEvict,this.texture=this.device.createTexture({size:[this.textureWidth,this.capacityRows],format:En,usage:Dn}),this.lru=new Oe({max:this.capacityBlocks})}allocate(e){let t=this.blockToSlot.get(e);if(t!==void 0)return this.lru.get(t),t;let n=this.popFreeSlot()??this.advanceHighWaterMark()??this.growAndAdvance()??this.evictAndReuseSlot();return this.blockToSlot.set(e,n),this.lru.set(n,e),n}touch(e){let t=this.blockToSlot.get(e);t!==void 0&&this.lru.get(t)}release(e){let t=this.blockToSlot.get(e);t!==void 0&&(this.blockToSlot.delete(e),this.lru.delete(t),this.freeSlots.push(t))}writeSamples(e,t,n,r,i){if(n<=0)return;let{column:a,row:o}=this.slotOriginToTexelCoord(e),s=this.textureWidth*On*Float32Array.BYTES_PER_ELEMENT,c=n*On;this.device.queue.writeTexture({texture:this.texture,origin:{x:a+t,y:o,z:0}},r.subarray(i,i+c),{bytesPerRow:s,rowsPerImage:1},{width:n,height:1,depthOrArrayLayers:1})}slotTextureOffset(e){let{row:t,column:n}=this.slotOriginToTexelCoord(e);return t*this.textureWidth+n}createView(){return this.texture.createView()}get currentCapacityBlocks(){return this.capacityBlocks}get currentAllocatedBlocks(){return this.blockToSlot.size}dispose(){this.texture.destroy(),this.lru.clear(),this.blockToSlot.clear(),this.freeSlots.length=0}get capacityBlocks(){return this.capacityRows*this.slotsPerRow}slotOriginToTexelCoord(e){return{row:Math.floor(e/this.slotsPerRow),column:e%this.slotsPerRow*this.samplesPerBlock}}popFreeSlot(){return this.freeSlots.pop()}advanceHighWaterMark(){if(this.highWaterMark>=this.capacityBlocks)return;let e=this.highWaterMark;return this.highWaterMark++,e}growAndAdvance(){if(this.capacityRows>=this.maxRows)return;let e=Math.min(this.capacityRows*2,this.maxRows);this.growTexture(e);let t=this.highWaterMark;return this.highWaterMark++,t}evictAndReuseSlot(){let e=this.lru.rkeys().next().value;if(e===void 0)throw Error(`MidPriceTextureRowManager: cannot evict — LRU empty despite exhausted capacity`);let t=this.lru.get(e);return this.lru.delete(e),t!==void 0&&(this.blockToSlot.delete(t),this.onEvict?.(t)),e}growTexture(e){let t=this.device.createTexture({size:[this.textureWidth,e],format:En,usage:Dn});if(this.highWaterMark>0){let e=Math.min(this.capacityRows,Math.ceil(this.highWaterMark/this.slotsPerRow)),n=this.device.createCommandEncoder({label:`mid-price.texture.grow`});n.copyTextureToTexture({texture:this.texture,origin:{x:0,y:0,z:0}},{texture:t,origin:{x:0,y:0,z:0}},{width:this.textureWidth,height:e,depthOrArrayLayers:1}),this.device.queue.submit([n.finish()])}this.texture.destroy(),this.texture=t,this.capacityRows=e}},An=17,jn=class{available=[];acquire(e,t,n,r){let i=this.available.findIndex(e=>e.width===t&&e.height===n);if(i!==-1){let[e]=this.available.splice(i,1);return e}return e.createTexture({size:[t,n],format:r,usage:An})}release(e){this.available.push(e)}dispose(){for(let e of this.available)e.destroy();this.available.length=0}},Mn=`// Shared WGSL: Heatmap uniforms, block descriptors, data-texture binding
// and tiny helpers for mapping (timeDelta, price) to clip space.
//
// Layout constants are injected via pipeline \`constants\` (WGSL \`override\`)
// so the same shader module works for both 16384- and 8192-wide textures.
//
// Bindings (group 0) — must match createBindGroupLayout in heatmap-layer.ts:
//   0: uniform         HeatmapUniforms
//   1: texture_2d<f32> dataTexture            (rgba32float, unfilterable-float)
//   2: storage(ro)     array<BlockDescriptor>

override SNAPSHOT_SLOTS: u32 = 128u;
override SNAPSHOTS_PER_ROW: u32 = 128u;
override ROWS_PER_BLOCK: u32 = 1u;

// Diagonal stripe overlay used to mark interpolated (repeat-last) cells.
// The period is measured in device pixels so the pattern stays stable
// regardless of zoom; darken factor < 1.0 scales the base heatmap color.
override STRIPE_PERIOD_PX: f32 = 8.0;
override STRIPE_DARK_FACTOR: f32 = 0.45;

// Alpha modulation by magnitude: low-magnitude (green) cells fade into
// the background, high-magnitude (red) cells stay fully opaque.
override CELL_ALPHA_LOW: f32 = 0.35;

struct HeatmapUniforms {
    viewport: vec2<f32>,
    viewTimeStartDeltaMs: f32,
    viewTimeEndDeltaMs: f32,
    timeStepMs: f32,
    priceStep: f32,
    priceMinValue: f32,
    priceMaxValue: f32,
    magnitudeMinValue: f32,
    magnitudeMaxValue: f32,
    blockCount: u32,
    // Width of the plot area in device pixels. \`viewport.x\` covers the
    // full canvas (for pixel→clip mapping); \`plotWidthPx\` excludes the
    // right-hand Y-axis panel so heatmap cells only occupy the plot area.
    plotWidthPx: f32,
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
    _pad4: u32,
};

struct BlockDescriptor {
    textureRowIndex: u32,
    count: u32,
    instanceOffset: u32,
    baseTimeDeltaMs: f32,
};

@group(0) @binding(0) var<uniform> U: HeatmapUniforms;
@group(0) @binding(1) var dataTexture: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> blocks: array<BlockDescriptor>;

fn priceMin() -> f32 { return U.priceMinValue; }
fn priceMax() -> f32 { return U.priceMaxValue; }
fn magnitudeMin() -> f32 { return U.magnitudeMinValue; }
fn magnitudeMax() -> f32 { return U.magnitudeMaxValue; }

struct CellCoord {
    col: u32,
    row: u32,
    snapshotInBlock: u32,
    levelIndex: u32,
};

fn cellCoordFromLocal(blockSlot: u32, localCellIndex: u32) -> CellCoord {
    let snapshotInBlock = localCellIndex / SNAPSHOT_SLOTS;
    let levelIndex = localCellIndex % SNAPSHOT_SLOTS;
    let rowInBlock = snapshotInBlock / SNAPSHOTS_PER_ROW;
    let snapshotColumn = snapshotInBlock % SNAPSHOTS_PER_ROW;
    var coord: CellCoord;
    coord.col = snapshotColumn * SNAPSHOT_SLOTS + levelIndex;
    coord.row = blockSlot * ROWS_PER_BLOCK + rowInBlock;
    coord.snapshotInBlock = snapshotInBlock;
    coord.levelIndex = levelIndex;
    return coord;
}

fn timeDeltaToPixelX(timeDeltaMs: f32) -> f32 {
    let range = U.viewTimeEndDeltaMs - U.viewTimeStartDeltaMs;
    let normalized = (timeDeltaMs - U.viewTimeStartDeltaMs) / range;
    return normalized * U.plotWidthPx;
}

fn priceToPixelY(price: f32) -> f32 {
    let range = priceMax() - priceMin();
    let normalized = (price - priceMin()) / range;
    // Flip so higher prices are at the top of the canvas.
    return (1.0 - normalized) * U.viewport.y;
}

fn pixelToClip(pixel: vec2<f32>) -> vec2<f32> {
    let clip = (pixel / U.viewport) * 2.0 - 1.0;
    // Flip Y so (0,0) is top-left in pixel space.
    return vec2<f32>(clip.x, -clip.y);
}

// Cells tile edge-to-edge without overdraw: the previous 0.5 px
// overlap was safe only while alpha was always 1.0 (opaque neighbour
// covered the seam). With magnitude-driven alpha < 1 the overlap
// strip gets double-blended and shows up as a visible brighter grid
// at every cell boundary. The tiny MSAA sub-pixel transparency at
// exact cell edges is preferable to that double-bright artefact.
fn timeStepHalfPixels() -> f32 {
    let range = U.viewTimeEndDeltaMs - U.viewTimeStartDeltaMs;
    return 0.5 * U.timeStepMs / range * U.plotWidthPx;
}

fn priceStepHalfPixels() -> f32 {
    let range = priceMax() - priceMin();
    return 0.5 * U.priceStep / range * U.viewport.y;
}
`,Nn=`// Heatmap render pipeline: one instance per visible cell, 6 vertices per
// instance (quad). See common.wgsl for uniforms and layout overrides.

const COLOR_LOW: vec3<f32> = vec3<f32>(0.10, 0.80, 0.20);
const COLOR_MID: vec3<f32> = vec3<f32>(1.00, 0.90, 0.10);
const COLOR_HIGH: vec3<f32> = vec3<f32>(0.90, 0.15, 0.15);

const QUAD_OFFSETS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
);

struct VsOut {
    @builtin(position) position: vec4<f32>,
    @location(0) price: f32,
    @location(1) volume: f32,
    @location(2) isInterpolated: f32,
};

fn findBlockSlot(instanceIndex: u32) -> u32 {
    var low: u32 = 0u;
    var high: u32 = U.blockCount;
    if (high == 0u) {
        return 0u;
    }
    loop {
        if (low + 1u >= high) { break; }
        let mid = (low + high) / 2u;
        if (blocks[mid].instanceOffset <= instanceIndex) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return low;
}

@vertex
fn vsHeatmap(
    @builtin(instance_index) iid: u32,
    @builtin(vertex_index) vid: u32,
) -> VsOut {
    var out: VsOut;

    if (U.blockCount == 0u) {
        out.position = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.price = 0.0;
        out.volume = 0.0;
        out.isInterpolated = 0.0;
        return out;
    }

    let blockIdx = findBlockSlot(iid);
    let desc = blocks[blockIdx];
    let localCell = iid - desc.instanceOffset;

    if (localCell >= desc.count * SNAPSHOT_SLOTS) {
        out.position = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.price = 0.0;
        out.volume = 0.0;
        out.isInterpolated = 0.0;
        return out;
    }

    let coord = cellCoordFromLocal(desc.textureRowIndex, localCell);
    let texel = textureLoad(dataTexture, vec2<u32>(coord.col, coord.row), 0);
    let timeDeltaInBlock = texel.x;
    let price = texel.y;
    let volume = texel.z;
    let isInterpolated = texel.w;

    // Skip padding cells (volume==0) by collapsing the quad off-screen.
    if (volume <= 0.0) {
        out.position = vec4<f32>(2.0, 2.0, 0.0, 1.0);
        out.price = 0.0;
        out.volume = 0.0;
        out.isInterpolated = 0.0;
        return out;
    }

    let absTimeDelta = desc.baseTimeDeltaMs + timeDeltaInBlock;
    let centerX = timeDeltaToPixelX(absTimeDelta);
    let centerY = priceToPixelY(price);

    let halfW = timeStepHalfPixels();
    let halfH = priceStepHalfPixels();

    let offset = QUAD_OFFSETS[vid];
    let pixel = vec2<f32>(centerX + offset.x * halfW, centerY + offset.y * halfH);
    out.position = vec4<f32>(pixelToClip(pixel), 0.0, 1.0);
    out.price = price;
    out.volume = volume;
    out.isInterpolated = isInterpolated;
    return out;
}

@fragment
fn fsHeatmap(in: VsOut) -> @location(0) vec4<f32> {
    let magnitude = in.price * in.volume;
    let lowBound = magnitudeMin();
    let highBound = magnitudeMax();
    let spread = max(highBound - lowBound, 1e-6);
    let t = clamp((magnitude - lowBound) / spread, 0.0, 1.0);

    var color: vec3<f32>;
    if (t < 0.5) {
        color = mix(COLOR_LOW, COLOR_MID, t * 2.0);
    } else {
        color = mix(COLOR_MID, COLOR_HIGH, (t - 0.5) * 2.0);
    }

    // Alpha rides the same magnitude ramp as the color: green cells
    // fade into the dark background, red cells stay fully opaque. The
    // pipeline uses non-premultiplied alpha blending.
    let alpha = mix(CELL_ALPHA_LOW, 1.0, t);

    // Interpolated cells (repeat-last fillers) get darkened diagonal
    // stripes in screen space so gaps are obvious without changing the
    // hue — the quantization pattern stays readable under zoom.
    if (in.isInterpolated > 0.5) {
        let stripePhase = fract((in.position.x + in.position.y) / STRIPE_PERIOD_PX);
        if (stripePhase > 0.5) {
            color = color * STRIPE_DARK_FACTOR;
        }
    }

    return vec4<f32>(color, alpha);
}
`,Pn=`// Mid-price line shader — consumes \`mid-price-common.wgsl\`.
//
// Instancing scheme: one instance per line segment, 12 vertices each:
//   [0..6)   — join-B disc cap at \`sampleB\`
//   [6..12)  — body rectangle from \`sampleA\` to \`sampleB\`
//
// We deliberately do NOT draw a cap at \`sampleA\`: adjacent segments
// share the junction sample (\`sampleB\` of segment i == \`sampleA\` of
// segment i+1), so the previous segment's join-B already stitches the
// corner. A second cap in the next segment would paint its outline
// annulus on top of the previous segment's body tail — the exact
// artefact that prompted this restructuring.
//
// Geometry is expanded by \`2 × outlineWidthPx\` (one side each) so the
// coloured core keeps its nominal \`widthFromRatio\` thickness and the
// outline sits *outside* the core rather than eating into it. The
// body interpolates colour from \`colorA\` at \`sampleA\` to \`colorB\` at
// \`sampleB\` — adjacent segments therefore transition smoothly through
// the junction cap colour instead of switching hues in one step.

struct MidVsOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    // Offset of this fragment from the line centre, expressed in
    // unit-basis coordinates (range \`[-0.5, 0.5]\` per axis). The
    // fragment shader derives \`normalizedDistance = length(...) * 2.0\`
    // from it; doing the reduction there rather than at the vertex
    // stage keeps the varying linearly interpolable across the quad.
    // For the straight body the X axis runs along the line direction
    // (irrelevant to thickness) so we zero it out — the shader ends
    // up reading \`|basis.y|\` for body fragments and \`length(basis)\`
    // for disc caps, which is exactly what we need.
    @location(1) unitOffset: vec2<f32>,
    // Fraction of \`normalizedDistance\` that stays inside the coloured
    // core; anything beyond is the black outline band.
    @location(2) innerFraction: f32,
};

const MID_JOIN_BASIS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(0.5, -0.5),
);

const MID_RECT_BASIS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -0.5),
    vec2<f32>(1.0, -0.5),
    vec2<f32>(1.0, 0.5),
    vec2<f32>(0.0, -0.5),
    vec2<f32>(1.0, 0.5),
    vec2<f32>(0.0, 0.5),
);

const MID_JOIN_B_END: u32 = 6u;

fn totalWidthPx(innerWidthPx: f32) -> f32 {
    return innerWidthPx + 2.0 * U.outlineWidthPx;
}

fn innerFractionOf(innerWidthPx: f32) -> f32 {
    let total = totalWidthPx(innerWidthPx);
    if (total <= 0.0) {
        return 0.0;
    }
    return innerWidthPx / total;
}

@vertex
fn vsMidPrice(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32
) -> MidVsOut {
    var out: MidVsOut;

    let sampleA = readGlobalSample(iid);
    let sampleB = readGlobalSample(iid + 1u);

    let pixelA = dataToPixel(sampleA.timeDeltaMs, sampleA.price);
    let pixelB = dataToPixel(sampleB.timeDeltaMs, sampleB.price);

    // \`packedColor\` at sample B describes the segment A→B (the
    // accumulator writes it when B arrives, comparing against the
    // previous sample). The join cap at B therefore matches this
    // segment's colour; the body gradients into it from \`colorA\`.
    let widthA = widthFromRatio(sampleA.priceChangeRatio);
    let widthB = widthFromRatio(sampleB.priceChangeRatio);
    let colorA = unpackColorWgsl(sampleA.packedColor);
    let colorB = unpackColorWgsl(sampleB.packedColor);

    let totalA = totalWidthPx(widthA);
    let totalB = totalWidthPx(widthB);

    if (vid < MID_JOIN_B_END) {
        let basis = MID_JOIN_BASIS[vid];
        out.color = colorB;
        out.unitOffset = basis;
        out.innerFraction = innerFractionOf(widthB);
        let offsetPixels = basis * totalB;
        out.position = vec4<f32>(pixelToClip(pixelB + offsetPixels), 0.0, 1.0);
    } else {
        let localVid = vid - MID_JOIN_B_END;
        let basis = MID_RECT_BASIS[localVid];

        let direction = pixelB - pixelA;
        let normal = safeNormalize(vec2<f32>(-direction.y, direction.x));

        // Interpolate thickness end-to-end so the rectangle joins the
        // disc cap at B smoothly when adjacent segments disagree in
        // slope, and gradient the colour across the segment so the
        // join transition reads as a smooth blend rather than a step.
        let innerThickness = mix(widthA, widthB, basis.x);
        let totalThickness = mix(totalA, totalB, basis.x);
        let basePixel = mix(pixelA, pixelB, basis.x);
        let offsetPixel = basePixel + normal * (basis.y * totalThickness);

        out.color = mix(colorA, colorB, basis.x);
        // X runs along the line direction — only the perpendicular
        // component (Y) contributes to distance from the centre line.
        out.unitOffset = vec2<f32>(0.0, basis.y);
        out.innerFraction = innerFractionOf(innerThickness);
        out.position = vec4<f32>(pixelToClip(offsetPixel), 0.0, 1.0);
    }

    return out;
}

// The line is drawn in two passes sharing this single vertex shader,
// each pass picking one of the two fragment entry points below:
//
//   1. \`fsMidPriceInterior\` — paints the coloured core of every
//      segment and writes \`1\` into the stencil buffer at every
//      covered sample (pipeline-side \`stencilFront.passOp: 'replace'\`,
//      reference = 1).
//   2. \`fsMidPriceOutline\` — paints the black outline band but is
//      gated by \`stencilCompare: 'equal'\` with reference = 0. Any
//      pixel already marked as interior by the first pass (including
//      interiors of *other* segments drawn in the same call) fails
//      the stencil test, so the outline of a newer segment can no
//      longer overwrite the body of an older one.
//
// Splitting the two branches into separate entry points lets each
// pipeline discard its "wrong half" up-front instead of toggling on a
// uniform / constant every frame.

@fragment
fn fsMidPriceInterior(in: MidVsOut) -> @location(0) vec4<f32> {
    let normalizedDistance = length(in.unitOffset) * 2.0;
    if (normalizedDistance > in.innerFraction) {
        discard;
    }
    return in.color;
}

@fragment
fn fsMidPriceOutline(in: MidVsOut) -> @location(0) vec4<f32> {
    let normalizedDistance = length(in.unitOffset) * 2.0;
    // Disc caps inscribe a circle inside the unit quad; corners land
    // at \`normalizedDistance > 1.0\` and must be discarded so joins read
    // as filled circles rather than squares. Body rectangles top out
    // at exactly \`1.0\` so the same check leaves them untouched.
    if (normalizedDistance > 1.0) {
        discard;
    }
    if (normalizedDistance <= in.innerFraction) {
        discard;
    }
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
`,Fn=`// Shared WGSL declarations for the mid-price line overlay.
//
// Bindings (group 0) — must match \`createMidPriceBindGroupLayout\`:
//   0: uniform         MidPriceUniforms
//   1: texture_2d<f32> dataTexture (rgba32float, unfilterable-float)
//   2: storage(ro)     array<MidPriceBlockDescriptor>

struct MidPriceUniforms {
    viewport: vec2<f32>,            // device pixels (full canvas)
    plotWidthPx: f32,               // device pixels of the plot area (canvas - Y-axis panel)
    viewTimeStartDeltaMs: f32,      // view window start, relative to globalBaseTime
    viewTimeEndDeltaMs: f32,        // view window end,   relative to globalBaseTime
    priceMin: f32,                  // viewport lower bound (absolute price)
    priceMax: f32,                  // viewport upper bound (absolute price)
    minWidthPx: f32,                // shader-side floor for line width
    maxWidthPx: f32,                // shader-side ceiling for line width
    widthScale: f32,                // growth factor applied to |Δprice / price|
    blockCount: u32,                // number of live mid-price blocks
    textureWidth: u32,              // mid-price data-texture width in texels
    outlineWidthPx: f32,            // black outline thickness (device pixels, per side)
    _pad1: u32,
    _pad2: u32,
    _pad3: u32,
};                                  // total = 64 bytes

struct MidPriceBlockDescriptor {
    textureOffset: u32,             // row * textureWidth + slotIndex * SAMPLES_PER_BLOCK
    count: u32,                     // 1..SAMPLES_PER_BLOCK
    baseTimeDeltaMs: f32,           // block.firstTimestampMs - globalBaseTime
    basePrice: f32,                 // block.basePrice (absolute price of first sample)
};

@group(0) @binding(0) var<uniform> U: MidPriceUniforms;
@group(0) @binding(1) var dataTexture: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> blocks: array<MidPriceBlockDescriptor>;

struct DecodedSample {
    timeDeltaMs: f32,               // relative to globalBaseTime
    price: f32,                     // absolute price in quote currency
    priceChangeRatio: f32,          // signed (current - prev) / current
    packedColor: f32,               // packColor() bit-reinterpreted to f32
};

/**
 * Stitches all live blocks into one logical point list indexed by
 * \`globalIndex\`. The join instance \`i\` connects global sample \`i\` to
 * \`i + 1\`, so a point in the N-th block whose local index is K gets
 * global index (sumCountsBefore + K).
 */
fn readGlobalSample(globalIndex: u32) -> DecodedSample {
    var accumulated: u32 = 0u;
    for (var blockIdx: u32 = 0u; blockIdx < U.blockCount; blockIdx = blockIdx + 1u) {
        let count = blocks[blockIdx].count;
        if (globalIndex < accumulated + count) {
            let localIndex = globalIndex - accumulated;
            let texOffset = blocks[blockIdx].textureOffset + localIndex;
            let row = texOffset / U.textureWidth;
            let col = texOffset % U.textureWidth;
            let texel = textureLoad(dataTexture, vec2<u32>(col, row), 0);
            var result: DecodedSample;
            result.timeDeltaMs = blocks[blockIdx].baseTimeDeltaMs + texel.x;
            result.price = blocks[blockIdx].basePrice + texel.y;
            result.priceChangeRatio = texel.z;
            result.packedColor = texel.w;
            return result;
        }
        accumulated = accumulated + count;
    }
    var fallback: DecodedSample;
    fallback.timeDeltaMs = 0.0;
    fallback.price = 0.0;
    fallback.priceChangeRatio = 0.0;
    fallback.packedColor = 0.0;
    return fallback;
}

const COLOR_BYTE_MASK: u32 = 0xFFu;
const COLOR_SHIFT_R: u32 = 8u;
const COLOR_SHIFT_G: u32 = 16u;
const COLOR_SHIFT_B: u32 = 24u;
const COLOR_SCALE: f32 = 255.0;

fn unpackColorWgsl(packed: f32) -> vec4<f32> {
    let bits = bitcast<u32>(packed);
    let a = f32(bits & COLOR_BYTE_MASK) / COLOR_SCALE;
    let r = f32((bits >> COLOR_SHIFT_R) & COLOR_BYTE_MASK) / COLOR_SCALE;
    let g = f32((bits >> COLOR_SHIFT_G) & COLOR_BYTE_MASK) / COLOR_SCALE;
    let b = f32((bits >> COLOR_SHIFT_B) & COLOR_BYTE_MASK) / COLOR_SCALE;
    return vec4<f32>(r, g, b, a);
}

fn safeNormalize(v: vec2<f32>) -> vec2<f32> {
    let len2 = dot(v, v);
    if (len2 > 1e-20) {
        return v * inverseSqrt(len2);
    }
    return vec2<f32>(0.0, 1.0);
}

/**
 * Map a (timeDelta, absolute price) pair into device-pixel coordinates
 * inside the plot area. Time maps across \`plotWidthPx\` only — the
 * right \`Y_AXIS_PANEL_CSS_PX * dpr\` pixels of the canvas are reserved
 * for the Y-axis panel and must stay clear of line geometry. Y is
 * flipped so higher prices render toward the top of the canvas.
 */
fn dataToPixel(timeDeltaMs: f32, price: f32) -> vec2<f32> {
    let timeRange = U.viewTimeEndDeltaMs - U.viewTimeStartDeltaMs;
    let priceRange = U.priceMax - U.priceMin;
    let normalizedX = (timeDeltaMs - U.viewTimeStartDeltaMs) / timeRange;
    let normalizedY = (price - U.priceMin) / priceRange;
    return vec2<f32>(normalizedX * U.plotWidthPx, (1.0 - normalizedY) * U.viewport.y);
}

fn pixelToClip(pixel: vec2<f32>) -> vec2<f32> {
    let clip = (pixel / U.viewport) * 2.0 - 1.0;
    return vec2<f32>(clip.x, -clip.y);
}

/**
 * Map the signed relative price change stored in the texel to a
 * drawn line width in device pixels.
 *
 *     width = clamp(minWidthPx × |ratio| × widthScale,
 *                   minWidthPx, maxWidthPx)
 *
 * The floor means even an unchanged segment renders at the minimum
 * visible thickness; the ceiling caps how thick very volatile
 * segments can grow.
 */
fn widthFromRatio(priceChangeRatio: f32) -> f32 {
    let raw = U.minWidthPx * abs(priceChangeRatio) * U.widthScale;
    return clamp(raw, U.minWidthPx, U.maxWidthPx);
}
`,In=`rgba32float`,Ln=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC,Rn=class{device;layout;maxBlocks;onEvict;texture;capacityBlocks;highWaterMark=0;freeSlots=[];lru;blockToSlot=new Map;constructor(e){this.device=e.device,this.layout=e.layout,this.maxBlocks=e.maxBlocks??1024,this.onEvict=e.onEvict,this.capacityBlocks=e.initialBlocks??32,this.texture=this.device.createTexture({size:[this.layout.textureWidth,this.capacityBlocks*this.layout.rowsPerBlock],format:In,usage:Ln}),this.lru=new Oe({max:this.maxBlocks})}allocate(e){let t=this.blockToSlot.get(e);if(t!==void 0)return this.lru.get(t),t;let n=this.popFreeSlot()??this.advanceHighWaterMark()??this.growAndAdvance()??this.evictAndReuseSlot();return this.blockToSlot.set(e,n),this.lru.set(n,e),n}touch(e){let t=this.blockToSlot.get(e);t!==void 0&&this.lru.get(t)}release(e){let t=this.blockToSlot.get(e);t!==void 0&&(this.blockToSlot.delete(e),this.lru.delete(t),this.freeSlots.push(t))}writeSnapshots(e,t,n,r,i){let{textureWidth:a,rowsPerBlock:o,snapshotsPerRow:s}=this.layout,c=a/s,l=e*o,u=a*4*Float32Array.BYTES_PER_ELEMENT,d=n,f=t,p=i;for(;d>0;){let e=Math.floor(f/s),t=f%s,n=t*c,i=Math.min(d,s-t),a=i*c,o=a*4;this.device.queue.writeTexture({texture:this.texture,origin:{x:n,y:l+e,z:0}},r.subarray(p,p+o),{bytesPerRow:u,rowsPerImage:1},{width:a,height:1,depthOrArrayLayers:1}),d-=i,f+=i,p+=o}}createView(){return this.texture.createView()}get currentCapacityBlocks(){return this.capacityBlocks}get currentAllocatedBlocks(){return this.blockToSlot.size}getSlotForBlock(e){return this.blockToSlot.get(e)}dispose(){this.texture.destroy(),this.lru.clear(),this.blockToSlot.clear(),this.freeSlots.length=0}popFreeSlot(){return this.freeSlots.pop()}advanceHighWaterMark(){if(this.highWaterMark>=this.capacityBlocks)return;let e=this.highWaterMark;return this.highWaterMark++,e}growAndAdvance(){if(this.capacityBlocks>=this.maxBlocks)return;let e=Math.min(this.capacityBlocks*2,this.maxBlocks);this.growTexture(e);let t=this.highWaterMark;return this.highWaterMark++,t}evictAndReuseSlot(){let e=this.lru.rkeys().next().value;if(e===void 0)throw Error(`TextureRowManager: cannot evict — LRU is empty despite exhausted capacity`);let t=this.lru.get(e);return this.lru.delete(e),t!==void 0&&(this.blockToSlot.delete(t),this.onEvict?.(t)),e}growTexture(e){let t=this.device.createTexture({size:[this.layout.textureWidth,e*this.layout.rowsPerBlock],format:In,usage:Ln});if(this.highWaterMark>0){let e=this.highWaterMark*this.layout.rowsPerBlock,n=this.device.createCommandEncoder();n.copyTextureToTexture({texture:this.texture,origin:{x:0,y:0,z:0}},{texture:t,origin:{x:0,y:0,z:0}},{width:this.layout.textureWidth,height:e,depthOrArrayLayers:1}),this.device.queue.submit([n.finish()])}this.texture.destroy(),this.texture=t,this.capacityBlocks=e}},zn=Mn+Nn,Bn=Fn+Pn,Vn=18;function Hn(e,t){e.getCompilationInfo().then(e=>{for(let n of e.messages){let e=`binance-view: shader[${t}] ${n.type} L${n.lineNum}:${n.linePos} —`;n.type===`error`?console.error(e,n.message):n.type===`warning`?console.warn(e,n.message):console.info(e,n.message)}})}async function W(e,t,n){try{return await e.createRenderPipelineAsync(n)}catch(e){let n=e instanceof Error?e.message:String(e);return console.error(`binance-view: pipeline[${t}] createRenderPipelineAsync failed —`,n,e),null}}var Un=class e{device;format;layout;textureRowManager;midPriceTextureRowManager;canvas;registry;midPriceIndex;taskManager;offscreen;context;target2d;msaaManager=c(4);renderTargetPool=new jn;heatmapBindGroupLayout;heatmapPipeline;heatmapResources;midPriceBindGroupLayout;midPriceInteriorPipeline;midPriceOutlinePipeline;midPriceResources;heatmapBindGroup;midPriceBindGroup;frameTaskUnsubscribe=void 0;disposed=!1;needsReconfigure=!1;onFrameInput=null;drawGridUnder=null;drawLabelsOver=null;constructor(e){this.canvas=e.canvas,this.registry=e.registry,this.midPriceIndex=e.midPriceIndex,this.taskManager=e.taskManager,this.device=e.device,this.format=e.format,this.offscreen=e.offscreen,this.context=e.context,this.target2d=e.target2d,this.layout=e.layout,this.textureRowManager=new Rn({device:this.device,layout:this.layout,initialBlocks:32,maxBlocks:rt,onEvict:e=>{let t=this.registry.get(e);t!==void 0&&(t.textureRowIndex=void 0)}}),this.midPriceTextureRowManager=new kn({device:this.device,onEvict:e=>{let t=this.midPriceIndex.get(e);t!==void 0&&(t.textureRowIndex=void 0)}}),this.heatmapBindGroupLayout=e.heatmapBindGroupLayout,this.heatmapPipeline=e.heatmapPipeline,this.heatmapResources=dn(this.device,rt),this.heatmapBindGroup=pn(this.device,this.heatmapBindGroupLayout,this.heatmapResources,this.textureRowManager.createView()),this.midPriceBindGroupLayout=e.midPriceBindGroupLayout,this.midPriceInteriorPipeline=e.midPriceInteriorPipeline,this.midPriceOutlinePipeline=e.midPriceOutlinePipeline,this.midPriceResources=_n(this.device,16),this.midPriceBindGroup=yn(this.device,this.midPriceBindGroupLayout,this.midPriceResources,this.midPriceTextureRowManager.createView())}static async create(t){i(!p(navigator.gpu),`WebGPU is not supported`);let n=await navigator.gpu.requestAdapter();if(p(n))return null;let r=tt,a=n.limits.maxTextureDimension2D>=r,o={};a&&(o.maxTextureDimension2D=r);let s;try{s=await n.requestDevice({requiredLimits:o})}catch{return null}s.addEventListener(`uncapturederror`,e=>{let t=e.error;console.error(`binance-view: webgpu uncapturederror (${t.constructor.name}) —`,t.message)});let c=s.limits.maxTextureDimension2D;if(c<8192)return s.destroy(),null;let l=Nt(c),u=new OffscreenCanvas(mt,768),d=u.getContext(`webgpu`);i(!p(d),`Failed to get WebGPU context on OffscreenCanvas`);let f=navigator.gpu.getPreferredCanvasFormat();d.configure({device:s,format:f,alphaMode:`premultiplied`,usage:Vn});let m=t.canvas.getContext(`2d`);i(!p(m),`Failed to get 2D context on visible canvas`);let h=s.createShaderModule({code:zn,label:`heatmap.shader`});Hn(h,`heatmap.shader`);let g=s.createShaderModule({code:Bn,label:`mid-price.shader`});Hn(g,`mid-price.shader`);let _=fn(s),v=vn(s),[y,b,x]=await Promise.all([W(s,`heatmap`,mn({device:s,module:h,layout:_,format:f,layoutConfig:l})),W(s,`mid-price.interior`,xn({device:s,module:g,layout:v,format:f})),W(s,`mid-price.outline`,Sn({device:s,module:g,layout:v,format:f}))]);return y===null||b===null||x===null?(s.destroy(),null):new e({canvas:t.canvas,registry:t.registry,midPriceIndex:t.midPriceIndex,taskManager:t.taskManager,device:s,format:f,offscreen:u,context:d,target2d:m,layout:l,heatmapBindGroupLayout:_,heatmapPipeline:y,midPriceBindGroupLayout:v,midPriceInteriorPipeline:b,midPriceOutlinePipeline:x})}setFrameInputSource(e){this.onFrameInput=e}setGridUnderCallback(e){this.drawGridUnder=e}setLabelsOverCallback(e){this.drawLabelsOver=e}start(){this.frameTaskUnsubscribe!==void 0||this.disposed||(this.frameTaskUnsubscribe=this.taskManager.subscribe(this.renderFrame,{minIntervalMs:0}))}stop(){this.frameTaskUnsubscribe?.(),this.frameTaskUnsubscribe=void 0}releaseBlockSlot(e){this.textureRowManager.release(e)}releaseMidPriceBlockSlot(e){this.midPriceTextureRowManager.release(e)}writeFlushedMidPriceSamples(e){let t=e.block,n=this.midPriceTextureRowManager.allocate(t.blockId);t.textureRowIndex=n;let r=t.count-e.addedSamples,i=r*4;this.midPriceTextureRowManager.writeSamples(n,r,e.addedSamples,e.data,i),this.midPriceIndex.upsert({blockId:t.blockId,firstTimestampMs:t.firstTimestampMs,basePrice:t.basePrice,lastTimestampMs:t.lastTimestampMs,count:t.count,textureRowIndex:n})}writeFlushedSnapshots(e){let t=e.block,n=this.textureRowManager.allocate(t.blockId);t.textureRowIndex=n;let r=t.count-e.addedSnapshots,i=r*512;this.textureRowManager.writeSnapshots(n,r,e.addedSnapshots,e.data,i),this.registry.upsert({minX:t.firstTimestampMs,maxX:t.lastTimestampMs,minY:0,maxY:0,blockId:t.blockId,textureRowIndex:n,count:t.count})}dispose(){this.disposed||(this.disposed=!0,this.stop(),this.textureRowManager.dispose(),this.midPriceTextureRowManager.dispose(),this.msaaManager.dispose(),this.renderTargetPool.dispose(),this.heatmapResources.uniformsBuffer.destroy(),this.heatmapResources.descriptorsBuffer.destroy(),this.midPriceResources.uniformsBuffer.destroy(),this.midPriceResources.descriptorsBuffer.destroy(),this.device.destroy())}syncCanvasSize(){let e=this.canvas.getBoundingClientRect(),t=Math.max(1,window.devicePixelRatio),n=Math.max(1,Math.floor(e.width*t)),r=Math.max(1,Math.floor(e.height*t));return(this.canvas.width!==n||this.canvas.height!==r)&&(this.canvas.width=n,this.canvas.height=r),{width:n,height:r}}computeVisibleBlocks(e,t){let n=this.registry.searchRange(e,t),r=[];for(let e of n)e.textureRowIndex!==void 0&&(this.textureRowManager.touch(e.blockId),r.push({meta:{blockId:e.blockId,firstTimestampMs:e.minX,lastTimestampMs:e.maxX,count:e.count,textureRowIndex:e.textureRowIndex},textureRowIndex:e.textureRowIndex}));return r}computeVisibleMidPriceBlocks(e,t){let n=this.midPriceIndex.searchRange(e,t),r=[];for(let e of n)e.textureRowIndex!==void 0&&(this.midPriceTextureRowManager.touch(e.blockId),r.push({item:e,textureOffset:this.midPriceTextureRowManager.slotTextureOffset(e.textureRowIndex)}));return r}renderFrame=()=>{if(this.disposed||this.onFrameInput===null)return;let{width:e,height:t}=this.syncCanvasSize();if(e===0||t===0)return;let n=this.onFrameInput(),r=this.computeVisibleBlocks(n.viewTimeStartMs,n.viewTimeEndMs),i=this.computeVisibleMidPriceBlocks(n.viewTimeStartMs,n.viewTimeEndMs),a=Mt(e,Math.max(1,window.devicePixelRatio)),o=0;if(r.length>0){let i=r[0].meta.firstTimestampMs;o=gn(this.device,this.heatmapResources.descriptorsBuffer,r,i).totalInstances,hn(this.device,this.heatmapResources.uniformsBuffer,{canvasWidth:e,canvasHeight:t,plotWidthPx:a,viewTimeStartDeltaMs:n.viewTimeStartMs-i,viewTimeEndDeltaMs:n.viewTimeEndMs-i,timeStepMs:n.timeStepMs,priceStep:n.priceStep,priceMin:n.priceMin,priceMax:n.priceMax,magnitudeMin:n.magnitudeMin,magnitudeMax:n.magnitudeMax,blockCount:r.length})}let s=0;if(i.length>0){let r=i[0].item.firstTimestampMs,{totalSegments:o}=wn(this.device,this.midPriceResources.descriptorsBuffer,i,r);s=o,Cn(this.device,this.midPriceResources.uniformsBuffer,{canvasWidth:e,canvasHeight:t,plotWidthPx:a,viewTimeStartDeltaMs:n.viewTimeStartMs-r,viewTimeEndDeltaMs:n.viewTimeEndMs-r,priceMin:n.priceMin,priceMax:n.priceMax,blockCount:i.length})}let c=this.renderOffscreenFrame(e,t,o,s);this.target2d.fillStyle=`#1a1a1a`,this.target2d.fillRect(0,0,e,t),this.invokeOverlay(this.drawGridUnder,e,t,n),c!==null&&(this.target2d.drawImage(c,0,0),c.close()),this.invokeOverlay(this.drawLabelsOver,e,t,n)};renderOffscreenFrame(e,t,n,r){(this.offscreen.width!==e||this.offscreen.height!==t||this.needsReconfigure)&&(this.offscreen.width=e,this.offscreen.height=t,this.context.configure({device:this.device,format:this.format,alphaMode:`premultiplied`,usage:Vn}),this.needsReconfigure=!1);let i=this.msaaManager.ensureView(this.device,this.format,e,t);if(i===null)return null;let a=this.renderTargetPool.acquire(this.device,e,t,this.format),o=this.device.createCommandEncoder({label:`binance.frame`}),s=o.beginRenderPass({colorAttachments:[{view:i,resolveTarget:a.createView(),loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});n>0&&(s.setPipeline(this.heatmapPipeline),s.setBindGroup(0,this.heatmapBindGroup),s.draw(6,n,0,0)),r>0&&(s.setBindGroup(0,this.midPriceBindGroup),s.setPipeline(this.midPriceOutlinePipeline),s.draw(Tn,r,0,0),s.setPipeline(this.midPriceInteriorPipeline),s.draw(Tn,r,0,0)),s.end();let c=this.context.getCurrentTexture();o.copyTextureToTexture({texture:a},{texture:c},[e,t]),this.device.queue.submit([o.finish()]),this.renderTargetPool.release(a);let l=this.offscreen.transferToImageBitmap();return this.needsReconfigure=!0,l}invokeOverlay(e,t,n,r){e!==null&&e({ctx:this.target2d,canvasWidthPx:t,canvasHeightPx:n,devicePixelRatio:Math.max(1,window.devicePixelRatio),frame:r})}};function Wn(e,t){let n=e.bids.length>0?e.bids[0][0]:void 0,r=e.asks.length>0?e.asks[0][0]:void 0;return n!==void 0&&r!==void 0?(n+r)/2:n??r??t}function Gn(e){return{viewTimeEndMs:e,targetViewTimeEndMs:e,panVelocityMsPerFrame:0,priceMin:0,priceMax:1}}function Kn(e){return e/it}function qn(e,t){return e.viewTimeEndMs-Kn(t)}function G(e,t){let n=Kn(t.plotWidthCssPx),r=Math.max(t.pageOpenTimeMs,t.oldestBlockStartMs??t.pageOpenTimeMs)+n,i=t.lastDisplaySnapshotTimeMs===void 0?e:t.lastDisplaySnapshotTimeMs+500;return r>i?i:b(e,r,i)}function Jn(e,t){return t===void 0?!0:t-e.viewTimeEndMs<st}function Yn(e){let{viewport:t,input:n,isInteracting:r}=e;!r&&Math.abs(t.panVelocityMsPerFrame)>.5?(t.targetViewTimeEndMs=G(t.targetViewTimeEndMs+t.panVelocityMsPerFrame,n),t.panVelocityMsPerFrame*=ot):r||(t.panVelocityMsPerFrame=0);let i=t.targetViewTimeEndMs-t.viewTimeEndMs;Math.abs(i)<2?t.viewTimeEndMs=t.targetViewTimeEndMs:t.viewTimeEndMs=R(t.viewTimeEndMs,t.targetViewTimeEndMs,at)}function Xn(e,t,n){e.targetViewTimeEndMs=G(t+500,n)}var Zn=500,Qn=2,$n=class{viewport;canvas;taskManager;pageOpenTimeMs;getRegistry;priceStep;midPrice=void 0;targetMidPrice=void 0;lastDisplayMs=void 0;magnitudeMin=0;magnitudeMax=1;magnitudeInitialized=!1;visibleLevels=40;targetVisibleLevels=40;pendingZoomFactor=1;pointers=[];lastPointerX=0;pendingDragDistance=0;pendingDeltaPx=0;isActuallyPanning=!1;pinchInitialDistance=void 0;cursorCssPosition=void 0;midPriceUnsubscribe;midPriceSource;midPriceToken=0;lastResolvedSnapshot=void 0;followPinned=!0;constructor(e){this.canvas=e.canvas,this.taskManager=e.taskManager,this.pageOpenTimeMs=e.pageOpenTimeMs,this.getRegistry=e.getRegistry,this.priceStep=e.priceStep,this.viewport=Gn(e.pageOpenTimeMs),this.viewport.priceMin=0,this.viewport.priceMax=1,this.handlePointerDown=this.handlePointerDown.bind(this),this.handlePointerMove=this.handlePointerMove.bind(this),this.handlePointerUp=this.handlePointerUp.bind(this),this.handlePointerLeave=this.handlePointerLeave.bind(this),this.handleWheel=this.handleWheel.bind(this),this.canvas.addEventListener(`pointerdown`,this.handlePointerDown),this.canvas.addEventListener(`pointermove`,this.handlePointerMove),this.canvas.addEventListener(`pointerup`,this.handlePointerUp),this.canvas.addEventListener(`pointercancel`,this.handlePointerLeave),this.canvas.addEventListener(`pointerleave`,this.handlePointerLeave),this.canvas.addEventListener(`wheel`,this.handleWheel,{passive:!1}),e.dataController===void 0?(this.midPriceSource=void 0,this.midPriceUnsubscribe=void 0):(this.midPriceSource=e.dataController,this.midPriceUnsubscribe=this.taskManager.subscribe(this.refreshTargetMidPrice,{minIntervalMs:e.midPriceIntervalMs??Zn}))}get isPanning(){return this.pointers.length===1&&this.isActuallyPanning}get isZooming(){return this.pointers.length>=2}get isFollowing(){return Jn(this.viewport,this.lastDisplayMs)}tick(){this.applyPendingZoom(),this.updateVisibleLevelsLerp(),this.updateViewportPriceBounds();let e=this.buildClampInput();if(this.isPanning)if(this.pendingDeltaPx!==0){let t=-this.pendingDeltaPx/it;this.pendingDeltaPx=0,this.viewport.targetViewTimeEndMs=G(this.viewport.targetViewTimeEndMs+t,e),this.viewport.panVelocityMsPerFrame=t}else this.viewport.panVelocityMsPerFrame=0;if(this.viewport.targetViewTimeEndMs=G(this.viewport.targetViewTimeEndMs,e),Yn({viewport:this.viewport,input:e,isInteracting:this.isPanning}),!this.followPinned&&this.lastDisplayMs!==void 0){let e=this.lastDisplayMs+500;this.viewport.targetViewTimeEndMs>=e-2&&(this.followPinned=!0)}Math.abs(this.viewport.viewTimeEndMs-this.viewport.targetViewTimeEndMs)>2&&this.taskManager.raise(60),this.cursorCssPosition!==void 0&&this.taskManager.raise(60)}onFlushArrived(e){return this.lastDisplayMs=e.lastDisplayMs,e.latestMagnitudeMin===0&&e.latestMagnitudeMax===0||(this.magnitudeInitialized?(this.magnitudeMin=R(this.magnitudeMin,e.latestMagnitudeMin,pt),this.magnitudeMax=R(this.magnitudeMax,e.latestMagnitudeMax,pt)):(this.magnitudeMin=e.latestMagnitudeMin,this.magnitudeMax=e.latestMagnitudeMax,this.magnitudeInitialized=!0)),this.followPinned&&(Xn(this.viewport,e.lastDisplayMs,this.buildClampInput()),this.taskManager.raise(60)),this.followPinned}isFollowPinned(){return this.followPinned}setTargetMidPrice(e){this.targetMidPrice=e,this.midPrice===void 0&&(this.midPrice=e)}getMagnitudeMin(){return this.magnitudeMin}getMagnitudeMax(){return this.magnitudeMax}setPriceStep(e){this.priceStep=e}viewTimeStartMsForPlotWidth(e){return qn(this.viewport,e)}getLastDisplayMs(){return this.lastDisplayMs}getVisibleLevels(){return this.visibleLevels}dispose(){this.midPriceUnsubscribe?.(),this.midPriceToken++,this.lastResolvedSnapshot=void 0,this.canvas.removeEventListener(`pointerdown`,this.handlePointerDown),this.canvas.removeEventListener(`pointermove`,this.handlePointerMove),this.canvas.removeEventListener(`pointerup`,this.handlePointerUp),this.canvas.removeEventListener(`pointercancel`,this.handlePointerLeave),this.canvas.removeEventListener(`pointerleave`,this.handlePointerLeave),this.canvas.removeEventListener(`wheel`,this.handleWheel)}getCursorCss(){return this.cursorCssPosition}refreshTargetMidPrice=()=>{let e=this.midPriceSource;if(e===void 0)return;let t=this.viewport.viewTimeEndMs,n=++this.midPriceToken;e.resolveSnapshotAt(t).then(e=>{if(n!==this.midPriceToken||e===void 0)return;this.lastResolvedSnapshot=e;let t=Wn(e);t!==void 0&&this.setTargetMidPrice(t)})};getLastResolvedSnapshot(){return this.lastResolvedSnapshot}applyPendingZoom(){this.pendingZoomFactor!==1&&(this.targetVisibleLevels=b(this.targetVisibleLevels*this.pendingZoomFactor,20,128),this.pendingZoomFactor=1,this.taskManager.raise(60))}updateVisibleLevelsLerp(){let e=this.targetVisibleLevels-this.visibleLevels;if(Math.abs(e)<.01){this.visibleLevels=this.targetVisibleLevels;return}this.visibleLevels=R(this.visibleLevels,this.targetVisibleLevels,lt),this.taskManager.raise(60)}updateViewportPriceBounds(){if(this.midPrice===void 0)return;if(this.targetMidPrice!==void 0){let e=this.priceStep/2,t=this.targetMidPrice-this.midPrice;Math.abs(t)<e?this.midPrice=this.targetMidPrice:(this.midPrice=R(this.midPrice,this.targetMidPrice,at),this.taskManager.raise(60))}let e=this.visibleLevels/2*this.priceStep;this.viewport.priceMin=this.midPrice-e,this.viewport.priceMax=this.midPrice+e}buildClampInput(){return{plotWidthCssPx:z(Math.max(1,this.canvas.clientWidth)),pageOpenTimeMs:this.pageOpenTimeMs,oldestBlockStartMs:this.getRegistry().oldestStartMs(),lastDisplaySnapshotTimeMs:this.lastDisplayMs}}handlePointerDown(e){this.pointers.length>=2||(this.pointers.push({id:e.pointerId,clientX:e.clientX}),this.canvas.setPointerCapture(e.pointerId),this.pointers.length===1?(this.lastPointerX=e.clientX,this.pendingDragDistance=0,this.pendingDeltaPx=0,this.isActuallyPanning=!1):(this.isActuallyPanning=!1,this.pendingDeltaPx=0,this.viewport.panVelocityMsPerFrame=0,this.pinchInitialDistance=this.distanceBetweenPointers()))}handlePointerMove(e){let t=this.canvas.getBoundingClientRect();this.cursorCssPosition={x:e.clientX-t.left,y:e.clientY-t.top},this.taskManager.raise(60);let n=this.pointers.find(t=>t.id===e.pointerId);if(n===void 0)return;if(n.clientX=e.clientX,this.pointers.length>=2){this.accumulatePinchZoom();return}let r=e.clientX-this.lastPointerX;this.lastPointerX=e.clientX,this.pendingDragDistance+=Math.abs(r),!this.isActuallyPanning&&this.pendingDragDistance>=Qn&&(this.isActuallyPanning=!0,this.viewport.targetViewTimeEndMs=this.viewport.viewTimeEndMs,this.followPinned=!1),this.isActuallyPanning&&(this.pendingDeltaPx+=r)}handlePointerLeave(e){this.cursorCssPosition=void 0,this.handlePointerUp(e)}handlePointerUp(e){let t=this.pointers.length;this.pointers=this.pointers.filter(t=>t.id!==e.pointerId),this.canvas.releasePointerCapture?.(e.pointerId),t>=2&&this.pointers.length<2&&(this.pinchInitialDistance=void 0,this.pendingDragDistance=0,this.pointers.length===1&&(this.lastPointerX=this.pointers[0].clientX)),this.pointers.length===0&&(this.isActuallyPanning&&this.taskManager.raise(60),this.isActuallyPanning=!1)}handleWheel(e){e.preventDefault();let t=er(e);if(t===0)return;let n=t>0?1+ct:1/(1+ct);this.pendingZoomFactor*=n}accumulatePinchZoom(){if(this.pointers.length<2||this.pinchInitialDistance===void 0)return;let e=this.distanceBetweenPointers();if(e===0||this.pinchInitialDistance===0)return;let t=this.pinchInitialDistance/e;Math.abs(t-1)<1e-4||(this.pendingZoomFactor*=t,this.pinchInitialDistance=e)}distanceBetweenPointers(){return this.pointers.length<2?0:Math.abs(this.pointers[0].clientX-this.pointers[1].clientX)}};function er(e){return e.deltaY===0?0:Math.sign(e.deltaY)}var tr=class{canvas;registry=new ln;midPriceIndex=new un;pageOpenTimeMs;updateSpeedMs;priceStep;renderer=null;viewportControllerInternal=null;constructor(e){this.canvas=e.canvas,this.pageOpenTimeMs=e.pageOpenTimeMs,this.updateSpeedMs=e.updateSpeedMs,this.priceStep=e.priceStep}get viewport(){if(this.viewportControllerInternal===null)throw Error(`BinanceChartState: viewport accessed before init`);return this.viewportControllerInternal.viewport}get viewportController(){if(this.viewportControllerInternal===null)throw Error(`BinanceChartState: viewportController accessed before init`);return this.viewportControllerInternal}async init(e){return this.renderer=await Un.create({canvas:this.canvas,registry:this.registry,midPriceIndex:this.midPriceIndex,taskManager:e.taskManager,updateSpeedMs:this.updateSpeedMs,priceStep:this.priceStep}),this.renderer===null?!1:(this.viewportControllerInternal=new $n({canvas:this.canvas,taskManager:e.taskManager,pageOpenTimeMs:this.pageOpenTimeMs,priceStep:this.priceStep,getRegistry:()=>this.registry,dataController:e.dataController}),this.renderer.setFrameInputSource(this.provideFrameInput),this.renderer.setGridUnderCallback(this.drawGridUnder),this.renderer.setLabelsOverCallback(this.drawLabelsOver),this.renderer.start(),!0)}ingestFlush(e){this.renderer===null||this.viewportControllerInternal===null||(this.renderer.writeFlushedSnapshots(e),this.viewportControllerInternal.onFlushArrived({lastDisplayMs:e.block.lastTimestampMs,latestMagnitudeMin:e.latestMagnitudeMin,latestMagnitudeMax:e.latestMagnitudeMax}))}ingestMidPriceFlush(e){this.renderer?.writeFlushedMidPriceSamples(e)}setPriceStep(e){this.priceStep=e,this.viewportControllerInternal?.setPriceStep(e)}releaseBlockSlot(e){this.renderer?.releaseBlockSlot(e)}releaseMidPriceBlockSlot(e){this.renderer?.releaseMidPriceBlockSlot(e)}dispose(){this.viewportControllerInternal?.dispose(),this.viewportControllerInternal=null,this.renderer?.dispose(),this.renderer=null}drawGridUnder=e=>{Jt({ctx:e.ctx,canvasWidthPx:e.canvasWidthPx,canvasHeightPx:e.canvasHeightPx,devicePixelRatio:e.devicePixelRatio,viewTimeStartMs:e.frame.viewTimeStartMs,viewTimeEndMs:e.frame.viewTimeEndMs,priceMin:e.frame.priceMin,priceMax:e.frame.priceMax,priceStep:e.frame.priceStep})};drawLabelsOver=e=>{Yt({ctx:e.ctx,canvasWidthPx:e.canvasWidthPx,canvasHeightPx:e.canvasHeightPx,devicePixelRatio:e.devicePixelRatio,viewTimeStartMs:e.frame.viewTimeStartMs,viewTimeEndMs:e.frame.viewTimeEndMs,priceMin:e.frame.priceMin,priceMax:e.frame.priceMax,priceStep:e.frame.priceStep,cursorCss:e.frame.cursorCss,lastSnapshot:e.frame.lastSnapshot})};provideFrameInput=()=>{if(this.viewportControllerInternal===null)throw Error(`BinanceChartState: frame requested before init`);this.viewportControllerInternal.tick();let e=z(Math.max(1,this.canvas.clientWidth));return{viewTimeStartMs:this.viewportControllerInternal.viewTimeStartMsForPlotWidth(e),viewTimeEndMs:this.viewportControllerInternal.viewport.viewTimeEndMs,priceMin:this.viewportControllerInternal.viewport.priceMin,priceMax:this.viewportControllerInternal.viewport.priceMax,magnitudeMin:this.viewportControllerInternal.getMagnitudeMin(),magnitudeMax:this.viewportControllerInternal.getMagnitudeMax(),priceStep:this.priceStep,timeStepMs:this.updateSpeedMs,cursorCss:this.viewportControllerInternal.getCursorCss(),lastSnapshot:this.viewportControllerInternal.getLastResolvedSnapshot()}}},K={instrument:`BTCUSDT`,rawDepth:800,aggregatedDepth:64,aggregationQuoteStep:1.5,updateSpeedMs:1e3,streamHost:`wss://stream.binance.com:9443`,apiHost:`https://api.binance.com/api/v3`,restSnapshotLimit:5e3,snapshotsPerBlock:128,flushEverySnapshots:1,maxSequenceGapRetries:5,reconnectDelayMs:ut,fallbackPriceStep:.01},nr=3,rr=class{registry;db;getActiveBlockSource;updateSpeedMs;depth;snapshotSlots;cache;constructor(e){this.registry=e.registry,this.db=e.db,this.getActiveBlockSource=e.getActiveBlock,this.updateSpeedMs=e.updateSpeedMs,this.depth=e.depth,this.snapshotSlots=e.snapshotSlots,this.cache=new or(e.cacheCapacity??nr)}async resolveSnapshotAt(e){let t=await this.locateSnapshot(e,{allowNearestEarlier:!0});if(t!==void 0)return this.reconstructSnapshot(t)}async resolveCellAt(e){let{pointerPx:t,plotRect:n,viewport:r,priceStep:i}=e;if(n.width<=0||n.height<=0||t.x<0||t.x>n.width)return null;let a=qn(r,n.width),o=r.viewTimeEndMs-a;if(o<=0)return null;let s=r.priceMax-r.priceMin;if(s<=0)return null;let c=a+t.x/n.width*o,l=r.priceMax-t.y/n.height*s,u=await this.locateSnapshot(c,{allowNearestEarlier:!1});return u===void 0?null:this.pickLevelAt(u,l,i,t)}clearCache(){this.cache.clear()}dispose(){this.cache.clear()}async locateSnapshot(e,t){let n=this.findBlockForTime(e,t.allowNearestEarlier);if(n===void 0)return;let r=await this.loadBlockSource(n.blockId);if(r===null)return;let i=this.findSnapshotIndex(r,e,{allowFallbackToLast:t.allowNearestEarlier});if(!(i<0))return{meta:r.meta,data:r.data,snapshotIndex:i}}findBlockForTime(e,t){let n=this.updateSpeedMs/2,r=this.registry.searchRange(e-n,e+n);if(r.length>0){let t,n=1/0;for(let i of r){if(i.minX<=e&&i.maxX>=e)return i;let r=Math.min(Math.abs(i.minX-e),Math.abs(i.maxX-e));r<n&&(n=r,t=i)}if(t!==void 0)return t}if(!t)return;let i=this.registry.oldestStartMs();if(i===void 0)return;let a=this.registry.searchRange(i,e);if(a.length===0)return;let o=a[0];for(let e of a)e.minX>o.minX&&(o=e);return o}async loadBlockSource(e){let t=this.getActiveBlockSource();if(t!==null&&t.meta.blockId===e)return t;let n=this.cache.get(e);if(n!==void 0)return{meta:ar(n),data:new Float32Array(n.data)};if(this.db===void 0)return null;let r=await this.db.getBlock(e);return r===void 0?null:(this.cache.put(r),{meta:ar(r),data:new Float32Array(r.data)})}findSnapshotIndex(e,t,n){let r=t-e.meta.firstTimestampMs,i=-1,a=this.updateSpeedMs/2;for(let t=0;t<e.meta.count;t++){let n=t*this.snapshotSlots*4,o=Math.abs(e.data[n]-r);o<a&&(a=o,i=t)}return i>=0?i:n.allowFallbackToLast&&e.meta.count>0&&r>=0?e.meta.count-1:-1}reconstructSnapshot(e){let{meta:t,data:n,snapshotIndex:r}=e,i=r*this.snapshotSlots*4,a=[],o=[];for(let e=0;e<this.depth;e++){let t=i+e*4,r=n[t+2];r>0&&a.push([n[t+1],r])}for(let e=0;e<this.depth;e++){let t=i+(this.depth+e)*4,r=n[t+2];r>0&&o.push([n[t+1],r])}return{eventTimeMs:t.firstTimestampMs+n[i],bids:a,asks:o}}pickLevelAt(e,t,n,r){let{meta:i,data:a,snapshotIndex:o}=e,s=o*this.snapshotSlots*4,c=n/2,l=-1,u=c;for(let e=0;e<this.snapshotSlots;e++){let n=s+e*4;if(a[n+2]<=0)continue;let r=Math.abs(a[n+1]-t);r<u&&(u=r,l=e)}if(l<0)return null;let d=s+l*4;return{blockId:i.blockId,timestampMs:i.firstTimestampMs+a[s],price:a[d+1],volume:a[d+2],side:ir(l,this.depth),pointerPx:r}}};function ir(e,t){return e<t?`bid`:e<2*t?`ask`:`padding`}function ar(e){return{blockId:e.blockId,firstTimestampMs:e.firstTimestampMs,lastTimestampMs:e.lastTimestampMs,count:e.count,textureRowIndex:e.textureRowIndex}}var or=class{entries=new Map;capacity;constructor(e){this.capacity=e}get(e){let t=this.entries.get(e);return t!==void 0&&(this.entries.delete(e),this.entries.set(e,t)),t}put(e){if(this.entries.has(e.blockId))this.entries.delete(e.blockId);else if(this.entries.size>=this.capacity){let e=this.entries.keys().next().value;e!==void 0&&this.entries.delete(e)}this.entries.set(e.blockId,e)}clear(){this.entries.clear()}},sr={requestAnimationFrame:e=>globalThis.requestAnimationFrame(e),cancelAnimationFrame:e=>globalThis.cancelAnimationFrame(e),now:()=>performance.now()},cr=class{tasks=[];scheduler;fpsController;rafHandle;lastProcessedMs=-1/0;disposed=!1;constructor(e={}){this.scheduler=e.scheduler??sr,this.fpsController=new a(e.idleFps??10)}subscribe(e,t){if(this.disposed)return()=>void 0;let n={callback:e,minIntervalMs:Math.max(0,t.minIntervalMs),nextDueMs:this.scheduler.now()};return this.tasks.push(n),this.ensureRunning(),()=>this.unsubscribe(n)}raise(e){this.fpsController.raise(e)}dispose(){this.disposed=!0,this.tasks.length=0,this.fpsController.dispose(),this.stop()}unsubscribe(e){let t=this.tasks.indexOf(e);t>=0&&this.tasks.splice(t,1),this.tasks.length===0&&this.stop()}ensureRunning(){this.rafHandle!==void 0||this.disposed||(this.rafHandle=this.scheduler.requestAnimationFrame(this.tick))}stop(){this.rafHandle!==void 0&&(this.scheduler.cancelAnimationFrame(this.rafHandle),this.rafHandle=void 0)}tick=()=>{if(this.rafHandle=void 0,this.disposed)return;this.fpsController.tick();let e=this.scheduler.now(),t=this.fpsController.getFrameIntervalMs();if(e-this.lastProcessedMs>=t){this.lastProcessedMs=e;let t=this.tasks.slice();for(let n of t)this.tasks.includes(n)&&e>=n.nextDueMs&&(n.nextDueMs=e+n.minIntervalMs,n.callback())}this.tasks.length>0&&!this.disposed&&(this.rafHandle=this.scheduler.requestAnimationFrame(this.tick))}},lr=`binance-orderbook`,q=`orderbook-blocks`,J=`mid-price-blocks`,ur=`avg-price-blocks`,dr=class{constructor(e){this.db=e}async clearAll(){await this.db.clear(q)}async putBlock(e){await this.db.put(q,e)}async getBlock(e){return this.db.get(q,e)}async deleteBlock(e){await this.db.delete(q,e)}async countBlocks(){return this.db.count(q)}close(){this.db.close()}},fr=class{constructor(e){this.db=e}async clearAll(){await this.db.clear(J)}async putBlock(e){await this.db.put(J,e)}async getBlock(e){return this.db.get(J,e)}async deleteBlock(e){await this.db.delete(J,e)}async countBlocks(){return this.db.count(J)}};async function pr(e=lr,t=3){let r=await n(e,t,{upgrade(e){e.objectStoreNames.contains(`orderbook-blocks`)||e.createObjectStore(q,{keyPath:`blockId`}),e.objectStoreNames.contains(`mid-price-blocks`)||e.createObjectStore(J,{keyPath:`blockId`});let t=ur;e.objectStoreNames.contains(t)&&e.deleteObjectStore(t)}});return{orderbook:new dr(r),midPrice:new fr(r),async clearAll(){let e=r.transaction([q,J],`readwrite`);await Promise.all([e.objectStore(q).clear(),e.objectStore(J).clear()]),await e.done},close(){r.close()}}}function mr(e,t,n,r){let i=new Float32Array(t*4),a=r?1:0,o=Math.min(e.bids.length,n);for(let t=0;t<o;t++){let[n,r]=e.bids[t],o=t*4;i[o+1]=n,i[o+2]=r,i[o+3]=a}let s=Math.min(e.asks.length,n);for(let t=0;t<s;t++){let[r,o]=e.asks[t],s=(n+t)*4;i[s+1]=r,i[s+2]=o,i[s+3]=a}return i}var hr=class{params;activeMeta=null;activeData=null;pendingSnapshots=0;constructor(e){this.params=e}addSnapshot(e){let{snapshotsPerBlock:t,flushEverySnapshots:n,snapshotSlots:r,depth:i,updateSpeedMs:a,onFlush:o}=this.params,s=1/0,c=0;for(let[t,n]of e.bids){if(n<=0)continue;let e=t*n;e<s&&(s=e),e>c&&(c=e)}for(let[t,n]of e.asks){if(n<=0)continue;let e=t*n;e<s&&(s=e),e>c&&(c=e)}Number.isFinite(s)||(s=0),(p(this.activeMeta)||this.activeMeta.count>=t)&&this.startNewBlock(e.eventTimeMs);let l=this.activeMeta,u=this.activeData;if(p(l)||p(u))return;let d=mr(e,r,i,e.isInterpolated),f=e.eventTimeMs-l.firstTimestampMs,m=(l.count+this.pendingSnapshots)*r*4;u.set(d,m);for(let e=0;e<r;e++){let t=m+e*4;u[t]=f}this.pendingSnapshots++;let h=this.pendingSnapshots>=n,g=l.count+this.pendingSnapshots>=t;if(h||g){let t=l.count===0,n=this.pendingSnapshots;l.count+=this.pendingSnapshots,l.lastTimestampMs=e.eventTimeMs,this.pendingSnapshots=0,o({block:l,data:u,isNewBlock:t,addedSnapshots:n,latestMagnitudeMin:s,latestMagnitudeMax:c})}}getActiveBlock(){return p(this.activeMeta)||p(this.activeData)?null:{meta:this.activeMeta,data:this.activeData}}dispose(){this.activeMeta=null,this.activeData=null,this.pendingSnapshots=0}startNewBlock(e){let{snapshotsPerBlock:t,snapshotSlots:n,updateSpeedMs:r}=this.params,i=jt(e,t,r);this.activeMeta={blockId:i,firstTimestampMs:i,lastTimestampMs:e,count:0,textureRowIndex:void 0},this.activeData=new Float32Array(t*n*4),this.pendingSnapshots=0}};function gr(e){return e.filterType===`PRICE_FILTER`&&!p(e.tickSize)}async function _r(e,t){let n=`${e}/exchangeInfo?symbol=${t.toUpperCase()}`;try{let e=await fetch(n);if(!e.ok){console.warn(`binance-view: exchangeInfo request failed`,{status:e.status,instrument:t});return}let r=(await e.json()).symbols.find(e=>e.symbol===t.toUpperCase());if(p(r))return;let i=r.filters.find(gr);if(p(i))return;let a=Number.parseFloat(i.tickSize);return Number.isFinite(a)&&a>0?a:void 0}catch(e){console.warn(`binance-view: exchangeInfo request errored`,{instrument:t,error:e});return}}function vr(e,t){return!Number.isFinite(t)||t===0?0:(t-e)/t}function yr(e){return Math.abs(e)<1e-6?`flat`:e>0?`up`:`down`}var br=m(...wt),xr=m(...Tt),Sr=m(...Et),Cr=class{samplesPerBlock;updateSpeedMs;flushEverySamples;onFlush;meta=null;activeData=null;lastSample=null;pendingSamples=0;disposed=!1;constructor(e){this.samplesPerBlock=e.samplesPerBlock,this.updateSpeedMs=e.updateSpeedMs,this.flushEverySamples=Math.max(1,e.flushEverySamples),this.onFlush=e.onFlush}addSample(e){if(this.disposed)return;let t=this.meta===null||this.meta.count>=this.samplesPerBlock;t&&this.startNewBlock(e);let n=this.meta,r=this.activeData;if(n===null||r===null)return;let i=this.lastSample===null?0:vr(this.lastSample.price,e.price),a=yr(i),o=n.count*4;r[o+0]=e.eventTimeMs-n.firstTimestampMs,r[o+1]=e.price-n.basePrice,r[o+2]=i,r[o+3]=wr(a),n.count+=1,n.lastTimestampMs=e.eventTimeMs,this.lastSample=e,this.pendingSamples+=1;let s=this.pendingSamples>=this.flushEverySamples,c=n.count>=this.samplesPerBlock;(s||c)&&this.emitFlush(t)}dispose(){this.disposed=!0,this.meta=null,this.activeData=null,this.lastSample=null,this.pendingSamples=0}startNewBlock(e){let t=jt(e.eventTimeMs,this.samplesPerBlock,this.updateSpeedMs);this.meta={blockId:t,firstTimestampMs:t,basePrice:e.price,lastTimestampMs:e.eventTimeMs,count:0,textureRowIndex:void 0},this.activeData=new Float32Array(this.samplesPerBlock*4),this.pendingSamples=0}emitFlush(e){if(this.meta===null||this.activeData===null||this.pendingSamples===0)return;let t={block:this.meta,data:this.activeData,isNewBlock:e,addedSamples:this.pendingSamples};this.pendingSamples=0,this.onFlush(t)}};function wr(e){switch(e){case`up`:return br;case`down`:return xr;case`flat`:return Sr}}function Tr(e,t){if(t<=0)return e;let n=new Map;for(let[r,i]of e.bids){if(i<=0)continue;let e=Math.floor(r/t)*t;n.set(e,(n.get(e)??0)+i)}let r=new Map;for(let[n,i]of e.asks){if(i<=0)continue;let e=Math.ceil(n/t)*t;r.set(e,(r.get(e)??0)+i)}let i=Array.from(n.entries()).map(([e,t])=>[e,t]).sort(([e],[t])=>t-e),a=Array.from(r.entries()).map(([e,t])=>[e,t]).sort(([e],[t])=>e-t);return{eventTimeMs:e.eventTimeMs,bids:i,asks:a}}function Er(e){return typeof window>`u`||typeof navigator>`u`||navigator.onLine?me(e):F(window,`online`).pipe(se(1))}var Dr=class extends Error{info;constructor(e){super(`OrderBook sequence gap for ${e.instrument}: expected <= ${e.expectedUpdateId}, got ${e.actualUpdateId}`),this.name=`OrderBookSequenceGapError`,this.info=e}},Or=class extends Error{constructor(){super(`Binance orderbook WebSocket stream closed unexpectedly`),this.name=`OrderBookStreamClosedError`}};function kr(e,t){t===void 0&&(t={});var n=t.selector,r=ye(t,[`selector`]);return new D(function(t){var i=new AbortController,a=i.signal,o=!0,s=r.signal;if(s)if(s.aborted)i.abort();else{var c=function(){a.aborted||i.abort()};s.addEventListener(`abort`,c),t.add(function(){return s.removeEventListener(`abort`,c)})}var l=k(k({},r),{signal:a}),u=function(e){o=!1,t.error(e)};return fetch(e,l).then(function(e){n?C(n(e)).subscribe(S(t,void 0,function(){o=!1,t.complete()},u)):(o=!1,t.next(e),t.complete())}).catch(u),function(){o&&i.abort()}})}function Ar(e){return{instrument:e.s,eventTimeMs:e.E,firstUpdateId:e.U,finalUpdateId:e.u,bids:e.b,asks:e.a}}function jr(e,t){let n=Array.from(e.bids.entries()).map(([e,t])=>[Number.parseFloat(e),Number.parseFloat(t)]).sort(([e],[t])=>t-e).slice(0,t),r=Array.from(e.asks.entries()).map(([e,t])=>[Number.parseFloat(e),Number.parseFloat(t)]).sort(([e],[t])=>e-t).slice(0,t);return{eventTimeMs:e.eventTimeMs,instrument:e.instrument,bids:n,asks:r}}function Mr(e){return u(e)&&`firstUpdateId`in e&&`finalUpdateId`in e}function Nr(e){let{rawUpdates$:t,restUrl:n,instrument:r,depth:a}=e,o=kr(n).pipe(de(e=>{if(!e.ok)throw Error(`Order book REST snapshot failed: ${e.status} ${e.statusText} for ${n}`);return T(e.json())}));return t.pipe(E(e=>Ar(e)),Ze((e,t)=>t===0?o.pipe(E(e=>(i(!p(e.bids)&&!p(e.asks),`Invalid order book snapshot response from ${n}: missing bids or asks`),e)),Qe(e)):ae(e)),et((e,t)=>{if(!Mr(t))return{status:`snapshot`,instrument:r.toUpperCase(),lastUpdateId:t.lastUpdateId,bids:new Map(t.bids.map(e=>[e[0],e[1]])),asks:new Map(t.asks.map(e=>[e[0],e[1]]))};if(i(!p(e),`State is not initialized`),t.finalUpdateId<=e.lastUpdateId)return i(e.status===`snapshot`,`Wrong update after fully constructed snapshot`),e;if(t.firstUpdateId>e.lastUpdateId+1)throw new Dr({instrument:e.instrument,expectedUpdateId:e.lastUpdateId+1,actualUpdateId:t.firstUpdateId,lastEventTimeMs:e.status===`full`?e.eventTimeMs:void 0});let n=new Map(e.bids),a=new Map(e.asks);for(let[e,r]of t.bids)Number.parseFloat(r)===0?n.delete(e):n.set(e,r);for(let[e,n]of t.asks)Number.parseFloat(n)===0?a.delete(e):a.set(e,n);return{status:`full`,eventTimeMs:t.eventTimeMs,instrument:e.instrument,lastUpdateId:t.finalUpdateId,bids:n,asks:a}},void 0),te(e=>!p(e)&&e.status===`full`),E(e=>jr(e,a)))}var Pr=class{items=[];enqueue(e){this.items.push(e)}drain(e,t){let n=[],r=[];for(let i of this.items)if(!(i.timestampMs<e)){if(i.timestampMs<t){n.push(i);continue}r.push(i)}return this.items.length=0,this.items.push(...r),n}get size(){return this.items.length}clear(){this.items.length=0}},Y=1e3,Fr={setTimeout:(e,t)=>globalThis.setTimeout(e,t),clearTimeout:e=>{p(e)||globalThis.clearTimeout(e)}},Ir=[],Lr=class{buffer=new Pr;onEmit;now;scheduler;maxInterpolatedSnapshots;started=!1;currentSecMs=0;lastEmittedSnapshot=null;interpolationCount=0;timerHandle=void 0;disposed=!1;constructor(t){this.onEmit=t.onEmit,this.now=t.now??e,this.scheduler=t.scheduler??Fr,this.maxInterpolatedSnapshots=t.maxInterpolatedSnapshots??5}push(e){this.disposed||(this.buffer.enqueue({timestampMs:e.eventTimeMs,snapshot:e}),this.started||this.start(e.eventTimeMs))}dispose(){this.disposed=!0,this.scheduler.clearTimeout(this.timerHandle),this.timerHandle=void 0,this.buffer.clear(),this.lastEmittedSnapshot=null,this.interpolationCount=0,this.started=!1}start(e){this.started=!0,this.currentSecMs=Math.floor(e/Y)*Y,this.scheduleNextTick()}tick=()=>{if(!this.disposed){for(this.processCurrentSecond(),this.currentSecMs+=Y;this.now()>=this.currentSecMs+Y;)this.processCurrentSecond(),this.currentSecMs+=Y;this.scheduleNextTick()}};processCurrentSecond(){let e=this.currentSecMs,t=this.currentSecMs+Y,n=this.buffer.drain(e,t);if(n.length>0){let e=n[n.length-1].snapshot;this.emit(e.bids,e.asks,!1),this.lastEmittedSnapshot=e,this.interpolationCount=0;return}if(this.lastEmittedSnapshot!==null){if(this.interpolationCount<this.maxInterpolatedSnapshots){this.emit(this.lastEmittedSnapshot.bids,this.lastEmittedSnapshot.asks,!0),this.interpolationCount+=1;return}this.emit(Ir,Ir,!0)}}emit(e,t,n){this.onEmit({eventTimeMs:this.currentSecMs,bids:e,asks:t,isInterpolated:n})}scheduleNextTick(){let e=this.currentSecMs+Y,t=Math.max(0,e-this.now());this.timerHandle=this.scheduler.setTimeout(this.tick,t)}};function Rr(e={}){return t=>new D(n=>{let r=new Lr({onEmit:e=>n.next(e),now:e.now,scheduler:e.scheduler,maxInterpolatedSnapshots:e.maxInterpolatedSnapshots}),i=t.subscribe({next:e=>r.push(e),error:e=>n.error(e),complete:()=>n.complete()});return()=>{r.dispose(),i.unsubscribe()}})}var zr={url:``,deserializer:function(e){return JSON.parse(e.data)},serializer:function(e){return JSON.stringify(e)}},Br=`WebSocketSubject.error must be called with an object with an error code, and an optional reason: { code: number, reason: string }`,Vr=function(e){be(t,e);function t(t,n){var r=e.call(this)||this;if(r._socket=null,t instanceof D)r.destination=n,r.source=t;else{var i=r._config=k({},zr);if(r._output=new _e,typeof t==`string`)i.url=t;else for(var a in t)t.hasOwnProperty(a)&&(i[a]=t[a]);if(!i.WebSocketCtor&&WebSocket)i.WebSocketCtor=WebSocket;else if(!i.WebSocketCtor)throw Error(`no WebSocket constructor can be found`);r.destination=new O}return r}return t.prototype.lift=function(e){var n=new t(this._config,this.destination);return n.operator=e,n.source=this,n},t.prototype._resetState=function(){this._socket=null,this.source||(this.destination=new O),this._output=new _e},t.prototype.multiplex=function(e,t,n){var r=this;return new D(function(i){try{r.next(e())}catch(e){i.error(e)}var a=r.subscribe({next:function(e){try{n(e)&&i.next(e)}catch(e){i.error(e)}},error:function(e){return i.error(e)},complete:function(){return i.complete()}});return function(){try{r.next(t())}catch(e){i.error(e)}a.unsubscribe()}})},t.prototype._connectSocket=function(){var e=this,t=this._config,n=t.WebSocketCtor,r=t.protocol,i=t.url,a=t.binaryType,o=this._output,s=null;try{s=r?new n(i,r):new n(i),this._socket=s,a&&(this._socket.binaryType=a)}catch(e){o.error(e);return}var c=new x(function(){e._socket=null,s&&s.readyState===1&&s.close()});s.onopen=function(t){if(!e._socket){s.close(),e._resetState();return}var n=e._config.openObserver;n&&n.next(t);var r=e.destination;e.destination=y.create(function(t){if(s.readyState===1)try{var n=e._config.serializer;s.send(n(t))}catch(t){e.destination.error(t)}},function(t){var n=e._config.closingObserver;n&&n.next(void 0),t&&t.code?s.close(t.code,t.reason):o.error(TypeError(Br)),e._resetState()},function(){var t=e._config.closingObserver;t&&t.next(void 0),s.close(),e._resetState()}),r&&r instanceof O&&c.add(r.subscribe(e.destination))},s.onerror=function(t){e._resetState(),o.error(t)},s.onclose=function(t){s===e._socket&&e._resetState();var n=e._config.closeObserver;n&&n.next(t),t.wasClean?o.complete():o.error(t)},s.onmessage=function(t){try{var n=e._config.deserializer;o.next(n(t))}catch(e){o.error(e)}}},t.prototype._subscribe=function(e){var t=this,n=this.source;return n?n.subscribe(e):(this._socket||this._connectSocket(),this._output.subscribe(e),e.add(function(){var e=t._socket;t._output.observers.length===0&&(e&&(e.readyState===1||e.readyState===0)&&e.close(),t._resetState())}),e)},t.prototype.unsubscribe=function(){var t=this._socket;t&&(t.readyState===1||t.readyState===0)&&t.close(),this._resetState(),e.prototype.unsubscribe.call(this)},t}(ne);function Hr(e){return new Vr(e)}var Ur=Symbol(`ws-open`),Wr=class extends Error{url;timeoutMs;constructor(e,t){super(`WebSocket open timeout after ${t}ms for ${e}`),this.name=`WsOpenTimeoutError`,this.url=e,this.timeoutMs=t}};function Gr(e,t){let n=t?.timeoutMs??1e4,r=Ae(e.url)?e.url:``;return P(()=>{let t=new O(1),i=e.openObserver;return fe(t,Hr({...e,openObserver:{next:e=>{t.next(Ur),t.complete(),i?.next(e)}}})).pipe(Le({first:n,with:()=>M(()=>new Wr(r,n))}),te(e=>e!==Ur))})}var Kr=1e3,qr=5;function Jr(e,t,n,r){let i=[],a=n-t;if(a<=0)return i;let o=Math.ceil(a/r);for(let a=1;a<=o;a++){let o=t+a*r;if(o>=n)break;i.push({...e,eventTimeMs:o})}return i}function Yr(e){let{streamHost:t,instrument:n,updateSpeedMs:r,depth:i,restUrl:a,onSequenceGap:o,maxSequenceGapRetries:s}=e,c=Gr({url:`${t}/ws/${n.toLowerCase()}@depth@${r}ms`});return P(()=>Nr({rawUpdates$:c,restUrl:a,instrument:n,depth:i})).pipe(pe({count:s??qr,delay:e=>e instanceof Dr?(o?.(e.info),ae(!0)):M(()=>e)}))}function Xr(t){let{streamHost:n,apiHost:r,instrument:i,depth:a,updateSpeedMs:o,restSnapshotLimit:s,aggregationQuoteStep:c,reconnectDelayMs:l,onSequenceGap:u,maxSequenceGapRetries:d,maxInterpolatedSnapshots:f}=t,p=`${r}/depth?symbol=${i.toUpperCase()}&limit=${s}`,m=l??Kr,h=null,g=null,_=!0;return P(()=>{let t=[],r=null;h!==null&&g!==null&&!_&&(r=g,g=null);let s=Yr({streamHost:n,instrument:i,updateSpeedMs:o,depth:a,restUrl:p,onSequenceGap:u,maxSequenceGapRetries:d}).pipe(he(n=>{if(r!==null&&h!==null){let n=e();t=Jr(h,r,n,o),r=null}h=n,_=!1}),$e(()=>{h!==null&&!_&&(g=e())})),c=P(()=>M(()=>new Or));return t.length>0?N(T(t),s,c):N(s,c)}).pipe(pe({delay:()=>Er(m)}),E(e=>Tr(Zr(e),c)),Rr({maxInterpolatedSnapshots:f}))}function Zr(e){return{eventTimeMs:e.eventTimeMs,bids:e.bids,asks:e.asks}}var Qr=5,$r=class{connection=`idle`;snapshotsReceived=0;lastDisplaySnapshotTimeMs=void 0;blocksPersisted=0;priceStep=void 0;errorMessage=void 0;selectedCell=void 0;interpolatedStreak=0;subscription=void 0;accumulator=void 0;midPriceAccumulator=void 0;chartState=void 0;db=void 0;taskManager=void 0;dataController=void 0;pageHideHandler=void 0;hitTestToken=0;attachToken=0;constructor(){Ce(this,{},{autoBind:!0})}async attachCanvas(t){if(this.chartState!==void 0)return;let n=this.attachToken,r;try{r=await pr(),await r.clearAll()}catch(e){console.warn(`binance-view: IndexedDB unavailable, history will not persist`,e),r=void 0}if(n!==this.attachToken){r?.close();return}let i=new tr({canvas:t,pageOpenTimeMs:e(),updateSpeedMs:K.updateSpeedMs,priceStep:K.aggregationQuoteStep}),a=new cr,o=new rr({registry:i.registry,db:r?.orderbook,getActiveBlock:()=>this.accumulator?.getActiveBlock()??null,updateSpeedMs:K.updateSpeedMs,depth:K.aggregatedDepth,snapshotSlots:128});if(!await i.init({taskManager:a,dataController:o})){j(()=>{this.connection=`unsupported`}),i.dispose(),a.dispose(),o.dispose(),r?.close();return}if(n!==this.attachToken){i.dispose(),a.dispose(),o.dispose(),r?.close();return}let s=()=>{this.db?.clearAll()};j(()=>{this.db=r,this.chartState=i,this.taskManager=a,this.dataController=o,this.pageHideHandler=s}),window.addEventListener(`pagehide`,s)}startStream(){this.subscription!==void 0||this.connection===`unsupported`||(this.connection=`connecting`,this.errorMessage=void 0,this.loadPriceStep(),this.accumulator=new hr({snapshotsPerBlock:K.snapshotsPerBlock,flushEverySnapshots:K.flushEverySnapshots,snapshotSlots:128,depth:K.aggregatedDepth,updateSpeedMs:K.updateSpeedMs,onFlush:this.handleFlush}),this.midPriceAccumulator=new Cr({samplesPerBlock:256,updateSpeedMs:K.updateSpeedMs,flushEverySamples:1,onFlush:this.handleMidPriceFlush}),this.subscription=Xr({streamHost:K.streamHost,apiHost:K.apiHost,instrument:K.instrument,depth:K.rawDepth,updateSpeedMs:K.updateSpeedMs,restSnapshotLimit:K.restSnapshotLimit,aggregationQuoteStep:K.aggregationQuoteStep,reconnectDelayMs:K.reconnectDelayMs,maxSequenceGapRetries:K.maxSequenceGapRetries}).subscribe({next:this.handleSnapshot,error:this.handleError}))}dispose(){if(this.attachToken++,this.pageHideHandler!==void 0&&(window.removeEventListener(`pagehide`,this.pageHideHandler),this.pageHideHandler=void 0),this.subscription?.unsubscribe(),this.subscription=void 0,this.chartState?.dispose(),this.chartState=void 0,this.taskManager?.dispose(),this.taskManager=void 0,this.dataController?.dispose(),this.dataController=void 0,this.accumulator?.dispose(),this.accumulator=void 0,this.midPriceAccumulator?.dispose(),this.midPriceAccumulator=void 0,this.db!==void 0){let e=this.db;this.db=void 0,e.clearAll().finally(()=>e.close())}this.connection=`idle`,this.snapshotsReceived=0,this.interpolatedStreak=0,this.lastDisplaySnapshotTimeMs=void 0,this.selectedCell=void 0}async resolveCellAt(e){if(this.chartState===void 0||this.dataController===void 0)return;let t=++this.hitTestToken,n=await this.dataController.resolveCellAt({pointerPx:e,plotRect:{width:z(this.chartState.canvas.clientWidth),height:this.chartState.canvas.clientHeight},viewport:this.chartState.viewport,priceStep:K.aggregationQuoteStep});t===this.hitTestToken&&j(()=>{this.selectedCell=n??void 0})}clearSelectedCell(){this.hitTestToken++,this.selectedCell=void 0}async loadPriceStep(){let e=await _r(K.apiHost,K.instrument);j(()=>{this.priceStep=e??K.fallbackPriceStep})}handleSnapshot(e){this.snapshotsReceived++,e.isInterpolated?(this.interpolatedStreak+=1,this.connection=this.interpolatedStreak>=Qr?`disconnected`:`connected`):(this.interpolatedStreak=0,this.connection=`connected`),this.accumulator?.addSnapshot(e);let t=Wn(e);t!==void 0&&this.midPriceAccumulator?.addSample({eventTimeMs:e.eventTimeMs,price:t})}handleFlush(e){this.chartState?.ingestFlush(e),j(()=>{this.lastDisplaySnapshotTimeMs=e.block.lastTimestampMs}),this.persistFlushedBlock(e),e.isNewBlock&&this.enforceHistoryCap()}async persistFlushedBlock(e){if(this.db===void 0)return;let t=new ArrayBuffer(e.data.byteLength);new Uint8Array(t).set(new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength));let n={blockId:e.block.blockId,firstTimestampMs:e.block.firstTimestampMs,lastTimestampMs:e.block.lastTimestampMs,count:e.block.count,textureRowIndex:e.block.textureRowIndex,data:t};try{await this.db.orderbook.putBlock(n),e.isNewBlock&&j(()=>{this.blocksPersisted++})}catch(e){console.warn(`binance-view: IndexedDB putBlock failed`,e)}}enforceHistoryCap(){if(this.chartState===void 0)return;let e=this.chartState.registry;for(;e.size>29;){let t=e.oldestStartMs();if(t===void 0)break;let n=e.get(t);if(n===void 0)break;e.remove(t),this.chartState.releaseBlockSlot(n.blockId),this.db?.orderbook.deleteBlock(n.blockId).catch(()=>{})}}handleError(e){this.connection=`error`,this.errorMessage=e instanceof Error?e.message:String(e)}handleMidPriceFlush(e){this.chartState?.ingestMidPriceFlush(e),this.persistMidPriceBlock(e),e.isNewBlock&&this.enforceMidPriceHistoryCap()}async persistMidPriceBlock(e){if(this.db===void 0)return;let t=new ArrayBuffer(e.data.byteLength);new Uint8Array(t).set(new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength));try{await this.db.midPrice.putBlock({blockId:e.block.blockId,firstTimestampMs:e.block.firstTimestampMs,lastTimestampMs:e.block.lastTimestampMs,basePrice:e.block.basePrice,count:e.block.count,textureRowIndex:e.block.textureRowIndex,data:t})}catch(e){console.warn(`binance-view: IndexedDB mid-price putBlock failed`,e)}}enforceMidPriceHistoryCap(){if(this.chartState===void 0)return;let e=this.chartState.midPriceIndex;for(;e.size>16;){let t=e.oldestStartMs();if(t===void 0)break;let n=e.get(t);if(n===void 0)break;e.remove(t),this.chartState.releaseMidPriceBlockSlot(n.blockId),this.db?.midPrice.deleteBlock(n.blockId).catch(()=>{})}}};function ei(){return Se().getOrCreateFeatureStore(`binance-view`,()=>new $r)}var X=h({en:{status:{idle:`Idle`,connecting:`Connecting…`,connected:`Connected`,reconnecting:`Reconnecting…`,disconnected:`Disconnected`,resyncing:`Resyncing orderbook…`,error:`Connection error`,unsupported:`WebGPU device does not meet requirements (maxTextureDimension2D >= 8192)`},tooltip:{time:`Time`,price:`Price`,volume:`Volume`,side:`Side`,bid:`Bid`,ask:`Ask`,loading:`Loading…`},comingSoon:`Binance orderbook heatmap — coming soon`,live:{instrument:e=>`Instrument: ${e}`,awaitingSnapshot:`Waiting for REST snapshot…`,snapshotReceived:`REST snapshot received, listening for updates`,totalSnapshots:e=>`Total snapshots received: ${e}`,lastSnapshotTime:e=>`Last snapshot: ${e}`,errorPrefix:`Error: `,expand:`Show details`,collapse:`Hide details`}},ru:{status:{idle:`Ожидание`,connecting:`Подключение…`,connected:`Подключено`,reconnecting:`Переподключение…`,disconnected:`Отключено`,resyncing:`Синхронизация стакана…`,error:`Ошибка подключения`,unsupported:`WebGPU-устройство не поддерживает требуемые лимиты (maxTextureDimension2D ≥ 8192)`},tooltip:{time:`Время`,price:`Цена`,volume:`Объём`,side:`Сторона`,bid:`Bid`,ask:`Ask`,loading:`Загрузка…`},comingSoon:`Тепловая карта стакана Binance — скоро`,live:{instrument:e=>`Инструмент: ${e}`,awaitingSnapshot:`Ожидаем REST-снепшот…`,snapshotReceived:`REST-снепшот получен, слушаем обновления`,totalSnapshots:e=>`Всего снепшотов получено: ${e}`,lastSnapshotTime:e=>`Последний снепшот: ${e}`,errorPrefix:`Ошибка: `,expand:`Показать детали`,collapse:`Скрыть детали`}}}),Z=t(),Q=14,$=4;function ti(e){switch(e){case`bid`:return X.tooltip.bid;case`ask`:return X.tooltip.ask;case`padding`:return`—`}}function ni(e,t){return e.toLocaleString(`en-US`,{minimumFractionDigits:t,maximumFractionDigits:t})}var ri=we(()=>{let e=ei().selectedCell,t=(0,I.useRef)(null);if((0,I.useLayoutEffect)(()=>{let n=t.current;if(n===null||e===void 0)return;let r=n.offsetParent?.getBoundingClientRect(),i=r?.width??window.innerWidth,a=r?.height??window.innerHeight,o=n.getBoundingClientRect(),s=o.width,c=o.height,l=e.pointerPx.x+Q;l+s+$>i&&(l=e.pointerPx.x-s-Q);let u=e.pointerPx.y+Q;u+c+$>a&&(u=e.pointerPx.y-c-Q);let d=Math.max($,Math.min(l,i-s-$)),f=Math.max($,Math.min(u,a-c-$));n.style.left=`${d}px`,n.style.top=`${f}px`,n.style.visibility=`visible`},[e]),e===void 0)return null;let n=l(e.timestampMs);return(0,Z.jsx)(`div`,{ref:t,style:{visibility:`hidden`,left:0,top:0},className:`pointer-events-none absolute z-20 min-w-[180px] rounded-md border border-border bg-surface-elevated/95 px-3 py-2 text-xs text-text-secondary shadow-lg backdrop-blur`,children:(0,Z.jsxs)(`dl`,{className:`grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono`,children:[(0,Z.jsx)(`dt`,{className:`text-text-muted`,children:X.tooltip.time}),(0,Z.jsx)(`dd`,{className:`text-text`,children:n}),(0,Z.jsx)(`dt`,{className:`text-text-muted`,children:X.tooltip.price}),(0,Z.jsx)(`dd`,{className:`text-text`,children:ni(e.price,2)}),(0,Z.jsx)(`dt`,{className:`text-text-muted`,children:X.tooltip.volume}),(0,Z.jsx)(`dd`,{className:`text-text`,children:ni(e.volume,6)}),(0,Z.jsx)(`dt`,{className:`text-text-muted`,children:X.tooltip.side}),(0,Z.jsx)(`dd`,{className:`text-text`,children:ti(e.side)})]})})});function ii(e){switch(e){case`idle`:return X.status.idle;case`connecting`:return X.status.connecting;case`connected`:return X.status.connected;case`reconnecting`:return X.status.reconnecting;case`disconnected`:return X.status.disconnected;case`error`:return X.status.error;case`unsupported`:return X.status.unsupported}}function ai(e){switch(e){case`connected`:return`bg-success/20 text-success`;case`connecting`:case`reconnecting`:return`bg-info/20 text-info animate-pulse`;case`disconnected`:return`bg-warning/20 text-warning`;case`error`:case`unsupported`:return`bg-error/20 text-error`;case`idle`:return`bg-surface-elevated text-text-muted`}}var oi=we(()=>{let e=ei(),[t,n]=(0,I.useState)(!1),r=A(()=>{n(e=>!e)}),i=e.connection===`connecting`&&e.snapshotsReceived===0,a=e.lastDisplaySnapshotTimeMs===void 0?void 0:l(e.lastDisplaySnapshotTimeMs);return(0,Z.jsxs)(`div`,{className:`pointer-events-auto absolute left-4 top-4 z-10 flex max-w-sm flex-col gap-2 rounded-lg border border-border bg-surface-elevated/85 px-3 py-2 text-xs text-text-secondary backdrop-blur`,children:[(0,Z.jsxs)(`button`,{type:`button`,onClick:r,className:`flex cursor-pointer items-center gap-2`,"aria-expanded":t,"aria-label":t?X.live.collapse:X.live.expand,children:[(0,Z.jsx)(`span`,{className:`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ai(e.connection)}`,children:ii(e.connection)}),(0,Z.jsx)(`span`,{className:`text-text-muted`,children:X.live.instrument(K.instrument)})]}),t?(0,Z.jsxs)(Z.Fragment,{children:[(0,Z.jsx)(`p`,{children:i?X.live.awaitingSnapshot:X.live.snapshotReceived}),(0,Z.jsxs)(`ul`,{className:`flex flex-col gap-0.5 font-mono`,children:[(0,Z.jsx)(`li`,{children:X.live.totalSnapshots(e.snapshotsReceived)}),a===void 0?null:(0,Z.jsx)(`li`,{children:X.live.lastSnapshotTime(a)})]}),e.errorMessage===void 0?null:(0,Z.jsxs)(`p`,{className:`text-error`,children:[X.live.errorPrefix,e.errorMessage]})]}):null]})}),si=we(()=>{let e=ei(),t=(0,I.useRef)(null),n=(0,I.useRef)(null),r=(0,I.useRef)(!1),i=(0,I.useRef)(void 0),a=A(()=>{if(i.current=void 0,!r.current)return;let t=n.current;t!==null&&e.resolveCellAt(t),i.current=requestAnimationFrame(a)}),o=A(()=>{r.current||(r.current=!0,i.current===void 0&&(i.current=requestAnimationFrame(a)))}),s=A(()=>{r.current=!1,i.current!==void 0&&(cancelAnimationFrame(i.current),i.current=void 0),n.current=null}),c=A(e=>{if(e.buttons!==0)return;let t=e.currentTarget.getBoundingClientRect();n.current={x:e.clientX-t.left,y:e.clientY-t.top},o()}),l=A(()=>{s(),e.clearSelectedCell()}),u=A(()=>{s(),e.clearSelectedCell()});return(0,I.useEffect)(()=>{let n=t.current;if(n===null)return;let r=!0;return e.attachCanvas(n).then(()=>{r&&e.startStream()}),()=>{r=!1,s(),e.dispose()}},[e,s]),(0,Z.jsxs)(`div`,{className:`${Ee.fixedContainer} relative h-full w-full bg-[#1a1a1a]`,children:[(0,Z.jsx)(`canvas`,{ref:t,className:`absolute inset-0 h-full w-full [touch-action:none]`,onPointerMove:c,onPointerDown:l,onPointerLeave:u}),(0,Z.jsx)(oi,{}),(0,Z.jsx)(ri,{})]})}),ci=(0,I.memo)(()=>(0,Z.jsx)(Te,{className:`h-full w-full`,children:(0,Z.jsx)(si,{})}));export{ci as BinanceView};