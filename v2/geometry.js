const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function estimateFaceRegion(w,h,box=null){
if(box){const cx=box.x+box.width*.5,cy=box.y+box.height*.48;return{x:cx,y:cy,rx:box.width*.46,ry:box.height*.50}}
return{x:w*.5,y:h*.48,rx:w*.31,ry:h*.40};
}
export function ellipseMask(w,h,face,feather=0.045){
const m=new Float32Array(w*h),fx=face.rx,fy=face.ry;
for(let y=0;y<h;y++){const dy=(y-face.y)/fy;for(let x=0;x<w;x++){const dx=(x-face.x)/fx;const d=Math.sqrt(dx*dx+dy*dy);const edge=1-feather;let a=clamp((1-d)/(1-edge));if(d>1)a=0;m[y*w+x]=a}}
return m;
}
export function protectFeatures(w,h,face){
const m=new Float32Array(w*h);const ex=face.rx*.28,ey=face.ry*.13;
const eyesY=face.y-face.ry*.12,eyeX=face.rx*.34;
const mouthY=face.y+face.ry*.30,mouthX=face.rx*.27;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
const le=((x-(face.x-eyeX))/ex)**2+((y-eyesY)/ey)**2;
const re=((x-(face.x+eyeX))/ex)**2+((y-eyesY)/ey)**2;
const mo=((x-face.x)/mouthX)**2+((y-mouthY)/(face.ry*.12))**2;
m[y*w+x]=Math.max(le<1?1:0,re<1?1:0,mo<1?1:0)}
return m;
}