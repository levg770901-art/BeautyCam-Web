(() => {
  "use strict";

  // BeautyCam Web V1.7 — makeup renderer
  // Purpose: make makeup visibly render on the same canvas used by the beauty pipeline,
  // while keeping the result soft, face-locked, and free of face-shape deformation.
  const EYE_L=[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
  const EYE_R=[362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
  const LIP=[61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,78];
  const BROW_L=[70,63,105,66,107,55,65,52,53,46];
  const BROW_R=[336,296,334,293,300,276,283,282,295,285];

  const PALETTES={
    natural:{blush:[226,104,120],shadow:[143,99,126],lip:[190,73,88],brow:[70,49,45]},
    rose:{blush:[239,74,111],shadow:[160,78,137],lip:[205,43,78],brow:[64,43,45]},
    warm:{blush:[235,116,77],shadow:[171,98,67],lip:[190,61,50],brow:[75,51,41]}
  };

  let style="natural", amount=0, browShape="natural", lipShape="natural";

  const pt=(f,i,w,h)=>f?.[i] ? [f[i].x*w,f[i].y*h] : null;
  const avg=a=>{a=a.filter(Boolean);return a.length?[a.reduce((s,p)=>s+p[0],0)/a.length,a.reduce((s,p)=>s+p[1],0)/a.length]:null};
  const dist=(a,b)=>a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0;
  const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${Math.max(0,Math.min(1,a))})`;

  function poly(ctx,p){
    p=p.filter(Boolean);
    if(p.length<3)return false;
    ctx.beginPath();
    ctx.moveTo(...p[0]);
    for(let i=1;i<p.length;i++)ctx.lineTo(...p[i]);
    ctx.closePath();
    return true;
  }

  function glow(ctx,x,y,rx,ry,c,a){
    if(!x||!y||rx<=0||ry<=0)return;
    ctx.save();
    const g=ctx.createRadialGradient(x,y,0,x,y,Math.max(rx,ry));
    g.addColorStop(0,rgba(c,a));
    g.addColorStop(.42,rgba(c,a*.72));
    g.addColorStop(.72,rgba(c,a*.20));
    g.addColorStop(1,rgba(c,0));
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function line(ctx,p,c,width,a){
    p=p.filter(Boolean);
    if(p.length<2)return;
    ctx.save();
    ctx.strokeStyle=rgba(c,a);
    ctx.lineWidth=width;
    ctx.lineCap="round";
    ctx.lineJoin="round";
    ctx.beginPath();
    ctx.moveTo(...p[0]);
    for(let i=1;i<p.length;i++)ctx.lineTo(...p[i]);
    ctx.stroke();
    ctx.restore();
  }

  function eyeMakeup(ctx,f,w,h,c,a,ed){
    const l=avg(EYE_L.map(i=>pt(f,i,w,h)));
    const r=avg(EYE_R.map(i=>pt(f,i,w,h)));
    if(!l||!r||!ed)return;

    // Upper-lid colour: deliberately stronger at the centre and feathered at the edge.
    const shadowA=.34*a;
    glow(ctx,l[0],l[1]-ed*.025,ed*.16,ed*.085,c,shadowA);
    glow(ctx,r[0],r[1]-ed*.025,ed*.16,ed*.085,c,shadowA);

    // A very soft lash-line definition; no eye enlargement or geometry deformation.
    const dark=[48,34,41];
    line(ctx,[pt(f,159,w,h),pt(f,33,w,h),pt(f,133,w,h)],dark,Math.max(1.35,ed*.010),.62*a);
    line(ctx,[pt(f,386,w,h),pt(f,362,w,h),pt(f,263,w,h)],dark,Math.max(1.35,ed*.010),.62*a);
  }

  function blush(ctx,f,w,h,c,a,ed){
    const l=avg(EYE_L.map(i=>pt(f,i,w,h)));
    const r=avg(EYE_R.map(i=>pt(f,i,w,h)));
    const m=avg([61,291,13,14].map(i=>pt(f,i,w,h)));
    if(!l||!r||!m||!ed)return;
    const y=m[1]-ed*.18;
    const sideA=.48*a;
    glow(ctx,l[0]+ed*.060,y,ed*.185,ed*.082,c,sideA);
    glow(ctx,r[0]-ed*.060,y,ed*.185,ed*.082,c,sideA);
  }

  function lips(ctx,f,w,h,c,a){
    const p=LIP.map(i=>pt(f,i,w,h));
    if(!poly(ctx,p))return;
    const l=pt(f,61,w,h), r=pt(f,291,w,h), m=avg([13,14].map(i=>pt(f,i,w,h))), wd=dist(l,r);
    if(!m||!wd)return;

    // Keep the natural lip boundary. Only colour and light are changed.
    ctx.save();
    ctx.fillStyle=rgba(c,.52*a);
    ctx.globalCompositeOperation="multiply";
    ctx.fill();
    ctx.restore();

    ctx.save();
    const g=ctx.createRadialGradient(m[0]-wd*.16,m[1]-wd*.13,1,m[0],m[1],wd*.50);
    g.addColorStop(0,"rgba(255,255,255,.28)");
    g.addColorStop(.48,"rgba(255,255,255,.10)");
    g.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=g;
    ctx.globalAlpha=.75*a;
    poly(ctx,p);
    ctx.fill();
    ctx.restore();

    if(lipShape==="full"){
      line(ctx,[pt(f,61,w,h),pt(f,291,w,h)],c,Math.max(1.6,wd*.018),.38*a);
    }else if(lipShape==="soft"){
      glow(ctx,m[0],m[1],wd*.30,wd*.10,c,.18*a);
    }
  }

  function brows(ctx,f,w,h,c,a,ed){
    for(const ids of [BROW_L,BROW_R]){
      const p=ids.map(i=>pt(f,i,w,h)).filter(Boolean);
      if(p.length<3)continue;
      const s=p[0],e=p[p.length-1],mx=(s[0]+e[0])/2,my=(s[1]+e[1])/2;
      let path=p;
      if(browShape==="straight")path=[s,[mx,my],e];
      else if(browShape==="arch")path=[s,[mx,my-ed*.035],e];
      line(ctx,path,c,Math.max(2.0,ed*.023),.68*a);
    }
  }

  function render(ctx,faces,w,h,options={}){
    const a=Math.max(0,Math.min(1,Number(options.amount??amount)));
    const p=PALETTES[options.style||style]||PALETTES.natural;
    if(!ctx||!Array.isArray(faces)||!faces.length||a<=.001)return;

    // Render on a temporary layer so each makeup component composites cleanly
    // over the already-processed beauty image.
    const layer=document.createElement("canvas");
    layer.width=w; layer.height=h;
    const lx=layer.getContext("2d");

    for(const f of faces){
      const ed=dist(pt(f,33,w,h),pt(f,263,w,h));
      if(!ed)continue;
      eyeMakeup(lx,f,w,h,p.shadow,a,ed);
      blush(lx,f,w,h,p.blush,a,ed);
      lips(lx,f,w,h,p.lip,a);
      brows(lx,f,w,h,p.brow,a,ed);
    }

    ctx.save();
    ctx.globalCompositeOperation="source-over";
    ctx.drawImage(layer,0,0);
    ctx.restore();
  }

  window.BeautyCamMakeup={
    setStyle(v){if(PALETTES[v])style=v},
    setAmount(v){amount=Math.max(0,Math.min(1,Number(v)/100))},
    setBrowShape(v){browShape=v||"natural"},
    setLipShape(v){lipShape=v||"natural"},
    render
  };
})();
