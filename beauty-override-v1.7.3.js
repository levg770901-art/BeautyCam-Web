(() => {
  "use strict";
  const video=document.getElementById("video"), canvas=document.getElementById("previewCanvas");
  const smoothEl=document.getElementById("smooth"), softenEl=document.getElementById("soften"), whitenEl=document.getElementById("whiten"), makeupEl=document.getElementById("makeup");
  const clamp=v=>Math.max(0,Math.min(255,v));
  const OVAL=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
  const EYES=[[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],[362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]];
  const NOSE=[1,2,98,327,168,197,5,4,51,281];
  const MOUTH=[61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,78];
  const BROW_L=[70,63,105,66,107], BROW_R=[300,293,334,296,336];
  const pt=(f,i,W,H)=>{const q=f[i];return q?[q.x*W,q.y*H]:null};
  const pathPoly=(ctx,f,ids,W,H,close=true)=>{const a=ids.map(i=>pt(f,i,W,H)).filter(Boolean);if(a.length<3)return;ctx.moveTo(a[0][0],a[0][1]);for(let i=1;i<a.length;i++)ctx.lineTo(a[i][0],a[i][1]);if(close)ctx.closePath()};
  function maskForFace(f,W,H){
    const m=document.createElement("canvas");m.width=W;m.height=H;const c=m.getContext("2d");
    c.beginPath();pathPoly(c,f,OVAL,W,H);for(const ids of [...EYES,NOSE,MOUTH]){c.moveTo(0,0);pathPoly(c,f,ids,W,H)}
    c.fillStyle="#fff";c.fill("evenodd");
    const d=c.getImageData(0,0,W,H).data;return d;
  }
  function skinRetouch(ctx,base,f,W,H,smooth,soften,whiten){
    if(!(smooth||soften||whiten))return;
    const mask=maskForFace(f,W,H);
    const src=document.createElement("canvas");src.width=W;src.height=H;src.getContext("2d").drawImage(video,0,0,W,H);
    const blur=document.createElement("canvas");blur.width=W;blur.height=H;const bc=blur.getContext("2d");bc.filter=`blur(${1.2+3.8*smooth+2.2*soften}px)`;bc.drawImage(src,0,0);bc.filter="none";
    const alpha=Math.min(.62,.10+.34*smooth+.30*soften);
    const clipped=document.createElement("canvas");clipped.width=W;clipped.height=H;const cc=clipped.getContext("2d");cc.drawImage(blur,0,0);const cd=cc.getImageData(0,0,W,H),md=mask;for(let i=0,k=0;i<cd.data.length;i+=4,k++)cd.data[i+3]=Math.round(md[k*4+3]*alpha);cc.putImageData(cd,0,0);base.drawImage(clipped,0,0);
    if(whiten){base.save();const wgrad=base.createRadialGradient(W*.5,H*.47,Math.min(W,H)*.05,W*.5,H*.48,Math.min(W,H)*.48);wgrad.addColorStop(0,`rgba(255,255,255,${.025+.15*whiten})`);wgrad.addColorStop(1,"rgba(255,255,255,0)");base.globalCompositeOperation="source-atop";base.fillStyle=wgrad;base.fillRect(0,0,W,H);base.restore();}
  }
  function cheek(ctx,f,W,H,side,amount,style){
    const eyeOuter=pt(f,side?263:33,W,H), eyeInner=pt(f,side?362:133,W,H), chin=pt(f,152,W,H);if(!eyeOuter||!eyeInner||!chin)return;
    const cx=(eyeOuter[0]+eyeInner[0])/2+(side?W*.075:-W*.075), cy=eyeOuter[1]+(chin[1]-eyeOuter[1])*.34;
    const r=Math.max(16,W*.045),g=ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.8);const a=.12*amount*(style==="rose"?1.15:style==="warm"?.9:.72);g.addColorStop(0,`rgba(220,82,105,${a})`);g.addColorStop(.55,`rgba(235,105,125,${a*.55})`);g.addColorStop(1,"rgba(235,105,125,0)");ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cx,cy,r*1.55,r*.85,side?-0.12:0.12,0,Math.PI*2);ctx.fill();
  }
  function lips(ctx,f,W,H,amount,style){
    const l=pt(f,61,W,H),r=pt(f,291,W,H),up=pt(f,13,W,H),lo=pt(f,14,W,H);if(!l||!r||!up||!lo)return;
    const cx=(l[0]+r[0])/2,cy=(up[1]+lo[1])/2,ww=Math.max(18,Math.hypot(r[0]-l[0],r[1]-l[1])*.88),hh=Math.max(7,Math.abs(lo[1]-up[1])*2.7);
    ctx.save();ctx.beginPath();ctx.ellipse(cx,cy,ww/2,hh/2,0,0,Math.PI*2);ctx.clip();
    const col=style==="soft"?"176,88,105":style==="full"?"190,62,84":"196,76,96";ctx.fillStyle=`rgba(${col},${.20+.42*amount})`;ctx.fillRect(cx-ww/2,cy-hh/2,ww,hh);ctx.globalCompositeOperation="screen";ctx.fillStyle=`rgba(255,190,200,${.08+.13*amount})`;ctx.fillRect(cx-ww*.2,cy-hh*.28,ww*.4,hh*.3);ctx.restore();
  }
  function brow(ctx,f,W,H,ids,amount,shape){const a=ids.map(i=>pt(f,i,W,H)).filter(Boolean);if(a.length<3)return;ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=`rgba(78,48,45,${.30+.34*amount})`;ctx.lineWidth=Math.max(2,W*.006);ctx.beginPath();ctx.moveTo(a[0][0],a[0][1]);const p1=a[1],p2=a[2],p3=a[3],p4=a[4];if(shape==="straight"){ctx.lineTo(p1[0],p1[1]);ctx.lineTo(p3[0],p3[1]);ctx.lineTo(p4[0],p4[1]);}else if(shape==="arch"){ctx.quadraticCurveTo(p2[0],p2[1]-W*.012,p3[0],p3[1]);ctx.quadraticCurveTo(p3[0],p3[1],p4[0],p4[1]);}else{ctx.quadraticCurveTo(p2[0],p2[1],p3[0],p3[1]);ctx.quadraticCurveTo(p3[0],p3[1],p4[0],p4[1]);}ctx.stroke();ctx.restore();}
  function makeup(ctx,faces,W,H){const amount=(+makeupEl?.value||0)/100;if(!amount||!faces.length)return;const preset=document.querySelector(".makeup-preset.active")?.dataset.makeup||"natural";const brow=document.querySelector(".shape-btn[data-brow].active")?.dataset.brow||"natural";const lip=document.querySelector(".shape-btn[data-lip].active")?.dataset.lip||"natural";for(const f of faces){cheek(ctx,f,W,H,false,amount,preset);cheek(ctx,f,W,H,true,amount,preset);lips(ctx,f,W,H,amount,lip);brow(ctx,f,W,H,BROW_L,amount,brow);brow(ctx,f,W,H,BROW_R,amount,brow);}}
  function render(){
    if(!video||!canvas||video.readyState<2||!video.videoWidth)return;
    const faces=window.BeautyCamEngine?.getFaces?.()||[];if(!faces.length)return;
    const smooth=(+smoothEl.value||0)/100,soften=(+softenEl.value||0)/100,whiten=(+whitenEl.value||0)/100;
    const W=Math.min(720,video.videoWidth),H=Math.round(video.videoHeight*W/video.videoWidth);canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(video,0,0,W,H);
    for(const f of faces)skinRetouch(ctx,ctx,f,W,H,smooth,soften,whiten);
    makeup(ctx,faces,W,H);
  }
  let timer=0;const start=()=>{clearInterval(timer);timer=setInterval(render,100)};window.addEventListener("load",start);start();
})();