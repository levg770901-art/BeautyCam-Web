(() => {
  "use strict";
  const video=document.getElementById("video"), canvas=document.getElementById("previewCanvas"), slider=document.getElementById("makeup");
  if(!video||!canvas||!slider||!window.BeautyMakeupEngine)return;
  let landmarker=null, loading=null, faces=[], lastDetect=0, lastRender=0, palette="natural";
  const MODEL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  const WASM="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
  async function init(){
    if(landmarker)return landmarker;
    if(loading)return loading;
    loading=(async()=>{try{
      const vision=await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js");
      const resolver=await vision.FilesetResolver.forVisionTasks(WASM);
      landmarker=await vision.FaceLandmarker.createFromOptions(resolver,{baseOptions:{modelAssetPath:MODEL,delegate:"GPU"},runningMode:"VIDEO",numFaces:5,minFaceDetectionConfidence:.55,minFacePresenceConfidence:.55,minTrackingConfidence:.55,outputFaceBlendshapes:false});
    }catch(e){console.warn("Makeup engine face tracking unavailable",e);landmarker=null}finally{loading=null}return landmarker})();
    return loading;
  }
  function detect(t){
    if(!landmarker||!video.srcObject||video.readyState<2||t-lastDetect<120)return;
    lastDetect=t;
    try{faces=landmarker.detectForVideo(video,t)?.faceLandmarks||[]}catch(e){}
  }
  function render(){
    const strength=Number(slider.value)/100;
    if(!strength||!faces.length||!canvas.width)return;
    const src=canvas.getContext("2d",{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
    const out=window.BeautyMakeupEngine.renderMakeup(src,faces,{strength,palette});
    canvas.getContext("2d").putImageData(out,0,0);
  }
  function loop(t){requestAnimationFrame(loop);detect(t);if(Number(slider.value)>0&&t-lastRender>280){lastRender=t;render()}}
  document.querySelectorAll(".makeup-preset").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.makeup!=="0")palette=b.dataset.makeup;else palette="natural"}));
  document.getElementById("capture")?.addEventListener("click",()=>setTimeout(render,80));
  init();requestAnimationFrame(loop);
})();
