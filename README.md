# BeautyCam-Web V1.1

BeautyCam Web — 美肌、磨皮、美白相機。

> 注意：這是一份依照先前 V1.1 規格重新建構的版本，不是從 GitHub 歷史還原的原始檔。原 repository 歷史目前只有 Initial commit / README。

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

## 實際使用

1. 以 HTTPS 網站或 localhost 開啟 `index.html`。
2. 點「開啟相機」並允許相機權限。
3. 相機畫面會以最多 960px 的處理尺寸進行即時美顏。
4. 調整「美肌／磨皮／美白」即可即時套用。
5. 點「拍照」後，以最多 1600px 的處理尺寸輸出照片。
6. 「上傳照片」可直接處理既有照片；三個滑桿會重新套用到原始照片。
7. 點「儲存照片」輸出 JPEG。

手機瀏覽器使用相機時需要安全來源（HTTPS 或 localhost）與使用者授權。直接從 GitHub 的檔案頁面開啟 HTML 並不能取得相機功能；正式使用應透過 GitHub Pages、其他 HTTPS 靜態網站，或 localhost。

## V1.1 已修正

- 上傳照片後滑桿現在會重新處理原始照片，不再引用已關閉的 ImageBitmap。
- 相機即時預覽與拍照分離：預覽最多 960px，拍照輸出最多 1600px。
- 相機停止時會停止所有 MediaStream tracks。
- `pagehide` / `beforeunload` 會釋放相機資源。
- 使用者拒絕相機權限時會顯示明確狀態訊息。

## V1.1 限制

這個版本尚未加入真正的多人臉偵測與精準 face/skin segmentation。因此它是 V1.1 的「基礎影像處理重建」，不是最終的 V2 多人自然美顏引擎。

下一個工程版本的方向：

Face Detection → Face/skin mask → Edge-aware smoothing → Multi-face processing → 即時效能最佳化。
