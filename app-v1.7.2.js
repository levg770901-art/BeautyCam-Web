(() => {
  "use strict";

  const MP_VERSION = "1.0.1";
  const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
  const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
  const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  const PREVIEW_MAX = 720;
  const PHOTO_MAX = 1600;
  const FPS = 8;

  const video = document.getElementById("video");
  const canvas = document.getElementById("previewCanvas");
  const placeholder = document.getElementById("placeholder");
  const status = document.getElementById("status");
  const startBtn = document.getElementById("startCamera");
  const switchBtn = document.getElementById("switchCamera");
  const captureBtn = document.getElementById("capture");
  const saveBtn = document.getElementById("download");
  const resetBtn = document.getElementById("reset");
  const sliders = {
    smooth: document.getElementById("smooth"),
    soften: document.getElementById("soften"),
    whiten: document.getElementById("whiten"),
    makeup: document.getElementById("makeup")
  };
  const values = {
    smooth: document.getElementById("smoothValue"),
    soften: document.getElementById("softenValue"),
    whiten: document.getElementById("whitenValue"),
    makeup: document.getElementById("makeupValue")
  };

  const detectCanvas = document.createElement("canvas");
  const detectCtx = detectCanvas.getContext("2d", { willReadFrequently: false });

  let stream = null;
  let sourceKind = null;
  let facing = "user";
  let mirrored = true;
  let raf = 0;
  let lastFrame = 0;
  let faceLandmarker = null;
  let faceInit = null;
  let latestFaces = [];
  let faceError = "";
  let detectMode = "IMAGE";

  const setStatus = text => { if (status) status.textContent = text; };
  const updateLabels = () => Object.keys(sliders).forEach(k => { if (values[k]) values[k].textContent = sliders[k].value; });
  const params = () => ({
    smooth: +sliders.smooth.value / 100,
    soften: +sliders.soften.value / 100,
    whiten: +sliders.whiten.value / 100,
    makeup: +sliders.makeup.value / 100
  });

  function showVideo() {
    video.style.display = "block";
    canvas.style.display = "none";
    placeholder.style.display = "none";
  }

  function showCanvas() {
    video.style.display = "none";
    canvas.style.display = "block";
    placeholder.style.display = "none";
  }

  function setMirror(value) {
    mirrored = !!value;
    canvas.style.transform = mirrored ? "scaleX(-1)" : "none";
  }

  function stopCamera() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
  }

  async function initFace() {
    if (faceLandmarker) return faceLandmarker;
    if (faceInit) return faceInit;

    faceInit = (async () => {
      try {
        setStatus("相機已開啟 · 載入臉部追蹤…");
        const vision = await import(MP_BUNDLE);
        if (!vision?.FilesetResolver || !vision?.FaceLandmarker) {
          throw new Error("MediaPipe 模組載入不完整");
        }
        const resolver = await vision.FilesetResolver.forVisionTasks(MP_WASM);
        faceLandmarker = await vision.FaceLandmarker.createFromOptions(resolver, {
          baseOptions: {
            modelAssetPath: FACE_MODEL,
            delegate: "CPU"
          },
          runningMode: "IMAGE",
          numFaces: 1,
          minFaceDetectionConfidence: 0.30,
          minFacePresenceConfidence: 0.30,
          minTrackingConfidence: 0.30,
          outputFaceBlendshapes: false
        });
        detectMode = "IMAGE";
        faceError = "";
        setStatus(`臉部追蹤已就緒 · MediaPipe ${MP_VERSION} CPU/IMAGE · 偵測 0 張臉`);
        return faceLandmarker;
      } catch (error) {
        console.error("BeautyCam FaceLandmarker init failed", error);
        faceLandmarker = null;
        faceError = error?.message || error?.name || String(error);
        setStatus(`臉部追蹤載入失敗 · ${faceError}`);
        return null;
      } finally {
        faceInit = null;
      }
    })();
    return faceInit;
  }

  function resizeDetectionCanvas() {
    if (!video.videoWidth || !video.videoHeight) return false;
    const scale = Math.min(1, PREVIEW_MAX / Math.max(video.videoWidth, video.videoHeight));
    detectCanvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    detectCanvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    return true;
  }

  function detectFace() {
    if (!faceLandmarker || video.readyState < 2) return;
    if (!resizeDetectionCanvas()) return;
    try {
      detectCtx.drawImage(video, 0, 0, detectCanvas.width, detectCanvas.height);
      const result = faceLandmarker.detect(detectCanvas);
      latestFaces = result?.faceLandmarks || [];
      faceError = "";
    } catch (error) {
      latestFaces = [];
      faceError = error?.message || error?.name || String(error);
      console.warn("BeautyCam face detect failed", error);
    }
    setStatus(`美肌 ${sliders.smooth.value}% · 磨皮 ${sliders.soften.value}% · 美白 ${sliders.whiten.value}% · 彩妝 ${sliders.makeup.value}% · 偵測 ${latestFaces.length} 張臉`);
  }

  const OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
  const EYES = [[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],[362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]];
  const MOUTH = [61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,78];
  const NOSE = [1,2,98,327,168,197,5,4,51,281];

  function polygon(ctx, face, ids, w, h) {
    const points = ids.map(i => face[i]).filter(Boolean).map(p => [p.x*w, p.y*h]);
    if (points.length < 3) return points;
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
    ctx.closePath();
    return points;
  }

  function faceMask(w, h, faces) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    for (const face of faces) {
      if (polygon(ctx, face, OVAL, w, h).length >= 3) ctx.fill();
      for (const ids of [...EYES, MOUTH, NOSE]) {
        const points = ids.map(i => face[i]).filter(Boolean).map(p => [p.x*w, p.y*h]);
        if (points.length < 3) continue;
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.moveTo(...points[0]);
        for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    const data = ctx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w*h);
    for (let i = 0; i < mask.length; i++) mask[i] = data[i*4];
    return mask;
  }

  function feather(mask, w, h, radius) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const rgba = new Uint8ClampedArray(w*h*4);
    for (let i = 0; i < mask.length; i++) {
      const v = mask[i];
      rgba[i*4] = rgba[i*4+1] = rgba[i*4+2] = v;
      rgba[i*4+3] = 255;
    }
    ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
    const blurred = document.createElement("canvas");
    blurred.width = w; blurred.height = h;
    const bctx = blurred.getContext("2d", { willReadFrequently: true });
    bctx.filter = `blur(${radius}px)`;
    bctx.drawImage(c, 0, 0);
    return bctx.getImageData(0, 0, w, h).data;
  }

  function skinScore(r,g,b,y,ch) {
    if (y < 20 || y > 250 || ch < 2) return 0;
    const warm = r >= g*.80 && g >= b*.68;
    const rose = r > g && g >= b*.86;
    const yellow = g >= b*1.04;
    const neutral = ch < 38 && r >= g*.88 && g >= b*.84;
    if (!warm || (!rose && !yellow && !neutral)) return 0;
    const v = Math.min(1, Math.max(0,(r-g)/75)*.43 + Math.max(0,g-b)/90*.37 + Math.min(1,ch/50)*.2);
    return Math.max(.10, Math.min(1, v + (neutral ? .16 : 0)));
  }

  function blurSource(source,w,h,r) {
    const c = document.createElement("canvas");
    c.width=w; c.height=h;
    const ctx=c.getContext("2d",{willReadFrequently:true});
    ctx.filter=`blur(${r}px)`;
    ctx.drawImage(source,0,0,w,h);
    ctx.filter="none";
    return ctx.getImageData(0,0,w,h).data;
  }

  function processBeauty(source,w,h,max,capture) {
    const scale = Math.min(1, max/Math.max(w,h));
    const outW = Math.max(1,Math.round(w*scale));
    const outH = Math.max(1,Math.round(h*scale));
    canvas.width=outW; canvas.height=outH;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(source,0,0,outW,outH);
    const base=ctx.getImageData(0,0,outW,outH);
    const output=new Uint8ClampedArray(base.data);
    const p=params();
    if (!(p.smooth||p.soften||p.whiten) || !latestFaces.length) return new ImageData(output,outW,outH);
    const mask=faceMask(outW,outH,latestFaces);
    const soft=feather(mask,outW,outH,Math.max(3,Math.round(outW/260)));
    const blur=blurSource(source,outW,outH,1.6+4.2*p.smooth+2.8*p.soften);
    const glow=blurSource(source,outW,outH,8+8*p.soften);
    const strength=Math.min(.50,p.smooth*.42+p.soften*.46)*(capture?1.08:1);
    for(let i=0,k=0;i<output.length;i+=4,k++){
      const r=base.data[i],g=base.data[i+1],b=base.data[i+2];
      const y=.2126*r+.7152*g+.0722*b;
      const ch=Math.max(r,g,b)-Math.min(r,g,b);
      const gate=skinScore(r,g,b,y,ch)*(soft[k*4]/255);
      if(gate<.03) continue;
      if(strength){
        const diff=Math.min(1,(Math.abs(r-blur[i])+Math.abs(g-blur[i+1])+Math.abs(b-blur[i+2]))/105);
        const mix=Math.min(.52,strength*gate*Math.max(.25,1-.55*diff));
        output[i]=r+(blur[i]-r)*mix;
        output[i+1]=g+(blur[i+1]-g)*mix;
        output[i+2]=b+(blur[i+2]-b)*mix;
      }
      let rr=output[i],gg=output[i+1],bb=output[i+2];
      const yy=.2126*rr+.7152*gg+.0722*bb;
      const shadow=Math.max(0,160-yy)/160;
      const lift=shadow*(4+p.soften*5)*gate;
      rr+=lift*.96; gg+=lift; bb+=lift*.98;
      if(p.whiten){
        const head=Math.max(0,250-yy)/205;
        const v=p.whiten*(18+10*p.soften)*head*gate;
        rr+=v*.965; gg+=v; bb+=v*.985;
      }
      if(p.soften){
        const gy=.2126*glow[i]+.7152*glow[i+1]+.0722*glow[i+2];
        const q=Math.max(0,Math.min(1,(gy-85)/150));
        const v=p.soften*5.5*q*gate;
        rr+=v*.97; gg+=v; bb+=v*.99;
      }
      const av=(rr+gg+bb)/3;
      const sat=1+p.smooth*.04;
      output[i]=Math.max(0,Math.min(255,av+(rr-av)*sat));
      output[i+1]=Math.max(0,Math.min(255,av+(gg-av)*sat));
      output[i+2]=Math.max(0,Math.min(255,av+(bb-av)*sat));
    }
    return new ImageData(output,outW,outH);
  }

  function render(source,max,capture=false){
    const data=processBeauty(source,source.videoWidth||source.width,source.videoHeight||source.height,max,capture);
    const ctx=canvas.getContext("2d");
    ctx.putImageData(data,0,0);
    if(window.BeautyCamMakeup?.render){
      window.BeautyCamMakeup.render(ctx,latestFaces,data.width,data.height,{amount:params().makeup});
    }
    setStatus(`美肌 ${sliders.smooth.value}% · 磨皮 ${sliders.soften.value}% · 美白 ${sliders.whiten.value}% · 彩妝 ${sliders.makeup.value}% · 偵測 ${latestFaces.length} 張臉`);
  }

  async function openStream(){
    try{return await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:960}}});}
    catch(e){return navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:facing}});}
  }

  async function start(){
    stopCamera();
    if(!navigator.mediaDevices?.getUserMedia){setStatus("目前環境不支援相機，請使用 HTTPS 網頁");return;}
    try{
      stream=await openStream();
      video.srcObject=stream;
      await video.play();
      sourceKind="camera";
      latestFaces=[];
      lastFrame=0;
      captureBtn.disabled=false;
      switchBtn.disabled=false;
      startBtn.textContent=facing==="user"?"前鏡頭已開啟":"後鏡頭已開啟";
      setMirror(facing==="user");
      showVideo();
      const tracker=await initFace();
      if(!tracker){setStatus(`相機已開啟 · 臉部追蹤不可用 · ${faceError}`);return;}
      showCanvas();
      loop();
    }catch(e){
      stopCamera();
      setStatus(e?.name==="NotAllowedError"?"相機權限被拒絕，請允許此網站使用相機":e?.name==="NotFoundError"?"找不到可用的相機":e?.name==="NotReadableError"?"相機目前被其他程式占用":"無法開啟相機，請確認 Safari 的相機權限");
      captureBtn.disabled=true;
      switchBtn.disabled=true;
    }
  }

  function loop(){
    const interval=1000/FPS;
    const tick=t=>{
      raf=requestAnimationFrame(tick);
      if(sourceKind!=="camera"||video.readyState<2||t-lastFrame<interval)return;
      lastFrame=t;
      detectFace();
      render(video,PREVIEW_MAX,false);
    };
    raf=requestAnimationFrame(tick);
  }

  function flipCanvas(){
    const temp=document.createElement("canvas");
    temp.width=canvas.width; temp.height=canvas.height;
    const t=temp.getContext("2d");
    t.translate(temp.width,0); t.scale(-1,1); t.drawImage(canvas,0,0);
    const ctx=canvas.getContext("2d");
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(temp,0,0);
  }

  async function capture(){
    if(sourceKind!=="camera"||!video.videoWidth)return;
    if(raf)cancelAnimationFrame(raf); raf=0;
    detectFace();
    render(video,PHOTO_MAX,true);
    if(facing==="user")flipCanvas();
    canvas.style.transform="none";
    saveBtn.disabled=false;
    setStatus(`拍照完成 · 偵測 ${latestFaces.length} 張臉`);
    stopCamera();
    sourceKind="photo-capture";
    switchBtn.disabled=true;
    startBtn.textContent="開啟前鏡頭";
  }

  function reset(){
    stopCamera(); latestFaces=[]; sourceKind=null;
    canvas.style.display="none"; canvas.style.transform="none"; video.style.display="none"; placeholder.style.display="grid";
    captureBtn.disabled=true; switchBtn.disabled=true; saveBtn.disabled=true; facing="user"; setMirror(true);
    startBtn.textContent="開啟前鏡頭"; setStatus("已重設");
  }

  startBtn.addEventListener("click",start);
  switchBtn.addEventListener("click",()=>{facing=facing==="user"?"environment":"user";start();});
  captureBtn.addEventListener("click",capture);
  resetBtn.addEventListener("click",reset);
  Object.values(sliders).forEach(s=>s?.addEventListener("input",updateLabels));
  window.addEventListener("pagehide",stopCamera);
  window.addEventListener("beforeunload",stopCamera);
  updateLabels();
  setMirror(true);
  window.BeautyCamEngine={getFaces:()=>latestFaces,getMirror:()=>mirrored,getCanvas:()=>canvas,getFaceError:()=>faceError,getDetectMode:()=>detectMode};
})();