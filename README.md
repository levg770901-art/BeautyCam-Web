# BeautyCam-Web V1.3

BeautyCam Web — Natural Beauty Engine，自然美肌、磨皮、美白相機。

> 本專案是依照需求重新建構的 Web 相機版本；不是從最初 GitHub 歷史還原原始程式。

## V1.3 核心定位

V1.3 不追求「磨得越白越漂亮」，而是把照片處理流程升級成較接近自然美肌相機的影像管線：

- 不換臉
- 不做臉型幾何變形
- 不大眼、不縮鼻、不瘦臉
- 前鏡頭固定鏡像預覽，拍照與儲存結果也保持鏡像
- 後鏡頭維持正常左右方向
- 相機即時處理最大邊長 960px
- 拍照輸出最大邊長 1600px
- 拍照後使用較高品質的重新處理流程
- 多人臉 Face Landmarker，最多 5 張臉
- 臉部輪廓 mask + 眼睛／嘴巴／鼻部細節保護
- Feathered mask，降低臉部邊界產生明顯接縫
- 保守 skin probability 判斷，不再只依賴單一 RGB 條件
- Edge-protected skin smoothing，降低毛孔與輪廓被過度抹平
- Natural tone balancing，輕微降低過度泛紅並提升暗部均勻度
- Luminance-based whitening，高光保護
- Facial feature detail restoration，讓眼睛與嘴部維持清晰
- 多人照片自動降低美肌強度，避免塑膠感
- 使用 Canvas / OffscreenCanvas；不使用 nested boxBlur loops
- Face Landmarker 與影像處理在瀏覽器裝置端進行，不把照片送到遠端影像處理服務

## V1.3 影像管線

```text
Camera
  ↓
960px Live Preview
  ↓
Face Landmarker
  ↓
Face / Feature Mask
  ↓
Feathered Skin Mask
  ↓
Skin Probability
  ↓
Edge-protected Smoothing
  ↓
Natural Tone Balance
  ↓
Luminance Whitening + Highlight Protection
  ↓
Feature Detail Restoration
  ↓
1600px High-quality Capture Render
  ↓
JPEG
  ↓
iPhone 儲存
```

## 使用方式

1. 開啟 HTTPS 網站。
2. 點「開啟前鏡頭」。
3. 允許 Safari 使用相機。
4. 相機先啟動；Face Landmarker 在背景載入，不阻塞相機權限流程。
5. 前鏡頭預設鏡像；「切換後鏡頭」可切換前／後鏡頭。
6. 調整「美肌／磨皮／美白」。
7. 點「拍照」後，V1.3 會用 1600px 上限重新進行高品質處理。
8. 點「儲存照片」使用目前既有的 iPhone 儲存／分享流程。
9. V1.3 UI 不提供照片圖庫、上傳或「選擇檔案」入口。
10. 「重設」會停止相機並清除目前狀態。

## 與 V1.2 的主要差異

### V1.2

Face Oval → RGB Skin Rule → Blur → Whitening

### V1.3

Face Landmarker → Feathered Face Mask → Skin Probability → Edge Protection → Tone Balance → Highlight-safe Whitening → Feature Detail Restoration

V1.3 的主要改善不是增加更多按鈕，而是改善同樣三個控制項背後的影像品質。

## 已知限制

- V1.3 仍不是商用相機 App 等級的完整 AI skin segmentation。
- 膚色判斷仍是裝置端規則式 probability gate，極端光線、彩色燈光、非常暗或非常亮的膚色仍可能降低準確度。
- 尚未加入痘痘／斑點 inpainting、牙齒／眼白修飾、生成式 AI 修復或臉型變形。
- Web 相機效能受 iPhone Safari、GPU、MediaPipe WASM／WebGL 狀態影響。
- Face Landmarker 載入失敗時，相機仍應保持可用，但會退回較保守的基礎處理。

## 技術原則

V1.3 優先順序是：

**自然 > 穩定 > 細節 > 強度**

不以「最大美肌強度」作為品質指標。最終照片應維持人物辨識度、五官清晰度與自然皮膚紋理。
