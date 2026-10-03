const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const maskCanvas=document.createElement("canvas");
const protectCanvas=document.createElement("canvas");
let maskCtx=null,protectCtx=null;
const OVAL=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const EYES=[[33,160,158,133,153,144],[362,385,387,263,373,380]];
const MOUTH=[61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95];
const BROWS=[[70,63,105,66,107],[336,296,334,293,300]];
function rasterPolygon(ctx,ids,p,w,h){const q=ids.map(i=>p[i]?[p[i].x*w,p[i].y*h]:null).filter(Boolean);if(q.length<3)return false;ctx.beginPath();ctx.moveTo(q[0][0],q[0][1]);for(let i=1;i<q.length;i++)ctx.lineTo(q[i][0],q[i][1]);ctx.closePath();ctx.fill();return true}
function featherMask(mask,w,h,passes=1){
  if(passes<1)return mask;
  const out=new Float32Array(mask.length);
  const tmp=new Float32Array(mask.length);
  const stride=w;
  for(let pass=0;pass<passes;pass++){
    for(let y=0;y<h;y++){
      const row=y*stride;
      const up=y>0?row-stride:row,down=y<h-1?row+stride:row;
      for(let x=0;x<w;x++){
        const i=row+x;
        let sum=mask[i]*4;
        let count=4;
        if(x>0){sum+=mask[i-1];count++}
        if(x<w-1){sum+=mask[i+1];count++}
        if(y>0){sum+=mask[up+x];count++}
        if(y<h-1){sum+=mask[down+x];count++}
        tmp[i]=sum/count;
      }
    }
    out.set(tmp);
    mask=tmp;
  }
  return out;
}
export function faceFromLandmarks(points,w,h,mirrored=false){if(!points?.length)return null;const pts=points.map(p=>({x:mirrored?1-p.x:p.x,y:p.y,z:p.z}));let minX=1,maxX=0,minY=1,maxY=0;for(const p of pts){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}return{x:(minX+maxX)*.5*w,y:(minY+(maxY-minY)*.49)*h,rx:(maxX-minX)*w*.54,ry:(maxY-minY)*h*.56,landmarks:pts}}
export function faceRegionMask(w,h,face){const m=new Float32Array(w*h);if(!face?.landmarks)return m;if(maskCanvas.width!==w||maskCanvas.height!==h){maskCanvas.width=w;maskCanvas.height=h}
const x=maskCtx||(maskCtx=maskCanvas.getContext("2d",{willReadFrequently:true}));x.clearRect(0,0,w,h);x.fillStyle="#fff";const p=face.landmarks;if(!rasterPolygon(x,OVAL,p,w,h))return m;
const d=x.getImageData(0,0,w,h).data;for(let i=0;i<m.length;i++)m[i]=d[i*4]/255;
return featherMask(m,w,h,1)}
export function landmarkMask(w,h,face){return faceRegionMask(w,h,face)}
export function ellipseMask(w,h,face,feather=.08){return faceRegionMask(w,h,face)}
export function resizeMask(mask,w,h,nw,nh){
  if(w===nw&&h===nh)return mask;
  const out=new Float32Array(nw*nh),sx=w/nw,sy=h/nh;
  for(let y=0;y<nh;y++){const fy=(y+.5)*sy-.5,y0=Math.max(0,Math.floor(fy)),y1=Math.min(h-1,y0+1),ty=Math.max(0,fy-y0);
    for(let x=0;x<nw;x++){const fx=(x+.5)*sx-.5,x0=Math.max(0,Math.floor(fx)),x1=Math.min(w-1,x0+1),tx=Math.max(0,fx-x0);
      const a=mask[y0*w+x0],b=mask[y0*w+x1],d=mask[y1*w+x0],e=mask[y1*w+x1];
      out[y*nw+x]=a+(b-a)*tx+(d+(e-d)*tx-a-(b-a)*tx)*ty;
    }
  }
  return out;
}
export function featureDistanceMask(w,h,face){
  const m=new Float32Array(w*h);if(!face?.landmarks)return m;
  const p=face.landmarks;
  if(protectCanvas.width!==w||protectCanvas.height!==h){protectCanvas.width=w;protectCanvas.height=h}
  const x=protectCtx||(protectCtx=protectCanvas.getContext("2d",{willReadFrequently:true}));
  x.clearRect(0,0,w,h);x.fillStyle="#fff";x.filter="blur(2px)";x.globalAlpha=.9;
  for(const ids of [...EYES,MOUTH,...BROWS])rasterPolygon(x,ids,p,w,h);
  x.filter="none";x.globalAlpha=1;
  const d=x.getImageData(0,0,w,h).data;
  for(let i=0;i<m.length;i++)m[i]=d[i*4]/255;
  return m;
}
export function protectFeatures(w,h,face){return featureDistanceMask(w,h,face)}
export function softSkinWeight(w,h,face){
  const m=new Float32Array(w*h);if(!face?.landmarks)return m;
  const p=face.landmarks;
  if(protectCanvas.width!==w||protectCanvas.height!==h){protectCanvas.width=w;protectCanvas.height=h}
  const x=protectCtx||(protectCtx=protectCanvas.getContext("2d",{willReadFrequently:true}));
  x.clearRect(0,0,w,h);x.fillStyle="#fff";
  x.filter="blur(5px)";x.globalAlpha=.82;
  for(const ids of [...EYES,MOUTH,...BROWS])rasterPolygon(x,ids,p,w,h);
  x.filter="none";x.globalAlpha=1;
  const d=x.getImageData(0,0,w,h).data;
  for(let i=0;i<m.length;i++)m[i]=d[i*4]/255;
  return m;
}
export function smoothLandmarks(previous,current,alpha=.32){if(!current?.length)return previous||[];if(!previous?.length)return current;return current.map((p,i)=>{const q=previous[i]||p;return{x:q.x*(1-alpha)+p.x*alpha,y:q.y*(1-alpha)+p.y*alpha,z:(q.z??0)*(1-alpha)+(p.z??0)*alpha}})}
