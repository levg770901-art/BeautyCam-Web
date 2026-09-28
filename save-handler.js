(() => {
  "use strict";

  const saveButton = document.getElementById("download");
  const canvas = document.getElementById("previewCanvas");
  const status = document.getElementById("status");
  if (!saveButton || !canvas) return;

  saveButton.addEventListener("click", async event => {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (!canvas.width || !canvas.height) return;

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!blob) {
      if (status) status.textContent = "照片建立失敗";
      return;
    }

    const filename = `BeautyCam-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
    const file = new File([blob], filename, { type: "image/jpeg" });

    // On iPhone/iPad, use the native share sheet instead of Safari's file download preview.
    // The user can choose "儲存影像" / Save Image from the system share sheet.
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        if (status) status.textContent = "照片已完成儲存";
        return;
      } catch (err) {
        if (err?.name === "AbortError") {
          if (status) status.textContent = "已取消儲存";
          return;
        }
        console.warn("Native share failed; falling back to download", err);
      }
    }

    // Fallback for browsers without file sharing support.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (status) status.textContent = "照片已送出儲存";
  }, true);
})();
