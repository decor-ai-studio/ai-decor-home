// Client-side helpers that turn app inputs into Lovable AI image requests.
import { streamImage } from "./stream-image";
import {
  SPEED_PROFILES,
  cacheKey,
  imageSignature,
  readCache,
  writeCache,
  type SpeedMode,
} from "./renderCache";
import {
  buildRenderDirectives,
  describeRender,
  DEFAULT_RENDER,
  type RenderSettings,
} from "./renderEngine";

export type DesignMode = "business" | "pro" | "personal";

export interface AiEditOptions {
  imageUrl: string;
  prompt: string;
  mode: DesignMode;
  maskDataUrl?: string | null;
  style?: string | null;
  render?: RenderSettings;
  /** "fast" returns a quick draft, "quality" the full-detail render. */
  speed?: SpeedMode;
  /** Extra learned direction (e.g. a client's taste profile). */
  extraDirection?: string;
  onFrame?: (dataUrl: string, isFinal: boolean) => void;
  signal?: AbortSignal;
}

export interface AiEditResult {
  outputDataUrl: string;
  appliedEffects: string[];
  regionMode: boolean;
  /** True when the result came from the local cache (instant, no AI cost). */
  cached?: boolean;
}

const MODE_BRIEF: Record<DesignMode, string> = {
  business:
    "You are an expert architectural visualiser for shopfronts, building facades and outdoor signage. Re-render the uploaded photo as a photorealistic finished facade: correct perspective, believable cladding panel seams, metal or acrylic illuminated channel letters with realistic light spill, clean joinery and professional exterior lighting.",
  pro: "You are a senior architectural designer producing client-ready facade and interior renders. Keep the building geometry, camera angle and surroundings identical and deliver a crisp, high-detail photorealistic render with accurate materials, reflections and shadows.",
  personal:
    "You are an interior design visualiser. Redecorate the photographed room photorealistically while keeping the room layout, windows and camera angle identical.",
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not load image"));
    img.src = src;
  });
}

export function buildFacadePrompt(opts: {
  prompt: string;
  mode: DesignMode;
  style?: string | null;
  regionMode?: boolean;
  render?: RenderSettings;
  extraDirection?: string;
}) {
  const lines = [
    MODE_BRIEF[opts.mode],
    `Client request (Egyptian Arabic, follow it exactly): "${opts.prompt.trim() || "حسّن الواجهة وارفع جودتها مع الحفاظ على شكلها"}"`,
    opts.style ? `Requested style: ${opts.style}.` : "",
    buildRenderDirectives(opts.render ?? DEFAULT_RENDER),
    opts.extraDirection?.trim() ? opts.extraDirection.trim() : "",
    opts.regionMode
      ? "Apply the changes only inside the masked region and leave every other pixel of the photo untouched."
      : "Preserve the original composition, framing, structure and background exactly; change only what the request asks for.",
    "Any Arabic text must be rendered with correct connected Arabic letterforms, right-to-left, spelled exactly as written by the client — never invent or translate words.",
    "Output a single sharp, high-resolution, daylight-accurate photograph. No watermarks, no UI, no text overlays other than the requested signage.",
  ];
  return lines.filter(Boolean).join("\n");
}

/** OpenAI edit masks mark editable pixels as fully transparent, so invert the painted mask. */
async function buildMaskFile(maskDataUrl: string, width: number, height: number): Promise<File> {
  const mask = await loadImage(maskDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(mask, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const painted = (px[i + 3] ?? 0) > 10;
    px[i] = 0;
    px[i + 1] = 0;
    px[i + 2] = 0;
    px[i + 3] = painted ? 0 : 255;
  }
  ctx.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("mask encoding failed");
  return new File([blob], "mask.png", { type: "image/png" });
}

/** Re-encode the source photo as PNG at a gateway-friendly size so mask dimensions always match. */
async function buildSourceFile(imageUrl: string, maxDim: number) {
  const img = await loadImage(imageUrl);
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
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("image encoding failed");
  return { file: new File([blob], "source.png", { type: "image/png" }), width: w, height: h };
}

/** Uploaded-photo editing: cladding, illuminated letters, materials, room redecoration. */
export async function aiEditImage(opts: AiEditOptions): Promise<AiEditResult> {
  const regionMode = !!opts.maskDataUrl;
  const speed: SpeedMode = opts.speed ?? "quality";
  const profile = SPEED_PROFILES[speed];
  const effects = [
    ...describeRequest(opts.prompt, opts.style ?? null),
    ...describeRender(opts.render ?? DEFAULT_RENDER),
  ];

  // Speed layer: an identical request is served instantly from the local cache.
  const key = cacheKey({
    imageSignature: imageSignature(opts.imageUrl),
    prompt: opts.prompt,
    mode: opts.mode,
    style: opts.style ?? null,
    ...(opts.render ? { render: opts.render } : {}),
    mask: opts.maskDataUrl ?? null,
    speed,
  });
  const hit = await readCache(key);
  if (hit) {
    opts.onFrame?.(hit, true);
    return { outputDataUrl: hit, appliedEffects: effects, regionMode, cached: true };
  }

  // Draft mode sends a smaller reference photo (fewer input tokens); final mode keeps full detail.
  const source = await buildSourceFile(opts.imageUrl, speed === "fast" ? 1024 : 1536);
  // Ask for the cheapest output size that matches the photo's shape instead of letting the model pick "auto".
  const outSize = source.width > source.height * 1.15 ? "1536x1024" : source.height > source.width * 1.15 ? "1024x1536" : "1024x1024";

  const form = new FormData();
  form.append(
    "prompt",
    buildFacadePrompt({
      prompt: opts.prompt,
      mode: opts.mode,
      style: opts.style ?? null,
      regionMode,
      render: opts.render ?? DEFAULT_RENDER,
      ...(opts.extraDirection ? { extraDirection: opts.extraDirection } : {}),
    }),
  );
  form.append("image", source.file);
  if (opts.maskDataUrl) {
    form.append("mask", await buildMaskFile(opts.maskDataUrl, source.width, source.height));
  }
  form.append("quality", profile.quality);
  form.append("size", outSize);
  form.append("partial_images", String(profile.partialImages));
  form.append("output_format", "png");

  let last = "";
  await streamImage(
    "/api/edit-image",
    form,
    (dataUrl, isFinal) => {
      last = dataUrl;
      opts.onFrame?.(dataUrl, isFinal);
    },
    opts.signal,
  );
  if (!last) throw new Error("no image returned");
  void writeCache(key, last);

  return { outputDataUrl: last, appliedEffects: effects, regionMode, cached: false };
}

export interface PosterOptions {
  text: string;
  subText?: string;
  brandType: string;
  style: string;
  palette: string;
  layout: "storefront" | "poster" | "letters" | "mockup";
  ratio: "1024x1024" | "1536x1024" | "1024x1536";
  /** "medium" is the default (much cheaper); use "high" only for the final print-ready render. */
  quality?: "medium" | "high";
  onFrame?: (dataUrl: string, isFinal: boolean) => void;
  signal?: AbortSignal;
}

const LAYOUT_BRIEF: Record<PosterOptions["layout"], string> = {
  storefront:
    "Photorealistic street-level photograph of a finished shopfront at dusk, the signage lit and glowing, clean pavement and soft ambient reflections.",
  poster:
    "Polished advertising poster for a signage and cladding company: strong hierarchy, generous margins, premium print-ready finish.",
  letters:
    "Studio product shot of 3D illuminated channel letters mounted on a dark textured panel, raking light, visible depth, acrylic face and LED halo glow.",
  mockup:
    "Realistic mockup presentation: the sign applied to a building facade, shot slightly off-axis with shallow depth of field.",
};

export function buildPosterPrompt(opts: Omit<PosterOptions, "onFrame" | "signal">) {
  return [
    "You are a senior signage and advertising art director working for a Middle-Eastern signage manufacturer.",
    LAYOUT_BRIEF[opts.layout],
    `Primary sign text, rendered exactly and spelled letter-for-letter: "${opts.text.trim()}".`,
    opts.subText?.trim() ? `Secondary line, also exact: "${opts.subText.trim()}".` : "",
    `Business type: ${opts.brandType}. Design style: ${opts.style}. Colour palette: ${opts.palette}.`,
    "Arabic text must use correct connected right-to-left letterforms with professional Arabic typography; never transliterate, translate, mirror or misspell it. Latin text uses clean modern type.",
    "Typography must be crisp and legible at full size, kerning tight and even, letters evenly lit.",
    "Deliver a high-resolution, production-ready image with realistic materials, accurate light spill and no watermark.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Text-to-design: signage posters, storefront previews and illuminated letter mockups. */
export async function aiGeneratePoster(opts: PosterOptions): Promise<string> {
  let last = "";
  await streamImage(
    "/api/generate-image",
    {
      prompt: buildPosterPrompt(opts),
      size: opts.ratio,
      quality: opts.quality ?? "medium",
      output_format: "png",
      partial_images: 1,
    },
    (dataUrl, isFinal) => {
      last = dataUrl;
      opts.onFrame?.(dataUrl, isFinal);
    },
    opts.signal,
  );
  if (!last) throw new Error("no image returned");
  return last;
}

const TAGS: { keywords: string[]; label: string }[] = [
  { keywords: ["كلادنج", "cladding", "ألومنيوم"], label: "كلادنج ألومنيوم" },
  { keywords: ["نيون", "مضيئة", "led", "إضاءة"], label: "حروف وإضاءة مضيئة" },
  { keywords: ["زجاج", "glass"], label: "واجهة زجاجية" },
  { keywords: ["خشب", "wood"], label: "خشب طبيعي" },
  { keywords: ["رخام", "marble"], label: "رخام فاخر" },
  { keywords: ["حجر", "stone"], label: "تكسية حجرية" },
  { keywords: ["أسود", "black"], label: "لون أسود" },
  { keywords: ["ذهبي", "دهبي", "gold"], label: "لمسة ذهبية" },
  { keywords: ["مودرن", "modern", "حديث"], label: "ستايل مودرن" },
  { keywords: ["فاخر", "luxury", "فخم"], label: "مظهر فاخر" },
];

function describeRequest(prompt: string, style: string | null) {
  const text = `${prompt} ${style ?? ""}`.toLowerCase();
  const labels = TAGS.filter((t) => t.keywords.some((k) => text.includes(k))).map((t) => t.label);
  if (style) labels.unshift(style);
  return labels.length ? Array.from(new Set(labels)) : ["إعادة توليد واقعية عالية الجودة"];
}

export function aiErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("402")) return "رصيد الذكاء الاصطناعي خلص — لازم تزوّد الرصيد للاستمرار.";
  if (raw.includes("429")) return "الطلبات كثيرة دلوقتي — استنى ثواني وجرّب تاني.";
  if (raw.includes("403")) return "الموديل مش متاح للحساب الحالي — كلّم الدعم أو غيّر الإعدادات.";
  if (raw.includes("500") && raw.includes("LOVABLE_API_KEY")) return "خدمة الذكاء الاصطناعي غير مهيأة.";
  return "حصل خطأ أثناء توليد الصورة — حاول تاني.";
}
