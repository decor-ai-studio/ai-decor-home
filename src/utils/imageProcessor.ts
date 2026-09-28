// Image processor: parses Egyptian Arabic prompts and applies real canvas-based
// visual transformations to uploaded images. All processing happens client-side.

export interface ProcessOptions {
  imageUrl: string;
  prompt: string;
  mode: "business" | "pro" | "personal";
  maskDataUrl?: string | null;
  style?: string | null;
}

export interface ProcessResult {
  outputDataUrl: string;
  appliedEffects: string[];
  regionMode: boolean;
}

interface ParsedCommand {
  effects: { type: string; label: string; params: Record<string, number | string> }[];
}

const KEYWORD_MAP: { keywords: string[]; effect: string; label: string; params: Record<string, number | string> }[] = [
  // Colors
  { keywords: ["أسود", "برد أسود", "لون أسود"], effect: "tint", label: "تدرج أسود", params: { r: 30, g: 30, b: 30, intensity: 0.5 } },
  { keywords: ["أبيض", "لون أبيض"], effect: "tint", label: "تدرج أبيض", params: { r: 240, g: 240, b: 240, intensity: 0.4 } },
  { keywords: ["أحمر", "لون أحمر"], effect: "tint", label: "تدرج أحمر", params: { r: 180, g: 30, b: 30, intensity: 0.45 } },
  { keywords: ["أزرق", "لون أزرق"], effect: "tint", label: "تدرج أزرق", params: { r: 30, g: 60, b: 180, intensity: 0.45 } },
  { keywords: ["ذهبي", "دهبي", "gold"], effect: "tint", label: "لمسة ذهبية", params: { r: 200, g: 160, b: 40, intensity: 0.4 } },
  { keywords: ["أخضر", "لون أخضر"], effect: "tint", label: "تدرج أخضر", params: { r: 30, g: 150, b: 60, intensity: 0.4 } },
  // Styles
  { keywords: ["مودرن", "modern", "حديث"], effect: "modern", label: "ستايل مودرن", params: { contrast: 1.15, saturation: 1.1, brightness: 1.05 } },
  { keywords: ["كلاسيك", "classic", "تراثي"], effect: "vintage", label: "ستايل كلاسيك", params: { sepia: 0.35, contrast: 1.1, vignette: 0.3 } },
  { keywords: ["بوهمي", "bohemian", "بوهمي"], effect: "warm", label: "ألوان بوهمية دافئة", params: { warmth: 20, saturation: 1.25 } },
  { keywords: ["إسكندنافي", "scandi", "نوردي"], effect: "bright", label: "إضاءة إسكندنافية", params: { brightness: 1.15, saturation: 0.85, coolness: 10 } },
  // Materials
  { keywords: ["كلادنج", "cladding", "ألومنيوم"], effect: "metallic", label: "كلادنج معدني", params: { contrast: 1.3, brightness: 0.9, metallic: 0.4 } },
  { keywords: ["نيون", "مضيئة", "إضاءة", "neon", "led"], effect: "glow", label: "إضاءة نيون", params: { glowStrength: 30, glowColor: "emerald" } },
  { keywords: ["زجاج", "glass", "زجاجي"], effect: "glass", label: "واجهة زجاجية", params: { brightness: 1.12, contrast: 1.08, blueShift: 15 } },
  { keywords: ["خشب", "wood", "خشبي"], effect: "warm", label: "خشب طبيعي دافئ", params: { warmth: 25, saturation: 1.15 } },
  { keywords: ["رخام", "marble"], effect: "bright", label: "رخام فاخر", params: { brightness: 1.18, contrast: 1.12, saturation: 0.8 } },
  { keywords: ["حجر", "stone"], effect: "texture", label: "تكسية حجرية", params: { contrast: 1.2, saturation: 0.9, warmth: 8 } },
  { keywords: ["خرسانة", "concrete"], effect: "desaturate", label: "خرسانة معرّضة", params: { saturation: 0.6, contrast: 1.15 } },
  // Mood / lighting
  { keywords: ["دافئ", "warm", "دافئة"], effect: "warm", label: "إضاءة دافئة", params: { warmth: 22, saturation: 1.12 } },
  { keywords: ["بارد", "cool", "باردة"], effect: "cool", label: "إضاءة باردة", params: { coolness: 20, saturation: 0.95 } },
  { keywords: ["ساطع", "bright", "إضاءة قوية"], effect: "bright", label: "إضاءة ساطعة", params: { brightness: 1.2, contrast: 1.05 } },
  { keywords: ["غامق", "dark", "داكن"], effect: "dark", label: "ألوان غامقة", params: { brightness: 0.82, contrast: 1.2, saturation: 1.15 } },
  { keywords: ["فاخر", "luxury", "فخم"], effect: "luxury", label: "مظهر فاخر", params: { contrast: 1.2, saturation: 1.15, warmth: 10, vignette: 0.2 } },
  { keywords: ["بسيط", "minimal", "بساطة"], effect: "minimal", label: "بساطة وأناقة", params: { saturation: 0.85, brightness: 1.08, contrast: 1.05 } },
  // Furniture / room
  { keywords: ["أريكة", "كنبة", "sofa", "أثاث"], effect: "warm", label: "تحديث الأثاث", params: { warmth: 15, saturation: 1.1 } },
  { keywords: ["سجاد", "carpet", "rug"], effect: "warm", label: "إضافة سجاد", params: { warmth: 18, saturation: 1.2 } },
  { keywords: ["نباتات", "نبات", "plants"], effect: "tint", label: "لمسة خضراء", params: { r: 30, g: 120, b: 50, intensity: 0.15 } },
];

function parsePrompt(prompt: string, mode: string, style?: string | null): ParsedCommand {
  const text = prompt.toLowerCase().trim();
  const effects: ParsedCommand["effects"] = [];
  const seen = new Set<string>();

  // Add style-based effect if selected
  if (style) {
    const styleMatch = KEYWORD_MAP.find((k) => k.keywords.some((kw) => style.includes(kw) || kw.includes(style)));
    if (styleMatch && !seen.has(styleMatch.effect)) {
      effects.push({ type: styleMatch.effect, label: styleMatch.label, params: styleMatch.params });
      seen.add(styleMatch.effect);
    }
  }

  // Match prompt keywords
  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some((kw) => text.includes(kw))) {
      if (!seen.has(entry.effect)) {
        effects.push({ type: entry.effect, label: entry.label, params: entry.params });
        seen.add(entry.effect);
      }
    }
  }

  // If no effects matched, apply a default based on mode
  if (effects.length === 0) {
    if (mode === "business") {
      effects.push({ type: "metallic", label: "تحسين عام للواجهة", params: { contrast: 1.15, brightness: 1.05, metallic: 0.2 } });
    } else if (mode === "pro") {
      effects.push({ type: "modern", label: "تحسين احترافي عام", params: { contrast: 1.12, saturation: 1.08, brightness: 1.05 } });
    } else {
      effects.push({ type: "warm", label: "تجديد عام للغرفة", params: { warmth: 15, saturation: 1.1 } });
    }
  }

  return { effects };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function applyEffectsToCtx(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effects: ParsedCommand["effects"]
) {
  for (const eff of effects) {
    const p = eff.params as Record<string, any>;
    switch (eff.type) {
      case "tint": {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = `rgba(${p['r']}, ${p['g']}, ${p['b']}, ${p['intensity']})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;
      }
      case "warm": {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = `rgba(255, 140, 40, ${(p['warmth'] as number) / 100})`;
        ctx.fillRect(0, 0, width, height);
        if (p['saturation']) {
          ctx.filter = `saturate(${p['saturation']})`;
          ctx.drawImage(ctx.canvas, 0, 0);
          ctx.filter = "none";
        }
        ctx.restore();
        break;
      }
      case "cool": {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = `rgba(40, 100, 255, ${(p['coolness'] as number) / 100})`;
        ctx.fillRect(0, 0, width, height);
        if (p['saturation']) {
          ctx.filter = `saturate(${p['saturation']})`;
          ctx.drawImage(ctx.canvas, 0, 0);
          ctx.filter = "none";
        }
        ctx.restore();
        break;
      }
      case "bright": {
        ctx.filter = `brightness(${p['brightness'] || 1.1}) contrast(${p['contrast'] || 1.05})`;
        if (p['saturation']) ctx.filter += ` saturate(${p['saturation']})`;
        if (p['coolness']) ctx.filter += ` hue-rotate(-${p['coolness']}deg)`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = "none";
        break;
      }
      case "dark": {
        ctx.filter = `brightness(${p['brightness'] || 0.85}) contrast(${p['contrast'] || 1.15}) saturate(${p['saturation'] || 1.1})`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = "none";
        break;
      }
      case "modern": {
        ctx.filter = `contrast(${p['contrast'] || 1.1}) saturate(${p['saturation'] || 1.05}) brightness(${p['brightness'] || 1.05})`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = "none";
        break;
      }
      case "vintage": {
        ctx.filter = `sepia(${p['sepia'] || 0.3}) contrast(${p['contrast'] || 1.1})`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = "none";
        if (p['vignette']) {
          ctx.save();
          const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.7);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(1, `rgba(0,0,0,${p['vignette']})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
        break;
      }
      case "metallic": {
        ctx.filter = `contrast(${p['contrast'] || 1.2}) brightness(${p['brightness'] || 0.95}) saturate(0.7)`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = "none";
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = `rgba(180, 180, 200, ${p['metallic'] || 0.3})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;
      }
      case "glow": {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const grad = ctx.createRadialGradient(width / 2, height / 3, 0, width / 2, height / 3, width * 0.6);
        const glowColor = p['glowColor'] === "emerald" ? "16, 185, 129" : p['glowColor'] === "blue" ? "59, 130, 246" : "245, 158, 11";
        grad.addColorStop(0, `rgba(${glowColor}, ${(p['glowStrength'] as number) / 100})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;
      }
      case "glass": {
        ctx.filter = `brightness(${p['brightness'] || 1.1}) contrast(${p['contrast'] || 1.05}) hue-rotate(-${p['blueShift'] || 10}deg) saturate(0.9)`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = "none";
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, "rgba(100, 150, 200, 0.12)");
        grad.addColorStop(0.5, "rgba(200, 220, 240, 0.08)");
        grad.addColorStop(1, "rgba(100, 150, 200, 0.12)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        break;
      }
      case "desaturate": {
        ctx.filter = `saturate(${p['saturation'] || 0.7}) contrast(${p['contrast'] || 1.1})`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = "none";
        break;
      }
      case "minimal": {
        ctx.filter = `saturate(${p['saturation'] || 0.85}) brightness(${p['brightness'] || 1.08}) contrast(${p['contrast'] || 1.05})`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = "none";
        break;
      }
      case "luxury": {
        ctx.filter = `contrast(${p['contrast'] || 1.15}) saturate(${p['saturation'] || 1.1}) brightness(1.02)`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = "none";
        if (p['warmth']) {
          ctx.save();
          ctx.globalCompositeOperation = "overlay";
          ctx.fillStyle = `rgba(255, 180, 60, ${(p['warmth'] as number) / 100})`;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
        if (p['vignette']) {
          ctx.save();
          const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.7);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(1, `rgba(0,0,0,${p['vignette']})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
        break;
      }
      case "texture": {
        ctx.filter = `contrast(${p['contrast'] || 1.15}) saturate(${p['saturation'] || 0.9})`;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.filter = "none";
        if (p['warmth']) {
          ctx.save();
          ctx.globalCompositeOperation = "overlay";
          ctx.fillStyle = `rgba(200, 160, 100, ${(p['warmth'] as number) / 100})`;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
        break;
      }
    }
  }
}

export async function processImage(opts: ProcessOptions): Promise<ProcessResult> {
  const img = await loadImage(opts.imageUrl);
  const maxDim = 1024;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, w, h);

  const parsed = parsePrompt(opts.prompt, opts.mode, opts.style);
  const regionMode = !!opts.maskDataUrl;

  if (regionMode) {
    // Apply effects only within mask region
    const maskImg = await loadImage(opts.maskDataUrl!);
    // Create a processed copy
    const processedCanvas = document.createElement("canvas");
    processedCanvas.width = w;
    processedCanvas.height = h;
    const procCtx = processedCanvas.getContext("2d");
    if (!procCtx) throw new Error("Canvas not supported");
    procCtx.drawImage(canvas, 0, 0);
    applyEffectsToCtx(procCtx, w, h, parsed.effects);

    // Composite: use mask to blend processed over original
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) throw new Error("Canvas not supported");
    maskCtx.drawImage(maskImg, 0, 0, w, h);

    // Draw processed image through mask
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    // Use mask as clipping alpha
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) throw new Error("Canvas not supported");
    tempCtx.drawImage(maskCanvas, 0, 0);
    tempCtx.globalCompositeOperation = "source-in";
    tempCtx.drawImage(processedCanvas, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
  } else {
    applyEffectsToCtx(ctx, w, h, parsed.effects);
  }

  const outputDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return {
    outputDataUrl,
    appliedEffects: parsed.effects.map((e) => e.label),
    regionMode,
  };
}
