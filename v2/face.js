export const EYE_L=[33,160,158,133,153,144],EYE_R=[362,385,387,263,373,380];
export const LIP=[61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95];
export const BROW_L=[70,63,105,66,107],BROW_R=[336,296,334,293,300];
export const CHEEK_L=234,CHEEK_R=454,Nose=1;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function stabilize(prev,next,alpha=.35){if(!next?.length)return prev||[];if(!prev?.length)return next;return next.map((p,i)=>{const q=prev[i]||p;return{x:q.x+(p.x-q.x)*alpha,y:q.y+(p.y-q.y)*alpha,z:(q.z??0)+((p.z??0)-(q.z??0))*alpha}})}
export function transformPoint(p,w,h,mirror=false){return[(mirror?1-p.x:p.x)*w,p.y*h]}
export function faceBox(points,w,h){if(!points?.length)return null;let x0=1,x1=0,y0=1,y1=0;for(const p of points){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y)}return{x:x0*w,y:y0*h,w:(x1-x0)*w,h:(y1-y0)*h,cx:(x0+x1)*w/2,cy:(y0+y1)*h/2}}
export function featureMask(w,h,points,ids,blur=3){const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#fff";const q=ids.map(i=>transformPoint(points[i],w,h));x.beginPath();x.moveTo(...q[0]);q.slice(1).forEach(p=>x.lineTo(...p));x.closePath();x.fill();if(blur){const out=document.createElement("canvas");out.width=w;out.height=h;const o=out.getContext("2d");o.filter=`blur(${blur}px)`;o.drawImage(c,0,0);return o.getImageData(0,0,w,h).data}return x.getImageData(0,0,w,h).data}
export function blend(list,name){return list?.find(x=>x.categoryName===name)?.score||0}
export {clamp}