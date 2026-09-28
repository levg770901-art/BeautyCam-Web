(() => {
  "use strict";

  // BeautyCam V2.0
  // Camera / Face Landmarker / Geometry / Beauty / Makeup / Final Canvas are intentionally separated.
  const MP_VERSION = "1.0.1";
  const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
  const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
  const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  const PREVIEW_MAX = 720;
  const PHOTO_MAX = 1600;
  const FPS = 8;

  const video = document.getElementById("video");
  const canvas = document.getElementById("previewCanvas");
  const placeholder = document.getElementById("placeholder");
  const status = document.getElementById("status");
  const startBtn = document.getElementById("startCamera");
  const switchBtn = document.getElementById("switchCamera");
  const captureBtn = document.getElementById("capture");
  const saveBtn = document.getElementById("download");
  const resetBtn = document.getElementById("reset");

  const sliders = {
    smooth: document.getElementById("smooth"),
    soften: document.getElementById("soften"),
    whiten: document.getElementById("whiten"),
    makeup: document.getElementById("makeup")
  };
  const values = {
    smooth: document.getElementById("smoothValue"),
    soften: document.getElementById("softenValue"),
    whiten: document.getElementById("whitenValue"),
    makeup: document.getElementById("makeupValue")
  };

  const detectCanvas = document.createElement("canvas");
  const detectCtx = detectCanvas.getContext("2d", { willReadFrequently: true });

  let stream = null;
  let sourceKind = null;
  let facing = "user";
  let raf = 0;
  let lastFrame = 0;
  let faceLandmarker = null;
  let faceInit = null;
  let stableFaces = [];

  const DEBUG = new URLSearchParams(location.search).get("debug") || "";

  const OVAL = [
    10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,
    400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,
    103,67,109
  ];
  const LEFT_EYE = [33,246,161,160,159,158,157,173,133];
  const RIGHT_EYE = [263,466,388,387,386,385,384,398,362];
  const LEFT_BROW = [70,63,105,66,107];
  const RIGHT_BROW = [336,296,334,293,300];
  const OUTER_LIP = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146];
  const INNER_LIP = [78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95];
  const LEFT_NOSTRIL = [98,97,2,94,19];
  const RIGHT_NOSTRIL = [327,326,2,94,19];

  const params = () => ({
    smooth: Number(sliders.smooth?.value || 0) / 100,
    soften: Number(sliders.soften?.value || 0) / 100,
    whiten: Number(sliders.whiten?.value || 0) / 100,
    makeup: Number(sliders.makeup?.value || 0) / 100
  });

  const setStatus = text => {
    if (status) status.textContent = text;
  };

  const updateLabels = () => {
    Object.keys(sliders).forEach(key => {
      if (values[key] && sliders[key]) values[key].textContent = sliders[key].value;
    });
  };

  function createRenderContext(width, height) {
    return {
      width,
      height,
      facing,
      mirror: facing === "user",
      landmarks: stableFaces,
      faceGeometry: null,
      beautyParams: {
        smooth: params().smooth,
        soften: params().soften,
        whitening: params().whiten
      },
      makeupParams: {
        amount: params().makeup
      }
    };
  }

  function point(face, index, ctx) {
    const q = face?.[index];
    if (!q) return null;
    return [
      (ctx.mirror ? 1 - q.x : q.x) * ctx.width,
      q.y * ctx.height
    ];
  }

  function distance(a, b) {
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
  }

  function average(points) {
    const p = points.filter(Boolean);
    if (!p.length) return null;
    return [
      p.reduce((sum, q) => sum + q[0], 0) / p.length,
      p.reduce((sum, q) => sum + q[1], 0) / p.length
    ];
  }

  function polygonPath(ctx, points) {
    const p = points.filter(Boolean);
    if (p.length < 3) return false;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
    return true;
  }

  function fillPolygon(ctx, points, fill = "#fff") {
    if (!polygonPath(ctx, points)) return false;
    ctx.fillStyle = fill;
    ctx.fill();
    return true;
  }

  function makeMask(width, height) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
  }

  function featherMask(mask, radius) {
    const out = makeMask(mask.width, mask.height);
    const ctx = out.getContext("2d");
    ctx.filter = `blur(${Math.max(0.5, radius)}px)`;
    ctx.drawImage(mask, 0, 0);
    return out;
  }

  function subtractPolygon(mask, points) {
    const ctx = mask.getContext("2d");
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    fillPolygon(ctx, points, "#fff");
    ctx.restore();
  }

  function createFaceGeometry(face, ctx) {
    const leftEye = LEFT_EYE.map(i => point(face, i, ctx));
    const rightEye = RIGHT_EYE.map(i => point(face, i, ctx));
    const leftBrow = LEFT_BROW.map(i => point(face, i, ctx));
    const rightBrow = RIGHT_BROW.map(i => point(face, i, ctx));
    const outerLip = OUTER_LIP.map(i => point(face, i, ctx));
    const innerLip = INNER_LIP.map(i => point(face, i, ctx));

    const leftCheek = average([
      point(face, 33, ctx), point(face, 234, ctx), point(face, 61, ctx)
    ]);
    const rightCheek = average([
      point(face, 263, ctx), point(face, 454, ctx), point(face, 291, ctx)
    ]);

    const bounds = OVAL.map(i => point(face, i, ctx)).filter(Boolean);
    const faceBounds = bounds.length ? {
      left: Math.min(...bounds.map(p => p[0])),
      right: Math.max(...bounds.map(p => p[0])),
      top: Math.min(...bounds.map(p => p[1])),
      bottom: Math.max(...bounds.map(p => p[1]))
    } : { left: 0, right: ctx.width, top: 0, bottom: ctx.height };

    return {
      face,
      leftEye,
      rightEye,
      leftBrow,
      rightBrow,
      outerLip,
      innerLip,
      leftCheek,
      rightCheek,
      nose: {
        tip: point(face, 1, ctx),
        left: point(face, 98, ctx),
        right: point(face, 327, ctx)
      },
      nostrils: {
        left: LEFT_NOSTRIL.map(i => point(face, i, ctx)),
        right: RIGHT_NOSTRIL.map(i => point(face, i, ctx))
      },
      faceBounds,
      faceWidth: distance(point(face, 234, ctx), point(face, 454, ctx)),
      faceHeight: distance(point(face, 10, ctx), point(face, 152, ctx)),
      eyeWidth: distance(point(face, 33, ctx), point(face, 263, ctx))
    };
  }

  function createLipMask(faceGeometry, ctx) {
    const mask = makeMask(ctx.width, ctx.height);
    const m = mask.getContext("2d");
    fillPolygon(m, faceGeometry.outerLip);
    subtractPolygon(mask, faceGeometry.innerLip);
    return mask;
  }

  function createBrowMask(faceGeometry, ctx, side) {
    const points = side === "left" ? faceGeometry.leftBrow : faceGeometry.rightBrow;
    const mask = makeMask(ctx.width, ctx.height);
    if (points.length < 3) return mask;

    const center = points.map(p => [p[0], p[1]]);
    const half = Math.max(2, faceGeometry.eyeWidth * 0.018);
    const upper = [];
    const lower = [];
    for (let i = 0; i < center.length; i++) {
      const prev = center[Math.max(0, i - 1)];
      const next = center[Math.min(center.length - 1, i + 1)];
      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      upper.push([center[i][0] + nx * half, center[i][1] + ny * half]);
      lower.push([center[i][0] - nx * half, center[i][1] - ny * half]);
    }
    fillPolygon(mask.getContext("2d"), upper.concat(lower.reverse()));
    return mask;
  }

  function createEyeshadowMask(faceGeometry, ctx, side) {
    const points = side === "left" ? faceGeometry.leftEye : faceGeometry.rightEye;
    const mask = makeMask(ctx.width, ctx.height);
    fillPolygon(mask.getContext("2d"), points);
    return mask;
  }

  function createBlushMask(faceGeometry, ctx, side) {
    const mask = makeMask(ctx.width, ctx.height);
    const m = mask.getContext("2d");
    const center = side === "left" ? faceGeometry.leftCheek : faceGeometry.rightCheek;
    if (!center || !faceGeometry.faceWidth || !faceGeometry.faceHeight) return mask;
    const radiusX = faceGeometry.faceWidth * 0.115;
    const radiusY = faceGeometry.faceHeight * 0.075;
    const gradient = m.createRadialGradient(
      center[0], center[1], 0,
      center[0], center[1], Math.max(radiusX, radiusY)
    );
    gradient.addColorStop(0, "rgba(255,0,0,1)");
    gradient.addColorStop(0.55, "rgba(255,0,0,0.62)");
    gradient.addColorStop(1, "rgba(255,0,0,0)");
    m.fillStyle = gradient;
    m.beginPath();
    m.ellipse(center[0], center[1], radiusX, radiusY, 0, 0, Math.PI * 2);
    m.fill();
    return mask;
  }

  function createSkinMask(faceGeometry, ctx) {
    const mask = makeMask(ctx.width, ctx.height);
    const m = mask.getContext("2d");
    fillPolygon(m, OVAL.map(i => point(faceGeometry.face, i, ctx)));
    subtractPolygon(mask, faceGeometry.leftEye);
    subtractPolygon(mask, faceGeometry.rightEye);
    subtractPolygon(mask, faceGeometry.leftBrow);
    subtractPolygon(mask, faceGeometry.rightBrow);
    subtractPolygon(mask, faceGeometry.outerLip);
    subtractPolygon(mask, LEFT_NOSTRIL.map(i => point(faceGeometry.face, i, ctx)));
    subtractPolygon(mask, RIGHT_NOSTRIL.map(i => point(faceGeometry.face, i, ctx)));
    return mask;
  }

  function drawMirroredSource(source, width, height, mirror) {
    const out = makeMask(width, height);
    const ctx = out.getContext("2d");
    if (mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, 0, 0, width, height);
    return out;
  }

  function getImageData(sourceCanvas) {
    return sourceCanvas.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  }

  function applyBeauty(sourceLayer, faceGeometry, ctx) {
    const out = makeMask(ctx.width, ctx.height);
    const outCtx = out.getContext("2d", { willReadFrequently: true });
    outCtx.drawImage(sourceLayer, 0, 0);

    if (!faceGeometry) return out;

    const p = ctx.beautyParams;
    if (p.smooth <= 0 && p.soften <= 0 && p.whitening <= 0) return out;

    const skinMask = featherMask(
      createSkinMask(faceGeometry, ctx),
      Math.max(1, Math.min(ctx.width, ctx.height) * 0.004)
    );
    const maskData = getImageData(skinMask).data;
    const base = outCtx.getImageData(0, 0, ctx.width, ctx.height);
    const result = new Uint8ClampedArray(base.data);

    let blurred = null;
    if (p.smooth > 0 || p.soften > 0) {
      const blurLayer = makeMask(ctx.width, ctx.height);
      const bctx = blurLayer.getContext("2d");
      bctx.filter = `blur(${1.2 + 4.5 * p.smooth + 2.5 * p.soften}px)`;
      bctx.drawImage(sourceLayer, 0, 0);
      blurred = getImageData(blurLayer).data;
    }

    for (let i = 0, px = 0; i < result.length; i += 4, px++) {
      const alpha = maskData[px * 4] / 255;
      if (alpha <= 0.01) continue;

      let r = base.data[i];
      let g = base.data[i + 1];
      let b = base.data[i + 2];

      if (blurred) {
        const blend = Math.min(0.82, (0.18 + 0.58 * p.smooth + 0.32 * p.soften) * alpha);
        r += (blurred[i] - r) * blend;
        g += (blurred[i + 1] - g) * blend;
        b += (blurred[i + 2] - b) * blend;
      }

      if (p.whitening > 0) {
        const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const lift = Math.min(0.30, p.whitening * 0.24 * alpha);
        const Y2 = Y + (255 - Y) * lift;
        const scale = Y > 1 ? Y2 / Y : 1;
        r = Math.min(255, r * scale);
        g = Math.min(255, g * scale);
        b = Math.min(255, b * scale);
      }

      result[i] = r;
      result[i + 1] = g;
      result[i + 2] = b;
    }

    outCtx.putImageData(new ImageData(result, ctx.width, ctx.height), 0, 0);
    return out;
  }

  function renderBeautyLayer(sourceLayer, ctx) {
    return applyBeauty(sourceLayer, ctx.faceGeometry, ctx);
  }

  function renderFinal(source, maxSize) {
    const sourceWidth = source.videoWidth || source.width;
    const sourceHeight = source.videoHeight || source.height;
    const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const rc = createRenderContext(width, height);
    const sourceLayer = drawMirroredSource(source, width, height, rc.mirror);
    rc.faceGeometry = rc.landmarks[0]
      ? createFaceGeometry(rc.landmarks[0], rc)
      : null;

    const beautyLayer = renderBeautyLayer(sourceLayer, rc);
    const makeupLayer = window.BeautyCamMakeup?.renderMakeupLayer
      ? window.BeautyCamMakeup.renderMakeupLayer(rc)
      : makeMask(width, height);

    canvas.width = width;
    canvas.height = height;
    const finalCtx = canvas.getContext("2d");
    finalCtx.clearRect(0, 0, width, height);
    // Final compositing: Beauty Layer -> Makeup Layer.
    finalCtx.drawImage(beautyLayer, 0, 0);
    finalCtx.drawImage(makeupLayer, 0, 0);

    if (DEBUG) drawDebug(finalCtx, rc);
    return rc;
  }

  function drawDebug(ctx, rc) {
    const mode = DEBUG.toLowerCase();
    const g = rc.faceGeometry;
    if (!g) return;

    if (["lip", "blush", "brow", "eye", "skin"].includes(mode)) {
      const mask = window.BeautyCamMakeup?.getDebugMask?.(mode, rc)
        || (mode === "skin" ? createSkinMask(g, rc) : null);
      if (mask) {
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.drawImage(mask, 0, 0);
        ctx.restore();
      }
      return;
    }

    ctx.save();
    ctx.lineWidth = Math.max(1, Math.min(rc.width, rc.height) / 360);
    ctx.strokeStyle = "#00ff66";
    ctx.fillStyle = "#00ff66";
    for (const face of rc.landmarks) {
      for (const q of face) {
        const x = (rc.mirror ? 1 - q.x : q.x) * rc.width;
        const y = q.y * rc.height;
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const outlines = [
      [g.outerLip, "#ff3366"],
      [g.leftBrow, "#ffcc00"], [g.rightBrow, "#ffcc00"],
      [g.leftEye, "#66ccff"], [g.rightEye, "#66ccff"]
    ];
    for (const [points, color] of outlines) {
      ctx.strokeStyle = color;
      if (polygonPath(ctx, points)) ctx.stroke();
    }
    for (const cheek of [g.leftCheek, g.rightCheek]) {
      if (!cheek) continue;
      ctx.fillStyle = "#ff6699";
      ctx.beginPath();
      ctx.arc(cheek[0], cheek[1], 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function stabilize(next) {
    if (!next.length) {
      stableFaces = [];
      return;
    }
    if (!stableFaces.length) {
      stableFaces = next;
      return;
    }
    const previous = stableFaces[0];
    const current = next[0];
    const blended = current.map((p, i) => {
      const q = previous[i] || p;
      return {
        x: q.x * 0.72 + p.x * 0.28,
        y: q.y * 0.72 + p.y * 0.28,
        z: q.z * 0.72 + p.z * 0.28
      };
    });
    stableFaces = [blended];
  }

  function detectFace() {
    if (!faceLandmarker || video.readyState < 2 || !video.videoWidth) return;
    const scale = Math.min(1, PREVIEW_MAX / Math.max(video.videoWidth, video.videoHeight));
    detectCanvas.width = Math.round(video.videoWidth * scale);
    detectCanvas.height = Math.round(video.videoHeight * scale);
    detectCtx.drawImage(video, 0, 0, detectCanvas.width, detectCanvas.height);
    try {
      const result = faceLandmarker.detect(detectCanvas);
      stabilize(result?.faceLandmarks || []);
    } catch (error) {
      stableFaces = [];
      console.warn("Face Landmarker frame failed", error);
    }
    setStatus(
      `美肌 ${sliders.smooth.value}% · 磨皮 ${sliders.soften.value}% · 美白 ${sliders.whiten.value}% · ` +
      `彩妝 ${sliders.makeup.value}% · 偵測 ${stableFaces.length} 張臉`
    );
  }

  async function initFace() {
    if (faceLandmarker) return faceLandmarker;
    if (faceInit) return faceInit;

    faceInit = (async () => {
      try {
        setStatus("相機已開啟 · 載入臉部追蹤…");
        const vision = await import(MP_BUNDLE);
        const resolver = await vision.FilesetResolver.forVisionTasks(MP_WASM);
        faceLandmarker = await vision.FaceLandmarker.createFromOptions(resolver, {
          baseOptions: {
            modelAssetPath: FACE_MODEL,
            delegate: "CPU"
          },
          runningMode: "IMAGE",
          numFaces: 1,
          minFaceDetectionConfidence: 0.30,
          minFacePresenceConfidence: 0.30,
          minTrackingConfidence: 0.30
        });
        return faceLandmarker;
      } catch (error) {
        setStatus(`臉部追蹤載入失敗 · ${error?.message || error?.name || error}`);
        return null;
      } finally {
        faceInit = null;
      }
    })();

    return faceInit;
  }

  function stopCamera() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
  }

  function setCameraState() {
    video.style.transform = "none";
    canvas.style.transform = "none";
  }

  async function start() {
    stopCamera();
    stableFaces = [];
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });
      video.srcObject = stream;
      await video.play();
      sourceKind = "camera";
      captureBtn.disabled = false;
      switchBtn.disabled = false;
      startBtn.textContent = facing === "user" ? "前鏡頭已開啟" : "後鏡頭已開啟";
      setCameraState();
      video.style.display = "none";
      canvas.style.display = "block";
      placeholder.style.display = "none";

      if (!(await initFace())) return;
      loop();
    } catch (error) {
      stopCamera();
      sourceKind = null;
      setStatus("無法開啟相機");
      captureBtn.disabled = true;
      switchBtn.disabled = true;
    }
  }

  function loop() {
    const interval = 1000 / FPS;
    const tick = timestamp => {
      raf = requestAnimationFrame(tick);
      if (sourceKind !== "camera" || video.readyState < 2 || timestamp - lastFrame < interval) return;
      lastFrame = timestamp;
      detectFace();
      renderFinal(video, PREVIEW_MAX);
    };
    raf = requestAnimationFrame(tick);
  }

  async function capture() {
    if (sourceKind !== "camera") return;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    detectFace();
    renderFinal(video, PHOTO_MAX);
    setCameraState();
    saveBtn.disabled = false;
    stopCamera();
    sourceKind = "photo-capture";
    switchBtn.disabled = true;
    startBtn.textContent = "開啟前鏡頭";
  }

  function reset() {
    stopCamera();
    stableFaces = [];
    sourceKind = null;
    canvas.style.display = "none";
    video.style.display = "none";
    placeholder.style.display = "grid";
    captureBtn.disabled = true;
    switchBtn.disabled = true;
    saveBtn.disabled = true;
    facing = "user";
    setCameraState();
    startBtn.textContent = "開啟前鏡頭";
    setStatus("已重設");
  }

  startBtn.addEventListener("click", start);
  switchBtn.addEventListener("click", () => {
    facing = facing === "user" ? "environment" : "user";
    start();
  });
  captureBtn.addEventListener("click", capture);
  resetBtn.addEventListener("click", reset);
  Object.values(sliders).forEach(slider => slider?.addEventListener("input", updateLabels));
  window.addEventListener("pagehide", stopCamera);
  window.addEventListener("beforeunload", stopCamera);

  updateLabels();
  setCameraState();
  window.BeautyCamEngine = {
    getFaces: () => stableFaces,
    getMirror: () => facing === "user",
    getCanvas: () => canvas
  };
})();
