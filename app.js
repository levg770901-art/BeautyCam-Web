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
  let previewFrame = 0;
  let lastFrameTime = 0;
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
  const NOSE = [1,2,98,327,168,197,5,4,51,281];

  function setStatus(text) { if (statusEl) statusEl.textContent = text; }

  function updateLabels() {
    for (const key of Object.keys(sliders)) {
      if (values[key] && sliders[key]) values[key].textContent = sliders[key].value;
    }
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
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  }

  function params() {
    return {
      smooth: Number(sliders.smooth.value) / 100,
      soften: Number(sliders.soften.value) / 100,
      whiten: Number(sliders.whiten.value) / 100
    };
  }

  async function initFaceLandmarker() {
    if (faceLandmarker) return faceLandmarker;
    if (faceInitPromise) return faceInitPromise;
    faceInitPromise = (async () => {
      try {
        setStatus("相機已開啟，正在載入自然多人臉美肌…");
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
        if (sourceKind === "camera") setStatus("V1.4 自然美肌已就緒");
        return faceLandmarker;
      } catch (err) {
        console.error("Face Landmarker init failed", err);
        faceLandmarker = null;
        if (sourceKind === "camera") setStatus("相機正常；臉部辨識未載入，使用安全基礎美肌");
        return null;
      } finally { faceInitPromise = null; }
    })();
    return faceInitPromise;
  }

  function updateFaces(source, timestamp) {
    if (!faceLandmarker || !source || timestamp - lastFaceTime < 100) return;
    lastFaceTime = timestamp;
    try { latestFaces = faceLandmarker.detectForVideo(source, timestamp)?.faceLandmarks || []; }
    catch (err) { console.warn("Face detection frame failed", err); }
  }

  function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi) inside = !inside;
    }
    return inside;
  }

  function drawPolygon(ctx, landmarks, indices, width, height) {
    const poly = indices.map(i => landmarks[i]).filter(Boolean).map(p => [p.x * width, p.y * height]);
    if (poly.length < 3) return poly;
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    return poly;
  }

  function rasterizeFaceMask(width, height, faces) {
    const c = document.createElement("canvas");
    c.width = width; c.height = height;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    for (const face of faces || []) {
      const oval = drawPolygon(ctx, face, FACE_OVAL, width, height);
      if (oval.length > 20) ctx.fill();
    }
    const image = ctx.getImageData(0, 0, width, height);
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) mask[i] = image.data[i * 4] > 0 ? 255 : 0;

    for (const face of faces || []) {
      for (const group of [LEFT_EYE, RIGHT_EYE, MOUTH, NOSE]) {
        const poly = group.map(i => face[i]).filter(Boolean).map(p => [p.x * width, p.y * height]);
        if (poly.length < 3) continue;
        const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
        const minX = Math.max(0, Math.floor(Math.min(...xs) - 3));
        const maxX = Math.min(width - 1, Math.ceil(Math.max(...xs) + 3));
        const minY = Math.max(0, Math.floor(Math.min(...ys) - 3));
        const maxY = Math.min(height - 1, Math.ceil(Math.max(...ys) + 3));
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
          if (pointInPolygon(x + 0.5, y + 0.5, poly)) mask[y * width + x] = 0;
        }
      }
    }
    return mask;
  }

  function makeFeatheredMask(mask, width, height, radius = 5) {
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
    c.width = width; c.height = height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
      data[p] = mask[i]; data[p + 1] = mask[i]; data[p + 2] = mask[i]; data[p + 3] = 255;
    }
    ctx.putImageData(new ImageData(data, width, height), 0, 0);
    const blur = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
    blur.width = width; blur.height = height;
    const bctx = blur.getContext("2d", { willReadFrequently: true });
    bctx.filter = `blur(${radius}px)`;
    bctx.drawImage(c, 0, 0);
    bctx.filter = "none";
    return bctx.getImageData(0, 0, width, height).data;
  }

  function makeFeatureMask(width, height, faces) {
    const c = document.createElement("canvas");
    c.width = width; c.height = height;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    for (const face of faces || []) for (const group of [LEFT_EYE, RIGHT_EYE, MOUTH]) {
      const poly = drawPolygon(ctx, face, group, width, height);
      if (poly.length >= 3) ctx.fill();
    }
    return ctx.getImageData(0, 0, width, height).data;
  }

  function makeBlurred(source, width, height, radius) {
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
    c.width = width; c.height = height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.filter = `blur(${Math.max(0.5, radius)}px)`;
    ctx.drawImage(source, 0, 0, width, height);
    ctx.filter = "none";
    return ctx.getImageData(0, 0, width, height).data;
  }

  function skinProbability(r, g, b, y, chroma) {
    if (y <= 22 || y >= 252 || chroma < 3) return 0;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const warm = r >= g * 0.84 && g >= b * 0.72;
    const rose = r > g && g >= b * 0.90;
    const yellow = g >= b * 1.08;
    const neutral = chroma < 24 && r >= g * 0.94 && g >= b * 0.90;
    if (!warm || (!rose && !yellow && !neutral)) return 0;
    const redness = Math.max(0, r - g);
    const yellowness = Math.max(0, g - b);
    const saturation = Math.min(1, chroma / 50);
    const skinHue = Math.max(0, Math.min(1, (redness / 78) * 0.42 + (yellowness / 92) * 0.38 + saturation * 0.20));
    const midtone = 1 - Math.min(1, Math.abs(y - 150) / 125) * 0.30;
    const paleSkin = neutral ? 0.72 : 1;
    return Math.max(0.08, Math.min(1, skinHue * midtone * paleSkin + (neutral ? 0.16 : 0)));
  }

  function processImage(source, width, height, maxSide, faces = latestFaces, captureMode = false) {
    const size = fitSize(width, height, maxSide);
    canvas.width = size.width; canvas.height = size.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, size.width, size.height);
    const base = ctx.getImageData(0, 0, size.width, size.height);
    const out = new Uint8ClampedArray(base.data);
    const p = params();
    const faceList = Array.isArray(faces) ? faces : [];
    const faceMask = rasterizeFaceMask(size.width, size.height, faceList);
    const hasFaces = faceList.length > 0;
    const beautyActive = p.smooth > 0 || p.soften > 0 || p.whiten > 0;
    if (!beautyActive) return new ImageData(out, size.width, size.height);

    const blurRadius = 1.8 + 4.2 * p.smooth + 2.8 * p.soften;
    const blurred = makeBlurred(source, size.width, size.height, blurRadius);
    const featureMask = makeFeatureMask(size.width, size.height, faceList);
    const feather = makeFeatheredMask(faceMask, size.width, size.height, Math.max(3, Math.round(size.width / 250)));
    const detailBlur = makeBlurred(source, size.width, size.height, 0.75);
    const glowBlur = makeBlurred(source, size.width, size.height, 9 + 8 * p.soften);
    const groupFactor = faceList.length >= 3 ? 0.84 : faceList.length === 2 ? 0.94 : 1;
    const smoothingStrength = Math.min(0.48, (p.smooth * 0.38 + p.soften * 0.42) * groupFactor);
    const captureBoost = captureMode ? 1.08 : 1;

    for (let i = 0, px = 0; i < out.length; i += 4, px++) {
      const r = base.data[i], g = base.data[i + 1], b = base.data[i + 2];
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const skinScore = skinProbability(r, g, b, y, chroma);
      const faceAlpha = hasFaces ? feather[px * 4] / 255 : 1;
      const skinGate = Math.min(1, skinScore * faceAlpha);

      if (skinGate > 0.035 && smoothingStrength > 0) {
        const br = blurred[i], bg = blurred[i + 1], bb = blurred[i + 2];
        const detail = Math.min(1, (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb)) / 105);
        const edgeProtection = 1 - 0.58 * detail;
        const blend = Math.min(0.50, smoothingStrength * skinGate * Math.max(0.28, edgeProtection) * captureBoost);
        out[i] = Math.round(r + (br - r) * blend);
        out[i + 1] = Math.round(g + (bg - g) * blend);
        out[i + 2] = Math.round(b + (bb - b) * blend);
      }

      if (skinGate > 0.035) {
        let rr = out[i], gg = out[i + 1], bb2 = out[i + 2];
        const yy = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb2;
        const redness = Math.max(0, rr - gg);
        const redControl = Math.min(4.5, redness * 0.055) * skinGate * (0.55 + p.soften * 0.45);
        rr -= redControl;
        gg += redControl * 0.16;

        const shadow = Math.max(0, 158 - yy) / 158;
        const softLight = shadow * (4.2 + 4.0 * p.soften) * skinGate;
        rr += softLight * 0.96;
        gg += softLight;
        bb2 += softLight * 0.98;

        if (p.whiten > 0) {
          const headroom = Math.max(0, 250 - yy) / 205;
          const lift = p.whiten * (20 + 10 * p.soften) * headroom * skinGate;
          rr += lift * 0.965;
          gg += lift;
          bb2 += lift * 0.985;
        }

        // Local portrait glow: brighten the low-frequency skin light without washing out highlights.
        if (p.soften > 0.04) {
          const glowR = glowBlur[i], glowG = glowBlur[i + 1], glowB = glowBlur[i + 2];
          const glowY = 0.2126 * glowR + 0.7152 * glowG + 0.0722 * glowB;
          const lowFreqLift = Math.max(0, Math.min(1, (glowY - 92) / 145));
          const glow = p.soften * 5.2 * lowFreqLift * skinGate;
          rr += glow * 0.97;
          gg += glow;
          bb2 += glow * 0.99;
        }

        // Very mild saturation recovery keeps skin from looking grey after smoothing.
        const avg = (rr + gg + bb2) / 3;
        const sat = 1 + p.smooth * 0.035;
        rr = avg + (rr - avg) * sat;
        gg = avg + (gg - avg) * sat;
        bb2 = avg + (bb2 - avg) * sat;

        out[i] = Math.min(255, Math.max(0, Math.round(rr)));
        out[i + 1] = Math.min(255, Math.max(0, Math.round(gg)));
        out[i + 2] = Math.min(255, Math.max(0, Math.round(bb2)));
      }

      const feature = featureMask[px * 4] / 255;
      if (feature > 0) {
        const amount = (captureMode ? 0.34 : 0.26) * feature;
        out[i] = Math.min(255, Math.max(0, Math.round(out[i] + (out[i] - detailBlur[i]) * amount)));
        out[i + 1] = Math.min(255, Math.max(0, Math.round(out[i + 1] + (out[i + 1] - detailBlur[i + 1]) * amount)));
        out[i + 2] = Math.min(255, Math.max(0, Math.round(out[i + 2] + (out[i + 2] - detailBlur[i + 2]) * amount)));
      }
    }

    // Subtle whole-image tonal finish, intentionally tiny so background character remains intact.
    const tone = Math.min(1, p.whiten * 0.10 + p.soften * 0.035);
    if (tone > 0) {
      for (let i = 0; i < out.length; i += 4) {
        const y = 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2];
        const headroom = Math.max(0, 252 - y) / 252;
        const lift = tone * 2.4 * headroom;
        out[i] = Math.min(255, Math.round(out[i] + lift * 0.98));
        out[i + 1] = Math.min(255, Math.round(out[i + 1] + lift));
        out[i + 2] = Math.min(255, Math.round(out[i + 2] + lift * 0.99));
      }
    }

    return new ImageData(out, size.width, size.height);
  }

  function showProcessed(data, mirror = false) {
    canvas.width = data.width; canvas.height = data.height;
    canvas.getContext("2d").putImageData(data, 0, 0);
    canvas.style.display = "block"; video.style.display = "none"; placeholder.style.display = "none";
    canvas.style.transform = mirror ? "scaleX(-1)" : "none";
  }

  function flipCanvasPixels() {
    if (!canvas.width || !canvas.height) return;
    const temp = document.createElement("canvas");
    temp.width = canvas.width; temp.height = canvas.height;
    const ctx = temp.getContext("2d");
    ctx.translate(temp.width, 0); ctx.scale(-1, 1); ctx.drawImage(canvas, 0, 0);
    const out = canvas.getContext("2d");
    out.setTransform(1, 0, 0, 1, 0, 0); out.clearRect(0, 0, canvas.width, canvas.height); out.drawImage(temp, 0, 0);
  }

  async function openCameraStream() {
    const preferred = { audio: false, video: { facingMode: { ideal: cameraFacing }, width: { ideal: 1280 }, height: { ideal: 960 } } };
    try { return await navigator.mediaDevices.getUserMedia(preferred); }
    catch (firstErr) {
      console.warn("Preferred camera constraints failed", firstErr);
      try { return await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: cameraFacing } }); }
      catch (secondErr) { console.warn("Facing-mode fallback failed", secondErr); return await navigator.mediaDevices.getUserMedia({ audio: false, video: true }); }
    }
  }

  async function startCamera() {
    releaseCamera();
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("目前環境不支援相機，請使用 HTTPS 網頁"); return; }
    try {
      stream = await openCameraStream();
      video.srcObject = stream; await video.play();
      sourceKind = "camera"; latestFaces = []; lastFaceTime = -Infinity;
      captureBtn.disabled = false; switchCameraBtn.disabled = false;
      startCameraBtn.textContent = cameraFacing === "user" ? "前鏡頭已開啟" : "後鏡頭已開啟";
      mirrorPreview = cameraFacing === "user"; setMirrorDisplay(mirrorPreview);
      canvas.style.display = "block"; video.style.display = "none"; placeholder.style.display = "none";
      setStatus(`已開啟${cameraFacing === "user" ? "前" : "後"}鏡頭，V1.4 自然美肌啟動中`);
      startPreviewLoop(); initFaceLandmarker();
    } catch (err) {
      console.error("Camera start failed", err); releaseCamera(); switchCameraBtn.disabled = true; captureBtn.disabled = true;
      if (err?.name === "NotAllowedError") setStatus("相機權限被拒絕，請允許此網站使用相機");
      else if (err?.name === "NotFoundError") setStatus("找不到可用的相機");
      else if (err?.name === "NotReadableError") setStatus("相機目前被其他程式占用");
      else setStatus("無法開啟相機，請確認 Safari 的相機權限");
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
        showProcessed(processImage(video, video.videoWidth, video.videoHeight, CAMERA_PROCESS_SIZE, latestFaces, false), mirrorPreview);
      }
    };
    previewFrame = requestAnimationFrame(loop);
  }

  async function capturePhoto() {
    if (sourceKind !== "camera" || !video.videoWidth) return;
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    const shouldMirror = cameraFacing === "user";
    const data = processImage(video, video.videoWidth, video.videoHeight, MAX_PHOTO_SIZE, latestFaces, true);
    showProcessed(data, false);
    if (shouldMirror) flipCanvasPixels();
    canvas.style.transform = "none"; downloadBtn.disabled = false;
    setStatus(`拍照完成：${latestFaces.length ? `偵測 ${latestFaces.length} 張臉，` : ""}已使用高品質 V1.4 處理`);
    releaseCamera(); sourceKind = "photo-capture"; switchCameraBtn.disabled = true; startCameraBtn.textContent = "開啟前鏡頭";
  }

  function reset() {
    releaseCamera(); latestFaces = []; sourceKind = null;
    canvas.style.display = "none"; canvas.style.transform = "none"; video.style.display = "none"; placeholder.style.display = "grid";
    captureBtn.disabled = true; switchCameraBtn.disabled = true; downloadBtn.disabled = true;
    startCameraBtn.textContent = "開啟前鏡頭"; cameraFacing = "user"; mirrorPreview = true; setStatus("已重設");
  }

  if (fileInput) fileInput.addEventListener("change", () => { fileInput.value = ""; });
  startCameraBtn.addEventListener("click", startCamera);
  switchCameraBtn.addEventListener("click", switchCamera);
  captureBtn.addEventListener("click", capturePhoto);
  resetBtn.addEventListener("click", reset);
  Object.values(sliders).forEach(slider => slider.addEventListener("input", updateLabels));
  window.addEventListener("pagehide", releaseCamera);
  window.addEventListener("beforeunload", releaseCamera);
  updateLabels(); setMirrorDisplay(true);
})();
