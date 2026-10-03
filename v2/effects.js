import {blend,clamp} from "./face.js";

const FACE_OVAL=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const EYE_L=[33,160,158,133,153,144],EYE_R=[362,385,387,263,373,380];
const LIP=[61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95];
const BROW_L=[70,63,105,66,107],BROW_R=[336,296,334,293,300];
const FEATURE_GROUPS=[EYE_L,EYE_R,LIP,BROW_L,BROW_R];

function rgba(c,a){return `rgba(${c[0]},${c[1]},${c[2]},${a})`}

function polygon(ctx,points,ids,w,h){
  if(!points?.length)return;
  const q=ids.map(i=>points[i]).filter(Boolean);
  if(q.length<3)return;
  ctx.beginPath();ctx.moveTo(q[0].x*w,q[0].y*h);
  for(let i=1;i<q.length;i++)ctx.lineTo(q[i].x*w,q[i].y*h);
  ctx.closePath();ctx.fill();
}

function buildMask(w,h,points,ids,blur=0){
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const ctx=c.getContext("2d",{willReadFrequently:true});ctx.fillStyle="#fff";polygon(ctx,points,ids,w,h);
  if(!blur)return ctx.getImageData(0,0,w,h).data;
  const out=document.createElement("canvas");out.width=w;out.height=h;
  const o=out.getContext("2d",{willReadFrequently:true});o.filter=`blur(${blur}px)`;o.drawImage(c,0,0);
  return o.getImageData(0,0,w,h).data;
}

function skinProbability(r,g,b){
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  if(max<35||delta<8)return 0;
  const y=.299*r+.587*g+.114*b;
  const cb=128-.168736*r-.331264*g+.5*b;
  const cr=128+.5*r-.418688*g-.081312*b;
  const hue=(Math.atan2(cr-128,cb-128)*180/Math.PI+360)%360;
  const hueDistance=Math.min(Math.abs(hue-20),360-Math.abs(hue-20));
  const hueWeight=1-clamp((hueDistance-38)/38);
  const chroma=Math.hypot(cb-128,cr-128);
  const chromaWeight=clamp(1-Math.abs(chroma-30)/48);
  const toneWeight=clamp((y-32)/38)*clamp((248-y)/42);
  return hueWeight*chromaWeight*toneWeight;
}

function smooth(data,w,h,radius){
  const r=Math.max(1,Math.min(4,Math.round(radius))),src=new Uint8ClampedArray(data),tmp=new Float32Array(data.length),out=new Uint8ClampedArray(data);
  for(let y=0;y<h;y++){let R=0,G=0,B=0,n=0;for(let x=-r;x<=r;x++){const xx=Math.max(0,Math.min(w-1,x)),p=(y*w+xx)*4;R+=src[p];G+=src[p+1];B+=src[p+2];n++}for(let x=0;x<w;x++){const p=(y*w+x)*4;tmp[p]=R/n;tmp[p+1]=G/n;tmp[p+2]=B/n;const add=Math.min(w-1,x+r+1),sub=Math.max(0,x-r),a=(y*w+add)*4,s=(y*w+sub)*4;R+=src[a]-src[s];G+=src[a+1]-src[s+1];B+=src[a+2]-src[s+2]}}
  for(let x=0;x<w;x++){let R=0,G=0,B=0,n=0;for(let y=-r;y<=r;y++){const yy=Math.max(0,Math.min(h-1,y)),p=(yy*w+x)*4;R+=tmp[p];G+=tmp[p+1];B+=tmp[p+2];n++}for(let y=0;y<h;y++){const p=(y*w+x)*4;out[p]=R/n;out[p+1]=G/n;out[p+2]=B/n;out[p+3]=src[p+3];const add=Math.min(h-1,y+r+1),sub=Math.max(0,y-r),a=(add*w+x)*4,s=(sub*w+x)*4;R+=tmp[a]-tmp[s];G+=tmp[a+1]-tmp[s+1];B+=tmp[a+2]-tmp[s+2]}}
  return out;
}

export function beauty(data,w,h,faceMask,featureProtection,settings){
  const soft=settings.soft/100,tone=settings.tone/100,light=settings.light/100;
  const smoothData=soft?smooth(data,w,h,.8+soft*2.8):data;
  const out=new Uint8ClampedArray(data);
  for(let i=0,p=0;i<faceMask.length;i++,p+=4){
    const face=faceMask[i]/255;
    const feature=featureProtection[i]/255;
    const skin=skinProbability(data[p],data[p+1],data[p+2]);
    const mask=face*skin*(1-feature*.92);
    if(mask<=.001)continue;
    const smoothAmount=mask*(.08+soft*.44);
    out[p]=data[p]+(smoothData[p]-data[p])*smoothAmount;
    out[p+1]=data[p+1]+(smoothData[p+1]-data[p+1])*smoothAmount;
    out[p+2]=data[p+2]+(smoothData[p+2]-data[p+2])*smoothAmount;
    const y=.2126*out[p]+.7152*out[p+1]+.0722*out[p+2];
    const warmth=(out[p]-out[p+1]*.86-out[p+2]*.52)/255;const toneFix=clamp(-warmth*.55)*tone*.055*mask;out[p]=Math.min(255,out[p]+out[p]*toneFix);out[p+1]=Math.min(255,out[p+1]+out[p+1]*toneFix*.45);const lift=light*.075*mask*clamp((232-y)/86);
    out[p]=Math.min(255,out[p]+out[p]*lift);
    out[p+1]=Math.min(255,out[p+1]+out[p+1]*lift);
    out[p+2]=Math.min(255,out[p+2]+out[p+2]*lift);
  }
  return out;
}

export function masks(w,h,points){
  const face=buildMask(w,h,points,FACE_OVAL,1.2);
  const protectionCanvas=document.createElement("canvas");protectionCanvas.width=w;protectionCanvas.height=h;
  const pc=protectionCanvas.getContext("2d",{willReadFrequently:true});pc.fillStyle="#fff";
  for(const ids of FEATURE_GROUPS)polygon(pc,points,ids,w,h);
  const blurCanvas=document.createElement("canvas");blurCanvas.width=w;blurCanvas.height=h;
  const bc=blurCanvas.getContext("2d",{willReadFrequently:true});bc.filter="blur(5px)";bc.drawImage(protectionCanvas,0,0);
  const protect=bc.getImageData(0,0,w,h).data;
  return{face,protect};
}

function ellipse(ctx,cx,cy,rx,ry,color,alpha){
  const g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rx,ry));
  g.addColorStop(0,rgba(color,alpha));g.addColorStop(.72,rgba(color,alpha*.32));g.addColorStop(1,rgba(color,0));
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
}

function lipMask(ctx,points,w,h,color,alpha,jaw){
  const q=LIP.map(i=>points[i]).filter(Boolean);if(q.length<3)return;
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=rgba(color,1);ctx.beginPath();ctx.moveTo(q[0].x*w,q[0].y*h);
  q.slice(1).forEach(p=>ctx.lineTo(p.x*w,p.y*h));ctx.closePath();ctx.fill();ctx.restore();
  const c=q.reduce((s,p)=>[s[0]+p.x*w,s[1]+p.y*h],[0,0]);ellipse(ctx,c[0]/q.length,c[1]/q.length,w*.045,h*.018*(1+jaw*.35),color,alpha*.42);
}

export function makeup(ctx,points,w,h,amount,look,expression){
  const a=amount/100;if(!a||look==="none")return;
  const style={natural:{lip:[190,65,82],blush:[230,90,115],brow:[65,45,40],shadow:[160,110,145]},rose:{lip:[214,58,90],blush:[238,86,120],brow:[60,42,42],shadow:[185,115,155]},warm:{lip:[198,70,52],blush:[235,112,76],brow:[72,50,38],shadow:[178,112,82]}}[look]||null;if(!style)return;
  const p=i=>points[i]?[points[i].x*w,points[i].y*h]:null;
  const l=p(234),r=p(454),mouth=p(13);if(!l||!r||!mouth)return;
  ctx.save();
  ellipse(ctx,l[0],l[1]+h*.018,w*.065,h*.042,style.blush,.20*a);
  ellipse(ctx,r[0],r[1]+h*.018,w*.065,h*.042,style.blush,.20*a);
  lipMask(ctx,points,w,h,style.lip,.22*a,blend(expression,"jawOpen"));
  for(const ids of [BROW_L,BROW_R]){
    ctx.strokeStyle=rgba(style.brow,.42*a);ctx.lineWidth=Math.max(1.5,w*.0035);ctx.lineCap="round";ctx.beginPath();
    ids.forEach((id,i)=>{const q=p(id);if(!q)return;i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.stroke();
  }
  for(const ids of [EYE_L,EYE_R]){
    const q=ids.map(p).filter(Boolean),cx=q.reduce((s,v)=>s+v[0],0)/q.length,cy=q.reduce((s,v)=>s+v[1],0)/q.length;
    const blink=ids===EYE_L?blend(expression,"eyeBlinkLeft"):blend(expression,"eyeBlinkRight");
    ellipse(ctx,cx,cy-h*.008,w*.052,h*.020*(1-blink*.72),style.shadow,.12*a);
  }
  ctx.restore();
}

export {FACE_OVAL,FEATURE_GROUPS};