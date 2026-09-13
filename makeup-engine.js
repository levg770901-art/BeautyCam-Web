(() => {
  "use strict";
  const PALETTES = {
    natural:{lip:[168,72,86],blush:[224,102,122],shadow:[116,88,76],brow:[62,48,45]},
    rose:{lip:[194,55,86],blush:[232,82,116],shadow:[151,76,104],brow:[58,44,45]},
    warm:{lip:[186,67,48],blush:[232,110,84],shadow:[154,105,72],brow:[66,50,41]}
  };
  let palette="natural", strength=0, lastRun=0;
  const video=document.getElementById("video"), canvas=document.getElementById("previewCanvas"), makeupSlider=document.getElementById("makeup"), makeupValue=document.getElementById("makeupValue");
  let detector=null, detectorPromise=null, faces=[];
  const FACE_MODEL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  const WASM="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
  const LEFT_EYE=[33,7,163,144,145,153,154,155,133], RIGHT_EYE=[362,382,381,380,374,373,390,249,263], LIPS=[61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,78];
  function p(face,i,w,h){const q=face?.[i];return q?[q.x*w,q.y*h]:null}
  function d(a,b){return a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0}
  function avg(face,ids,w,h){const a=ids.map(i=>p(face,i,w,h)).filter(Boolean);return a.length?[a.reduce((s,q)=>s+q[0],0)/a.length,a.reduce((s,q)=>s+q[1],0)/a.length]:null}
  function poly(ctx,face,ids,w,h){const a=ids.map(i=>p(face,i,w,h)).filter(Boolean);if(a.length<3)return;ctx.beginPath();ctx.moveTo(...a[0]);for(let i=1;i<a.length;i++)ctx.lineTo(...a[i]);ctx.closePath();}
  function drawSoftEllipse(ctx,cx,cy,rx,ry,color,a){if(!cx)return;const g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rx,ry));g.addColorStop(0,`rgba(${color},${a})`);g.addColorStop(.55,`rgba(${color},${a*.42})`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill()}
  function drawLine(ctx,a,b,color,w,a1){if(!a||!b)return;ctx.strokeStyle=`rgba(${color},${a1})`;ctx.lineWidth=w;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke()}
  async function init(){if(detector)return detector;if(detectorPromise)return detectorPromise;detectorPromise=(async()=>{try{const v=await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js");const r=await v.FilesetResolver.forVisionTasks(WASM);detector=await v.FaceLandmarker.createFromOptions(r,{baseOptions:{modelAssetPath:FACE_MODEL,delegate:"GPU"},runningMode:"VIDEO",numFaces:5,minFaceDetectionConfidence:.55,minFacePresenceConfidence:.55,minTrackingConfidence:.55});return detector}catch(e){console.warn("Makeup detector unavailable",e);return null}finally{detectorPromise=null}})();return detectorPromise}
  function render(){if(!strength||!faces.length)return;const w=canvas.width,h=canvas.height;if(!w||!h)return;const src=canvas;const layer=document.createElement("canvas");layer.width=w;layer.height=h;const ctx=layer.getContext("2d");ctx.drawImage(src,0,0);const c=PALETTES[palette]||PALETTES.natural;for(const face of faces){const fw=d(p(face,234,w,h),p(face,454,w,h))||w*.3;const le=avg(face,[33,133,159,145],w,h),re=avg(face,[362,263,386,374],w,h),mouth=avg(face,[61,291,13,14],w,h);const lipPts=LIPS.map(i=>p(face,i,w,h)).filter(Boolean);if(lipPts.length){ctx.save();poly(ctx,face,LIPS,w,h);ctx.clip();ctx.fillStyle=`rgba(${c.lip[0]},${c.lip[1]},${c.lip[2]},${.48*strength})`;ctx.fillRect(0,0,w,h);ctx.restore();}
    if(le&&re){drawSoftEllipse(ctx,le[0],le[1]+fw*.23,fw*.18,fw*.095,c.blush,.24*strength);drawSoftEllipse(ctx,re[0],re[1]+fw*.23,fw*.18,fw*.095,c.blush,.24*strength);drawSoftEllipse(ctx,le[0],le[1]-fw*.035,fw*.19,fw*.075,c.shadow,.32*strength);drawSoftEllipse(ctx,re[0],re[1]-fw*.035,fw*.19,fw*.075,c.shadow,.32*strength);}
    if(le&&re){drawLine(ctx,p(face,159,w,h),p(face,33,w,h),c.brow,Math.max(1.2,fw*.010),.55*strength);drawLine(ctx,p(face,386,w,h),p(face,362,w,h),c.brow,Math.max(1.2,fw*.010),.55*strength);}
    if(le&&re){drawLine(ctx,p(face,159,w,h),p(face,33,w,h),c.brow,Math.max(1,fw*.006),.65*strength);drawLine(ctx,p(face,386,w,h),p(face,362,w,h),c.brow,Math.max(1,fw*.006),.65*strength);}
  }
  const main=canvas.getContext("2d");main.clearRect(0,0,w,h);main.drawImage(layer,0,0);}
  async function tick(t){requestAnimationFrame(tick);if(!strength||!canvas.width)return;if(t-lastRun<140)return;lastRun=t;const dtr=await init();if(!dtr)return;try{faces=dtr.detectForVideo(canvas,t)?.faceLandmarks||[];render()}catch(e){}}
  function setPalette(v){palette=v;document.querySelectorAll(".makeup-preset").forEach(b=>b.classList.toggle("active",b.dataset.makeup===v));if(v==="0")strength=0}
  function setStrength(v){strength=Math.max(0,Math.min(1,Number(v)/100));if(makeupValue)makeupValue.textContent=v}
  document.querySelectorAll(".makeup-preset").forEach(b=>b.addEventListener("click",()=>{const v=b.dataset.makeup;setPalette(v);if(v!=="0"){setStrength(Math.max(55,Number(makeupSlider?.value||0)));if(makeupSlider)makeupSlider.value=Math.max(55,Number(makeupSlider.value||0));}else{if(makeupSlider)makeupSlider.value=0;setStrength(0)} }));
  makeupSlider?.addEventListener("input",()=>{setStrength(makeupSlider.value);if(Number(makeupSlider.value)>0&&palette==="0")setPalette("natural");});
  window.BeautyMakeupEngine={setPalette,setStrength};
  requestAnimationFrame(tick);
})();
