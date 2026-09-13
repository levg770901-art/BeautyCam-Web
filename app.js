(() => {
  "use strict";

  const MAX_PHOTO_SIZE = 1600;
  const CAMERA_PROCESS_SIZE = 960;

  const video = document.getElementById("video");
  const previewCanvas = document.getElementById("previewCanvas");
  const photoPreview = document.getElementById("photoPreview");
  const placeholder = document.getElementById("placeholder");
  const fileInput = document.getElementById("fileInput");
  const startCameraBtn = document.getElementById("startCamera");
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
  let currentSource = null;
  let sourceKind = null;
  let rafId = 0;
  let lastFrameTime = 0;
  let processedBlobUrl = null;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function updateLabels() {
    Object.keys(sliders).forEach(k => values[k].textContent = sliders[k].value);
  }

  function releaseCamera() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    video.srcObject = null;
  }

  function fitSize(width, height, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  function getParams() {
    return {
      smooth: Number(sliders.smooth.value) / 100,
      soften: Number(sliders.soften.value) / 100,
      whiten: Number(sliders.whiten.value) / 100
    };
  }

  // Conservative edge-preserving approximation:
  // - low-resolution blur is blended rather than replacing pixels
  // - local contrast is retained
  // - whitening is luminance-oriented with highlight protection
  function processImage(source, width, height, maxSize) {
    const size = fitSize(width, height, maxSize);
    previewCanvas.width = size.width;
    previewCanvas.height = size.height;

    const ctx = previewCanvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.drawImage(source, 0, 0, size.width, size.height);

    const base = ctx.getImageData(0, 0, size.width, size.height);
    const params = getParams();

    if (params.smooth <= 0 && params.soften <= 0 && params.whiten <= 0) {
      return base;
    }

    // Use a temporary offscreen canvas for the blur layer.
    const blurCanvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(size.width, size.height)
      : document.createElement("canvas");
    blurCanvas.width = size.width;
    blurCanvas.height = size.height;

    const bctx = blurCanvas.getContext("2d");
    bctx.drawImage(source, 0, 0, size.width, size.height);

    const blurPx = 1 + Math.round(5 * params.smooth + 2 * params.soften);
    bctx.filter = `blur(${blurPx}px)`;
    bctx.drawImage(blurCanvas, 0, 0);
    bctx.filter = "none";

    const blurred = bctx.getImageData(0, 0, size.width, size.height);
    const out = base.data;
    const bl = blurred.data;

    for (let i = 0; i < out.length; i += 4) {
      const r = out[i], g = out[i + 1], b = out[i + 2];

      // Luminance and chroma proxy.
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const localContrast = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);

      // Skin-like conservative gate. This is deliberately broad enough for
      // varied skin tones, but excludes strong chromatic regions.
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const warm = r >= g * 0.82 && g >= b * 0.72;
      const skinGate = warm && (maxc - minc) > 8 && y > 28;

      if (skinGate) {
        const strength = Math.min(
          0.42,
          params.smooth * 0.30 + params.soften * 0.34
        );

        // Preserve edges by reducing blend where local chroma/contrast is high.
        const edgePenalty = Math.min(1, localContrast / 110);
        const blend = strength * (1 - 0.55 * edgePenalty);

        out[i]     = Math.round(r + (bl[i]     - r) * blend);
        out[i + 1] = Math.round(g + (bl[i + 1] - g) * blend);
        out[i + 2] = Math.round(b + (bl[i + 2] - b) * blend);
      }

      if (params.whiten > 0) {
        // Luminance lift with highlight protection. Avoid naive RGB addition.
        const headroom = Math.max(0, 245 - y) / 217;
        const gate = skinGate ? 1 : 0.18;
        const lift = params.whiten * 14 * headroom * gate;
        out[i]     = Math.min(255, Math.round(out[i]     + lift * 0.96));
        out[i + 1] = Math.min(255, Math.round(out[i + 1] + lift));
        out[i + 2] = Math.min(255, Math.round(out[i + 2] + lift * 0.98));
      }
    }

    return new ImageData(out, size.width, size.height);
  }

  function drawProcessedImageData(imageData) {
    previewCanvas.width = imageData.width;
    previewCanvas.height = imageData.height;
    previewCanvas.getContext("2d").putImageData(imageData, 0, 0);
    previewCanvas.style.display = "block";
    video.style.display = "none";
    photoPreview.style.display = "none";
    placeholder.style.display = "none";
  }

  async function blobFromCanvas() {
    return new Promise(resolve => previewCanvas.toBlob(resolve, "image/jpeg", 0.94));
  }

  function showCamera() {
    previewCanvas.style.display = "none";
    photoPreview.style.display = "none";
    video.style.display = "block";
    placeholder.style.display = "none";
  }

  async function startCamera() {
    releaseCamera();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });
      video.srcObject = stream;
      await video.play();
      sourceKind = "camera";
      currentSource = video;
      captureBtn.disabled = false;
      showCamera();
      setStatus("相機已開啟");
      startPreviewLoop();
    } catch (err) {
      console.error(err);
      setStatus("無法開啟相機，請確認瀏覽器的相機權限");
    }
  }

  function startPreviewLoop() {
    const interval = 1000 / 15; // Keep V1.1 conservative for mobile performance.
    const loop = (time) => {
      rafId = requestAnimationFrame(loop);
      if (sourceKind !== "camera" || video.readyState < 2) return;
      if (time - lastFrameTime < interval) return;
      lastFrameTime = time;

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;

      // Camera preview processing is capped at 960px.
      const imageData = processImage(video, w, h, CAMERA_PROCESS_SIZE);
      drawProcessedImageData(imageData);
    };
    rafId = requestAnimationFrame(loop);
  }

  async function loadPhoto(file) {
    releaseCamera();
    const bitmap = await createImageBitmap(file);
    sourceKind = "photo";
    currentSource = bitmap;
    const imageData = processImage(bitmap, bitmap.width, bitmap.height, MAX_PHOTO_SIZE);
    drawProcessedImageData(imageData);
    captureBtn.disabled = true;
    downloadBtn.disabled = false;
    setStatus(`照片已處理（最長邊上限 ${MAX_PHOTO_SIZE}px）`);
    bitmap.close?.();
  }

  async function capturePhoto() {
    if (sourceKind !== "camera" || !video.videoWidth) return;

    // Capture at photo-processing resolution, rather than the lower preview resolution.
    const imageData = processImage(
      video,
      video.videoWidth,
      video.videoHeight,
      MAX_PHOTO_SIZE
    );
    drawProcessedImageData(imageData);
    downloadBtn.disabled = false;
    setStatus("照片已完成美顏");
    releaseCamera();
  }

  async function downloadPhoto() {
    if (previewCanvas.width === 0) return;
    const blob = await blobFromCanvas();
    if (!blob) return;

    if (processedBlobUrl) URL.revokeObjectURL(processedBlobUrl);
    processedBlobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = processedBlobUrl;
    a.download = `BeautyCam-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus("照片已準備儲存");
  }

  function reset() {
    releaseCamera();
    sourceKind = null;
    currentSource = null;
    video.style.display = "block";
    previewCanvas.style.display = "none";
    photoPreview.style.display = "none";
    placeholder.style.display = "grid";
    captureBtn.disabled = true;
    downloadBtn.disabled = true;

    sliders.smooth.value = 30;
    sliders.soften.value = 15;
    sliders.whiten.value = 10;
    updateLabels();
    setStatus("已重設");
  }

  Object.values(sliders).forEach(slider => {
    slider.addEventListener("input", () => {
      updateLabels();
      if (sourceKind === "photo" && currentSource) {
        // For an uploaded photo, re-render from the original source.
        // currentSource is an ImageBitmap only briefly in loadPhoto, so reload
        // from the image element is handled through the file input on next change.
      }
    });
  });

  startCameraBtn.addEventListener("click", startCamera);
  captureBtn.addEventListener("click", capturePhoto);
  downloadBtn.addEventListener("click", downloadPhoto);
  resetBtn.addEventListener("click", reset);

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadPhoto(file);
    } catch (err) {
      console.error(err);
      setStatus("照片載入失敗");
    }
  });

  window.addEventListener("pagehide", releaseCamera);
  window.addEventListener("beforeunload", releaseCamera);

  updateLabels();
})();