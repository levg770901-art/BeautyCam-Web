# BeautyCam-Web V1.1

BeautyCam Web — 美肌、磨皮、美白相機。

> 注意：這是一份依照先前 V1.1 規格「重新建構」的版本，不是從 GitHub 歷史還原的原始檔。原 repository 目前只有 Initial commit / README。

## V1.1 核心原則

- 不換臉
- 不做臉型幾何變形
- 不大眼、不縮鼻、不瘦臉
- 上傳照片處理最大邊長 1600px
- 相機即時處理最大邊長 960px
- 使用 Canvas / OffscreenCanvas 進行影像處理
- 避免 nested boxBlur loops
- 美肌採保守混合並盡量保留邊緣
- 美白以亮度（luminance）為基礎，並保護高光
- 前鏡頭優先
- 停止相機時釋放 MediaStream tracks
- pagehide / beforeunload 時釋放相機資源

## 執行

直接以 HTTPS 或 localhost 開啟 `index.html`。
手機瀏覽器使用相機時，通常需要安全來源（HTTPS 或 localhost）與使用者授權。

## V1.1 限制

這個重建版本尚未加入真正的多人臉偵測與精準 face/skin segmentation。
因此它是 V1.1 的「基礎影像處理重建」，不是我們現在討論的 V2 多人自然美顏引擎。

下一個工程版本的正確方向是：
Face Detection → Face/skin mask → Edge-aware smoothing → Multi-face processing → 即時效能最佳化。
