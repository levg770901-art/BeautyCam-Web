(() => {
  "use strict";

  // BeautyCam Makeup Engine V1.0
  // Landmark-driven cosmetic rendering. No facial geometry deformation.
  const MAKEUP = {
    palettes: {
      natural: { lip: [166, 91, 101], blush: [214, 118, 126], shadow: [126, 98, 86], liner: [62, 48, 47], brow: [72, 57, 52] },
      rose: { lip: [181, 72, 91], blush: [222, 106, 128], shadow: [145, 91, 104], liner: [58, 45, 49], brow: [68, 52, 50] },
      warm: { lip: [176, 83, 67], blush: [221, 127, 105], shadow: [145, 108, 78], liner: [60, 47, 41], brow: [73, 57, 48] }
    }
  };

  function clamp(v, a = 0, b = 255) { return Math.max(a, Math.min(b, v)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function landmark(face, i, w, h) {
    const p = face?.[i];
    return p ? [p.x * w, p.y * h] : null;
  }
  function centroid(face, ids, w, h) {
    const pts = ids.map(i => landmark(face, i, w, h)).filter(Boolean);
    if (!pts.length) return null;
    return [pts.reduce((s,p)=>s+p[0],0)/pts.length, pts.reduce((s,p)=>s+p[1],0)/pts.length];
  }
  function dist(a,b) { return a && b ? Math.hypot(a[0]-b[0],a[1]-b[1]) : 0; }
  function gaussian(x, y, cx, cy, sx, sy) {
    const dx=(x-cx)/sx, dy=(y-cy)/sy;
    return Math.exp(-0.5*(dx*dx+dy*dy));
  }
  function paintPixel(out, i, rgb, amount) {
    out[i] = clamp(mix(out[i], rgb[0], amount));
    out[i+1] = clamp(mix(out[i+1], rgb[1], amount));
    out[i+2] = clamp(mix(out[i+2], rgb[2], amount));
  }

  function renderMakeup(baseImage, faces, options = {}) {
    const { width, height, data } = baseImage;
    const out = new Uint8ClampedArray(data);
    const palette = MAKEUP.palettes[options.palette] || MAKEUP.palettes.natural;
    const strength = Math.max(0, Math.min(1, Number(options.strength ?? 0)));
    if (!strength || !faces?.length) return new ImageData(out, width, height);

    for (const face of faces) {
      const leftEye = centroid(face, [33,133,159,145], width, height);
      const rightEye = centroid(face, [362,263,386,374], width, height);
      const mouth = centroid(face, [61,291,13,14], width, height);
      const leftBrow = centroid(face, [70,63,105,107,66], width, height);
      const rightBrow = centroid(face, [300,293,334,336,296], width, height);
      const faceWidth = dist(landmark(face, 234,width,height), landmark(face,454,width,height)) || width*0.3;
      const eyeWidth = Math.max(10, dist(leftEye, landmark(face,133,width,height)) * 2.1 || faceWidth*0.12);
      const mouthWidth = Math.max(12, dist(landmark(face,61,width,height), landmark(face,291,width,height)) || faceWidth*0.22);

      // Blush: two very soft, skin-like radial layers.
      if (options.blush !== false) {
        for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
          const a = Math.max(
            gaussian(x,y,leftEye[0]-faceWidth*0.02,leftEye[1]+faceWidth*0.25,faceWidth*0.22,faceWidth*0.15),
            gaussian(x,y,rightEye[0]+faceWidth*0.02,rightEye[1]+faceWidth*0.25,faceWidth*0.22,faceWidth*0.15)
          ) * 0.16 * strength;
          if (a > 0.004) paintPixel(out,(y*width+x)*4,palette.blush,a);
        }
      }

      // Eyeshadow: broad, feathered upper-eye wash, excluding the eyeball itself.
      if (options.shadow !== false) {
        for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
          let a=0;
          if(leftEye) a=Math.max(a,gaussian(x,y,leftEye[0],leftEye[1]-faceWidth*0.035,eyeWidth*0.72,faceWidth*0.09));
          if(rightEye) a=Math.max(a,gaussian(x,y,rightEye[0],rightEye[1]-faceWidth*0.035,eyeWidth*0.72,faceWidth*0.09));
          a*=0.20*strength;
          if(a>0.008) paintPixel(out,(y*width+x)*4,palette.shadow,a);
        }
      }

      // Lips: tint the actual lip landmark region while preserving luminance and texture.
      if (options.lip !== false && mouth) {
        const lipIds=[61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95,78];
        const pts=lipIds.map(i=>landmark(face,i,width,height)).filter(Boolean);
        const minX=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[0]))-3)), maxX=Math.min(width-1,Math.ceil(Math.max(...pts.map(p=>p[0]))+3));
        const minY=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1]))-3)), maxY=Math.min(height-1,Math.ceil(Math.max(...pts.map(p=>p[1]))+3));
        for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++) {
          const nx=(x-mouth[0])/(mouthWidth*0.52), ny=(y-mouth[1])/(mouthWidth*0.23);
          const a=Math.exp(-0.5*(nx*nx+ny*ny))*0.62*strength;
          if(a>0.02) paintPixel(out,(y*width+x)*4,palette.lip,a);
        }
      }

      // Brows: subtle density overlay following existing brow positions.
      if (options.brow !== false) {
        for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
          let a=0;
          if(leftBrow) a=Math.max(a,gaussian(x,y,leftBrow[0],leftBrow[1],faceWidth*0.17,faceWidth*0.045));
          if(rightBrow) a=Math.max(a,gaussian(x,y,rightBrow[0],rightBrow[1],faceWidth*0.17,faceWidth*0.045));
          a*=0.22*strength;
          if(a>0.01) paintPixel(out,(y*width+x)*4,palette.brow,a);
        }
      }
    }
    return new ImageData(out,width,height);
  }

  window.BeautyMakeupEngine = { renderMakeup };
})();
