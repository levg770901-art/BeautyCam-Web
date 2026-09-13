# BeautyCam-Web V1.2

BeautyCam Web — 美肌、磨皮、美白相機。

> 注意：這是一份依照先前規格重新建構的版本，不是從 GitHub 歷史還原的原始檔。原 repository 歷史最初只有 Initial commit / README。

## V1.2 核心原則

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
- 使用 MediaPipe Face Landmarker 進行瀏覽器端多人臉 landmark 偵測
- 以臉部輪廓建立 skin-processing mask，並排除眼睛與嘴部細節
- 最多同時處理 5 張臉
- 臉部辨識與影像處理在裝置端進行，不將照片／影像幀上傳到遠端影像處理服務

## 實際使用

1. 以 HTTPS 網站或 localhost 開啟 `index.html`。
2. 點「開啟相機」並允許相機權限。
3. 第一次啟動會載入 Face Landmarker 模型；之後以最多 960px 的處理尺寸進行即時美顏。
4. 偵測到多人時，各張臉會分別套用美肌處理。
5. 調整「美肌／磨皮／美白」即可即時套用。
6. 點「拍照」後，以最多 1600px 的處理尺寸輸出照片。
7. 「上傳照片」會嘗試進行臉部辨識，再以最多 1600px 處理。
8. 點「儲存照片」輸出 JPEG。

手機瀏覽器使用相機時需要安全來源（HTTPS 或 localhost）與使用者授權。正式使用可透過 GitHub Pages、其他 HTTPS 靜態網站，或 localhost。

## V1.2 新增

- MediaPipe Face Landmarker：瀏覽器端多人臉 landmark 偵測。
- `numFaces: 5`：支援群體自拍的多臉處理方向。
- Face Oval mask：美肌主要限制在偵測到的臉部範圍內。
- Eye / mouth exclusion：保留眼睛與嘴部細節，降低整張臉被模糊的問題。
- Face-aware whitening：美白主要作用於偵測到的臉部皮膚區域。
- 若模型載入失敗，會自動退回 V1.1 的基礎美肌，不讓相機整體失效。

## V1.2 限制

目前的 face mask 是「臉部輪廓 + 顏色條件」的第一版，還不是商用美容相機等級的完整 skin segmentation。因此髮際線、眉毛、鬍鬚、耳朵與不同光線下的皮膚邊界仍可能需要進一步改善。

下一個工程方向：

Face Landmarker → 更精準 skin segmentation → feather / edge-aware mask → 多臉效能最佳化 → 群體自拍自然美顏。
