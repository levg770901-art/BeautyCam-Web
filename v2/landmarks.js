const VISION_CDN="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1";
const WASM_URL="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export class LandmarkProvider{
  constructor(){this.landmarker=null;this.ready=false;this.error=null;this.lastTimestamp=-1}
  async init(){
    if(this.ready)return true;
    try{
      const {FilesetResolver,FaceLandmarker}=await import(VISION_CDN);
      const vision=await FilesetResolver.forVisionTasks(WASM_URL);
      const options={
        baseOptions:{modelAssetPath:MODEL_URL,delegate:"GPU"},
        runningMode:"VIDEO",
        numFaces:1,
        minFaceDetectionConfidence:.5,
        minFacePresenceConfidence:.5,
        minTrackingConfidence:.5,
        outputFaceBlendshapes:true,
        outputFacialTransformationMatrixes:true
      };
      try{
        this.landmarker=await FaceLandmarker.createFromOptions(vision,options);
      }catch(gpuError){
        options.baseOptions.delegate="CPU";
        this.landmarker=await FaceLandmarker.createFromOptions(vision,options);
      }
      this.ready=true;
      this.error=null;
      return true;
    }catch(e){
      this.error=e;
      this.ready=false;
      return false;
    }
  }
  async detect(source){
    if(!this.ready||!this.landmarker)return{landmarks:[],blendshapes:[],transformationMatrix:null};
    try{
      const timestamp=Math.max(performance.now(),this.lastTimestamp+1);
      this.lastTimestamp=timestamp;
      const result=this.landmarker.detectForVideo(source,timestamp);
      return{
        landmarks:result.faceLandmarks?.[0]||[],
        blendshapes:result.faceBlendshapes?.[0]?.categories||[],
        transformationMatrix:result.facialTransformationMatrixes?.[0]||null
      };
    }catch(e){
      this.error=e;
      return{landmarks:[],blendshapes:[],transformationMatrix:null};
    }
  }
  reset(){this.lastTimestamp=-1}
  dispose(){this.landmarker?.close?.();this.landmarker=null;this.ready=false;this.lastTimestamp=-1}
}
