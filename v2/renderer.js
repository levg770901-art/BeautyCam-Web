export class Renderer{
constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext("2d",{willReadFrequently:true})}
resize(w,h){if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}}
draw(video,mirrored){const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.save();if(mirrored){c.translate(w,0);c.scale(-1,1)}c.drawImage(video,0,0,w,h);c.restore()}
frame(){return this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height)}
put(data){this.ctx.putImageData(data,0,0)}
}