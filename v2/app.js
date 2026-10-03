import {CameraEngine} from "./camera.js";
import {estimateFaceRegion,ellipseMask,protectFeatures} from "./geometry.js";
import {buildSkinMask} from "./skin.js";
import {processBeauty} from "./beauty.js";
import {Renderer} from "./renderer.js";

const $=id=>document.getElementById(id);
const video=$("video"),canvas=$("canvas"),status=$("status"),placeholder=$("placeholder");
const camera=new CameraEngine(video),renderer=new Renderer(canvas);
const controls={smooth:$("smooth"),soften:$("soften"),whiten:$("whiten")};
let running=false,captureMode=false,last=0,raf=0,faceBox=null;

function setStatus(t){status.textContent=t}
function settings(){return{smooth:+controls.smooth.value,soften:+controls.soften.value,whiten:+controls.whiten.value}}
function updateLabels(){for(const k of Object.keys(controls))$(k+"Value").textContent=controls[k].value}
function sizeFor(max){const s=Math.min(1,max/Math.max(video.videoWidth,video.videoHeight));return[Math.max(1,Math.round(video.videoWidth*s)),Math.max(1,Math.round(video.videoHeight*s))]}

async function render(max=720){
if(!video.videoWidth)return;
const [w,h]=sizeFor(max);renderer.resize(w,h);renderer.draw(video,camera.mirrored);
const raw=renderer.frame();
const face=estimateFaceRegion(w,h,faceBox);
const fm=ellipseMask(w,h,face);
const protect=protectFeatures(w,h,face);
const skin=buildSkinMask(raw.data,w,h,fm,protect);
const out=processBeauty(raw.data,w,h,skin,settings());
renderer.put(new ImageData(out,w,h));
setStatus(`V2.0 Core · 美肌 ${controls.smooth.value}% · 磨皮 ${controls.soften.value}% · 美白 ${controls.whiten.value}%`);
}

function loop(t){if(!running)return;raf=requestAnimationFrame(loop);if(t-last<66)return;last=t;render(720)}
async function start(){
try{await camera.start();running=true;captureMode=false;canvas.style.display="block";video.style.display="none";placeholder.style.display="none";$("capture").disabled=false;$("switch").disabled=false;$("save").disabled=true;$("start").textContent=camera.facing==="user"?"前鏡頭已開啟":"後鏡頭已開啟";setStatus("V2.0 Core · 相機已開啟");raf=requestAnimationFrame(loop)}
catch(e){setStatus("相機開啟失敗："+(e?.message||e));running=false}
}
async function switchCamera(){camera.switch();await start()}
async function capture(){if(!running)return;cancelAnimationFrame(raf);await render(1600);running=false;captureMode=true;$("save").disabled=false;$("capture").disabled=true;$("switch").disabled=true;$("start").textContent="重新開啟前鏡頭";camera.stop();setStatus("V2.0 Core · 已完成高解析度處理")}
async function save(){const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",.94));if(!blob)return;const file=new File([blob],`BeautyCam-V2-${Date.now()}.jpg`,{type:"image/jpeg"});if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file]});return}catch(e){if(e?.name==="AbortError")return}}const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function reset(){cancelAnimationFrame(raf);running=false;captureMode=false;camera.stop();canvas.style.display="none";video.style.display="none";placeholder.style.display="grid";$("capture").disabled=true;$("switch").disabled=true;$("save").disabled=true;$("start").textContent="開啟前鏡頭";setStatus("V2.0 Core 尚未啟動")}
$("start").onclick=start;$("switch").onclick=switchCamera;$("capture").onclick=capture;$("save").onclick=save;$("reset").onclick=reset;
Object.values(controls).forEach(x=>x.addEventListener("input",()=>{updateLabels();if(captureMode)render(1600)}));updateLabels();