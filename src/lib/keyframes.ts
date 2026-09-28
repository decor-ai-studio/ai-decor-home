// Client-side keyframe extraction + quality scoring for uploaded photos and videos.
// Samples frames across the clip, scores each one (sharpness, contrast, exposure,
// detail density) and returns the best candidates for the design pipeline.

export interface Keyframe {
  /** PNG data URL of the extracted frame. */
  dataUrl: string;
  /** Position in the source clip, in seconds (0 for a still photo). */
  time: number;
  /** Overall quality score, 0..100. */
  score: number;
  sharpness: number;
  contrast: number;
  exposure: number;
  detail: number;
}

const MAX_DIM = 1536;

function fit(w: number, h: number, max = MAX_DIM) {
  if (w <= max && h <= max) return { w, h };
  const scale = max / Math.max(w, h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas unavailable");
  return { canvas, ctx };
}

/** Grade a frame already drawn on a canvas using a small luminance analysis pass. */
function grade(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sw = Math.max(32, Math.min(320, width));
  const sh = Math.max(32, Math.round((height / width) * sw));
  const small = canvasOf(sw, sh);
  small.ctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const { data } = small.ctx.getImageData(0, 0, sw, sh);

  const lum = new Float32Array(sw * sh);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const value =
      0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
    lum[p] = value;
    sum += value;
  }
  const mean = sum / lum.length;

  let variance = 0;
  let lapSum = 0;
  let lapSq = 0;
  let edges = 0;
  let lapCount = 0;
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      const center = lum[i] ?? 0;
      variance += (center - mean) ** 2;
      const lap =
        4 * center -
        (lum[i - 1] ?? 0) -
        (lum[i + 1] ?? 0) -
        (lum[i - sw] ?? 0) -
        (lum[i + sw] ?? 0);
      lapSum += lap;
      lapSq += lap * lap;
      lapCount++;
      if (Math.abs(lap) > 18) edges++;
    }
  }
  variance /= lum.length;
  const lapMean = lapCount ? lapSum / lapCount : 0;
  const lapVar = lapCount ? lapSq / lapCount - lapMean * lapMean : 0;

  const sharpness = Math.round(Math.min(100, Math.sqrt(Math.max(0, lapVar)) * 6));
  const contrast = Math.round(Math.min(100, (Math.sqrt(variance) / 64) * 100));
  // Best exposure sits around mid grey; punish crushed blacks and blown highlights.
  const exposure = Math.round(Math.max(0, 100 - (Math.abs(mean - 122) / 122) * 140));
  const detail = Math.round(Math.min(100, (edges / Math.max(1, lapCount)) * 320));
  const score = Math.round(sharpness * 0.44 + detail * 0.22 + contrast * 0.19 + exposure * 0.15);
  return { sharpness, contrast, exposure, detail, score: Math.max(0, Math.min(100, score)) };
}

/** Grade + normalise a still photo so it flows through the same pipeline as video frames. */
export async function keyframeFromImage(src: string): Promise<Keyframe> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("تعذّر قراءة الصورة"));
    el.src = src;
  });
  const size = fit(img.naturalWidth, img.naturalHeight);
  const { canvas, ctx } = canvasOf(size.w, size.h);
  ctx.drawImage(img, 0, 0, size.w, size.h);
  return { dataUrl: canvas.toDataURL("image/png"), time: 0, ...grade(ctx, size.w, size.h) };
}

export interface ExtractOptions {
  /** How many frames to sample across the clip. */
  samples?: number;
  /** How many of the best frames to keep. */
  keep?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("تعذّر قراءة الفيديو"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

/** Extract and rank the best keyframes from a video file. */
export async function extractKeyframes(file: File, opts: ExtractOptions = {}): Promise<Keyframe[]> {
  const samples = Math.max(4, Math.min(40, opts.samples ?? 18));
  const keep = Math.max(1, Math.min(samples, opts.keep ?? 4));
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => resolve();
      video.addEventListener("loadeddata", onReady, { once: true });
      video.addEventListener("error", () => reject(new Error("صيغة الفيديو غير مدعومة")), {
        once: true,
      });
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const size = fit(video.videoWidth || 1280, video.videoHeight || 720);
    const { canvas, ctx } = canvasOf(size.w, size.h);
    const frames: Keyframe[] = [];

    for (let i = 0; i < samples; i++) {
      if (opts.signal?.aborted) throw new Error("تم الإلغاء");
      const time = duration ? ((i + 0.5) / samples) * duration : 0;
      await seek(video, time);
      ctx.drawImage(video, 0, 0, size.w, size.h);
      const metrics = grade(ctx, size.w, size.h);
      frames.push({ dataUrl: canvas.toDataURL("image/png"), time, ...metrics });
      opts.onProgress?.(i + 1, samples);
      if (!duration) break;
    }

    // Keep the best frames, spread across the clip so they are not near-duplicates.
    const minGap = duration ? duration / (keep * 2.5) : 0;
    const ranked = [...frames].sort((a, b) => b.score - a.score);
    const picked: Keyframe[] = [];
    for (const frame of ranked) {
      if (picked.length >= keep) break;
      if (picked.some((p) => Math.abs(p.time - frame.time) < minGap)) continue;
      picked.push(frame);
    }
    for (const frame of ranked) {
      if (picked.length >= keep) break;
      if (!picked.includes(frame)) picked.push(frame);
    }
    return picked.sort((a, b) => b.score - a.score);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export const isVideoFile = (file: File) =>
  file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
