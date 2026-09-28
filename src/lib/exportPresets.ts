// Ready-made export templates for images & videos + per-client favourite export settings.

export type MediaKind = "image" | "video";
export type Quality = "draft" | "standard" | "high" | "max";
export type FitMode = "cover" | "contain";

export interface ExportPreset {
  id: string;
  platform: string;
  label: string;
  width: number;
  height: number;
  kinds: MediaKind[];
}

export const PRESETS: ExportPreset[] = [
  { id: "ig-post", platform: "إنستغرام", label: "منشور مربع", width: 1080, height: 1080, kinds: ["image", "video"] },
  { id: "ig-portrait", platform: "إنستغرام", label: "منشور طولي 4:5", width: 1080, height: 1350, kinds: ["image", "video"] },
  { id: "ig-story", platform: "إنستغرام", label: "ستوري / ريلز", width: 1080, height: 1920, kinds: ["image", "video"] },
  { id: "tiktok", platform: "تيك توك", label: "فيديو عمودي", width: 1080, height: 1920, kinds: ["image", "video"] },
  { id: "yt-video", platform: "يوتيوب", label: "فيديو Full HD", width: 1920, height: 1080, kinds: ["video"] },
  { id: "yt-shorts", platform: "يوتيوب", label: "شورتس", width: 1080, height: 1920, kinds: ["video"] },
  { id: "yt-thumb", platform: "يوتيوب", label: "صورة مصغّرة", width: 1280, height: 720, kinds: ["image"] },
  { id: "fb-post", platform: "فيسبوك", label: "منشور", width: 1200, height: 630, kinds: ["image", "video"] },
  { id: "x-post", platform: "إكس", label: "منشور", width: 1600, height: 900, kinds: ["image", "video"] },
  { id: "snap", platform: "سناب شات", label: "إعلان عمودي", width: 1080, height: 1920, kinds: ["image", "video"] },
  { id: "whatsapp", platform: "واتساب", label: "حالة", width: 1080, height: 1920, kinds: ["image", "video"] },
  { id: "linkedin", platform: "لينكدإن", label: "منشور", width: 1200, height: 627, kinds: ["image", "video"] },
  { id: "print-a4", platform: "طباعة", label: "A4 عمودي 300dpi", width: 2480, height: 3508, kinds: ["image"] },
  { id: "billboard", platform: "طباعة", label: "لوحة إعلانية عريضة", width: 3840, height: 1280, kinds: ["image"] },
  { id: "hd-land", platform: "عام", label: "HD أفقي", width: 1280, height: 720, kinds: ["image", "video"] },
  { id: "4k-land", platform: "عام", label: "4K أفقي", width: 3840, height: 2160, kinds: ["image", "video"] },
];

export const QUALITY_LABEL: Record<Quality, string> = {
  draft: "مسودة (خفيف)",
  standard: "قياسي",
  high: "عالي",
  max: "أقصى جودة",
};
export const QUALITY_SCALE: Record<Quality, number> = { draft: 0.5, standard: 0.75, high: 1, max: 1 };
export const IMAGE_Q: Record<Quality, number> = { draft: 0.6, standard: 0.8, high: 0.9, max: 1 };
export const VIDEO_BPS: Record<Quality, number> = { draft: 1_500_000, standard: 4_000_000, high: 8_000_000, max: 16_000_000 };

export interface ExportSettings {
  presetId: string;
  quality: Quality;
  imageFormat: "png" | "jpeg" | "webp";
  fit: FitMode;
}

export const DEFAULT_SETTINGS: ExportSettings = { presetId: "ig-post", quality: "high", imageFormat: "png", fit: "cover" };

const KEY = "rawaq.exportPrefs.v1";
type Store = Record<string, Partial<Record<MediaKind, ExportSettings>>>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Store; } catch { return {}; }
}

export function getClientPrefs(clientId: string | null, kind: MediaKind): ExportSettings | null {
  return read()[clientId ?? "_default"]?.[kind] ?? null;
}

export function saveClientPrefs(clientId: string | null, kind: MediaKind, s: ExportSettings) {
  const store = read();
  const k = clientId ?? "_default";
  store[k] = { ...(store[k] ?? {}), [kind]: s };
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function targetSize(p: ExportPreset, q: Quality) {
  const s = QUALITY_SCALE[q];
  const even = (n: number) => Math.max(2, Math.round((n * s) / 2) * 2);
  return { w: even(p.width), h: even(p.height) };
}

function drawFit(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, w: number, h: number, fit: FitMode) {
  const r = fit === "cover" ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
  const dw = sw * r, dh = sh * r;
  if (fit === "contain") { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image(); i.crossOrigin = "anonymous";
    i.onload = () => res(i); i.onerror = () => rej(new Error("تعذّر تحميل الصورة"));
    i.src = src;
  });
}

export async function exportImage(src: string, s: ExportSettings): Promise<Blob> {
  const p = PRESETS.find((x) => x.id === s.presetId) ?? PRESETS[0]!;
  const { w, h } = targetSize(p, s.quality);
  const img = await loadImg(src);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  drawFit(ctx, img, img.naturalWidth, img.naturalHeight, w, h, s.fit);
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("فشل التصدير"))), `image/${s.imageFormat}`, IMAGE_Q[s.quality]),
  );
}

export async function exportVideo(src: string, s: ExportSettings, onProgress?: (p: number) => void): Promise<{ blob: Blob; ext: string }> {
  const p = PRESETS.find((x) => x.id === s.presetId) ?? PRESETS[0]!;
  const { w, h } = targetSize(p, s.quality);
  const v = document.createElement("video");
  v.crossOrigin = "anonymous"; v.muted = true; v.playsInline = true; v.src = src;
  await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error("تعذّر تحميل الفيديو")); });
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: mime, videoBitsPerSecond: VIDEO_BPS[s.quality] });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));
  let raf = 0;
  const tick = () => {
    drawFit(ctx, v, v.videoWidth, v.videoHeight, w, h, s.fit);
    if (v.duration) onProgress?.(Math.min(1, v.currentTime / v.duration));
    raf = requestAnimationFrame(tick);
  };
  rec.start(250);
  await v.play();
  tick();
  await new Promise<void>((res) => (v.onended = () => res()));
  cancelAnimationFrame(raf);
  rec.stop();
  await done;
  onProgress?.(1);
  return { blob: new Blob(chunks, { type: mime.split(";")[0] ?? "video/webm" }), ext: mime.includes("mp4") ? "mp4" : "webm" };
}
