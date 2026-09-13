(() => {
  "use strict";
  const EYE_L=[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],EYE_R=[362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
  const LIP=[61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,78];
  const BROW_L=[70,63,105,66,107,55,65,52,53,46],BROW_R=[336,296,334,293,300,276,283,282,295,285];
  const PALETTES={natural:{blush:[232,118,132],shadow:[151,106,132],lip:[191,82,94],brow:[73,52,47]},rose:{blush:[242,82,118],shadow:[164,82,139],lip:[205,48,82],brow:[66,46,47]},warm:{blush:[238,125,82],shadow:[176,105,72],lip:[190,64,53],brow:[76,53,43]}};
  let style="natural",amount=0,browShape="natural",lipShape="natural";
  const pt=(f,i,w,h)=>f?.[i]?[f[i].x*w,f[i].y*h]:null;
  const avg=a=>{a=a.filter(Boolean);return a.length?[a.reduce((s,p)=>s+p[0],0)/a.length,a.reduce((s,p)=>s+p[1],0)/a.length]:null};
  const dist=(a,b)=>a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0;
  const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function poly(ctx,p){p=p.filter(Boolean);if(p.length<3)return false;ctx.beginPath();ctx.moveTo(...p[0]);for(let i=1;i<p.length;i++)ctx.lineTo(...p[i]);ctx.closePath();return true}
  function glow(ctx,x,y,rx,ry,c,a){if(!x||!y||rx<=0||ry<=0)return;ctx.save();const g=ctx.createRadialGradient(x,y,0,x,y,Math.max(rx,ry));g.addColorStop(0,rgba(c,a));g.addColorStop(.48,rgba(c,a*.68));g.addColorStop(.78,rgba(c,a*.20));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore()}
  function line(ctx,p,c,width,a){p=p.filter(Boolean);if(p.length<2)return;ctx.save();ctx.strokeStyle=rgba(c,a);ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(...p[0]);for(let i=1;i<p.length;i++)ctx.lineTo(...p[i]);ctx.stroke();ctx.restore()}
  function eyes(ctx,f,w,h,c,a,ed){const l=avg(EYE_L.map(i=>pt(f,i,w,h))),r=avg(EYE_R.map(i=>pt(f,i,w,h)));if(!l||!r)return;glow(ctx,l[0],l[1]-ed*.035,ed*.13,ed*.065,c,.72*a);glow(ctx,r[0],r[1]-ed*.035,ed*.13,ed*.065,c,.72*a);line(ctx,[pt(f,159,w,h),pt(f,33,w,h),pt(f,133,w,h)],[48,35,42],Math.max(1.5,ed*.014),.78*a);line(ctx,[pt(f,386,w,h),pt(f,362,w,h),pt(f,263,w,h)],[48,35,42],Math.max(1.5,ed*.014),.78*a)}
  function blush(ctx,f,w,h,c,a,ed){const l=avg(EYE_L.map(i=>pt(f,i,w,h))),r=avg(EYE_R.map(i=>pt(f,i,w,h))),m=avg([61,291,13,14].map(i=>pt(f,i,w,h)));if(!l||!r||!m)return;const y=m[1]-ed*.19;glow(ctx,l[0]+ed*.055,y,ed*.18,ed*.082,c,.90*a);glow(ctx,r[0]-ed*.055,y,ed*.18,ed*.082,c,.90*a)}
  function lips(ctx,f,w,h,c,a){const p=LIP.map(i=>pt(f,i,w,h));if(!poly(ctx,p))return;ctx.save();ctx.fillStyle=rgba(c,.72*a);ctx.fill();ctx.restore();const l=pt(f,61,w,h),r=pt(f,291,w,h),m=avg([13,14].map(i=>pt(f,i,w,h))),wd=dist(l,r);if(m&&wd){ctx.save();const g=ctx.createRadialGradient(m[0]-wd*.18,m[1]-wd*.12,1,m[0],m[1],wd*.48);g.addColorStop(0,"rgba(255,255,255,.32)");g.addColorStop(.55,"rgba(255,255,255,.10)");g.addColorStop(1,"rgba(255,255,255,0)");ctx.fillStyle=g;ctx.globalAlpha=.8*a;poly(ctx,p);ctx.fill();ctx.restore()}
    if(lipShape==="full")line(ctx,[pt(f,61,w,h),pt(f,291,w,h)],c,Math.max(2,wd*.025),.55*a);
    if(lipShape==="soft")glow(ctx,m[0],m[1],wd*.31,wd*.10,c,.28*a)
  }
  function brows(ctx,f,w,h,c,a,ed){for(const ids of [BROW_L,BROW_R]){let p=ids.map(i=>pt(f,i,w,h)).filter(Boolean);if(p.length<3)continue;const s=p[0],e=p[p.length-1],mx=(s[0]+e[0])/2,my=(s[1]+e[1])/2;if(browShape==="straight")p=[s,[mx,my],e];else if(browShape==="arch")p=[s,[mx,my-ed*.035],e];line(ctx,p,c,Math.max(2.5,ed*.032),.82*a)}}
  function render(ctx,faces,w,h,options={}){const a=Math.max(0,Math.min(1,Number(options.amount??amount))),p=PALETTES[options.style||style]||PALETTES.natural;if(!ctx||!Array.isArray(faces)||!faces.length||a<=.001)return;for(const f of faces){const ed=dist(pt(f,33,w,h),pt(f,263,w,h));if(!ed)continue;eyes(ctx,f,w,h,p.shadow,a,ed);blush(ctx,f,w,h,p.blush,a,ed);lips(ctx,f,w,h,p.lip,a);brows(ctx,f,w,h,p.brow,a,ed)}}
  window.BeautyCamMakeup={setStyle(v){if(PALETTES[v])style=v},setAmount(v){amount=Math.max(0,Math.min(1,Number(v)/100))},setBrowShape(v){browShape=v||"natural"},setLipShape(v){lipShape=v||"natural"},render};
})();
