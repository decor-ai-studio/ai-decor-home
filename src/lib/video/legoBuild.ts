// LEGO-style assembly renderer: the source photo is cut into bricks that fly in
// and snap into place. Rendering is a pure function of time, so the same code
// powers the live preview, the second-by-second scrubber and the exported video.

export type BuildOptions = {
  cols: number;
  /** Row count; keep it in sync with buildBricks() so no brick is missing. */
  rows?: number;
  background: string;
  accent: string;
  caption: string;
  studs: boolean;
  /** Optional real material photo blended over every brick (metal / cladding look). */
  material?: HTMLImageElement | HTMLCanvasElement | null;
  /** 0..1 strength of the material blend. */
  materialMix?: number;
  /** Moving light sweep + per-brick metallic shading (pure local math, no cost). */
  shine?: boolean;
  /** Slow cinematic push-in on the wall while it is being built. */
  camera?: boolean;
  /** Blueprint ghost of the final wall under the falling bricks. */
  ghost?: boolean;
  /** Tiny sparks when a brick snaps into place. */
  sparks?: boolean;
  /** At the end the seams fade out and the wall becomes the clean finished photo. */
  seamless?: boolean;
  /** Closing brand card (shop name / phone) shown in the last moments. */
  brand?: string;
  phone?: string;
  /** Shop logo drawn on the closing card. */
  logo?: HTMLImageElement | HTMLCanvasElement | null;
};

export const DEFAULT_BUILD: BuildOptions = {
  cols: 14,
  background: "#050b18",
  accent: "#34d399",
  caption: "تركيب الواجهة",
  studs: true,
  material: null,
  materialMix: 0.45,
  shine: true,
  camera: true,
  ghost: true,
  sparks: true,
  seamless: true,
  brand: "",
  phone: "",
  logo: null,
};

type Brick = { cx: number; cy: number; order: number; dx: number; dy: number; rot: number };

/** Deterministic pseudo-random so every render of the same second is identical. */
function rand(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export type BuildPattern =
  | "bottom-up" | "top-down" | "left-right" | "right-left" | "center-out"
  | "outside-in" | "diagonal" | "spiral" | "random";

export const BUILD_PATTERNS: { id: BuildPattern; name: string }[] = [
  { id: "bottom-up", name: "من الأسفل للأعلى" },
  { id: "top-down", name: "من الأعلى للأسفل" },
  { id: "left-right", name: "من اليسار لليمين" },
  { id: "right-left", name: "من اليمين لليسار" },
  { id: "center-out", name: "من المركز للخارج" },
  { id: "outside-in", name: "من الإطار للمركز" },
  { id: "diagonal", name: "قُطري" },
  { id: "spiral", name: "حلزوني" },
  { id: "random", name: "عشوائي فني" },
];

function patternOrder(p: BuildPattern, c: number, r: number, cols: number, rows: number, i: number) {
  const nx = c / Math.max(1, cols - 1), ny = r / Math.max(1, rows - 1);
  const d = Math.hypot(nx - 0.5, ny - 0.5);
  switch (p) {
    case "top-down": return r * cols + c;
    case "left-right": return c * rows + r;
    case "right-left": return (cols - 1 - c) * rows + r;
    case "center-out": return d * 100;
    case "outside-in": return (1 - d) * 100;
    case "diagonal": return (nx + (1 - ny)) * 100;
    case "spiral": return (Math.atan2(ny - 0.5, nx - 0.5) / (2 * Math.PI) + 0.5) * 30 + d * 200;
    case "random": return rand(i + 91) * 100;
    default: return (rows - 1 - r) * cols + c;
  }
}

export function buildBricks(cols: number, rows: number, pattern: BuildPattern = "bottom-up"): Brick[] {
  const bricks: Brick[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      // bottom-up placement, slight shuffle inside each row
      const base = patternOrder(pattern, c, r, cols, rows, i);
      const span = pattern === "center-out" || pattern === "outside-in" || pattern === "diagonal" || pattern === "spiral" || pattern === "random" ? 6 : cols * 0.8;
      const order = base + rand(i) * span;
      bricks.push({
        cx: c,
        cy: r,
        order,
        dx: (rand(i + 11) - 0.5) * 2.4,
        dy: -1.4 - rand(i + 23) * 1.6,
        rot: (rand(i + 37) - 0.5) * 0.9,
      });
    }
  }
  const min = Math.min(...bricks.map((b) => b.order));
  bricks.forEach((b) => (b.order -= min));
  const max = Math.max(...bricks.map((b) => b.order));
  bricks.forEach((b) => (b.order /= max || 1));
  return bricks;
}

const easeOutBack = (p: number) => {
  const c1 = 1.7, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/**
 * Draws the assembly at absolute time `t` (seconds) of a clip lasting `duration`.
 * Pure function of time: identical for preview, scrubber and exported video.
 */
export function drawBuildFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  bricks: Brick[],
  t: number,
  duration: number,
  opts: BuildOptions,
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const p = clamp01(t / duration);

  // backdrop
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, opts.background);
  bg.addColorStop(1, "#01040c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  const margin = 0.82;
  const scale = Math.min((W * margin) / iw, (H * margin) / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const ox = (W - dw) / 2;
  const oy = (H - dh) / 2;

  const cols = opts.cols;
  const rows = opts.rows ?? Math.max(3, Math.round((cols * dh) / dw));
  const bw = dw / cols;
  const bh = dh / rows;

  const placeSpan = 0.88; // bricks land over the first 88% of the clip
  const brickTime = 0.16; // relative length of one brick flight
  const done = Math.min(1, p / placeSpan);

  // ---- scene (affected by the camera) ----
  ctx.save();
  if (opts.camera ?? true) {
    const push = 1 + 0.07 * easeInOut(p);
    ctx.translate(W / 2, H / 2);
    ctx.scale(push, push);
    ctx.translate(-W / 2, -H / 2 + dh * 0.01 * p);
  }

  // baseplate shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(W / 2, oy + dh + 18, dw * 0.52, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // blueprint ghost: shows where the bricks will land, fades as the wall fills up
  if (opts.ghost ?? true) {
    const ga = 1 - done;
    if (ga > 0.02) {
      ctx.globalAlpha = 0.09 * ga;
      ctx.drawImage(img, ox, oy, dw, dh);
      ctx.globalAlpha = 0.22 * ga;
      ctx.strokeStyle = opts.accent;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      for (let c = 0; c <= cols; c++) {
        ctx.moveTo(ox + c * bw, oy);
        ctx.lineTo(ox + c * bw, oy + dh);
      }
      for (let r = 0; r <= rows; r++) {
        ctx.moveTo(ox, oy + r * bh);
        ctx.lineTo(ox + dw, oy + r * bh);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  const material = opts.material && (opts.materialMix ?? 0) > 0 ? opts.material : null;
  const mix = Math.min(1, opts.materialMix ?? 0.45);
  const mw = material ? (material as HTMLImageElement).naturalWidth || material.width : 0;
  const mh = material ? (material as HTMLImageElement).naturalHeight || material.height : 0;

  for (const b of bricks) {
    if (b.cy >= rows) continue;
    const start = b.order * (placeSpan - brickTime);
    const local = (p - start) / brickTime;
    if (local <= 0) continue;
    const k = Math.min(1, local);
    const e = easeOutBack(k);
    const air = Math.max(0, 1 - e);

    const x = ox + b.cx * bw;
    const y = oy + b.cy * bh;
    const fx = x + b.dx * bw * (1 - e) * 6;
    const fy = y + b.dy * bh * (1 - e) * 6;

    // contact shadow that shrinks as the brick comes down onto the wall
    if (k < 1) {
      ctx.fillStyle = `rgba(0,0,0,${0.32 * (1 - k)})`;
      ctx.fillRect(fx + air * bw * 0.4, fy + air * bh * 0.7, bw, bh);
    }

    ctx.save();
    ctx.globalAlpha = Math.min(1, local * 2.2);
    ctx.translate(fx + bw / 2, fy + bh / 2);
    ctx.rotate(b.rot * (1 - e));
    const s = 1 + (1 - e) * 0.18;
    ctx.scale(s, s);

    // brick face = slice of the photo
    ctx.drawImage(img, (b.cx * iw) / cols, (b.cy * ih) / rows, iw / cols, ih / rows, -bw / 2, -bh / 2, bw + 0.6, bh + 0.6);

    // real material texture, continuous across the whole wall
    if (material) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = Math.min(1, local * 2.2) * mix;
      ctx.drawImage(material, (b.cx * mw) / cols, (b.cy * mh) / rows, mw / cols, mh / rows, -bw / 2, -bh / 2, bw + 0.6, bh + 0.6);
      ctx.restore();
    }

    // brushed-metal shading
    if (opts.shine) {
      const g = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
      g.addColorStop(0, "rgba(255,255,255,0.22)");
      g.addColorStop(0.45, "rgba(255,255,255,0.02)");
      g.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = g;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    }

    // plastic bevel
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh * 0.16);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(-bw / 2, bh / 2 - bh * 0.12, bw, bh * 0.12);

    // studs on top, fading as the brick settles
    if (opts.studs) {
      const studAlpha = 0.35 + (1 - k) * 0.45;
      ctx.fillStyle = `rgba(255,255,255,${studAlpha * 0.5})`;
      ctx.strokeStyle = `rgba(0,0,0,${studAlpha * 0.35})`;
      const r = Math.min(bw, bh) * 0.14;
      for (const sxp of [-0.25, 0.25]) {
        ctx.beginPath();
        ctx.ellipse(sxp * bw, -bh / 2 + r * 1.1, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // snap flash
    if (k < 1) {
      ctx.strokeStyle = opts.accent;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.lineWidth = 2;
      ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    }
    ctx.restore();

    // sparks right after the snap (deterministic, so scrubbing stays exact)
    if ((opts.sparks ?? true) && local > 1 && local < 1.35) {
      const u = (local - 1) / 0.35;
      const idx = b.cy * cols + b.cx;
      ctx.fillStyle = opts.accent;
      ctx.globalAlpha = (1 - u) * 0.9;
      for (let j = 0; j < 4; j++) {
        const a = rand(idx * 4 + j + 5) * Math.PI * 2;
        const d = u * Math.min(bw, bh) * (0.5 + rand(idx + j * 13) * 0.6);
        const sz = Math.max(1.5, Math.min(bw, bh) * 0.05);
        ctx.fillRect(x + bw / 2 + Math.cos(a) * d, y + bh / 2 + Math.sin(a) * d, sz, sz);
      }
      ctx.globalAlpha = 1;
    }
  }

  // finish: seams melt away and the wall becomes the clean finished photo
  const fin = clamp01((p - placeSpan) / 0.05);
  if ((opts.seamless ?? true) && fin > 0) {
    ctx.globalAlpha = fin;
    ctx.drawImage(img, ox, oy, dw, dh);
    if (material) {
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = fin * mix;
      ctx.drawImage(material, 0, 0, mw, mh, ox, oy, dw, dh);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;
  }

  // light sweep across the completed wall
  if (opts.shine && p > placeSpan) {
    const q = (p - placeSpan) / (1 - placeSpan);
    const cx = ox + (q * 1.6 - 0.3) * dw;
    const band = dw * 0.28;
    const g = ctx.createLinearGradient(cx - band, oy, cx + band, oy + dh);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.32)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, dw, dh);
    ctx.clip();
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = g;
    ctx.fillRect(ox, oy, dw, dh);
    ctx.restore();
  }

  // frame
  ctx.strokeStyle = opts.accent;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 3;
  ctx.strokeRect(ox - 6, oy - 6, dw + 12, dh + 12);
  ctx.globalAlpha = 1;
  ctx.restore(); // end of camera transform

  // ---- overlay (fixed on screen) ----
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  const cardT = easeInOut(clamp01((p - 0.9) / 0.07));
  const hasCard = !!(opts.brand?.trim() || opts.phone?.trim() || opts.logo);
  const hudA = hasCard ? 1 - cardT : 1;

  if (hudA > 0.01) {
    ctx.globalAlpha = hudA;
    const barW = W * 0.6;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect((W - barW) / 2, H - 44, barW, 8);
    ctx.fillStyle = opts.accent;
    ctx.fillRect((W - barW) / 2, H - 44, barW * done, 8);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.round(Math.min(W, H * 1.6) / 40)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${opts.caption} · ${Math.round(done * 100)}٪`, W / 2, H - 58);
    ctx.textAlign = "start";
    ctx.globalAlpha = 1;
  }

  // closing brand card slides up in the final moments
  if (hasCard && cardT > 0) {
    const ch = Math.max(H * 0.13, 70);
    const cw = W * 0.8;
    const cy = H - ch - 28 + (1 - cardT) * (ch + 40);
    ctx.globalAlpha = cardT;
    ctx.fillStyle = "rgba(2,6,23,0.85)";
    ctx.fillRect((W - cw) / 2, cy, cw, ch);
    ctx.fillStyle = opts.accent;
    ctx.fillRect((W - cw) / 2, cy, 6, ch);
    if (opts.logo) {
      const lw = (opts.logo as HTMLImageElement).naturalWidth || opts.logo.width;
      const lh = (opts.logo as HTMLImageElement).naturalHeight || opts.logo.height;
      const box = ch * 0.72;
      const ls = Math.min(box / lw, box / lh);
      ctx.drawImage(opts.logo, (W - cw) / 2 + 22, cy + (ch - lh * ls) / 2, lw * ls, lh * ls);
    }
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    const fs = Math.round(Math.min(W, H * 1.6) / 22);
    if (opts.brand?.trim()) {
      ctx.font = `bold ${fs}px system-ui, sans-serif`;
      ctx.fillText(opts.brand.trim(), W / 2, cy + ch * (opts.phone?.trim() ? 0.45 : 0.62));
    }
    if (opts.phone?.trim()) {
      ctx.fillStyle = opts.accent;
      ctx.font = `600 ${Math.round(fs * 0.7)}px system-ui, sans-serif`;
      ctx.fillText(opts.phone.trim(), W / 2, cy + ch * 0.82);
    }
    ctx.textAlign = "start";
    ctx.globalAlpha = 1;
  }
}
