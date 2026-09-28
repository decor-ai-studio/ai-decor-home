// Client helper for the Lego-style assembly video pipeline.
// Creates a gateway video job through our server route, polls it, then downloads
// the finished MP4 through the server proxy and returns a local blob URL.

export type LegoVideoStatus = "queued" | "in_progress" | "completed" | "failed";

export interface LegoVideoOptions {
  /** Final design image the animation must build up to. */
  imageDataUrl: string;
  /** Extra Arabic/English direction from the designer. */
  brief?: string;
  duration?: number;
  resolution?: "720p" | "1080p";
  aspectRatio?: "16:9" | "9:16";
  onStatus?: (status: LegoVideoStatus, progress: number) => void;
  signal?: AbortSignal;
}

export interface LegoVideoResult {
  id: string;
  videoUrl: string;
  blob: Blob;
}

// Adaptive polling: check quickly at first, then back off (saves waiting time on short jobs).
const POLL_START_MS = 2500;
const POLL_MAX_MS = 7000;
const MAX_WAIT_MS = 9 * 60 * 1000;

// Identical requests in the same session reuse the finished video instantly.
const resultCache = new Map<string, LegoVideoResult>();

function hashKey(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 7) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${(h >>> 0).toString(36)}:${s.length}`;
}

/** Downscale + JPEG-encode the input so upload and model ingestion are faster. */
async function shrinkImage(dataUrl: string, maxDim: number): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const s = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    if (s === 1 && dataUrl.startsWith("data:image/jpeg")) return dataUrl;
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } catch {
    return dataUrl;
  }
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("تم الإلغاء"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

async function readError(res: Response) {
  const text = await res.text().catch(() => "");
  throw new Error(`${res.status}:${text.slice(0, 400)}`);
}

export async function generateLegoAssemblyVideo(opts: LegoVideoOptions): Promise<LegoVideoResult> {
  const resolution = opts.resolution ?? "1080p";
  const imageDataUrl = await shrinkImage(opts.imageDataUrl, resolution === "720p" ? 1280 : 1920);
  const key = hashKey([imageDataUrl, opts.brief ?? "", opts.duration ?? 8, resolution, opts.aspectRatio ?? "16:9"].join("|"));
  const cached = resultCache.get(key);
  if (cached) {
    opts.onStatus?.("completed", 100);
    return cached;
  }
  const created = await fetch("/api/generate-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl,
      brief: opts.brief ?? "",
      duration: opts.duration ?? 8,
      resolution,
      aspectRatio: opts.aspectRatio ?? "16:9",
    }),
    signal: opts.signal ?? null,
  });
  if (!created.ok) await readError(created);
  const job = (await created.json()) as { id?: string };
  if (!job.id) throw new Error("لم يتم إنشاء مهمة الفيديو");

  opts.onStatus?.("queued", 0);

  const started = Date.now();
  let delay = POLL_START_MS;
  while (Date.now() - started < MAX_WAIT_MS) {
    await wait(delay, opts.signal);
    delay = Math.min(POLL_MAX_MS, Math.round(delay * 1.35));
    const res = await fetch(`/api/video-status/${encodeURIComponent(job.id)}`, {
      signal: opts.signal ?? null,
    });
    if (!res.ok) await readError(res);
    const state = (await res.json()) as {
      status?: LegoVideoStatus;
      progress?: number;
      error?: { message?: string };
    };
    const status = state.status ?? "in_progress";
    opts.onStatus?.(status, Math.round(state.progress ?? 0));
    if (status === "failed") throw new Error(state.error?.message ?? "فشل توليد الفيديو");
    if (status === "completed") {
      const file = await fetch(`/api/video-file/${encodeURIComponent(job.id)}`, {
        signal: opts.signal ?? null,
      });
      if (!file.ok) await readError(file);
      const blob = await file.blob();
      const out = { id: job.id, videoUrl: URL.createObjectURL(blob), blob };
      resultCache.set(key, out);
      return out;
    }
  }
  throw new Error("استغرق توليد الفيديو وقتاً أطول من المتوقع — جرّب مرة أخرى");
}

export function legoVideoErrorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("تم الإلغاء")) return "تم إلغاء توليد الفيديو.";
  if (text.startsWith("402")) return "رصيد الذكاء الاصطناعي غير كافٍ لتوليد الفيديو — اشحن الرصيد أو قلّل المدة/الدقة.";
  if (text.startsWith("429")) return "هناك فيديو آخر قيد التوليد الآن — استنى لحد ما يخلص وجرّب تاني.";
  if (text.startsWith("400")) return "الطلب مرفوض — غيّر الوصف أو الصورة المستخدمة وجرّب تاني.";
  if (text.startsWith("403")) return "موديل الفيديو غير متاح للحساب الحالي حالياً.";
  if (text.startsWith("500")) return "خدمة الفيديو غير مهيأة حالياً.";
  return text.startsWith("5") ? "حصل خطأ في خدمة الفيديو — حاول تاني." : text;
}
