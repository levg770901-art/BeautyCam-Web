import {detailPreservingSmooth} from "./skin.js";
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function processBeauty(data,w,h,mask,settings,{preview=false}={}){

  const smooth=settings.smooth/100,soften=settings.soften/100,whiten=settings.whiten/100;
  const radius=.8+smooth*1.1+soften*1.4*(preview?.72:1);
  const soft=radius>1?detailPreservingSmooth(data,w,h,radius):data;
  const out=new Uint8ClampedArray(data);
  for(let i=0,p=0;i<mask.length;i++,p+=4){
    const m=mask[i];
    const a=clamp(m*(.10+smooth*.31+soften*.29),0,.64);
    if(a>0){
      out[p]=data[p]+(soft[p]-data[p])*a;
      out[p+1]=data[p+1]+(soft[p+1]-data[p+1])*a;
      out[p+2]=data[p+2]+(soft[p+2]-data[p+2])*a;
    }
    if(whiten&&m>0){
      const y=.2126*out[p]+.7152*out[p+1]+.0722*out[p+2];
      const amount=whiten*.13*m*clamp((225-y)/70);
      const scale=1+amount;
      out[p]=Math.min(255,out[p]*scale);
      out[p+1]=Math.min(255,out[p+1]*scale);
      out[p+2]=Math.min(255,out[p+2]*scale);
    }
  }
  return out;
}