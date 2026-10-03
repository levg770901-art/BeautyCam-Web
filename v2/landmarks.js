export class LandmarkProvider{
constructor(){this.mesh=null;this.ready=false;this.error=null}
async init(){if(this.ready)return true;if(!navigator.gpu){this.error=new Error("此瀏覽器不支援 WebGPU");return false}
try{const mod=await import("https://cdn.jsdelivr.net/npm/@svenflow/micro-facemesh@0.1.2/+esm");this.mesh=await mod.createFacemesh({maxFaces:1,scoreThreshold:.5,faceScoreThreshold:.5});this.ready=true;return true}catch(e){this.error=e;return false}}
async detect(source){if(!this.ready||!this.mesh)return[];try{const faces=await this.mesh.detect(source);return faces[0]?.landmarks||[]}catch(e){this.error=e;return[]}}
reset(){this.mesh?.reset?.()}
dispose(){this.mesh?.dispose?.();this.mesh=null;this.ready=false}
}