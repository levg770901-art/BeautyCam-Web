(() => {
  "use strict";

  const EYE_L = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
  const EYE_R = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
  const LIP = [61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,78];
  const BROW_L = [70,63,105,66,107,55,65,52,53,46,124,7];
  const BROW_R = [336,296,334,293,300,276,283,282,295,285,353,383];

  const PALETTES = {
    natural: { blush:[232,118,132], shadow:[155,112,132], lip:[191,82,94], brow:[73,52,47] },
    rose:    { blush:[239,92,125],  shadow:[161,91,137],  lip:[196,54,86],  brow:[66,46,47] },
    warm:    { blush:[235,132,91],  shadow:[177,113,77],  lip:[184,70,58],  brow:[76,53,43] }
  };

  let style = "natural";
  let amount = 0;
  let browShape = "natural";
  let lipShape = "natural";

  const point = (face, i, w, h) => {
    const p = face?.[i];
    return p ? [p.x * w, p.y * h] : null;
  };
  const average = pts => {
    const a = pts.filter(Boolean);
    if (!a.length) return null;
    return [a.reduce((s,p)=>s+p[0],0)/a.length, a.reduce((s,p)=>s+p[1],0)/a.length];
  };
  const distance = (a,b) => a && b ? Math.hypot(a[0]-b[0],a[1]-b[1]) : 0;
  const color = (c,a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function path(ctx, pts) {
    const p=pts.filter(Boolean);
    if(p.length<3) return false;
    ctx.beginPath(); ctx.moveTo(p[0][0],p[0][1]);
    for(let i=1;i<p.length;i++) ctx.lineTo(p[i][0],p[i][1]);
    ctx.closePath(); return true;
  }

  function softEllipse(ctx,cx,cy,rx,ry,c,alpha,blur) {
    if(!cx || !cy) return;
    ctx.save();
    ctx.filter=`blur(${blur}px)`;
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rx,ry));
    g.addColorStop(0,color(c,alpha));
    g.addColorStop(.58,color(c,alpha*.46));
    g.addColorStop(1,color(c,0));
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function stroke(ctx,pts,c,width,alpha,blur=0) {
    const p=pts.filter(Boolean); if(p.length<2)return;
    ctx.save(); ctx.strokeStyle=color(c,alpha); ctx.lineWidth=width; ctx.lineCap="round"; ctx.lineJoin="round";
    if(blur) ctx.filter=`blur(${blur}px)`;
    ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)ctx.lineTo(p[i][0],p[i][1]);ctx.stroke();ctx.restore();
  }

  function drawEyeShadow(ctx,face,w,h,c,a) {
    const left=average(EYE_L.map(i=>point(face,i,w,h))), right=average(EYE_R.map(i=>point(face,i,w,h)));
    const ed=distance(point(face,33,w,h),point(face,263,w,h));
    if(!left||!right||!ed)return;
    softEllipse(ctx,left[0],left[1]-ed*.005,ed*.115,ed*.052,c,.52*a,ed*.025);
    softEllipse(ctx,right[0],right[1]-ed*.005,ed*.115,ed*.052,c,.52*a,ed*.025);
    stroke(ctx,[point(face,159,w,h),point(face,33,w,h),point(face,133,w,h)], [54,40,47],Math.max(1.2,ed*.012),.62*a,.35);
    stroke(ctx,[point(face,386,w,h),point(face,362,w,h),point(face,263,w,h)], [54,40,47],Math.max(1.2,ed*.012),.62*a,.35);
  }

  function drawBlush(ctx,face,w,h,c,a) {
    const l=average(EYE_L.map(i=>point(face,i,w,h))), r=average(EYE_R.map(i=>point(face,i,w,h)));
    const mouth=average([61,291,13,14].map(i=>point(face,i,w,h)));
    const ed=distance(l,r); if(!l||!r||!mouth||!ed)return;
    const y=mouth[1]-ed*.17, rx=ed*.16, ry=ed*.075;
    softEllipse(ctx,l[0]+ed*.04,y,rx,ry,c,.86*a,ed*.045);
    softEllipse(ctx,r[0]-ed*.04,y,rx,ry,c,.86*a,ed*.045);
  }

  function drawLips(ctx,face,w,h,c,a) {
    const pts=LIP.map(i=>point(face,i,w,h)); if(!path(ctx,pts))return;
    const width=distance(point(face,61,w,h),point(face,291,w,h));
    const center=average([61,291,13,14].map(i=>point(face,i,w,h)));
    ctx.save();
    ctx.globalAlpha=.80*a;
    ctx.fillStyle=color(c,1); ctx.fill();
    const shine=ctx.createRadialGradient(center[0]-width*.18,center[1]-width*.08,1,center[0],center[1],width*.48);
    shine.addColorStop(0,"rgba(255,255,255,.25)"); shine.addColorStop(1,"rgba(255,255,255,0)");
    ctx.globalAlpha=.65*a;ctx.fillStyle=shine;ctx.fill();ctx.restore();
    if(lipShape==="full") {
      ctx.save();ctx.globalAlpha=.28*a;ctx.filter=`blur(${Math.max(1,width*.008)}px)`;ctx.strokeStyle=color(c,1);ctx.lineWidth=Math.max(2,width*.035);path(ctx,pts);ctx.stroke();ctx.restore();
    }
    if(lipShape==="soft") {
      ctx.save();ctx.globalAlpha=.22*a;ctx.filter=`blur(${Math.max(2,width*.035)}px)`;ctx.strokeStyle=color(c,1);ctx.lineWidth=Math.max(3,width*.055);path(ctx,pts);ctx.stroke();ctx.restore();
    }
  }

  function drawBrows(ctx,face,w,h,c,a) {
    const ed=distance(point(face,33,w,h),point(face,263,w,h)); if(!ed)return;
    for(const ids of [BROW_L,BROW_R]) {
      let pts=ids.map(i=>point(face,i,w,h)).filter(Boolean); if(pts.length<4)continue;
      const start=pts[0], end=pts[pts.length-1];
      if(browShape==="straight") {
        const y=(start[1]+end[1])*.5;
        pts=[start,[start[0]+(end[0]-start[0])*.35,y],[start[0]+(end[0]-start[0])*.72,y],end];
      } else if(browShape==="arch") {
        const mx=(start[0]+end[0])*.5, my=(start[1]+end[1])*.5-ed*.035;
        pts=[start,[mx-ed*.07,my],[mx+ed*.07,my],end];
      }
      stroke(ctx,pts,c,Math.max(2,ed*.030),.68*a,Math.max(1,ed*.012));
    }
  }

  function render(ctx,faces,w,h,options={}) {
    const a=Math.max(0,Math.min(1,Number(options.amount ?? amount)));
    if(!ctx||!Array.isArray(faces)||!faces.length||a<=.001)return;
    const p=PALETTES[options.style||style]||PALETTES.natural;
    for(const face of faces) {
      drawEyeShadow(ctx,face,w,h,p.shadow,a);
      drawBlush(ctx,face,w,h,p.blush,a);
      drawLips(ctx,face,w,h,p.lip,a);
      drawBrows(ctx,face,w,h,p.brow,a);
    }
  }

  window.BeautyCamMakeup = {
    setStyle(v){ if(PALETTES[v]) style=v; },
    setAmount(v){ amount=Math.max(0,Math.min(1,Number(v)/100)); },
    setBrowShape(v){ browShape=v||"natural"; },
    setLipShape(v){ lipShape=v||"natural"; },
    render
  };
})();
