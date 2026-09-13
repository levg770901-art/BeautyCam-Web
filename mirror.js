(() => {
  "use strict";

  // BeautyCam V1.2: iPhone-style front-camera behavior.
  // Front-camera preview is mirrored, and the captured/saved image is mirrored too.
  // Rear-camera preview/output remain normal. Face landmarks are still calculated
  // from the original video frame, so mirroring never changes landmark coordinates.
  const canvas = document.getElementById("previewCanvas");
  const captureBtn = document.getElementById("capture");
  const downloadBtn = document.getElementById("download");
  const resetBtn = document.getElementById("reset");
  const mirrorToggleBtn = document.getElementById("mirrorToggle");

  if (!canvas || !captureBtn || !downloadBtn) return;

  // The visible mirror switch is intentionally removed. Front-camera mirroring
  // is now a fixed behavior, matching the intended selfie-camera UX.
  if (mirrorToggleBtn) mirrorToggleBtn.style.display = "none";

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

  // Capture in capture-phase so we read the preview mirror state BEFORE app.js
  // replaces the canvas with the high-resolution capture frame.
  captureBtn.addEventListener("click", () => {
    const shouldMirror = canvas.style.transform === "scaleX(-1)";
    canvas.dataset.captureMirror = shouldMirror ? "1" : "0";
    delete canvas.dataset.pixelsMirrored;
    requestAnimationFrame(() => {
      canvas.style.transform = shouldMirror ? "scaleX(-1)" : "none";
    });
  }, true);

  // Run before app.js's download handler so the JPEG itself is mirrored.
  downloadBtn.addEventListener("click", () => {
    if (canvas.dataset.captureMirror === "1" && canvas.dataset.pixelsMirrored !== "1") {
      flipCanvasPixels();
      canvas.dataset.pixelsMirrored = "1";
      canvas.style.transform = "scaleX(-1)";
    }
  }, true);

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      requestAnimationFrame(() => {
        delete canvas.dataset.captureMirror;
        delete canvas.dataset.pixelsMirrored;
      });
    });
  }
})();
