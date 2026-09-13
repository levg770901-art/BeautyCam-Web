(() => {
  "use strict";
  const video=document.getElementById("video"), baseCanvas=document.getElementById("previewCanvas"), slider=document.getElementById("makeup");
  if(!video||!baseCanvas||!slider)return;
  let landmarker=null,loading=null,faces=[],lastDetect=0,lastRender=0,palette="natural";
  const MODEL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  const WASM="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
  const PALETTES={natural:{lip:"168,72,86",blush:"224,102,122",shadow:"116,88,76",brow:"62,48,45"},rose:{lip:"194,55,86",blush:"232,82,116",shadow:"151,76,104",brow:"58,44,45"},warm:{lip:"186,67,48",blush:"232,110,84",shadow:"154,105,72",brow:"66,50,41"}};
  const overlay=document.createElement("canvas");overlay.id="makeupCanvas";overlay.setAttribute("aria-hidden","true");Object.assign(overlay.style,{position:"absolute",inset:"0",width:"100%",height:"100%",objectFit:"cover",objectPosition:"center center",display:"none",zIndex:"4",pointerEvents:"none",transformOrigin:"center center"});baseCanvas.parentElement.appendChild(overlay);
  function p(f,i,w,h){const q=f?.[i];return q?[q.x*w,q.y*h]:null} function d(a,b){return a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0} function avg(f,ids,w,h){const a=ids.map(i=>p(f,i,w,h)).filter(Boolean);return a.length?[a.reduce((s,q)=>s+q[0],0)/a.length,a.reduce((s,q)=>s+q[1],0)/a.length]:null}
  function poly(ctx,f,ids,w,h){const a=ids.map(i=>p(f,i,w,h)).filter(Boolean);if(a.length<3)return false;ctx.beginPath();ctx.moveTo(...a[0]);for(let i=1;i<a.length;i++)ctx.lineTo(...a[i]);ctx.closePath();return true}
  function soft(ctx,x,y,rx,ry,color,a){if(!x)return;const g=ctx.createRadialGradient(x,y,0,x,y,Math.max(rx,ry));g.addColorStop(0,`rgba(${color},${a})`);g.addColorStop(.55,`rgba(${color},${a*.42})`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
  async function init(){if(landmarker)return landmarker;if(loading)return loading;loading=(async()=>{try{const v=await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js");const r=await v.FilesetResolver.forVisionTasks(WASM);landmarker=await v.FaceLandmarker.createFromOptions(r,{baseOptions:{modelAssetPath:MODEL,delegate:"GPU"},runningMode:"VIDEO",numFaces:5,minFaceDetectionConfidence:.55,minFacePresenceConfidence:.55,minTrackingConfidence:.55});}catch(e){console.warn("Makeup face tracking unavailable",e);landmarker=null}finally{loading=null}return landmarker})();return loading}
  function detect(t){if(!landmarker||video.readyState<2||t-lastDetect<120)return;lastDetect=t;try{faces=landmarker.detectForVideo(video,t)?.faceLandmarks||[]}catch(e){}}
  function render(){const s=Number(slider.value)/100;if(!s||!faces.length||!baseCanvas.width)return;const w=baseCanvas.width,h=baseCanvas.height;overlay.width=w;overlay.height=h;overlay.style.transform=baseCanvas.style.transform||"none";overlay.style.display=baseCanvas.style.display==="none"?"none":"block";const ctx=overlay.getContext("2d");ctx.clearRect(0,0,w,h);const c=PALETTES[palette];for(const f of faces){const fw=d(p(f,234,w,h),p(f,454,w,h))||w*.3;const le=avg(f,[33,133,159,145],w,h),re=avg(f,[362,263,386,374],w,h);
      // Blush: clearly visible but feathered.
      if(le&&re){soft(ctx,le[0]-fw*.02,le[1]+fw*.25,fw*.19,fw*.13,c.blush,.42*s);soft(ctx,re[0]+fw*.02,re[1]+fw*.25,fw*.19,fw*.13,c.blush,.42*s);}
      // Eyeshadow + soft liner.
      if(le&&re){soft(ctx,le[0],le[1]-fw*.035,fw*.18,fw*.075,c.shadow,.52*s);soft(ctx,re[0],re[1]-fw*.035,fw*.18,fw*.075,c.shadow,.52*s);}
      // Lips: actual landmark polygon, not a generic oval.
      if(poly(ctx,f,[61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,78],w,h)){ctx.save();ctx.clip();ctx.fillStyle=`rgba(${c.lip},${.72*s})`;ctx.fillRect(0,0,w,h);ctx.restore();}
      // Brow density follows existing eyebrow landmarks.
      const lb=[70,63,105,66,107],rb=[300,293,334,296,336];ctx.strokeStyle=`rgba(${c.brow},${.78*s})`;ctx.lineCap="round";ctx.lineWidth=Math.max(2,fw*.012);for(const ids of [lb,rb]){const pts=ids.map(i=>p(f,i,w,h)).filter(Boolean);if(pts.length>2){ctx.beginPath();ctx.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)ctx.lineTo(...pts[i]);ctx.stroke();}}
    }}
  function loop(t){requestAnimationFrame(loop);detect(t);if(Number(slider.value)>0&&t-lastRender>70){lastRender=t;render()}}
  document.querySelectorAll(".makeup-preset").forEach(b=>b.addEventListener("click",()=>{palette=b.dataset.makeup==="0"?"natural":b.dataset.makeup;if(b.dataset.makeup==="0"){slider.value=0;slider.dispatchEvent(new Event("input"));}else if(Number(slider.value)<60){slider.value=70;slider.dispatchEvent(new Event("input"));}}));
  slider.addEventListener("input",()=>{if(Number(slider.value)>0){init();}else{overlay.style.display="none";}});
  document.getElementById("capture")?.addEventListener("click",()=>setTimeout(()=>{render();if(Number(slider.value)>0&&overlay.style.display!=="none"){const ctx=baseCanvas.getContext("2d");ctx.drawImage(overlay,0,0);overlay.style.display="none";}},180));
  document.getElementById("reset")?.addEventListener("click",()=>{slider.value=0;slider.dispatchEvent(new Event("input"));overlay.style.display="none"});
  init();requestAnimationFrame(loop);
})();
