(() => {
  "use strict";

  const video = document.getElementById("video");
  const baseCanvas = document.getElementById("previewCanvas");
  const slider = document.getElementById("makeup");
  if (!video || !baseCanvas || !slider) return;

  let landmarker = null;
  let loading = null;
  let faces = [];
  let lastDetect = 0;
  let lastRender = 0;
  let palette = "natural";

  const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";

  const PALETTES = {
    natural: { lip: "190,70,88", blush: "235,88,112", shadow: "125,88,78", brow: "55,43,40" },
    rose:    { lip: "210,45,82", blush: "242,65,112", shadow: "150,65,105", brow: "52,39,42" },
    warm:    { lip: "205,62,40", blush: "242,96,70", shadow: "160,102,68", brow: "62,46,37" }
  };

  // Transparent makeup layer. It sits above the beauty-processed preview.
  const overlay = document.createElement("canvas");
  overlay.id = "makeupCanvas";
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "absolute", inset: "0", width: "100%", height: "100%",
    objectFit: "cover", objectPosition: "center center", display: "none",
    zIndex: "4", pointerEvents: "none", transformOrigin: "center center"
  });
  baseCanvas.parentElement.appendChild(overlay);

  function pt(face, i, w, h) {
    const q = face?.[i];
    return q ? [q.x * w, q.y * h] : null;
  }

  function dist(a, b) {
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
  }

  function avg(face, ids, w, h) {
    const a = ids.map(i => pt(face, i, w, h)).filter(Boolean);
    if (!a.length) return null;
    return [a.reduce((s, q) => s + q[0], 0) / a.length, a.reduce((s, q) => s + q[1], 0) / a.length];
  }

  function polygon(ctx, face, ids, w, h) {
    const a = ids.map(i => pt(face, i, w, h)).filter(Boolean);
    if (a.length < 3) return false;
    ctx.beginPath();
    ctx.moveTo(a[0][0], a[0][1]);
    for (let i = 1; i < a.length; i++) ctx.lineTo(a[i][0], a[i][1]);
    ctx.closePath();
    return true;
  }

  function softEllipse(ctx, x, y, rx, ry, color, alpha) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const radius = Math.max(rx, ry);
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(0.50, `rgba(${color},${alpha * 0.48})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  async function init() {
    if (landmarker) return landmarker;
    if (loading) return loading;
    loading = (async () => {
      try {
        const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js");
        const resolver = await vision.FilesetResolver.forVisionTasks(WASM);
        landmarker = await vision.FaceLandmarker.createFromOptions(resolver, {
          // The main beauty engine already uses GPU. Use CPU here to avoid two
          // FaceLandmarker instances competing for the same iPhone GPU context.
          baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
          runningMode: "VIDEO",
          numFaces: 5,
          minFaceDetectionConfidence: 0.50,
          minFacePresenceConfidence: 0.50,
          minTrackingConfidence: 0.50
        });
      } catch (e) {
        console.warn("Makeup face tracking unavailable", e);
        landmarker = null;
      } finally {
        loading = null;
      }
      return landmarker;
    })();
    return loading;
  }

  function detect(t) {
    if (!landmarker || video.readyState < 2 || t - lastDetect < 150) return;
    lastDetect = t;
    try {
      faces = landmarker.detectForVideo(video, t)?.faceLandmarks || [];
    } catch (e) {
      // Keep the previous good landmarks for a short tracking dropout.
    }
  }

  function render() {
    const s = Number(slider.value) / 100;
    if (!s || !faces.length || !baseCanvas.width || !baseCanvas.height) return;

    const w = baseCanvas.width;
    const h = baseCanvas.height;
    overlay.width = w;
    overlay.height = h;
    overlay.style.transform = baseCanvas.style.transform || "none";
    overlay.style.display = baseCanvas.style.display === "none" ? "none" : "block";

    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const c = PALETTES[palette];

    for (const face of faces) {
      const faceWidth = dist(pt(face, 234, w, h), pt(face, 454, w, h)) || w * 0.30;
      const leftEye = avg(face, [33, 133, 159, 145], w, h);
      const rightEye = avg(face, [362, 263, 386, 374], w, h);

      // Blush: larger and clearly visible, but feathered into the skin.
      if (leftEye && rightEye) {
        const a = 0.58 * s;
        softEllipse(ctx, leftEye[0] - faceWidth * 0.03, leftEye[1] + faceWidth * 0.28,
          faceWidth * 0.20, faceWidth * 0.135, c.blush, a);
        softEllipse(ctx, rightEye[0] + faceWidth * 0.03, rightEye[1] + faceWidth * 0.28,
          faceWidth * 0.20, faceWidth * 0.135, c.blush, a);
      }

      // Eyeshadow: broad enough to be visible on an iPhone display.
      if (leftEye && rightEye) {
        softEllipse(ctx, leftEye[0], leftEye[1] - faceWidth * 0.025,
          faceWidth * 0.19, faceWidth * 0.085, c.shadow, 0.62 * s);
        softEllipse(ctx, rightEye[0], rightEye[1] - faceWidth * 0.025,
          faceWidth * 0.19, faceWidth * 0.085, c.shadow, 0.62 * s);
      }

      // Correct MediaPipe lip contours: outer lip and inner mouth are cut out.
      const outerLip = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];
      const innerLip = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 402, 317];
      if (polygon(ctx, face, outerLip, w, h)) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = `rgba(${c.lip},${0.82 * s})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      // Restore the mouth opening so lipstick does not paint the teeth/inside.
      if (polygon(ctx, face, innerLip, w, h)) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.fill();
        ctx.restore();
      }

      // Eyebrow enhancement follows the existing brow landmarks.
      const browIds = [[70, 63, 105, 66, 107], [300, 293, 334, 296, 336]];
      ctx.strokeStyle = `rgba(${c.brow},${0.88 * s})`;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2, faceWidth * 0.014);
      for (const ids of browIds) {
        const points = ids.map(i => pt(face, i, w, h)).filter(Boolean);
        if (points.length > 2) {
          ctx.beginPath();
          ctx.moveTo(points[0][0], points[0][1]);
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
          ctx.stroke();
        }
      }
    }
  }

  function loop(t) {
    requestAnimationFrame(loop);
    detect(t);
    if (Number(slider.value) > 0 && t - lastRender > 80) {
      lastRender = t;
      render();
    }
  }

  document.querySelectorAll(".makeup-preset").forEach(button => {
    button.addEventListener("click", () => {
      palette = button.dataset.makeup === "0" ? "natural" : button.dataset.makeup;
      if (button.dataset.makeup === "0") {
        slider.value = 0;
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (Number(slider.value) < 70) {
        slider.value = 70;
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });

  slider.addEventListener("input", () => {
    if (Number(slider.value) > 0) init();
    else overlay.style.display = "none";
  });

  // Keep the existing save path unchanged. Only composite makeup into the
  // already-captured preview canvas after the capture operation completes.
  document.getElementById("capture")?.addEventListener("click", () => {
    setTimeout(() => {
      render();
      if (Number(slider.value) > 0 && overlay.style.display !== "none") {
        const ctx = baseCanvas.getContext("2d");
        ctx.drawImage(overlay, 0, 0);
        overlay.style.display = "none";
      }
    }, 260);
  });

  document.getElementById("reset")?.addEventListener("click", () => {
    slider.value = 0;
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    overlay.style.display = "none";
  });

  init();
  requestAnimationFrame(loop);
})();
