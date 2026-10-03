# BeautyCam V2.0

This directory is a clean V2.0 implementation. It is not a continuation of the legacy V1 application architecture, renderer, mask rules, or effect pipeline.

## V2.0 architecture

```
Camera
  ↓
Canvas compositor
  ↓
Google MediaPipe Face Landmarker
  ├─ 3D face landmarks
  ├─ facial blendshapes
  └─ facial transformation matrix
  ↓
Temporal stabilization
  ↓
Face-region / feature-protection masks
  ↓
Local beauty compositor
  ↓
Expression-aware makeup compositor
  ↓
Preview / high-resolution capture
```

## Technical boundary

Google MediaPipe is used for face understanding. BeautyCam owns the image processing, mask construction, compositing, and UI.

The Web implementation uses the verified Google AI Edge MediaPipe Tasks Vision package family and runs inference in the browser. The model is referenced from Google's hosted artifact instead of being bundled.

## V2.0 principles

- New architecture; no legacy V1 pipeline
- Browser-local processing
- No remote photo-processing service
- Face landmarks are data, not a prescribed beauty algorithm
- No hard removal of eyes or mouth from the face region
- Continuous feature protection
- Expression-aware makeup
- Mirrored preview and landmark coordinates share one render coordinate system
- Preview and capture use the same effect architecture
- Capture gets a dedicated high-resolution render
