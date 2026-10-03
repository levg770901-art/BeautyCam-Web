const clamp=(v,a=0,b=255)=>Math.max(a,Math.min(b,v));
export function skinProbability(r,g,b){
const mx=Math.max(r,g,b),mn=Math.min(r,g,b),y=.299*r+.587*g+.114*b,cb=128-.168736*r-.331264*g+.5*b,cr=128+.5*r-.418688*g-.081312*b,hue=(Math.atan2(cr-128,cb-128)*180/Math.PI+360)%360,chroma=Math.sqrt((cb-128)**2+(cr-128)**2);
return y>38&&y<245&&(hue>335||hue<55)&&chroma>5&&chroma<65?Math.min(1,(chroma-5)/28):0;
}
export function buildSkinMask(data,w,h,face,protect){const m=new Float32Array(w*h);for(let i=0,p=0;i<m.length;i++,p+=4)m[i]=face[i]*skinProbability(data[p],data[p+1],data[p+2])*(1-protect[i]*.92);return m}
export function blurRGBA(data,w,h,radius){
const r=Math.max(1,Math.min(6,Math.round(radius))),tmp=new Uint8ClampedArray(data.length),out=new Uint8ClampedArray(data.length),diam=r*2+1;
for(let y=0;y<h;y++){let sr=0,sg=0,sb=0,sa=0;for(let x=-r;x<=r;x++){const xx=Math.max(0,Math.min(w-1,x)),p=(y*w+xx)*4;sr+=data[p];sg+=data[p+1];sb+=data[p+2];sa+=data[p+3]}for(let x=0;x<w;x++){let p=(y*w+x)*4;tmp[p]=sr/diam;tmp[p+1]=sg/diam;tmp[p+2]=sb/diam;tmp[p+3]=sa/diam;const add=Math.min(w-1,x+r+1),sub=Math.max(0,x-r);let q=(y*w+add)*4,s=(y*w+sub)*4;sr+=data[q]-data[s];sg+=data[q+1]-data[s+1];sb+=data[q+2]-data[s+2];sa+=data[q+3]-data[s+3]}}
for(let x=0;x<w;x++){let sr=0,sg=0,sb=0,sa=0;for(let y=-r;y<=r;y++){const yy=Math.max(0,Math.min(h-1,y)),p=(yy*w+x)*4;sr+=tmp[p];sg+=tmp[p+1];sb+=tmp[p+2];sa+=tmp[p+3]}for(let y=0;y<h;y++){const p=(y*w+x)*4;out[p]=sr/diam;out[p+1]=sg/diam;out[p+2]=sb/diam;out[p+3]=sa/diam;const add=Math.min(h-1,y+r+1),sub=Math.max(0,y-r),q=(add*w+x)*4,s=(sub*w+x)*4;sr+=tmp[q]-tmp[s];sg+=tmp[q+1]-tmp[s+1];sb+=tmp[q+2]-tmp[s+2];sa+=tmp[q+3]-tmp[s+3]}}
return out;
}