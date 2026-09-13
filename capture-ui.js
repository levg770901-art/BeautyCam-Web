(() => {
  "use strict";

  const uploadControl = document.getElementById("uploadControl");
  const captureBtn = document.getElementById("capture");
  const resetBtn = document.getElementById("reset");
  const fileInput = document.getElementById("fileInput");

  if (!uploadControl || !captureBtn || !resetBtn) return;

  function showUpload() {
    uploadControl.style.display = "flex";
  }

  function hideUploadAfterCapture() {
    uploadControl.style.display = "none";
  }

  // Upload is available before taking a photo.
  showUpload();

  // app.js handles the actual capture first; then hide the upload control.
  captureBtn.addEventListener("click", hideUploadAfterCapture);

  // Reset returns to the initial state, so upload becomes available again.
  resetBtn.addEventListener("click", showUpload);

  // Loading an uploaded image keeps the upload function available.
  fileInput?.addEventListener("change", showUpload);
})();
