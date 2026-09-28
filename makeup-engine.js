(() => {
  "use strict";

  // BeautyCam V2.0 Makeup Engine
  // Geometry -> mask -> feather -> color -> makeup layer.
  const STYLES = {
    natural: {
      lip: [202, 68, 88],
      blush: [242, 92, 112],
      brow: [68, 45, 42],
      shadow: [151, 91, 132]
    },
    rose: {
      lip: [216, 48, 82],
      blush: [242, 72, 104],
      brow: [62, 40, 42],
      shadow: [169, 70, 145]
    },
    warm: {
      lip: [207, 61, 52],
      blush: [238, 111, 72],
      brow: [72, 48, 38],
      shadow: [170, 91, 62]
    }
  };

  let style = "natural";
  let amount = 0;
  let browShape = "natural";
  let lipShape = "natural";

  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;

  function makeMask(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function point(face, index, rc) {
    const q = face?.[index];
    if (!q) return null;
    return [
      (rc.mirror ? 1 - q.x : q.x) * rc.width,
      q.y * rc.height
    ];
  }

  function distance(a, b) {
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
  }

  function polygon(ctx, points) {
    const p = points.filter(Boolean);
    if (p.length < 3) return false;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.closePath();
    return true;
  }

  function fillPolygon(ctx, points, fill = "#fff") {
    if (!polygon(ctx, points)) return false;
    ctx.fillStyle = fill;
    ctx.fill();
    return true;
  }

  function feather(mask, radius) {
    const out = makeMask(mask.width, mask.height);
    const ctx = out.getContext("2d");
    ctx.filter = `blur(${Math.max(0.5, radius)}px)`;
    ctx.drawImage(mask, 0, 0);
    return out;
  }

  function createLipMask(rc) {
    const g = rc.faceGeometry;
    const mask = makeMask(rc.width, rc.height);
    const ctx = mask.getContext("2d");
    fillPolygon(ctx, g.outerLip);
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    fillPolygon(ctx, g.innerLip);
    ctx.restore();
    return mask;
  }

  function createBrowMask(rc, side) {
    const g = rc.faceGeometry;
    const source = side === "left" ? g.leftBrow : g.rightBrow;
    const mask = makeMask(rc.width, rc.height);
    if (source.length < 3) return mask;

    const center = source.map((p, i) => {
      let y = p[1];
      if (browShape === "straight") {
        const endpoints = (source[0][1] + source[source.length - 1][1]) / 2;
        y += (endpoints - y) * 0.72;
      } else if (browShape === "arch") {
        const midFactor = 1 - Math.abs(i - 2) / 2;
        y -= g.eyeWidth * 0.055 * Math.max(0, midFactor);
      }
      return [p[0], y];
    });

    const eyeWidth = side === "left"
      ? distance(point(g.face, 33, rc), point(g.face, 133, rc))
      : distance(point(g.face, 263, rc), point(g.face, 362, rc));
    const half = Math.max(2, eyeWidth * 0.025);
    const upper = [];
    const lower = [];

    for (let i = 0; i < center.length; i++) {
      const prev = center[Math.max(0, i - 1)];
      const next = center[Math.min(center.length - 1, i + 1)];
      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      upper.push([center[i][0] + nx * half, center[i][1] + ny * half]);
      lower.push([center[i][0] - nx * half, center[i][1] - ny * half]);
    }

    fillPolygon(mask.getContext("2d"), upper.concat(lower.reverse()));
    return mask;
  }

  function createEyeshadowMask(rc, side) {
    const g = rc.faceGeometry;
    const points = side === "left" ? g.leftEye : g.rightEye;
    const mask = makeMask(rc.width, rc.height);
    fillPolygon(mask.getContext("2d"), points);
    return mask;
  }

  function createBlushMask(rc, side) {
    const g = rc.faceGeometry;
    const mask = makeMask(rc.width, rc.height);
    const ctx = mask.getContext("2d");
    const center = side === "left" ? g.leftCheek : g.rightCheek;
    if (!center || !g.faceWidth || !g.faceHeight) return mask;

    const rx = g.faceWidth * 0.115;
    const ry = g.faceHeight * 0.075;
    const gradient = ctx.createRadialGradient(center[0], center[1], 0, center[0], center[1], Math.max(rx, ry));
    gradient.addColorStop(0, "rgba(255,0,0,1)");
    gradient.addColorStop(0.55, "rgba(255,0,0,0.62)");
    gradient.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(center[0], center[1], rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    return mask;
  }

  function paintMask(mask, color, opacity, rc, target) {
    const soft = feather(mask, Math.max(1, Math.min(rc.width, rc.height) * 0.003));
    const layer = makeMask(rc.width, rc.height);
    const lctx = layer.getContext("2d");
    lctx.fillStyle = rgba(color, clamp(opacity));
    lctx.fillRect(0, 0, rc.width, rc.height);
    lctx.globalCompositeOperation = "destination-in";
    lctx.drawImage(soft, 0, 0);
    target.drawImage(layer, 0, 0);
  }

  function renderLip(rc, target, color, a) {
    const mask = createLipMask(rc);
    // First validation target: 100% must be visibly colored.
    paintMask(mask, color, clamp(0.82 * a), rc, target);
  }

  function renderBlush(rc, target, color, a, side) {
    const mask = createBlushMask(rc, side);
    paintMask(mask, color, clamp(0.70 * a), rc, target);
  }

  function renderBrow(rc, target, color, a, side) {
    const mask = createBrowMask(rc, side);
    paintMask(mask, color, clamp(0.88 * a), rc, target);
  }

  function renderEyeshadow(rc, target, color, a, side) {
    const mask = createEyeshadowMask(rc, side);
    paintMask(mask, color, clamp(0.58 * a), rc, target);
  }

  function renderMakeupLayer(rc) {
    const layer = makeMask(rc.width, rc.height);
    if (!rc.faceGeometry || rc.makeupParams.amount <= 0) return layer;

    const target = layer.getContext("2d");
    const colors = STYLES[style] || STYLES.natural;
    const a = clamp(rc.makeupParams.amount);

    // Stable compositing order; makeup never mutates the beauty/source layer.
    renderEyeshadow(rc, target, colors.shadow, a, "left");
    renderEyeshadow(rc, target, colors.shadow, a, "right");
    renderBlush(rc, target, colors.blush, a, "left");
    renderBlush(rc, target, colors.blush, a, "right");
    renderLip(rc, target, colors.lip, a);
    renderBrow(rc, target, colors.brow, a, "left");
    renderBrow(rc, target, colors.brow, a, "right");

    return layer;
  }

  function getDebugMask(mode, rc) {
    if (!rc.faceGeometry) return null;
    if (mode === "lip") return feather(createLipMask(rc), Math.max(1, Math.min(rc.width, rc.height) * 0.002));
    if (mode === "brow") {
      const out = makeMask(rc.width, rc.height);
      const ctx = out.getContext("2d");
      ctx.drawImage(createBrowMask(rc, "left"), 0, 0);
      ctx.drawImage(createBrowMask(rc, "right"), 0, 0);
      return out;
    }
    if (mode === "eye") {
      const out = makeMask(rc.width, rc.height);
      const ctx = out.getContext("2d");
      ctx.drawImage(createEyeshadowMask(rc, "left"), 0, 0);
      ctx.drawImage(createEyeshadowMask(rc, "right"), 0, 0);
      return out;
    }
    if (mode === "blush") {
      const out = makeMask(rc.width, rc.height);
      const ctx = out.getContext("2d");
      ctx.drawImage(createBlushMask(rc, "left"), 0, 0);
      ctx.drawImage(createBlushMask(rc, "right"), 0, 0);
      return out;
    }
    return null;
  }

  window.BeautyCamMakeup = {
    setStyle: value => {
      if (STYLES[value]) style = value;
    },
    setAmount: value => {
      amount = clamp(Number(value) / 100);
    },
    setBrowShape: value => {
      browShape = value || "natural";
    },
    setLipShape: value => {
      lipShape = value || "natural";
    },
    renderMakeupLayer,
    getDebugMask,
    getState: () => ({ style, amount, browShape, lipShape })
  };
})();
