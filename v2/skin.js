const clamp=(v,a=0,b=255)=>Math.max(a,Math.min(b,v));
export function skinProbability(r,g,b){
const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
if(mx-mn<12)return 0;
const y=.299*r+.587*g+.114*b;
const cb=128-.168736*r-.331264*g+.5*b;
const cr=128+.5*r-.418688*g-.081312*b;
const hue=(Math.atan2(cr-128,cb-128)*180/Math.PI+360)%360;
const chroma=Math.sqrt((cb-128)**2+(cr-128)**2);
const tone=y>38&&y<245;
const hueGate=(hue>335||hue<55);
const chromaGate=chroma>5&&chroma<65;
return tone&&hueGate&&chromaGate?Math.min(1,(chroma-5)/28):0;
}
export function buildSkinMask(data,w,h,face,protect){
const m=new Float32Array(w*h);
for(let i=0,p=0;i<m.length;i++,p+=4){const r=data[p],g=data[p+1],b=data[p+2];m[i]=face[i]*skinProbability(r,g,b)*(1-protect[i]*.92)}
return m;
}
export function blurRGBA(data,w,h,radius){
const out=new Uint8ClampedArray(data.length),r=Math.max(1,Math.round(radius));
for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sr=0,sg=0,sb=0,sa=0,n=0;for(let yy=Math.max(0,y-r);yy<=Math.min(h-1,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(w-1,x+r);xx++){const q=(yy*w+xx)*4;sr+=data[q];sg+=data[q+1];sb+=data[q+2];sa+=data[q+3];n++}const p=(y*w+x)*4;out[p]=sr/n;out[p+1]=sg/n;out[p+2]=sb/n;out[p+3]=sa/n}
return out;
}