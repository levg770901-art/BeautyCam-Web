# BeautyCam V2.0 Core — Round 1

This directory is the first V2.0 implementation and is intentionally isolated from the existing V1.x application.

## Round 1 pipeline

Camera → Video Frame → Canvas → Face Region → Skin Probability → Feature Protection → Beauty Processing → Final Canvas

## Principles

- No MediaPipe
- No TensorFlow
- No ONNX Runtime
- No third-party beauty SDK
- No remote photo-processing service
- Canvas is the single rendered output
- Front camera is mirrored in the rendering pipeline rather than by CSS transform
- Preview and capture use the same processing pipeline
- Feature protection reduces smoothing over the eye/mouth regions
- Skin detection uses traditional Y/Cb/Cr-style color rules

## Important limitation of Round 1

This round deliberately does **not** claim true facial landmark tracking yet. The face region is currently an explicit geometry abstraction so the rendering/skin pipeline can be validated independently.

The next V2 stage should replace the geometry provider with a dedicated landmark provider while keeping the camera, mask, beauty and renderer modules unchanged.

## Entry point

Open `/v2/index.html` from the GitHub Pages site after the branch is deployed.

## Acceptance targets

1. iPhone Safari can open the camera.
2. Front-camera preview is consistently mirrored.
3. Beauty effects stay inside the estimated face region.
4. Eye and mouth regions remain protected.
5. Preview and capture use the same rendering path.
6. Capture uses a larger output size than live preview.
7. Existing V1.x remains untouched.
