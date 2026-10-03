const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function skinProbability(r,g,b){
  const y=.299*r+.587*g+.114*b,cb=128-.168736*r-.331264*g+.5*b,cr=128+.5*r-.418688*g-.081312*b;
  const hue=(Math.atan2(cr-128,cb-128)*180/Math.PI+360)%360;
  const chroma=Math.hypot(cb-128,cr-128);
  const hueGate=(hue>335||hue<55)?1:0;
  const chromaGate=clamp(1-Math.abs(chroma-30)/42);
  const toneGate=clamp((y-35)/35)*clamp((250-y)/35);
  return hueGate*chromaGate*toneGate;
}
export function buildSkinMask(data,w,h,face,protect,maskW=w,maskH=h){
  const m=new Float32Array(w*h);
  const sx=maskW/w,sy=maskH/h;
  for(let y=0;y<h;y++){
    const fy=Math.min(maskH-1,Math.floor(y*sy)),row=fy*maskW;
    for(let x=0;x<w;x++){
      const fx=Math.min(maskW-1,Math.floor(x*sx)),mi=row+fx,p=(y*w+x)*4;
      const base=face[mi]*skinProbability(data[p],data[p+1],data[p+2]);
      m[y*w+x]=base*(1-protect[mi]*.96);
    }
  }
  return m;
}
export function blurRGBA(data,w,h,radius){
  const r=Math.max(1,Math.min(6,Math.round(radius))),tmp=new Uint8ClampedArray(data.length),out=new Uint8ClampedArray(data.length),diam=r*2+1;
  for(let y=0;y<h;y++){let sr=0,sg=0,sb=0,sa=0;
    for(let x=-r;x<=r;x++){const xx=Math.max(0,Math.min(w-1,x)),p=(y*w+xx)*4;sr+=data[p];sg+=data[p+1];sb+=data[p+2];sa+=data[p+3]}
    for(let x=0;x<w;x++){const p=(y*w+x)*4;tmp[p]=sr/diam;tmp[p+1]=sg/diam;tmp[p+2]=sb/diam;tmp[p+3]=sa/diam;const add=Math.min(w-1,x+r+1),sub=Math.max(0,x-r),q=(y*w+add)*4,s=(y*w+sub)*4;sr+=data[q]-data[s];sg+=data[q+1]-data[s+1];sb+=data[q+2]-data[s+2];sa+=data[q+3]-data[s+3]}}
  for(let x=0;x<w;x++){let sr=0,sg=0,sb=0,sa=0;
    for(let y=-r;y<=r;y++){const yy=Math.max(0,Math.min(h-1,y)),p=(yy*w+x)*4;sr+=tmp[p];sg+=tmp[p+1];sb+=tmp[p+2];sa+=tmp[p+3]}
    for(let y=0;y<h;y++){const p=(y*w+x)*4;out[p]=sr/diam;out[p+1]=sg/diam;out[p+2]=sb/diam;out[p+3]=sa/diam;const add=Math.min(h-1,y+r+1),sub=Math.max(0,y-r),q=(add*w+x)*4,s=(sub*w+x)*4;sr+=tmp[q]-tmp[s];sg+=tmp[q+1]-tmp[s+1];sb+=tmp[q+2]-tmp[s+2]}}
  return out;
}
export function detailPreservingSmooth(data,w,h,radius=2){
  const base=blurRGBA(data,w,h,radius),out=new Uint8ClampedArray(data.length);
  for(let i=0;i<data.length;i+=4){
    const lum=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
    const baseLum=.2126*base[i]+.7152*base[i+1]+.0722*base[i+2];
    const detail=lum-baseLum;
    const preserve=clamp(1-Math.abs(detail)/34,.18,.72);
    out[i]=clamp(base[i]+(data[i]-base[i])*preserve);
    out[i+1]=clamp(base[i+1]+(data[i+1]-base[i+1])*preserve);
    out[i+2]=clamp(base[i+2]+(data[i+2]-base[i+2])*preserve);
    out[i+3]=data[i+3];
  }
  return out;
}