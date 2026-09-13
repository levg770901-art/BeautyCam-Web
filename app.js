(() => {
  "use strict";

  const MAX_PHOTO_SIZE = 1600;
  const CAMERA_PROCESS_SIZE = 960;
  const PREVIEW_FPS = 10;
  const FACE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";

  const video = document.getElementById("video");
  const canvas = document.getElementById("previewCanvas");
  const placeholder = document.getElementById("placeholder");
  const fileInput = document.getElementById("fileInput");
  const startCameraBtn = document.getElementById("startCamera");
  const switchCameraBtn = document.getElementById("switchCamera");
  const captureBtn = document.getElementById("capture");
  const downloadBtn = document.getElementById("download");
  const resetBtn = document.getElementById("reset");
  const statusEl = document.getElementById("status");
  const sliders = {
    smooth: document.getElementById("smooth"),
    soften: document.getElementById("soften"),
    whiten: document.getElementById("whiten")
  };
  const values = {
    smooth: document.getElementById("smoothValue"),
    soften: document.getElementById("softenValue"),
    whiten: document.getElementById("whitenValue")
  };

  let stream = null;
  let sourceKind = null;
  let originalPhoto = null;
  let previewFrame = 0;
  let lastFrameTime = 0;
  let photoRenderTimer = 0;
  let processedBlobUrl = null;
  let faceLandmarker = null;
  let faceInitPromise = null;
  let latestFaces = [];
  let lastFaceTime = -Infinity;
  let cameraFacing = "user";
  let mirrorPreview = true;

  const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
  const LEFT_EYE = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
  const RIGHT_EYE = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
  const MOUTH = [61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,78];

  function setStatus(text) { statusEl.textContent = text; }

  function updateLabels() {
    for (const key of Object.keys(sliders)) values[key].textContent = sliders[key].value;
  }

  function setMirrorDisplay(enabled) {
    mirrorPreview = Boolean(enabled);
    canvas.style.transform = mirrorPreview ? "scaleX(-1)" : "none";
  }

  function releaseCamera() {
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
  }

  function fitSize(width, height, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  function params() {
    return {
      smooth: Number(sliders.smooth.value) / 100,
      soften: Number(sliders.soften.value) / 100,
      whiten: Number(sliders.whiten.value) / 100
    };
  }

  // Face detection is optional for camera startup. The camera must never wait for this model.
  async function initFaceLandmarker() {
    if (faceLandmarker) return faceLandmarker;
    if (faceInitPromise) return faceInitPromise;

    faceInitPromise = (async () => {
      try {
        setStatus("相機已開啟，正在載入多人臉美肌…");
        const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js");
        const resolver = await vision.FilesetResolver.forVisionTasks(VISION_WASM_URL);
        faceLandmarker = await vision.FaceLandmarker.createFromOptions(resolver, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 5,
          minFaceDetectionConfidence: 0.55,
          minFacePresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
          outputFaceBlendshapes: false
        });
        if (sourceKind === "camera") setStatus("多人臉美肌已就緒");
        return faceLandmarker;
      } catch (err) {
        console.error("Face Landmarker init failed", err);
        faceLandmarker = null;
        if (sourceKind === "camera") setStatus("相機正常；臉部辨識未載入，暫用基礎美肌");
        return null;
      } finally {
        faceInitPromise = null;
      }
    })();

    return faceInitPromise;
  }

  function updateFaces(source, timestamp) {
    if (!faceLandmarker || !source || timestamp - lastFaceTime < 100) return;
    lastFaceTime = timestamp;
    try {
      latestFaces = faceLandmarker.detectForVideo(source, timestamp)?.faceLandmarks || [];
    } catch (err) {
      console.warn("Face detection frame failed", err);
    }
  }

  async function detectPhotoFaces(image) {
    if (!faceLandmarker) return [];
    try {
      await faceLandmarker.setOptions({ runningMode: "IMAGE" });
      const result = faceLandmarker.detect(image);
      await faceLandmarker.setOptions({ runningMode: "VIDEO" });
      return result?.faceLandmarks || [];
    } catch (err) {
      console.warn("Photo face detection failed", err);
      try { await faceLandmarker.setOptions({ runningMode: "VIDEO" }); } catch (_) {}
      return [];
    }
  }

  function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi) inside = !inside;
    }
    return inside;
  }

  function makeFaceMask(width, height, faces) {
    const mask = new Uint8Array(width * height);
    if (!faces?.length) return mask;

    const work = document.createElement("canvas");
    work.width = width;
    work.height = height;
    const ctx = work.getContext("2d");
    ctx.fillStyle = "#fff";

    for (const landmarks of faces) {
      const oval = FACE_OVAL.map(i => landmarks[i]).filter(Boolean).map(p => [p.x * width, p.y * height]);
      if (oval.length > 20) {
        ctx.beginPath();
        ctx.moveTo(oval[0][0], oval[0][1]);
        for (let i = 1; i < oval.length; i++) ctx.lineTo(oval[i][0], oval[i][1]);
        ctx.closePath();
        ctx.fill();
      }
    }

    const rgba = ctx.getImageData(0, 0, width, height).data;
    for (let i = 0; i < mask.length; i++) mask[i] = rgba[i * 4] > 0 ? 255 : 0;

    for (const landmarks of faces) {
      for (const group of [LEFT_EYE, RIGHT_EYE, MOUTH]) {
        const poly = group.map(i => landmarks[i]).filter(Boolean).map(p => [p.x * width, p.y * height]);
        if (poly.length < 3) continue;
        const xs = poly.map(p => p[0]);
        const ys = poly.map(p => p[1]);
        const minX = Math.max(0, Math.floor(Math.min(...xs)));
        const maxX = Math.min(width - 1, Math.ceil(Math.max(...xs)));
        const minY = Math.max(0, Math.floor(Math.min(...ys)));
        const maxY = Math.min(height - 1, Math.ceil(Math.max(...ys)));
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            if (pointInPolygon(x + 0.5, y + 0.5, poly)) mask[y * width + x] = 0;
          }
        }
      }
    }
    return mask;
  }

  function processImage(source, width, height, maxSide, faces = latestFaces) {
    const size = fitSize(width, height, maxSide);
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, size.width, size.height);
    const base = ctx.getImageData(0, 0, size.width, size.height);
    const p = params();
    const faceMask = makeFaceMask(size.width, size.height, faces);
    const hasFaceMask = faces?.length > 0;

    if (p.smooth === 0 && p.soften === 0 && p.whiten === 0) return base;

    const blurCanvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size.width, size.height) : document.createElement("canvas");
    blurCanvas.width = size.width;
    blurCanvas.height = size.height;
    const bctx = blurCanvas.getContext("2d", { willReadFrequently: true });
    bctx.drawImage(source, 0, 0, size.width, size.height);

    const copy = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size.width, size.height) : document.createElement("canvas");
    copy.width = size.width;
    copy.height = size.height;
    copy.getContext("2d").drawImage(blurCanvas, 0, 0);
    bctx.clearRect(0, 0, size.width, size.height);
    bctx.filter = `blur(${1 + Math.round(4 * p.smooth + 2 * p.soften)}px)`;
    bctx.drawImage(copy, 0, 0);
    bctx.filter = "none";

    const blurred = bctx.getImageData(0, 0, size.width, size.height).data;
    const out = base.data;
    for (let i = 0, px = 0; i < out.length; i += 4, px++) {
      const r = out[i], g = out[i + 1], b = out[i + 2];
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const chroma = maxc - minc;
      const warm = r >= g * 0.82 && g >= b * 0.72;
      const colorSkin = warm && chroma > 8 && y > 28 && y < 248;
      const faceAllowed = hasFaceMask ? faceMask[px] > 0 : true;
      const skinGate = faceAllowed && colorSkin;

      if (skinGate) {
        const strength = Math.min(0.40, p.smooth * 0.28 + p.soften * 0.32);
        const edge = Math.min(1, (Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b)) / 120);
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

  function showProcessed(data, mirror = false) {
    canvas.width = data.width;
    canvas.height = data.height;
    canvas.getContext("2d").putImageData(data, 0, 0);
    canvas.style.display = "block";
    video.style.display = "none";
    placeholder.style.display = "none";
    canvas.style.transform = mirror ? "scaleX(-1)" : "none";
  }

  function flipCanvasPixels() {
    if (!canvas.width || !canvas.height) return;
    const temp = document.createElement("canvas");
    temp.width = canvas.width;
    temp.height = canvas.height;
    const ctx = temp.getContext("2d");
    ctx.translate(temp.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0);
    const out = canvas.getContext("2d");
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, canvas.width, canvas.height);
    out.drawImage(temp, 0, 0);
  }

  function schedulePhotoRender() {
    if (sourceKind !== "photo" || !originalPhoto) return;
    clearTimeout(photoRenderTimer);
    photoRenderTimer = setTimeout(() => {
      showProcessed(processImage(originalPhoto, originalPhoto.naturalWidth, originalPhoto.naturalHeight, MAX_PHOTO_SIZE, latestFaces), false);
      downloadBtn.disabled = false;
      setStatus("照片效果已更新");
    }, 50);
  }

  async function openCameraStream() {
    const preferred = {
      audio: false,
      video: {
        facingMode: { ideal: cameraFacing },
        width: { ideal: 1280 },
        height: { ideal: 960 }
      }
    };
    try {
      return await navigator.mediaDevices.getUserMedia(preferred);
    } catch (firstErr) {
      console.warn("Preferred camera constraints failed", firstErr);
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: cameraFacing } });
      } catch (secondErr) {
        console.warn("Facing-mode fallback failed", secondErr);
        return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
    }
  }

  async function startCamera() {
    releaseCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("目前環境不支援相機，請使用 HTTPS 網頁");
      return;
    }

    try {
      // Critical fix: request the camera FIRST. Face Landmarker loads in the background.
      stream = await openCameraStream();
      video.srcObject = stream;
      await video.play();
      sourceKind = "camera";
      latestFaces = [];
      lastFaceTime = -Infinity;
      captureBtn.disabled = false;
      switchCameraBtn.disabled = false;
      startCameraBtn.textContent = cameraFacing === "user" ? "前鏡頭已開啟" : "後鏡頭已開啟";
      mirrorPreview = cameraFacing === "user";
      setMirrorDisplay(mirrorPreview);
      canvas.style.display = "block";
      video.style.display = "none";
      placeholder.style.display = "none";
      setStatus(`已開啟${cameraFacing === "user" ? "前" : "後"}鏡頭，正在啟動美肌`);
      startPreviewLoop();

      // Do not block camera operation on CDN/WASM/model/GPU initialization.
      initFaceLandmarker();
    } catch (err) {
      console.error("Camera start failed", err);
      releaseCamera();
      switchCameraBtn.disabled = true;
      captureBtn.disabled = true;
      if (err?.name === "NotAllowedError") {
        setStatus("相機權限被拒絕，請允許此網站使用相機");
      } else if (err?.name === "NotFoundError") {
        setStatus("找不到可用的相機");
      } else if (err?.name === "NotReadableError") {
        setStatus("相機目前被其他程式占用");
      } else {
        setStatus("無法開啟相機，請確認 Safari 的相機權限");
      }
    }
  }

  async function switchCamera() {
    cameraFacing = cameraFacing === "user" ? "environment" : "user";
    mirrorPreview = cameraFacing === "user";
    setStatus(`正在切換至${cameraFacing === "user" ? "前" : "後"}鏡頭…`);
    await startCamera();
  }

  function startPreviewLoop() {
    const interval = 1000 / PREVIEW_FPS;
    const loop = time => {
      previewFrame = requestAnimationFrame(loop);
      if (sourceKind !== "camera" || video.readyState < 2 || time - lastFrameTime < interval) return;
      lastFrameTime = time;
      if (video.videoWidth && video.videoHeight) {
        updateFaces(video, time);
        showProcessed(processImage(video, video.videoWidth, video.videoHeight, CAMERA_PROCESS_SIZE, latestFaces), mirrorPreview);
      }
    };
    previewFrame = requestAnimationFrame(loop);
  }

  async function loadPhoto(file) {
    releaseCamera();
    switchCameraBtn.disabled = true;
    if (!file.type.startsWith("image/")) throw new Error("Not an image");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    if (originalPhoto?.src?.startsWith("blob:")) URL.revokeObjectURL(originalPhoto.src);
    originalPhoto = img;
    sourceKind = "photo";
    captureBtn.disabled = true;
    mirrorPreview = false;
    setMirrorDisplay(false);
    latestFaces = await detectPhotoFaces(img);
    showProcessed(processImage(img, img.naturalWidth, img.naturalHeight, MAX_PHOTO_SIZE, latestFaces), false);
    downloadBtn.disabled = false;
    setStatus(`照片已處理（最長邊上限 ${MAX_PHOTO_SIZE}px）${latestFaces.length ? `，偵測到 ${latestFaces.length} 張臉` : ""}`);
  }

  function capturePhoto() {
    if (sourceKind !== "camera" || !video.videoWidth) return;
    const shouldMirror = cameraFacing === "user";
    showProcessed(processImage(video, video.videoWidth, video.videoHeight, MAX_PHOTO_SIZE, latestFaces), false);
    // Front-camera saved image follows the mirrored selfie preview; rear camera stays normal.
    if (shouldMirror) flipCanvasPixels();
    canvas.style.transform = "none";
    downloadBtn.disabled = false;
    setStatus("照片已完成多人臉美肌");
    releaseCamera();
    sourceKind = "photo-capture";
    switchCameraBtn.disabled = true;
    startCameraBtn.textContent = "開啟前鏡頭";
  }

  async function downloadPhoto() {
    if (!canvas.width || !canvas.height) return;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!blob) return;
    if (processedBlobUrl) URL.revokeObjectURL(processedBlobUrl);
    processedBlobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = processedBlobUrl;
    a.download = `BeautyCam-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus("照片已儲存");
  }

  function reset() {
    releaseCamera();
    clearTimeout(photoRenderTimer);
    if (originalPhoto?.src?.startsWith("blob:")) URL.revokeObjectURL(originalPhoto.src);
    originalPhoto = null;
    sourceKind = null;
    latestFaces = [];
    canvas.style.display = "none";
    canvas.style.transform = "none";
    video.style.display = "none";
    placeholder.style.display = "grid";
    captureBtn.disabled = true;
    switchCameraBtn.disabled = true;
    downloadBtn.disabled = true;
    startCameraBtn.textContent = "開啟前鏡頭";
    cameraFacing = "user";
    mirrorPreview = true;
    setStatus("已重設");
  }

  startCameraBtn.addEventListener("click", startCamera);
  switchCameraBtn.addEventListener("click", switchCamera);
  captureBtn.addEventListener("click", capturePhoto);
  downloadBtn.addEventListener("click", downloadPhoto);
  resetBtn.addEventListener("click", reset);
  fileInput.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { await loadPhoto(file); }
    catch (err) { console.error(err); setStatus("照片載入失敗"); }
    finally { fileInput.value = ""; }
  });
  Object.values(sliders).forEach(slider => slider.addEventListener("input", () => {
    updateLabels();
    schedulePhotoRender();
  }));

  window.addEventListener("pagehide", releaseCamera);
  window.addEventListener("beforeunload", releaseCamera);
  updateLabels();
  setMirrorDisplay(true);
})();
