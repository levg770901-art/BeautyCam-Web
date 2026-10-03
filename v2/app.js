import {CameraEngine} from "./camera.js";
import {LandmarkProvider} from "./landmarks.js";
import {faceFromLandmarks,landmarkMask,protectFeatures,resizeMask,smoothLandmarks} from "./geometry.js";
import {buildSkinMask} from "./skin.js";
import {processBeauty} from "./beauty.js";
import {Renderer} from "./renderer.js";
import {renderMakeup} from "./makeup.js";
const $=id=>document.getElementById(id),video=$("video"),canvas=$("canvas"),status=$("status"),placeholder=$("placeholder");
const camera=new CameraEngine(video),landmarks=new LandmarkProvider(),renderer=new Renderer(canvas);
const perf={frames:0,last:performance.now(),fps:0,detectMs:0,renderMs:0};
const controls={smooth:$("smooth"),soften:$("soften"),whiten:$("whiten"),makeup:$("makeup")};
let makeupStyle="natural";
let running=false,captureMode=false,last=0,raf=0,stable=[],providerReady=false,detectBusy=false,liveMax=720,qualityTimer=0;
const setStatus=t=>status.textContent=t;
const settings=()=>({smooth:+controls.smooth.value,soften:+controls.soften.value,whiten:+controls.whiten.value});
const maskSize=(w,h)=>{const max=360,s=Math.min(1,max/Math.max(w,h));return[Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s))]};
const updateLabels=()=>Object.keys(controls).forEach(k=>$(k+"Value").textContent=controls[k].value);
const sizeFor=max=>{const s=Math.min(1,max/Math.max(video.videoWidth,video.videoHeight));return[Math.max(1,Math.round(video.videoWidth*s)),Math.max(1,Math.round(video.videoHeight*s))]};
async function detect(){if(detectBusy)return stable;detectBusy=true;const t=performance.now();try{const pts=await landmarks.detect(video);stable=smoothLandmarks(stable,pts,.28)}finally{perf.detectMs=performance.now()-t;detectBusy=false}return stable}
async function render(max=720,doDetect=true){if(!video.videoWidth)return;const t=performance.now();const[w,h]=sizeFor(max);renderer.resize(w,h);renderer.draw(video,camera.mirrored);const raw=renderer.frame();const pts=doDetect?await detect():stable;const face=faceFromLandmarks(pts,w,h,camera.mirrored);if(!face){renderer.put(raw);setStatus("V2.0 · 尋找臉部…");return}const [mw,mh]=maskSize(w,h);
const faceMask=landmarkMask(mw,mh,face);
const protectMask=protectFeatures(mw,mh,face);
const skin=buildSkinMask(raw.data,w,h,resizeMask(faceMask,mw,mh,w,h),resizeMask(protectMask,mw,mh,w,h));
renderer.put(new ImageData(processBeauty(raw.data,w,h,skin,settings()),w,h));
renderMakeup(renderer.ctx,face?[face.landmarks]:[],w,h,{amount:+controls.makeup.value,style:makeupStyle});perf.renderMs=performance.now()-t;perf.frames++;if(performance.now()-perf.last>1000){perf.fps=perf.frames*1000/(performance.now()-perf.last);perf.frames=0;perf.last=performance.now()}setStatus(`V2.0 · 478 landmarks · 美肌 ${controls.smooth.value}% · 磨皮 ${controls.soften.value}% · 美白 ${controls.whiten.value}%`)}
async function loop(t){if(!running)return;raf=requestAnimationFrame(loop);if(t-last<80)return;last=t;await render(liveMax,true);
if(t-qualityTimer>2500){qualityTimer=t;if(perf.fps&&perf.fps<9&&liveMax>540)liveMax=540;else if(perf.fps>14&&perf.renderMs<48&&liveMax<720)liveMax=720}}
async function start(){try{await camera.start();running=true;captureMode=false;canvas.style.display="block";video.style.display="none";placeholder.style.display="none";$("capture").disabled=false;$("switch").disabled=false;$("save").disabled=true;liveMax=720;$("start").textContent=camera.facing==="user"?"前鏡頭已開啟":"後鏡頭已開啟";if(!providerReady){setStatus("V2.0 · 初始化 GPU 臉部追蹤…");providerReady=await landmarks.init()}if(!providerReady){setStatus("GPU 臉部追蹤初始化失敗："+(landmarks.error?.message||"未知錯誤"));return}setStatus("V2.0 · 478 landmarks 已啟動");raf=requestAnimationFrame(loop)}catch(e){setStatus("相機開啟失敗："+(e?.message||e));running=false}}
async function switchCamera(){camera.switch();landmarks.reset();stable=[];await start()}
async function capture(){if(!running)return;cancelAnimationFrame(raf);await render(1600,true);running=false;captureMode=true;$("save").disabled=false;$("capture").disabled=true;$("switch").disabled=true;$("start").textContent="重新開啟前鏡頭";camera.stop();setStatus("V2.0 · 已完成高解析度處理")}
async function save(){const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",.94));if(!blob)return;const file=new File([blob],`BeautyCam-V2-${Date.now()}.jpg`,{type:"image/jpeg"});if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file]});return}catch(e){if(e?.name==="AbortError")return}}const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function reset(){cancelAnimationFrame(raf);running=false;captureMode=false;camera.stop();landmarks.reset();stable=[];canvas.style.display="none";video.style.display="none";placeholder.style.display="grid";$("capture").disabled=true;$("switch").disabled=true;$("save").disabled=true;$("start").textContent="開啟前鏡頭";setStatus("V2.0 Core 尚未啟動")}
$("start").onclick=start;$("switch").onclick=switchCamera;$("capture").onclick=capture;$("save").onclick=save;$("reset").onclick=reset;
Object.values(controls).forEach(x=>x.addEventListener("input",()=>{updateLabels();if(captureMode)render(1600,false)}));updateLabels();
for(const b of document.querySelectorAll("[data-style]"))b.onclick=()=>{makeupStyle=b.dataset.style;document.querySelectorAll("[data-style]").forEach(x=>x.classList.toggle("active",x===b));if(captureMode)render(1600,false)};
