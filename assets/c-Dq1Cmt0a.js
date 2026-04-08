import{D as e,M as t,N as n,P as r,j as i,st as a}from"./c-D2N51Ix1.js";import{t as o}from"./c-CLIWQxFX.js";var s=a(n(),1),c=function(e){return e[e.Year=0]=`Year`,e[e.Month=1]=`Month`,e[e.Week=2]=`Week`,e[e.Day=3]=`Day`,e[e.Hour=4]=`Hour`,e[e.Minute=5]=`Minute`,e}({}),l=60,u=3600,d=86400,f=60,p=24,m=[1,2,5],h=8,g=2,_=70,v=20,y=10;function b(t){let n=BigInt(Math.trunc(t))*1000000000n;return e.Instant.fromEpochNanoseconds(n)}function ee(e,t){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}`}function te(e,t,n){return`${String(e).padStart(2,`0`)}:${String(t).padStart(2,`0`)}:${String(n).padStart(2,`0`)}`}function x(e,t,n,r,i){if(e.length<=1||r<=0)return e;let a=n-t;if(a<=0)return e;let o=i+y,s=[],c=-1/0;for(let n of e){let e=(n.position-t)/a*r;e-c>=o&&(s.push(n),c=e)}return s}function ne(e,t,n,r){return x(S(e,t,n),e,t,r,_)}function S(t,n,r){let i=[];switch(r){case c.Year:{let r=b(t).toZonedDateTimeISO(`UTC`),a=b(n).toZonedDateTimeISO(`UTC`),o=r.with({day:1,hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(o,r)<0&&(o=o.add({months:1}));e.ZonedDateTime.compare(o,a)<=0;)i.push({position:Number(o.epochNanoseconds/1000000000n),label:o.toPlainDate().toLocaleString(`en-US`,{month:`short`})}),o=o.add({months:1});break}case c.Month:{let r=b(t).toZonedDateTimeISO(`UTC`),a=b(n).toZonedDateTimeISO(`UTC`),o=r.with({hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(o,r)<0&&(o=o.add({days:1}));e.ZonedDateTime.compare(o,a)<=0;)i.push({position:Number(o.epochNanoseconds/1000000000n),label:String(o.day)}),o=o.add({days:1});break}case c.Week:{let r=b(t).toZonedDateTimeISO(`UTC`),a=b(n).toZonedDateTimeISO(`UTC`),o=[`Mon`,`Tue`,`Wed`,`Thu`,`Fri`,`Sat`,`Sun`],s=r.with({hour:0,minute:0,second:0,nanosecond:0});for(e.ZonedDateTime.compare(s,r)<0&&(s=s.add({days:1}));e.ZonedDateTime.compare(s,a)<=0;){let e=s.dayOfWeek;i.push({position:Number(s.epochNanoseconds/1000000000n),label:o[e-1]}),s=s.add({days:1})}break}case c.Day:{let e=Math.ceil(t/u),r=Math.floor(n/u);for(let t=e;t<=r;t++){let e=t*u,n=(t%p+p)%p;i.push({position:e,label:ee(n,0)})}break}case c.Hour:{let e=Math.ceil(t/l),r=Math.floor(n/l);for(let t=e;t<=r;t++){let e=t*l,n=Math.floor(e%d/l),r=Math.floor(n/f),a=n%f;i.push({position:e,label:ee((r%p+p)%p,a)})}break}case c.Minute:{let e=Math.ceil(t),r=Math.floor(n);for(let t=e;t<=r;t++){let e=t%d,n=Math.floor(e/u),r=Math.floor(e%u/l),a=e%l;i.push({position:t,label:te((n%p+p)%p,r,a)})}break}}return i}function re(e){if(e<=0)return 1;let t=10**Math.floor(Math.log10(e)),n=e/t;for(let e of m)if(e>=n)return e*t;return m[0]*t*10}function ie(e,t,n){let r=t-e;if(r<=0)return[{position:e,label:ae(e,1)}];let i=re(r/h);Math.floor(r/i)<g&&(i=re(r/g));let a=Math.max(0,-Math.floor(Math.log10(i))+1),o=[],s=Math.ceil(e/i)*i;for(let n=s;n<=t+i*.01;n+=i)n>=e&&n<=t&&o.push({position:n,label:ae(n,a)});return x(o,e,t,n,v)}function ae(e,t){return e.toFixed(t)}var C=2048,oe=.1,se=1767225600;48/Float32Array.BYTES_PER_ELEMENT;var ce=.9,le=1.1,ue=.18,de=365*24*3600,w=`http://www.w3.org/2000/svg`,fe=`#999`,pe=`#555`,me=`#333`,he=`monospace`,T=255,E=255,D=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),O=new Float32Array(D),k=new Uint32Array(D);function A(e,t,n,r){let i=Math.round(r*E)&T,a=Math.round(e*E)&T,o=Math.round(t*E)&T,s=Math.min(Math.round(n*E)&T,126);return k[0]=i|a<<8|o<<16|s<<24,O[0]}var j=2654435761,M=16,N=4294967296;function P(e){let t=Math.imul(e,j)>>>0,n=(t^t>>>M)>>>0;return{value:n/N,next:n}}function F(e,t){return P((Math.trunc(e*1e3)^Math.imul(t,j))>>>0).value-.5}var I=366,L=.5,ge=100,R;function _e(){if(R!==void 0)return R;let e=new Float64Array(I),t=new Float64Array(I),n=se,r=de/(I-1),i=42,a=ge;for(let o=0;o<I;o++){e[o]=n+o*r;let s=P(i);i=s.next,a+=(s.value-.5)*L,t[o]=a}return R={times:e,values:t},R}function ve(e){let{times:t,values:n}=_e();if(e<=t[0])return n[0];if(e>=t[I-1])return n[I-1];let r=0,i=I-1;for(;i-r>1;){let n=r+i>>1;t[n]<=e?r=n:i=n}let a=(e-t[r])/(t[i]-t[r]);return n[r]+a*(n[i]-n[r])}var z={[c.Year]:0,[c.Month]:.15,[c.Week]:.08,[c.Day]:.04,[c.Hour]:.02,[c.Minute]:.01},B={[c.Year]:365,[c.Month]:300,[c.Week]:168,[c.Day]:480,[c.Hour]:360,[c.Minute]:60},V=1,ye=10-V;function H(e){return A(e,.8-e*.6,1-e*.2,1)}function U(e){return V+(F(e,7)+.5)*ye}function be(e,t,n){return n===c.Year?W(e,t):G(e,t,n)}function W(e,t){let{times:n,values:r}=_e(),i=[],a=n[I-1]-n[0];for(let o=0;o<I;o++)if(n[o]>=e&&n[o]<=t){let e=(n[o]-n[0])/a;i.push({time:n[o],value:r[o],size:U(n[o]),color:H(e)})}return i}function G(e,t,n){let r=B[n],i=(t-e)/(r-1),a=z[n],o=se,s=de,c=Array(r);for(let t=0;t<r;t++){let r=e+t*i,l=ve(r),u=0,d=n;for(let e=1;e<=d;e++){let t=z[e]??0;u+=F(r,e)*t}let f=l+u*a*10,p=(r-o)/s,m=Math.max(0,Math.min(1,p));c[t]={time:r,value:f,size:U(r),color:H(m)}}return c}var xe=3;function Se(e,t,n){let r=new ArrayBuffer(e.length*4*Float32Array.BYTES_PER_ELEMENT),i=new Float32Array(r),a=new Uint32Array(r);for(let r=0;r<e.length;r++){let o=r*4,s=e[r];i[o]=s.time-t,i[o+1]=s.value-n,i[o+2]=s.size,a[o+xe]=Ee(s.color)}return i}var Ce=new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT),we=new Float32Array(Ce),Te=new Uint32Array(Ce);function Ee(e){return we[0]=e,Te[0]}var De=`struct Uniforms {
    viewport: vec2<f32>,      // canvas size in pixels
    timeRangeMin: f32,        // visible time range start (delta from base)
    timeRangeMax: f32,        // visible time range end (delta from base)
    valueRangeMin: f32,       // visible value range start (delta from base)
    valueRangeMax: f32,       // visible value range end (delta from base)
    pointCount: u32,          // number of points in this draw call
    textureWidth: u32,        // TEXTURE_WIDTH constant
    lineWidth: f32,           // DPR scale factor for per-point sizes
    textureRow: u32,          // starting row in the data texture
    baseTime: f32,            // base time for delta decoding
    baseValue: f32,           // base value for delta decoding
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var dataTexture: texture_2d<f32>;

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) joinCenter: vec2<f32>,
    @location(2) joinWidth: f32,
};

// 6 vertices for a join quad (circle at a point)
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

const BYTE_MASK: u32 = 0xFFu;
const SHIFT_R: u32 = 8u;
const SHIFT_G: u32 = 16u;
const SHIFT_B: u32 = 24u;
const COLOR_SCALE: f32 = 255.0;

const JOIN_A_END: u32 = 6u;
const JOIN_B_END: u32 = 12u;

// Layout matches packColor: [A bits 0-7] [R bits 8-15] [G bits 16-23] [B bits 24-31]
fn unpackColorWgsl(packed: f32) -> vec4<f32> {
    let bits = bitcast<u32>(packed);
    let a = f32(bits & BYTE_MASK) / COLOR_SCALE;
    let r = f32((bits >> SHIFT_R) & BYTE_MASK) / COLOR_SCALE;
    let g = f32((bits >> SHIFT_G) & BYTE_MASK) / COLOR_SCALE;
    let b = f32((bits >> SHIFT_B) & BYTE_MASK) / COLOR_SCALE;
    return vec4<f32>(r, g, b, a);
}

fn readPoint(index: u32) -> vec4<f32> {
    let row = U.textureRow + index / U.textureWidth;
    let col = index % U.textureWidth;
    return textureLoad(dataTexture, vec2<u32>(col, row), 0);
}

fn safeNormalize(v: vec2<f32>) -> vec2<f32> {
    let len2 = dot(v, v);
    if (len2 > 1e-20) {
        return v * inverseSqrt(len2);
    }
    return vec2<f32>(0.0, 1.0);
}

fn dataToPixel(timeDelta: f32, valueDelta: f32) -> vec2<f32> {
    let timeRange = U.timeRangeMax - U.timeRangeMin;
    let valueRange = U.valueRangeMax - U.valueRangeMin;

    let nx = (timeDelta - U.timeRangeMin) / timeRange;
    let ny = (valueDelta - U.valueRangeMin) / valueRange;

    return vec2<f32>(nx * U.viewport.x, ny * U.viewport.y);
}

fn pixelToClip(pixel: vec2<f32>) -> vec2<f32> {
    return (pixel / U.viewport) * 2.0 - 1.0;
}

// 18 vertices per instance: 6 join A + 6 join B + 6 rect body
@vertex
fn vs(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VSOut {
    var out: VSOut;

    let pointA = readPoint(iid);
    let pointB = readPoint(iid + 1u);

    let pixelA = dataToPixel(pointA.x, pointA.y);
    let pixelB = dataToPixel(pointB.x, pointB.y);

    let dpr = max(1.0, U.lineWidth);
    let widthA = pointA.z * dpr;
    let widthB = pointB.z * dpr;

    let colorA = unpackColorWgsl(pointA.w);
    let colorB = unpackColorWgsl(pointB.w);

    if (vid < JOIN_A_END) {
        // Join circle at point A
        let basis = JOIN_BASIS[vid];
        out.joinCenter = basis;
        out.joinWidth = widthA;
        out.color = colorA;

        let offset = basis * widthA;
        out.position = vec4<f32>(pixelToClip(pixelA + offset), 0.0, 1.0);
    } else if (vid < JOIN_B_END) {
        // Join circle at point B
        let localVid = vid - JOIN_A_END;
        let basis = JOIN_BASIS[localVid];
        out.joinCenter = basis;
        out.joinWidth = widthB;
        out.color = colorB;

        let offset = basis * widthB;
        out.position = vec4<f32>(pixelToClip(pixelB + offset), 0.0, 1.0);
    } else {
        // Line body rectangle
        let localVid = vid - JOIN_B_END;
        let basis = RECT_BASIS[localVid];

        out.joinCenter = vec2<f32>(0.0, 0.0);
        out.joinWidth = 0.0;

        let dir = pixelB - pixelA;
        let normal = safeNormalize(vec2<f32>(-dir.y, dir.x));

        let w = mix(widthA, widthB, basis.x);
        let basePixel = mix(pixelA, pixelB, basis.x);
        let offsetPixel = basePixel + normal * (basis.y * w);

        out.color = mix(colorA, colorB, basis.x);
        out.position = vec4<f32>(pixelToClip(offsetPixel), 0.0, 1.0);
    }

    return out;
}

// ── Rhombus rendering ────────────────────────────────────────────────

// Quad positions: 6 vertices forming two triangles covering [-0.5, 0.5]
const QUAD_POSITIONS: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, 0.5),
    vec2<f32>(-0.5, 0.5),
);

struct RhombusVSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) uv: vec2<f32>,
};

// One instance per point — renders a quad, rhombus shape cut in fragment shader
@vertex
fn vsRhombus(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> RhombusVSOut {
    var out: RhombusVSOut;

    let point = readPoint(iid);
    let center = dataToPixel(point.x, point.y);
    let dpr = max(1.0, U.lineWidth);
    let size = point.z * dpr * 4.0;

    let quadPos = QUAD_POSITIONS[vid];
    out.uv = quadPos; // UV in [-0.5, 0.5]

    let pixel = center + quadPos * size;

    out.position = vec4<f32>(pixelToClip(pixel), 0.0, 1.0);
    out.color = unpackColorWgsl(point.w);

    return out;
}

// Rhombus test: |x| / 0.3 + |y| / 0.5 <= 1 (diamond inscribed in the quad)
const RHOMBUS_HALF_W: f32 = 0.3;
const RHOMBUS_HALF_H: f32 = 0.5;

@fragment
fn fsRhombus(in: RhombusVSOut) -> @location(0) vec4<f32> {
    if (abs(in.uv.x) / RHOMBUS_HALF_W + abs(in.uv.y) / RHOMBUS_HALF_H > 1.0) {
        discard;
    }
    return in.color;
}

// ── Line fragment shader ─────────────────────────────────────────────

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
    // Discard pixels outside the join circle
    if (in.joinWidth > 0.0 && dot(in.joinCenter, in.joinCenter) > 0.25) {
        discard;
    }
    return in.color;
}
`;function Oe(e,t,n=0,r=e.length-1,i=q){for(;r>n;){if(r-n>600){let a=r-n+1,o=t-n+1,s=Math.log(a),c=.5*Math.exp(2*s/3),l=.5*Math.sqrt(s*c*(a-c)/a)*(o-a/2<0?-1:1);Oe(e,t,Math.max(n,Math.floor(t-o*c/a+l)),Math.min(r,Math.floor(t+(a-o)*c/a+l)),i)}let a=e[t],o=n,s=r;for(K(e,n,t),i(e[r],a)>0&&K(e,n,r);o<s;){for(K(e,o,s),o++,s--;i(e[o],a)<0;)o++;for(;i(e[s],a)>0;)s--}i(e[n],a)===0?K(e,n,s):(s++,K(e,s,r)),s<=t&&(n=s+1),t<=s&&(r=s-1)}}function K(e,t,n){let r=e[t];e[t]=e[n],e[n]=r}function q(e,t){return e<t?-1:e>t?1:0}var ke=class{constructor(e=9){this._maxEntries=Math.max(4,e),this._minEntries=Math.max(2,Math.ceil(this._maxEntries*.4)),this.clear()}all(){return this._all(this.data,[])}search(e){let t=this.data,n=[];if(!Le(e,t))return n;let r=this.toBBox,i=[];for(;t;){for(let a=0;a<t.children.length;a++){let o=t.children[a],s=t.leaf?r(o):o;Le(e,s)&&(t.leaf?n.push(o):Ie(e,s)?this._all(o,n):i.push(o))}t=i.pop()}return n}collides(e){let t=this.data;if(!Le(e,t))return!1;let n=[];for(;t;){for(let r=0;r<t.children.length;r++){let i=t.children[r],a=t.leaf?this.toBBox(i):i;if(Le(e,a)){if(t.leaf||Ie(e,a))return!0;n.push(i)}}t=n.pop()}return!1}load(e){if(!(e&&e.length))return this;if(e.length<this._minEntries){for(let t=0;t<e.length;t++)this.insert(e[t]);return this}let t=this._build(e.slice(),0,e.length-1,0);if(!this.data.children.length)this.data=t;else if(this.data.height===t.height)this._splitRoot(this.data,t);else{if(this.data.height<t.height){let e=this.data;this.data=t,t=e}this._insert(t,this.data.height-t.height-1,!0)}return this}insert(e){return e&&this._insert(e,this.data.height-1),this}clear(){return this.data=Q([]),this}remove(e,t){if(!e)return this;let n=this.data,r=this.toBBox(e),i=[],a=[],o,s,c;for(;n||i.length;){if(n||(n=i.pop(),s=i[i.length-1],o=a.pop(),c=!0),n.leaf){let r=J(e,n.children,t);if(r!==-1)return n.children.splice(r,1),i.push(n),this._condense(i),this}!c&&!n.leaf&&Ie(n,r)?(i.push(n),a.push(o),o=0,s=n,n=n.children[0]):s?(o++,n=s.children[o],c=!1):n=null}return this}toBBox(e){return e}compareMinX(e,t){return e.minX-t.minX}compareMinY(e,t){return e.minY-t.minY}toJSON(){return this.data}fromJSON(e){return this.data=e,this}_all(e,t){let n=[];for(;e;)e.leaf?t.push(...e.children):n.push(...e.children),e=n.pop();return t}_build(e,t,n,r){let i=n-t+1,a=this._maxEntries,o;if(i<=a)return o=Q(e.slice(t,n+1)),Y(o,this.toBBox),o;r||(r=Math.ceil(Math.log(i)/Math.log(a)),a=Math.ceil(i/a**(r-1))),o=Q([]),o.leaf=!1,o.height=r;let s=Math.ceil(i/a),c=s*Math.ceil(Math.sqrt(a));Re(e,t,n,c,this.compareMinX);for(let i=t;i<=n;i+=c){let t=Math.min(i+c-1,n);Re(e,i,t,s,this.compareMinY);for(let n=i;n<=t;n+=s){let i=Math.min(n+s-1,t);o.children.push(this._build(e,n,i,r-1))}}return Y(o,this.toBBox),o}_chooseSubtree(e,t,n,r){for(;r.push(t),!(t.leaf||r.length-1===n);){let n=1/0,r=1/0,i;for(let a=0;a<t.children.length;a++){let o=t.children[a],s=Me(o),c=Pe(e,o)-s;c<r?(r=c,n=s<n?s:n,i=o):c===r&&s<n&&(n=s,i=o)}t=i||t.children[0]}return t}_insert(e,t,n){let r=n?e:this.toBBox(e),i=[],a=this._chooseSubtree(r,this.data,t,i);for(a.children.push(e),Z(a,r);t>=0&&i[t].children.length>this._maxEntries;)this._split(i,t),t--;this._adjustParentBBoxes(r,i,t)}_split(e,t){let n=e[t],r=n.children.length,i=this._minEntries;this._chooseSplitAxis(n,i,r);let a=this._chooseSplitIndex(n,i,r),o=Q(n.children.splice(a,n.children.length-a));o.height=n.height,o.leaf=n.leaf,Y(n,this.toBBox),Y(o,this.toBBox),t?e[t-1].children.push(o):this._splitRoot(n,o)}_splitRoot(e,t){this.data=Q([e,t]),this.data.height=e.height+1,this.data.leaf=!1,Y(this.data,this.toBBox)}_chooseSplitIndex(e,t,n){let r,i=1/0,a=1/0;for(let o=t;o<=n-t;o++){let t=X(e,0,o,this.toBBox),s=X(e,o,n,this.toBBox),c=Fe(t,s),l=Me(t)+Me(s);c<i?(i=c,r=o,a=l<a?l:a):c===i&&l<a&&(a=l,r=o)}return r||n-t}_chooseSplitAxis(e,t,n){let r=e.leaf?this.compareMinX:Ae,i=e.leaf?this.compareMinY:je;this._allDistMargin(e,t,n,r)<this._allDistMargin(e,t,n,i)&&e.children.sort(r)}_allDistMargin(e,t,n,r){e.children.sort(r);let i=this.toBBox,a=X(e,0,t,i),o=X(e,n-t,n,i),s=Ne(a)+Ne(o);for(let r=t;r<n-t;r++){let t=e.children[r];Z(a,e.leaf?i(t):t),s+=Ne(a)}for(let r=n-t-1;r>=t;r--){let t=e.children[r];Z(o,e.leaf?i(t):t),s+=Ne(o)}return s}_adjustParentBBoxes(e,t,n){for(let r=n;r>=0;r--)Z(t[r],e)}_condense(e){for(let t=e.length-1,n;t>=0;t--)e[t].children.length===0?t>0?(n=e[t-1].children,n.splice(n.indexOf(e[t]),1)):this.clear():Y(e[t],this.toBBox)}};function J(e,t,n){if(!n)return t.indexOf(e);for(let r=0;r<t.length;r++)if(n(e,t[r]))return r;return-1}function Y(e,t){X(e,0,e.children.length,t,e)}function X(e,t,n,r,i){i||=Q(null),i.minX=1/0,i.minY=1/0,i.maxX=-1/0,i.maxY=-1/0;for(let a=t;a<n;a++){let t=e.children[a];Z(i,e.leaf?r(t):t)}return i}function Z(e,t){return e.minX=Math.min(e.minX,t.minX),e.minY=Math.min(e.minY,t.minY),e.maxX=Math.max(e.maxX,t.maxX),e.maxY=Math.max(e.maxY,t.maxY),e}function Ae(e,t){return e.minX-t.minX}function je(e,t){return e.minY-t.minY}function Me(e){return(e.maxX-e.minX)*(e.maxY-e.minY)}function Ne(e){return e.maxX-e.minX+(e.maxY-e.minY)}function Pe(e,t){return(Math.max(t.maxX,e.maxX)-Math.min(t.minX,e.minX))*(Math.max(t.maxY,e.maxY)-Math.min(t.minY,e.minY))}function Fe(e,t){let n=Math.max(e.minX,t.minX),r=Math.max(e.minY,t.minY),i=Math.min(e.maxX,t.maxX),a=Math.min(e.maxY,t.maxY);return Math.max(0,i-n)*Math.max(0,a-r)}function Ie(e,t){return e.minX<=t.minX&&e.minY<=t.minY&&t.maxX<=e.maxX&&t.maxY<=e.maxY}function Le(e,t){return t.minX<=e.maxX&&t.minY<=e.maxY&&t.maxX>=e.minX&&t.maxY>=e.minY}function Q(e){return{children:e,height:1,leaf:!0,minX:1/0,minY:1/0,maxX:-1/0,maxY:-1/0}}function Re(e,t,n,r,i){let a=[t,n];for(;a.length;){if(n=a.pop(),t=a.pop(),n-t<=r)continue;let o=t+Math.ceil((n-t)/r/2)*r;Oe(e,o,t,n,i),a.push(t,o,o,n)}}function ze(){return new ke}function Be(e,t){e.insert({minX:t.timeStart,minY:t.scale,maxX:t.timeEnd,maxY:t.scale,part:t})}function Ve(e,t,n,r){return e.search({minX:n,minY:t,maxX:r,maxY:t})}function He(e,t){let n=t-e;return n>=15552e3?c.Year:n>=1728e3?c.Month:n>=259200?c.Week:n>=21600?c.Day:n>=600?c.Hour:c.Minute}function Ue(e,t,n,r){let i=t-e;return i>=r-n?[n,r]:e<n?[n,n+i]:t>r?[r-i,r]:[e,t]}function We(e,t){let n=t-e,r=n>0?n*oe:1;return[e-r,t+r]}function Ge(e,t,n,r){let i=e.length;if(i===0)return;let a=0,o=i;for(;a<o;){let t=a+o>>1;e[t]<n?a=t+1:o=t}let s=a;for(a=s,o=i;a<o;){let t=a+o>>1;e[t]<=r?a=t+1:o=t}let c=a;if(s>=c)return;let l=1/0,u=-1/0;for(let e=s;e<c;e++){let n=t[e];n<l&&(l=n),n>u&&(u=n)}return[l,u]}function Ke(e,t,n,r){let i=n*((t-e)/r);return[e-i,t-i]}function qe(e,t,n,r){let i=t-e,a=e+i*r,o=Math.max(i*n,60);return[a-o*r,a+o*(1-r)]}function Je(e,t){let n=!1,r;return Ye(e,t).then(e=>{n?e():r=e}),()=>{n=!0,r?.()}}async function Ye(e,t){i(!r(navigator.gpu),`WebGPU is not supported`);let n=await navigator.gpu.requestAdapter();i(!r(n),`WebGPU adapter not available`);let a=await n.requestDevice(),o=e.getContext(`webgpu`);i(!r(o),`Failed to get WebGPU canvas context`);let s=o,c=navigator.gpu.getPreferredCanvasFormat();s.configure({device:a,format:c,alphaMode:`premultiplied`});let l=a.createShaderModule({code:De}),u=a.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.VERTEX,texture:{sampleType:`unfilterable-float`,viewDimension:`2d`}}]}),d={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}},f=a.createPipelineLayout({bindGroupLayouts:[u]}),p=a.createRenderPipeline({layout:f,vertex:{module:l,entryPoint:`vs`},fragment:{module:l,entryPoint:`fs`,targets:[{format:c,blend:d}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),m=a.createRenderPipeline({layout:f,vertex:{module:l,entryPoint:`vsRhombus`},fragment:{module:l,entryPoint:`fsRhombus`,targets:[{format:c,blend:d}]},primitive:{topology:`triangle-list`},multisample:{count:4}}),h=a.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),g=a.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),_=4,v=a.createTexture({size:[C,_],format:`rgba32float`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC});function y(){let e=v.createView();b=a.createBindGroup({layout:u,entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:e}]}),ee=a.createBindGroup({layout:u,entries:[{binding:0,resource:{buffer:g}},{binding:1,resource:e}]})}let b,ee;y();function te(e){if(e<=_)return!0;let t=_;for(;t<e;)t*=2;if(t=Math.min(t,512),e>t)return!1;let n=a.createTexture({size:[C,t],format:`rgba32float`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC}),r=a.createCommandEncoder();return r.copyTextureToTexture({texture:v,origin:[0,0,0]},{texture:n,origin:[0,0,0]},[C,oe,1]),a.queue.submit([r.finish()]),v.destroy(),v=n,_=t,y(),!0}let x=null,S=null,re=ze(),ae=ze(),oe=0,T=se,E=se+de,D=T,O=E,k=0,A=200,j=D,M=O,N=0,P=0;function F(e,t){let n=He(D,O),r=Ve(e,n,D,O).find(e=>e.part.timeStart<=D&&e.part.timeEnd>=O);if(r!==void 0)return r.part;let i=O-D,o=Math.max(T,D-i),s=Math.min(E,O+i),c=be(o,s,n);if(c.length===0)return null;if(t!==0)for(let e of c)e.value+=t;let l=c[0].time,u=c[0].value,d=Se(c,l,u),f=oe,p=Math.ceil(c.length/C);if(!te(f+p))return null;for(let e=0;e<p;e++){let t=Math.min(C,c.length-e*C),n=e*C*4,r=d.subarray(n,n+t*4);a.queue.writeTexture({texture:v,origin:[0,f+e,0]},r,{bytesPerRow:C*4*Float32Array.BYTES_PER_ELEMENT,rowsPerImage:1},[t,1,1])}let m=new Float64Array(c.length),h=new Float64Array(c.length),g=1/0,_=-1/0;for(let e=0;e<c.length;e++)m[e]=c[e].time,h[e]=c[e].value,c[e].value<g&&(g=c[e].value),c[e].value>_&&(_=c[e].value);let y={scale:n,timeStart:o,timeEnd:s,baseTime:l,baseValue:u,textureRowStart:f,pointCount:c.length,valueMin:g,valueMax:_,pointTimes:m,pointValues:h};return Be(e,y),oe+=p,y}function I(){let e=F(re,0),t=F(ae,2);if(r(e)||r(t))return null;let n=Ge(e.pointTimes,e.pointValues,D,O),i=Ge(t.pointTimes,t.pointValues,D,O),a=1/0,o=-1/0;if(n!==void 0&&(a=Math.min(a,n[0]),o=Math.max(o,n[1])),i!==void 0&&(a=Math.min(a,i[0]),o=Math.max(o,i[1])),a<o){let[e,t]=We(a,o);k=e,A=t}return{line:e,rhombus:t}}function L(){let t=Math.max(1,window.devicePixelRatio),n=Math.floor(e.clientWidth*t),r=Math.floor(e.clientHeight*t);(e.width!==n||e.height!==r)&&(e.width=n,e.height=r),N=n,P=r}function ge(){return!r(x)&&x.width===N&&x.height===P?S:(x?.destroy(),N===0||P===0?(x=null,S=null,null):(x=a.createTexture({size:[N,P],format:c,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),S=x.createView(),S))}function R(e,t){let n=new ArrayBuffer(48),r=new Float32Array(n),i=new Uint32Array(n);r[0]=N,r[1]=P,r[2]=D-e.baseTime,r[3]=O-e.baseTime,r[4]=k-e.baseValue,r[5]=A-e.baseValue,i[6]=e.pointCount,i[7]=C,r[8]=Math.max(1,window.devicePixelRatio),i[9]=e.textureRowStart,r[10]=e.baseTime,r[11]=e.baseValue,a.queue.writeBuffer(t,0,n)}function _e(){for(;t.firstChild;)t.removeChild(t.firstChild)}function ve(){_e();let n=e.clientWidth,r=e.clientHeight;t.setAttribute(`width`,String(n)),t.setAttribute(`height`,String(r)),t.setAttribute(`viewBox`,`0 0 ${n} ${r}`);let i=n-10,a=r-30,o=i-60,s=a-10;if(o<=0||s<=0)return;let c=document.createElementNS(w,`path`);c.setAttribute(`d`,`M 60 10 L 60 ${a} L ${i} ${a}`),c.setAttribute(`stroke`,pe),c.setAttribute(`fill`,`none`),c.setAttribute(`stroke-width`,`1`),t.appendChild(c);let l=O-D,u=A-k,d=He(D,O),f=ne(D,O,d,o);for(let e of f){let n=60+(e.position-D)/l*o;if(n<60||n>i)continue;let r=document.createElementNS(w,`line`);r.setAttribute(`x1`,String(n)),r.setAttribute(`y1`,`10`),r.setAttribute(`x2`,String(n)),r.setAttribute(`y2`,String(a)),r.setAttribute(`stroke`,me),r.setAttribute(`stroke-width`,`0.5`),t.appendChild(r);let s=document.createElementNS(w,`line`);s.setAttribute(`x1`,String(n)),s.setAttribute(`y1`,String(a)),s.setAttribute(`x2`,String(n)),s.setAttribute(`y2`,String(a+5)),s.setAttribute(`stroke`,pe),s.setAttribute(`stroke-width`,`1`),t.appendChild(s);let c=document.createElementNS(w,`text`);c.setAttribute(`x`,String(n)),c.setAttribute(`y`,String(a+5+11+2)),c.setAttribute(`text-anchor`,`middle`),c.setAttribute(`fill`,fe),c.setAttribute(`font-size`,`11`),c.setAttribute(`font-family`,he),c.textContent=e.label,t.appendChild(c)}let p=ie(k,A,s);for(let e of p){let n=a-(e.position-k)/u*s;if(n<10||n>a)continue;let r=document.createElementNS(w,`line`);r.setAttribute(`x1`,`60`),r.setAttribute(`y1`,String(n)),r.setAttribute(`x2`,String(i)),r.setAttribute(`y2`,String(n)),r.setAttribute(`stroke`,me),r.setAttribute(`stroke-width`,`0.5`),t.appendChild(r);let o=document.createElementNS(w,`line`);o.setAttribute(`x1`,`55`),o.setAttribute(`y1`,String(n)),o.setAttribute(`x2`,`60`),o.setAttribute(`y2`,String(n)),o.setAttribute(`stroke`,pe),o.setAttribute(`stroke-width`,`1`),t.appendChild(o);let c=document.createElementNS(w,`text`);c.setAttribute(`x`,`51`),c.setAttribute(`y`,String(n+11/3)),c.setAttribute(`text-anchor`,`end`),c.setAttribute(`fill`,fe),c.setAttribute(`font-size`,`11`),c.setAttribute(`font-family`,he),c.textContent=e.label,t.appendChild(c)}}let z=!1,B=0;function V(t){z=!0,B=t.clientX,e.style.cursor=`grabbing`}function ye(t){if(!z)return;let n=t.clientX-B;B=t.clientX;let[r,i]=Ue(...Ke(D,O,n,e.clientWidth),T,E);D=r,O=i,j=r,M=i}function H(){z=!1,e.style.cursor=`grab`}function U(t){t.preventDefault();let n=e.getBoundingClientRect(),r=(t.clientX-n.left)/n.width,i=t.deltaY>0?le:ce,[a,o]=Ue(...qe(j,M,i,r),T,E);j=a,M=o}e.addEventListener(`mousedown`,V),e.addEventListener(`mousemove`,ye),e.addEventListener(`mouseup`,H),e.addEventListener(`mouseleave`,H),e.addEventListener(`wheel`,U,{passive:!1}),e.style.cursor=`grab`;let W=0,G=!1,xe=0;function Ce(e){let t=e.touches[0].clientX-e.touches[1].clientX,n=e.touches[0].clientY-e.touches[1].clientY;return Math.sqrt(t*t+n*n)}function we(t){let n=e.getBoundingClientRect();return((t.touches[0].clientX+t.touches[1].clientX)/2-n.left)/n.width}function Te(e){e.touches.length===1?(G=!0,W=e.touches[0].clientX):e.touches.length===2&&(G=!1,xe=Ce(e))}function Ee(t){if(t.preventDefault(),t.touches.length===2){let e=Ce(t),n=xe/e,r=we(t),[i,a]=Ue(...qe(j,M,n,r),T,E);j=i,M=a,xe=e;return}if(!G||t.touches.length!==1)return;let n=t.touches[0].clientX-W;W=t.touches[0].clientX;let[r,i]=Ue(...Ke(D,O,n,e.clientWidth),T,E);D=r,O=i,j=r,M=i}function Oe(e){e.touches.length===0?G=!1:e.touches.length===1&&(G=!0,W=e.touches[0].clientX)}e.addEventListener(`touchstart`,Te,{passive:!0}),e.addEventListener(`touchmove`,Ee,{passive:!1}),e.addEventListener(`touchend`,Oe),L();let K=new ResizeObserver(()=>{L()});K.observe(e);let q=0,ke=!1;function J(){if(ke)return;L();let e=j-D,t=M-O;Math.abs(e)>.001||Math.abs(t)>.001?(D+=e*ue,O+=t*ue):(D=j,O=M);let n=I();if(r(n)||n.line.pointCount<2){q=requestAnimationFrame(J);return}let i=ge();if(r(i)){q=requestAnimationFrame(J);return}let o=s.getCurrentTexture().createView(),c=a.createCommandEncoder(),l=c.beginRenderPass({colorAttachments:[{view:i,resolveTarget:o,loadOp:`clear`,clearValue:{r:0,g:0,b:0,a:0},storeOp:`discard`}]});R(n.line,h),l.setPipeline(p),l.setBindGroup(0,b),l.draw(18,n.line.pointCount-1,0,0),R(n.rhombus,g),l.setPipeline(m),l.setBindGroup(0,ee),l.draw(6,n.rhombus.pointCount,0,0),l.end(),a.queue.submit([c.finish()]),ve(),q=requestAnimationFrame(J)}return q=requestAnimationFrame(J),()=>{ke=!0,cancelAnimationFrame(q),K.disconnect(),e.removeEventListener(`mousedown`,V),e.removeEventListener(`mousemove`,ye),e.removeEventListener(`mouseup`,H),e.removeEventListener(`mouseleave`,H),e.removeEventListener(`wheel`,U),e.removeEventListener(`touchstart`,Te),e.removeEventListener(`touchmove`,Ee),e.removeEventListener(`touchend`,Oe),x?.destroy(),v.destroy(),h.destroy(),g.destroy(),a.destroy()}}var $=t(),Xe=(0,s.memo)(()=>{let e=(0,s.useRef)(null),t=(0,s.useRef)(null);return(0,s.useEffect)(()=>{if(e.current&&t.current)return Je(e.current,t.current)},[]),(0,$.jsxs)(`div`,{className:`${o.fixedContainer} relative`,children:[(0,$.jsx)(`div`,{className:`absolute inset-0 bg-[#262626]`}),(0,$.jsx)(`svg`,{ref:t,className:`absolute inset-0 h-full w-full pointer-events-none`}),(0,$.jsx)(`canvas`,{ref:e,className:`absolute inset-0 h-full w-full`})]})});export{Xe as Timeseries};