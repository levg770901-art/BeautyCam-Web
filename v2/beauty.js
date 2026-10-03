import {blurRGBA} from "./skin.js";
export function processBeauty(data,w,h,mask,settings){
const smooth=settings.smooth/100,soften=settings.soften/100,whiten=settings.whiten/100;
const radius=.6+smooth*1.2+soften*1.6;
const soft=radius>1?blurRGBA(data,w,h,radius):data;
const out=new Uint8ClampedArray(data);
for(let i=0,p=0;i<mask.length;i++,p+=4){const a=Math.min(.78,mask[i]*(.20+smooth*.42+soften*.38));if(a<=.001)continue;
out[p]=data[p]+(soft[p]-data[p])*a;out[p+1]=data[p+1]+(soft[p+1]-data[p+1])*a;out[p+2]=data[p+2]+(soft[p+2]-data[p+2])*a;
if(whiten){const y=.2126*out[p]+.7152*out[p+1]+.0722*out[p+2];const s=whiten*.16*mask[i]*Math.max(0,1-Math.max(0,y-210)/45);const scale=y>1?1+(255-y)/y*s:1;out[p]=Math.min(255,out[p]*scale);out[p+1]=Math.min(255,out[p+1]*scale);out[p+2]=Math.min(255,out[p+2]*scale)}
}
return out;
}