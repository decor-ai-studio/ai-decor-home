// Advanced client-side image processing pipeline.
// Pure canvas/typed-array math — no network, runs in a few milliseconds so the
// UI can update while the user drags a slider.

export interface Adjustments {
  exposure: number; // -100..100
  contrast: number; // -100..100
  highlights: number; // -100..100
  shadows: number; // -100..100
  saturation: number; // -100..100
  vibrance: number; // -100..100
  temperature: number; // -100 (cold) .. 100 (warm)
  tint: number; // -100 (green) .. 100 (magenta)
  clarity: number; // 0..100 local contrast
  sharpen: number; // 0..100
  depth: number; // 0..100 contact-shadow / ambient occlusion
  bloom: number; // 0..100 light glow
  vignette: number; // 0..100
  grain: number; // 0..100
}

export const NEUTRAL: Adjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  clarity: 0,
  sharpen: 0,
  depth: 0,
  bloom: 0,
  vignette: 0,
  grain: 0,
};

export interface GradePreset {
  id: string;
  label: string;
  hint: string;
  values: Partial<Adjustments>;
}

export const GRADE_PRESETS: GradePreset[] = [
  {
    id: "neutral",
    label: "طبيعي",
    hint: "بدون معالجة",
    values: {},
  },
  {
    id: "cinema3d",
    label: "سينمائي ثلاثي الأبعاد",
    hint: "عمق قوي وظلال محددة",
    values: { contrast: 18, shadows: 14, depth: 55, clarity: 38, sharpen: 30, bloom: 18, vignette: 22 },
  },
  {
    id: "studio",
    label: "استوديو معماري",
    hint: "إضاءة نظيفة وتفاصيل حادة",
    values: { exposure: 6, highlights: -18, shadows: 20, clarity: 30, sharpen: 35, depth: 25, saturation: 6 },
  },
  {
    id: "night-neon",
    label: "نيون ليلي",
    hint: "توهج الحروف المضيئة",
    values: { exposure: -8, contrast: 22, shadows: -10, bloom: 55, saturation: 18, temperature: -14, vignette: 34 },
  },
  {
    id: "golden",
    label: "ساعة ذهبية",
    hint: "دفء الغروب",
    values: { temperature: 32, tint: 6, exposure: 5, highlights: -12, shadows: 16, vibrance: 22, bloom: 20 },
  },
  {
    id: "clean-day",
    label: "نهار صافي",
    hint: "ألوان واقعية متوازنة",
    values: { exposure: 8, highlights: -20, shadows: 18, vibrance: 14, clarity: 18, sharpen: 20 },
  },
  {
    id: "hyperreal",
    label: "واقعية فائقة",
    hint: "أقصى تفاصيل ودقة",
    values: { contrast: 12, clarity: 52, sharpen: 48, depth: 45, vibrance: 16, highlights: -14, shadows: 12, grain: 8 },
  },
];

export const BLEND_MODES = [
  { id: "normal", label: "عادي" },
  { id: "multiply", label: "ضرب (ظلال)" },
  { id: "screen", label: "شاشة (إضاءة)" },
  { id: "overlay", label: "تراكب" },
  { id: "soft-light", label: "ضوء ناعم" },
  { id: "hard-light", label: "ضوء قوي" },
  { id: "color-dodge", label: "توهج" },
  { id: "luminosity", label: "إضاءة فقط" },
  { id: "color", label: "لون فقط" },
] as const;

export type BlendMode = (typeof BLEND_MODES)[number]["id"];

export interface Layer {
  id: string;
  name: string;
  src: string;
  opacity: number; // 0..1
  blend: BlendMode;
  visible: boolean;
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Fast separable box blur over a single channel, repeated for a gaussian-like falloff. */
function boxBlur(src: Float32Array, w: number, h: number, radius: number, passes = 2) {
  if (radius < 1) return src;
  let buf = src;
  let tmp = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    // horizontal
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += buf[row + Math.min(w - 1, Math.max(0, x))]!;
      const norm = radius * 2 + 1;
      for (let x = 0; x < w; x++) {
        tmp[row + x] = sum / norm;
        const out = row + Math.max(0, x - radius);
        const inn = row + Math.min(w - 1, x + radius + 1);
        sum += buf[inn]! - buf[out]!;
      }
    }
    // vertical
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!;
      const norm = radius * 2 + 1;
      for (let y = 0; y < h; y++) {
        buf[y * w + x] = sum / norm;
        const out = Math.max(0, y - radius) * w + x;
        const inn = Math.min(h - 1, y + radius + 1) * w + x;
        sum += tmp[inn]! - tmp[out]!;
      }
    }
  }
  tmp = new Float32Array(0);
  return buf;
}

/**
 * Apply the full grading + detail pipeline to an ImageData in place.
 * Order: exposure -> white balance -> tone (highlights/shadows) -> contrast
 *        -> local contrast (clarity) -> depth (contact shadows) -> sharpen
 *        -> colour (saturation/vibrance) -> bloom -> vignette -> grain.
 */
export function applyAdjustments(image: ImageData, adj: Adjustments): ImageData {
  const { width: w, height: h, data } = image;
  const n = w * h;

  const exposure = Math.pow(2, adj.exposure / 100);
  const contrast = 1 + adj.contrast / 100;
  const hi = adj.highlights / 100;
  const sh = adj.shadows / 100;
  const temp = adj.temperature / 100;
  const tint = adj.tint / 100;
  const sat = 1 + adj.saturation / 100;
  const vib = adj.vibrance / 100;

  // base tone + colour pass
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    let r = data[p]! / 255;
    let g = data[p + 1]! / 255;
    let b = data[p + 2]! / 255;

    r *= exposure;
    g *= exposure;
    b *= exposure;

    // white balance
    r *= 1 + temp * 0.25 + tint * 0.06;
    g *= 1 - Math.abs(temp) * 0.04 - tint * 0.12;
    b *= 1 - temp * 0.25 + tint * 0.06;

    // tone curve on luminance-ish weighting
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (hi !== 0) {
      const mask = Math.max(0, lum - 0.5) * 2;
      const f = 1 + hi * mask * 0.8;
      r *= f;
      g *= f;
      b *= f;
    }
    if (sh !== 0) {
      const mask = Math.max(0, 0.5 - lum) * 2;
      const add = sh * mask * 0.35;
      r += add;
      g += add;
      b += add;
    }

    // contrast around mid grey
    r = (r - 0.5) * contrast + 0.5;
    g = (g - 0.5) * contrast + 0.5;
    b = (b - 0.5) * contrast + 0.5;

    // saturation / vibrance
    const l2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = l2 + (r - l2) * sat;
    g = l2 + (g - l2) * sat;
    b = l2 + (b - l2) * sat;
    if (vib !== 0) {
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const amount = vib * (1 - (mx - mn));
      r = l2 + (r - l2) * (1 + amount);
      g = l2 + (g - l2) * (1 + amount);
      b = l2 + (b - l2) * (1 + amount);
    }

    data[p] = clamp255(r * 255);
    data[p + 1] = clamp255(g * 255);
    data[p + 2] = clamp255(b * 255);
  }

  const needsLum = adj.clarity > 0 || adj.depth > 0;
  if (needsLum) {
    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      lum[i] = 0.2126 * data[p]! + 0.7152 * data[p + 1]! + 0.0722 * data[p + 2]!;
    }
    const radius = Math.max(2, Math.round(Math.min(w, h) / 90));
    const blurred = boxBlur(Float32Array.from(lum), w, h, radius, 2);

    const clarity = adj.clarity / 100;
    const depth = adj.depth / 100;
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      const diff = lum[i]! - blurred[i]!;
      let gain = 0;
      if (clarity > 0) gain += diff * clarity * 0.9;
      let shade = 1;
      if (depth > 0) {
        // crevices (darker than their surroundings) get an occlusion shadow
        const occ = Math.max(0, -diff) / 255;
        shade = 1 - Math.min(0.55, occ * depth * 3.2);
      }
      data[p] = clamp255((data[p]! + gain) * shade);
      data[p + 1] = clamp255((data[p + 1]! + gain) * shade);
      data[p + 2] = clamp255((data[p + 2]! + gain) * shade);
    }
  }

  if (adj.sharpen > 0) {
    const amount = (adj.sharpen / 100) * 1.2;
    const src = Uint8ClampedArray.from(data);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = src[p + c]!;
          const around =
            src[p - 4 + c]! + src[p + 4 + c]! + src[p - w * 4 + c]! + src[p + w * 4 + c]!;
          data[p + c] = clamp255(center + amount * (center * 4 - around) * 0.25);
        }
      }
    }
  }

  if (adj.bloom > 0) {
    const amount = adj.bloom / 100;
    const radius = Math.max(3, Math.round(Math.min(w, h) / 60));
    const glow = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      const l = 0.2126 * data[p]! + 0.7152 * data[p + 1]! + 0.0722 * data[p + 2]!;
      glow[i] = l > 170 ? l - 170 : 0;
    }
    boxBlur(glow, w, h, radius, 2);
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      const g = glow[i]! * amount * 1.6;
      // screen blend of the glow
      data[p] = clamp255(255 - ((255 - data[p]!) * (255 - g)) / 255);
      data[p + 1] = clamp255(255 - ((255 - data[p + 1]!) * (255 - g)) / 255);
      data[p + 2] = clamp255(255 - ((255 - data[p + 2]!) * (255 - g)) / 255);
    }
  }

  if (adj.vignette > 0 || adj.grain > 0) {
    const vig = adj.vignette / 100;
    const grain = adj.grain / 100;
    const cx = w / 2;
    const cy = h / 2;
    const maxD = Math.hypot(cx, cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        let f = 1;
        if (vig > 0) {
          const d = Math.hypot(x - cx, y - cy) / maxD;
          f = 1 - vig * Math.pow(Math.max(0, d - 0.35) / 0.65, 2);
        }
        const noise = grain > 0 ? (Math.random() - 0.5) * grain * 42 : 0;
        data[p] = clamp255(data[p]! * f + noise);
        data[p + 1] = clamp255(data[p + 1]! * f + noise);
        data[p + 2] = clamp255(data[p + 2]! * f + noise);
      }
    }
  }

  return image;
}

export function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذّر تحميل الصورة"));
    img.src = src;
  });
}

/** Flatten visible layers onto one canvas using their blend mode and opacity. */
export function compositeLayers(
  layers: { img: HTMLImageElement; opacity: number; blend: BlendMode; visible: boolean }[],
  maxDim: number,
): HTMLCanvasElement {
  const base = layers.find((l) => l.visible) ?? layers[0];
  const canvas = document.createElement("canvas");
  if (!base) {
    canvas.width = 1;
    canvas.height = 1;
    return canvas;
  }
  let w = base.img.naturalWidth;
  let h = base.img.naturalHeight;
  if (Math.max(w, h) > maxDim) {
    const s = maxDim / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  let first = true;
  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.globalAlpha = first ? 1 : layer.opacity;
    ctx.globalCompositeOperation = first ? "source-over" : (layer.blend as GlobalCompositeOperation);
    ctx.drawImage(layer.img, 0, 0, w, h);
    first = false;
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

/** Composite + grade in one step. Returns a PNG data URL. */
export function renderPipeline(
  layers: { img: HTMLImageElement; opacity: number; blend: BlendMode; visible: boolean }[],
  adj: Adjustments,
  maxDim: number,
  fast = false,
): string {
  const canvas = compositeLayers(layers, maxDim);
  const ctx = canvas.getContext("2d");
  const encode = () => (fast ? canvas.toDataURL("image/jpeg", 0.92) : canvas.toDataURL("image/png"));
  if (!ctx || canvas.width < 2) return encode();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.putImageData(applyAdjustments(data, adj), 0, 0);
  return encode();
}

export function isNeutral(adj: Adjustments) {
  return (Object.keys(NEUTRAL) as (keyof Adjustments)[]).every((k) => adj[k] === NEUTRAL[k]);
}

export function withPreset(preset: GradePreset): Adjustments {
  return { ...NEUTRAL, ...preset.values };
}
