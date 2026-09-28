(() => {
  "use strict";
  const video=document.getElementById("video"),canvas=document.getElementById("previewCanvas");
  const s={smooth:document.getElementById("smooth"),soften:document.getElementById("soften"),whiten:document.getElementById("whiten")};
  const clamp=v=>Math.max(0,Math.min(255,v));
  function render(){
    if(!video||!canvas||video.readyState<2||!video.videoWidth)return;
    const faces=window.BeautyCamEngine?.getFaces?.()||[]; if(!faces.length)return;
    const smooth=+s.smooth.value/100,soften=+s.soften.value/100,whiten=+s.whiten.value/100;
    const W=Math.min(720,video.videoWidth),H=Math.round(video.videoHeight*W/video.videoWidth); canvas.width=W;canvas.height=H;
    const x=canvas.getContext("2d",{willReadFrequently:true});x.drawImage(video,0,0,W,H);
    if(!(smooth||soften||whiten))return;
    for(const f of faces){
      const p=f.map(q=>[q.x*W,q.y*H]);
      const minX=Math.max(0,Math.floor(Math.min(...p.map(q=>q[0])))),maxX=Math.min(W-1,Math.ceil(Math.max(...p.map(q=>q[0]))));
      const minY=Math.max(0,Math.floor(Math.min(...p.map(q=>q[1])))),maxY=Math.min(H-1,Math.ceil(Math.max(...p.map(q=>q[1]))));
      const img=x.getImageData(minX,minY,maxX-minX+1,maxY-minY+1),d=img.data;
      const amount=.06+.18*smooth+.16*soften;
      for(let i=0;i<d.length;i+=4){
        const r=d[i],g=d[i+1],b=d[i+2],y=.2126*r+.7152*g+.0722*b;
        const skin=(r>55&&g>38&&b>28&&r>=g*.78&&g>=b*.68)?1:0;
        if(!skin)continue;
        const lift=(Math.max(0,155-y)/155)*(2+4*soften)+whiten*(10+7*soften);
        const v=amount;
        d[i]=clamp(r+(g-r)*v+lift*.95);d[i+1]=clamp(g+(r-g)*v+lift);d[i+2]=clamp(b+(r-b)*v+lift*.98);
      }
      x.putImageData(img,minX,minY);
    }
    window.BeautyCamMakeup?.render?.(x,faces,W,H,{amount:(+document.getElementById("makeup").value||0)/100});
  }
  let timer=0; const start=()=>{clearInterval(timer);timer=setInterval(render,140)};
  window.addEventListener("load",start);start();
})();
