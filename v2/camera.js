export class CameraEngine{
constructor(video){this.video=video;this.stream=null;this.facing="user"}
async start(){this.stop();this.stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:this.facing},width:{ideal:1280},height:{ideal:960},frameRate:{ideal:30,max:30}}});this.video.srcObject=this.stream;await this.video.play()}
stop(){if(this.stream){for(const t of this.stream.getTracks())t.stop()}this.stream=null;this.video.srcObject=null}
switch(){this.facing=this.facing==="user"?"environment":"user"}
get mirrored(){return this.facing==="user"}
}