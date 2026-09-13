(() => {
  "use strict";
  const MAX_PHOTO_SIZE = 1600;
  const CAMERA_PROCESS_SIZE = 960;
  const PREVIEW_FPS = 10;
  const video = document.getElementById("video");
  const canvas = document.getElementById("previewCanvas");
  const placeholder = document.getElementById("placeholder");
  const fileInput = document.getElementById("fileInput");
  const startCameraBtn = document.getElementById("startCamera");
  const captureBtn = document.getElementById("capture");
  const downloadBtn = document.getElementById("download");
  const resetBtn = document.getElementById("reset");
  const statusEl = document.getElementById("status");
  const sliders = { smooth: document.getElementById("smooth"), soften: document.getElementById("soften"), whiten: document.getElementById("whiten") };
  const values = { smooth: document.getElementById("smoothValue"), soften: document.getElementById("softenValue"), whiten: document.getElementById("whitenValue") };
  let stream = null;
  let sourceKind = null;
  let originalPhoto = null;
  let previewFrame = 0;
  let lastFrameTime = 0;
  let photoRenderTimer = 0;
  let processedBlobUrl = null;

  function setStatus(text) { statusEl.textContent = text; }
  function updateLabels() { for (const key of Object.keys(sliders)) values[key].textContent = sliders[key].value; }
  function releaseCamera() {
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
  }
  function fitSize(width, height, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  }
  function params() {
    return { smooth: Number(sliders.smooth.value) / 100, soften: Number(sliders.soften.value) / 100, whiten: Number(sliders.whiten.value) / 100 };
  }
  function processImage(source, width, height, maxSide) {
    const size = fitSize(width, height, maxSide);
    canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, size.width, size.height);
    const base = ctx.getImageData(0, 0, size.width, size.height);
    const p = params();
    if (p.smooth === 0 && p.soften === 0 && p.whiten === 0) return base;
    const blurCanvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size.width, size.height) : document.createElement("canvas");
    blurCanvas.width = size.width; blurCanvas.height = size.height;
    const bctx = blurCanvas.getContext("2d", { willReadFrequently: true });
    bctx.drawImage(source, 0, 0, size.width, size.height);
    const copy = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size.width, size.height) : document.createElement("canvas");
    copy.width = size.width; copy.height = size.height;
    copy.getContext("2d").drawImage(blurCanvas, 0, 0);
    bctx.clearRect(0, 0, size.width, size.height);
    bctx.filter = `blur(${1 + Math.round(4 * p.smooth + 2 * p.soften)}px)`;
    bctx.drawImage(copy, 0, 0);
    bctx.filter = "none";
    const blurred = bctx.getImageData(0, 0, size.width, size.height).data;
    const out = base.data;
    for (let i = 0; i < out.length; i += 4) {
      const r = out[i], g = out[i + 1], b = out[i + 2];
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const maxc = Math.max(r, g, b), minc = Math.min(r, g, b);
      const chroma = maxc - minc;
      const warm = r >= g * 0.82 && g >= b * 0.72;
      const skinGate = warm && chroma > 8 && y > 28 && y < 248;
      const edge = Math.min(1, (Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b)) / 120);
      if (skinGate) {
        const strength = Math.min(0.40, p.smooth * 0.28 + p.soften * 0.32);
        const blend = strength * (1 - 0.55 * edge);
        out[i] = Math.round(r + (blurred[i] - r) * blend);
        out[i + 1] = Math.round(g + (blurred[i + 1] - g) * blend);
        out[i + 2] = Math.round(b + (blurred[i + 2] - b) * blend);
      }
      if (p.whiten > 0) {
        const headroom = Math.max(0, 245 - y) / 217;
        const lift = p.whiten * 14 * headroom * (skinGate ? 1 : 0.08);
        out[i] = Math.min(255, Math.round(out[i] + lift * 0.96));
        out[i + 1] = Math.min(255, Math.round(out[i + 1] + lift));
        out[i + 2] = Math.min(255, Math.round(out[i + 2] + lift * 0.98));
      }
    }
    return new ImageData(out, size.width, size.height);
  }
  function showProcessed(data) {
    canvas.width = data.width; canvas.height = data.height;
    canvas.getContext("2d").putImageData(data, 0, 0);
    canvas.style.display = "block"; video.style.display = "none"; placeholder.style.display = "none";
  }
  function schedulePhotoRender() {
    if (sourceKind !== "photo" || !originalPhoto) return;
    clearTimeout(photoRenderTimer);
    photoRenderTimer = setTimeout(() => {
      showProcessed(processImage(originalPhoto, originalPhoto.naturalWidth, originalPhoto.naturalHeight, MAX_PHOTO_SIZE));
      downloadBtn.disabled = false; setStatus("照片效果已更新");
    }, 50);
  }
  async function startCamera() {
    releaseCamera();
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("目前環境不支援相機，請使用 HTTPS 網頁"); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 960 } } });
      video.srcObject = stream; await video.play(); sourceKind = "camera"; captureBtn.disabled = false;
      canvas.style.display = "block"; video.style.display = "none"; placeholder.style.display = "none";
      setStatus("相機已開啟，正在即時美顏"); startPreviewLoop();
    } catch (err) {
      console.error(err); setStatus(err?.name === "NotAllowedError" ? "相機權限被拒絕，請允許此網站使用相機" : "無法開啟相機");
    }
  }
  function startPreviewLoop() {
    const interval = 1000 / PREVIEW_FPS;
    const loop = time => {
      previewFrame = requestAnimationFrame(loop);
      if (sourceKind !== "camera" || video.readyState < 2 || time - lastFrameTime < interval) return;
      lastFrameTime = time;
      if (video.videoWidth && video.videoHeight) showProcessed(processImage(video, video.videoWidth, video.videoHeight, CAMERA_PROCESS_SIZE));
    };
    previewFrame = requestAnimationFrame(loop);
  }
  async function loadPhoto(file) {
    releaseCamera();
    if (!file.type.startsWith("image/")) throw new Error("Not an image");
    const url = URL.createObjectURL(file);
    const img = new Image(); img.decoding = "async";
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    if (originalPhoto?.src?.startsWith("blob:")) URL.revokeObjectURL(originalPhoto.src);
    originalPhoto = img; sourceKind = "photo"; captureBtn.disabled = true;
    showProcessed(processImage(img, img.naturalWidth, img.naturalHeight, MAX_PHOTO_SIZE));
    downloadBtn.disabled = false; setStatus(`照片已處理（最長邊上限 ${MAX_PHOTO_SIZE}px）`);
  }
  function capturePhoto() {
    if (sourceKind !== "camera" || !video.videoWidth) return;
    showProcessed(processImage(video, video.videoWidth, video.videoHeight, MAX_PHOTO_SIZE));
    downloadBtn.disabled = false; setStatus("照片已完成美顏"); releaseCamera(); sourceKind = "photo-capture";
  }
  async function downloadPhoto() {
    if (!canvas.width || !canvas.height) return;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!blob) return;
    if (processedBlobUrl) URL.revokeObjectURL(processedBlobUrl);
    processedBlobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = processedBlobUrl; a.download = `BeautyCam-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
    document.body.appendChild(a); a.click(); a.remove(); setStatus("照片已儲存");
  }
  function reset() {
    releaseCamera(); clearTimeout(photoRenderTimer);
    if (originalPhoto?.src?.startsWith("blob:")) URL.revokeObjectURL(originalPhoto.src);
    originalPhoto = null; sourceKind = null; canvas.style.display = "none"; video.style.display = "block"; placeholder.style.display = "grid";
    captureBtn.disabled = true; downloadBtn.disabled = true;
    sliders.smooth.value = 30; sliders.soften.value = 15; sliders.whiten.value = 10; updateLabels(); setStatus("已重設");
  }
  Object.values(sliders).forEach(slider => slider.addEventListener("input", () => { updateLabels(); if (sourceKind === "photo") schedulePhotoRender(); }));
  startCameraBtn.addEventListener("click", startCamera); captureBtn.addEventListener("click", capturePhoto); downloadBtn.addEventListener("click", downloadPhoto); resetBtn.addEventListener("click", reset);
  fileInput.addEventListener("change", async e => { const file = e.target.files?.[0]; if (!file) return; try { await loadPhoto(file); } catch (err) { console.error(err); setStatus("照片載入失敗"); } });
  window.addEventListener("pagehide", releaseCamera); window.addEventListener("beforeunload", releaseCamera); updateLabels();
})();