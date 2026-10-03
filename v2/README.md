# BeautyCam V2.0 — Round 2

V2.0 is a separate rebuild from the legacy V1.x application.

## Current pipeline

Camera → Video → Google MediaPipe Face Landmarker → Stable Landmarks → Face/Skin Masks → Beauty Processing → Makeup → Canvas

### Landmark engine

Round 2 replaces the earlier experimental `micro-facemesh` provider with Google's official `@mediapipe/tasks-vision@1.0.1` Face Landmarker package and the official Face Landmarker task model.

Google's current Web samples use the same package family and official model URL, and Face Landmarker provides 478 3D face landmarks. citeturn0search0turn0search3

The package is Apache-2.0 licensed. The exact model artifact's licensing/provenance should still be re-checked before any commercial redistribution or packaging of the model itself; BeautyCam currently references Google's hosted model rather than bundling a copy. citeturn1search0turn2search4

MediaPipe Tasks performs the image/video inference on-device; Google states that input media is not sent to Google servers. Google also states that MediaPipe Tasks sends performance/utilization metrics, so any public release should include appropriate privacy disclosure/consent where required. citeturn1search0turn1search9

## Beauty engine

- Traditional Y/Cb/Cr-style skin probability
- Landmark-based face mask
- Eye/lip protection
- Temporal landmark smoothing
- Box-blur based skin softening
- Whiten adjustment
- Landmark-driven lip, blush and brow makeup

## Round 2 performance work

- Reuse the landmark mask canvas instead of allocating a new canvas every frame.
- Use MediaPipe GPU delegate first, with CPU fallback.
- Keep face detection and pixel rendering separated in the existing loop.
- Live preview remains lower resolution than capture.
- Capture uses the same processing path at a larger output size.

## UI direction

The V2 interface is being redesigned mobile-first for iPhone Safari:

- Camera preview remains the visual focus.
- Effects are grouped into one compact panel.
- Presets are touch-friendly.
- Capture/save actions are visually prioritized.
- Technical status is kept unobtrusive.

## Explicit exclusions

- No separate third-party beauty SDK
- No remote photo-processing service
- No TensorFlow application dependency
- No ONNX Runtime application dependency
- V1.x remains untouched

## Next engineering targets

1. Improve skin smoothing so texture is softened without a plastic look.
2. Add stronger eye-white and teeth protection.
3. Upgrade blush/lip/brow masks and add eyeshadow.
4. Add performance telemetry for iPhone QA.
5. Evaluate worker/offscreen rendering where it materially improves Safari performance.
6. Add facial geometry effects only after the core beauty pipeline is stable.
