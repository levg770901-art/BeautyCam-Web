const PACKAGE="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1";
const WASM="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
export class FaceVision{
  constructor(){this.engine=null;this.ready=false;this.last=-1}
  async init(){
    if(this.ready)return;
    const {FilesetResolver,FaceLandmarker}=await import(PACKAGE);
    const files=await FilesetResolver.forVisionTasks(WASM);
    const opts={baseOptions:{modelAssetPath:MODEL,delegate:"GPU"},runningMode:"VIDEO",numFaces:1,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,minTrackingConfidence:.5,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true};
    try{this.engine=await FaceLandmarker.createFromOptions(files,opts)}catch(e){opts.baseOptions.delegate="CPU";this.engine=await FaceLandmarker.createFromOptions(files,opts)}
    this.ready=true
  }
  detect(video){
    if(!this.ready)return null;
    const ts=Math.max(performance.now(),this.last+1);this.last=ts;
    const r=this.engine.detectForVideo(video,ts);
    return {landmarks:r.faceLandmarks?.[0]||[],blendshapes:r.faceBlendshapes?.[0]?.categories||[],matrix:r.facialTransformationMatrixes?.[0]||null}
  }
  reset(){this.last=-1}
  close(){this.engine?.close?.();this.engine=null;this.ready=false;this.reset()}
}