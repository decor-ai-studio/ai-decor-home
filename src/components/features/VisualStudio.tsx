import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Download, Film, Loader2, Play, Pause, Music, Square, Sparkles, Volume2, Scissors } from "lucide-react";
import FeatureShell, { card, btn, input } from "./FeatureShell";
import { DEFAULT_BUILD, BUILD_PATTERNS, buildBricks, type BuildPattern, drawBuildFrame, type BuildOptions } from "@/lib/video/legoBuild";
import claddingA from "@/assets/materials-cladding-a.jpg";
import claddingB from "@/assets/materials-cladding-b.jpg";
import signageA from "@/assets/materials-signage-a.jpg";
import signageB from "@/assets/materials-signage-b.jpg";
import { MUSIC_TRACKS, previewTrack, scheduleTrack, type MusicTrack } from "@/lib/video/music";

type Frame = { url: string; time: number; score: number };

// Sharpness (edge energy) + brightness balance → frame quality score.
function scoreCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let edges = 0,
    lum = 0;
  for (let y = 1; y < h; y += 2)
    for (let x = 1; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const l = 0.3 * d[i]! + 0.59 * d[i + 1]! + 0.11 * d[i + 2]!;
      const li = (y * w + x - 1) * 4;
      const lu = ((y - 1) * w + x) * 4;
      edges += Math.abs(l - d[li]!) + Math.abs(l - d[lu]!);
      lum += l;
    }
  const n = (w * h) / 4;
  const bright = 1 - Math.abs(lum / n - 128) / 128;
  return (edges / n / 40) * 0.7 + bright * 0.3;
}

const MATERIALS = [
  { id: "cladding-a", name: "كلادنج ١", src: claddingA },
  { id: "cladding-b", name: "كلادنج ٢", src: claddingB },
  { id: "signage-a", name: "لافتات ١", src: signageA },
  { id: "signage-b", name: "لافتات ٢", src: signageB },
];

/** Load a user file and downscale it so custom textures/logos stay light in memory. */
async function fileToCanvas(file: File, maxDim: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    await new Promise((res, rej) => {
      im.onload = res;
      im.onerror = rej;
      im.src = url;
    });
    const k = Math.min(1, maxDim / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(im.naturalWidth * k));
    c.height = Math.max(1, Math.round(im.naturalHeight * k));
    c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const ASPECTS = {
  "16:9": { w: 1280, h: 720, name: "أفقي 16:9 (يوتيوب)" },
  "9:16": { w: 720, h: 1280, name: "طولي 9:16 (ريلز / ستوري)" },
  "1:1": { w: 1080, h: 1080, name: "مربع 1:1 (انستجرام)" },
} as const;
type AspectKey = keyof typeof ASPECTS;

export default function VisualStudio({ onBack }: { onBack: () => void }) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Frame | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  const [duration, setDuration] = useState(10);
  const [testFrom, setTestFrom] = useState(0);
  const [testTo, setTestTo] = useState(10);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [opts, setOpts] = useState<BuildOptions>(DEFAULT_BUILD);
  const [aspect, setAspect] = useState<AspectKey>("16:9");
  const W = ASPECTS[aspect].w;
  const H = ASPECTS[aspect].h;
  const [materialId, setMaterialId] = useState<string>("none");
  const [customMat, setCustomMat] = useState<HTMLCanvasElement | null>(null);
  // load the chosen material once; presets are bundled with the app, custom ones stay in the browser
  useEffect(() => {
    if (materialId === "custom") {
      setOpts((o) => ({ ...o, material: customMat }));
      return;
    }
    const m = MATERIALS.find((x) => x.id === materialId);
    if (!m) {
      setOpts((o) => ({ ...o, material: null }));
      return;
    }
    const im = new Image();
    im.onload = () => setOpts((o) => ({ ...o, material: im }));
    im.src = m.src;
  }, [materialId, customMat]);

  async function onCustomMaterial(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setCustomMat(await fileToCanvas(file, 1024));
    setMaterialId("custom");
  }
  async function onLogo(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const c = await fileToCanvas(file, 256);
    setOpts((o) => ({ ...o, logo: c }));
  }
  const [trackId, setTrackId] = useState<MusicTrack["id"] | "none">("corporate");
  const [volume, setVolume] = useState(0.65);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [pattern, setPattern] = useState<BuildPattern>("bottom-up");
  const [ai, setAi] = useState<null | { subject: string; reason: string; steps: string[]; pattern: BuildPattern }>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const musicLen = Math.max(0, duration - trimEnd);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const stopPreview = useRef<(() => void) | null>(null);

  const [recording, setRecording] = useState(false);
  const [recProgress, setRecProgress] = useState(0);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const exportRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);

  // grid rows follow the photo's aspect ratio so every brick has a slice
  const rows = useMemo(() => {
    if (!img) return Math.round(opts.cols * 0.62);
    return Math.max(3, Math.round((opts.cols * img.naturalHeight) / img.naturalWidth));
  }, [img, opts.cols]);
  const bricks = useMemo(() => buildBricks(opts.cols, rows, pattern), [opts.cols, rows, pattern]);
  const gridOpts = useMemo(() => ({ ...opts, rows }), [opts, rows]);

  // keep the test window inside the clip length
  useEffect(() => {
    setTestTo((v) => Math.min(duration, Math.max(1, v)));
    setTestFrom((v) => Math.min(duration - 1, Math.max(0, v)));
    setPlayhead((v) => Math.min(duration, v));
    setTrimEnd((v) => Math.min(v, duration - 1));
  }, [duration]);

  async function analyzeWithAI() {
    if (!img) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const c = document.createElement("canvas");
      const sc = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.round(img.naturalWidth * sc);
      c.height = Math.round(img.naturalHeight * sc);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const res = await fetch("/api/build-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: c.toDataURL("image/jpeg", 0.7) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّر التحليل");
      setAi(data);
      setPattern(data.pattern);
      setDuration(data.duration);
      setTrackId(data.trackId);
      if (typeof data.materialId === "string") setMaterialId(data.materialId);
      setOpts((o) => ({ ...o, cols: data.cols, caption: data.caption || o.caption }));
      setPlayhead(0);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "تعذّر التحليل");
    } finally {
      setAiBusy(false);
    }
  }

  const render = useCallback(
    (t: number) => {
      const c = previewRef.current;
      if (!c || !img) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      drawBuildFrame(ctx, img, bricks, t, duration, gridOpts);
    },
    [img, bricks, duration, gridOpts],
  );

  useEffect(() => {
    render(playhead);
  }, [render, playhead, aspect]);

  // play only the selected test window, looping
  useEffect(() => {
    if (!playing || !img) return;
    const from = Math.min(testFrom, testTo);
    const to = Math.max(testFrom + 0.5, testTo);
    let t0 = performance.now() - (playhead >= from && playhead <= to ? (playhead - from) * 1000 : 0);
    const loop = (now: number) => {
      const t = from + (now - t0) / 1000;
      if (t >= to) {
        t0 = now;
        setPlayhead(from);
      } else setPlayhead(t);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, testFrom, testTo, img]);

  async function loadImage(url: string) {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    await image.decode();
    setImg(image);
    setPlayhead(0);
  }

  async function handleFile(file: File) {
    setBusy(true);
    setFrames([]);
    setPlaying(false);
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("image/")) {
      const f = { url, time: 0, score: 1 };
      setFrames([f]);
      setSelected(f);
      await loadImage(url);
      setBusy(false);
      return;
    }
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    await new Promise((r) => (v.onloadedmetadata = r));
    const c = document.createElement("canvas");
    const scale = 640 / Math.max(v.videoWidth, v.videoHeight);
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const out: Frame[] = [];
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      v.currentTime = (v.duration * (i + 0.5)) / steps;
      await new Promise((r) => (v.onseeked = r));
      ctx.drawImage(v, 0, 0, c.width, c.height);
      out.push({
        url: c.toDataURL("image/jpeg", 0.85),
        time: v.currentTime,
        score: scoreCanvas(ctx, c.width, c.height),
      });
    }
    out.sort((a, b) => b.score - a.score);
    const best = out.slice(0, 6);
    setFrames(best);
    setSelected(best[0] ?? null);
    if (best[0]) await loadImage(best[0].url);
    setBusy(false);
  }

  function playMusicPreview(track: MusicTrack) {
    stopPreview.current?.();
    if (previewing === track.id) {
      setPreviewing(null);
      return;
    }
    stopPreview.current = previewTrack(track, 6, volume, trimStart);
    setPreviewing(track.id);
    setTimeout(() => setPreviewing((p) => (p === track.id ? null : p)), 6200);
  }

  useEffect(() => () => stopPreview.current?.(), []);

  async function exportVideo() {
    const canvas = exportRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d")!;
    setPlaying(false);
    setRecording(true);
    setRecProgress(0);

    const stream = canvas.captureStream(30);
    let audioCtx: AudioContext | null = null;
    const track = MUSIC_TRACKS.find((t) => t.id === trackId);
    if (track) {
      audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      scheduleTrack(audioCtx, dest, track, musicLen, audioCtx.currentTime + 0.1, volume, trimStart);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }

    // MP4 plays everywhere (WhatsApp, iPhone); fall back to WebM where the browser can't record MP4
    const mime =
      ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      ) ?? "video/webm";
    const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type: mime.split(";")[0]! }));
      a.download = `facade-lego-build-${duration}s.${ext}`;
      a.click();
      audioCtx?.close().catch(() => {});
      setRecording(false);
      setRecProgress(1);
    };
    rec.start();

    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      drawBuildFrame(ctx, img, bricks, Math.min(t, duration), duration, gridOpts);
      setRecProgress(Math.min(1, t / duration));
      if (t < duration) requestAnimationFrame(draw);
      else rec.stop();
    };
    requestAnimationFrame(draw);
  }

  // Keep the quick-jump row readable at any length: show ~20 evenly spaced marks max.
  const secondsStep = Math.max(1, Math.ceil((Math.floor(duration) + 1) / 20));
  const seconds = Array.from(
    { length: Math.floor((Math.floor(duration)) / secondsStep) + 1 },
    (_, i) => i * secondsStep,
  );

  return (
    <FeatureShell
      title="استوديو فيديو التركيب (نمط الليجو)"
      subtitle="صورة الواجهة تتركب قطعة قطعة · اختبار ثانية بثانية · موسيقى مختارة"
      onBack={onBack}
    >
      <label className={`${card} flex flex-col items-center gap-3 cursor-pointer border-dashed hover:border-emerald-500/60`}>
        {busy ? <Loader2 className="w-8 h-8 animate-spin text-emerald-400" /> : <Upload className="w-8 h-8 text-emerald-400" />}
        <span className="font-bold">{busy ? "جاري تحليل الصور..." : "ارفع صورة الواجهة (أو فيديو)"}</span>
        <span className="text-xs text-slate-400">من الفيديو نختار تلقائياً أوضح 6 لقطات، ثم نحوّل اللقطة إلى فيديو تركيب</span>
        <input
          type="file"
          accept="video/*,image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </label>

      {frames.length > 1 && (
        <div className={card}>
          <h2 className="font-bold mb-3">أفضل اللقطات</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {frames.map((f, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelected(f);
                  loadImage(f.url);
                }}
                className={`relative rounded-lg overflow-hidden border-2 ${selected === f ? "border-emerald-400" : "border-transparent"}`}
              >
                <img src={f.url} alt={`لقطة ${i + 1}`} className="w-full aspect-video object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] py-0.5">
                  {Math.round(f.score * 100)}٪ · {f.time.toFixed(1)}ث
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {img && (
        <>
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> تسلسل تركيب مقترح بالذكاء الاصطناعي
              </h2>
              <button onClick={analyzeWithAI} disabled={aiBusy} className={`${btn} flex items-center gap-2`}>
                {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiBusy ? "جاري تحليل الصورة..." : "حلّل الصورة واقترح التسلسل"}
              </button>
            </div>
            {aiError && <p className="text-sm text-red-400 mt-3">{aiError}</p>}
            {ai && (
              <div className="mt-4 space-y-2 text-sm">
                <p><span className="text-slate-400">المحتوى: </span>{ai.subject}</p>
                <p><span className="text-slate-400">التسلسل: </span>{BUILD_PATTERNS.find((p) => p.id === ai.pattern)?.name} — {ai.reason}</p>
                <ol className="list-decimal pr-5 text-slate-300 space-y-1">
                  {ai.steps.map((st, i) => <li key={i}>{st}</li>)}
                </ol>
                <p className="text-[11px] text-slate-500">طُبّقت الاقتراحات (التسلسل، الطول، حجم القطع، النص، الموسيقى) ويمكنك تعديلها.</p>
              </div>
            )}
            <label className="block text-xs text-slate-400 mt-4 mb-1">ترتيب التركيب</label>
            <div className="flex flex-wrap gap-1">
              {BUILD_PATTERNS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPattern(p.id); setPlayhead(0); }}
                  className={`px-2 py-1 rounded-lg text-xs border ${pattern === p.id ? "border-emerald-400 bg-emerald-500/15" : "border-slate-700 bg-slate-950"}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className={card}>
            <h2 className="font-bold mb-3">المعاينة الحية</h2>
            <canvas ref={previewRef} width={W} height={H} className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-950" />
            <canvas ref={exportRef} width={W} height={H} className="hidden" />

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center"
                aria-label={playing ? "إيقاف" : "تشغيل"}
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.04}
                value={playhead}
                onChange={(e) => {
                  setPlaying(false);
                  setPlayhead(+e.target.value);
                }}
                className="flex-1"
              />
              <span className="text-xs tabular-nums text-slate-300 w-20 text-center">
                {playhead.toFixed(1)} / {duration}ث
              </span>
            </div>

            <div className="flex flex-wrap gap-1 mt-3">
              {seconds.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setPlaying(false);
                    setPlayhead(s);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] border ${
                    Math.floor(playhead) === s ? "border-emerald-400 bg-emerald-500/15" : "border-slate-700 bg-slate-950"
                  }`}
                >
                  {s}ث
                </button>
              ))}
            </div>
          </div>

          <div className={card}>
            <h2 className="font-bold mb-3">التوقيت والاختبار</h2>
            <label className="block text-xs text-slate-400 mb-1">طول الفيديو: {duration} ثانية</label>
            <input
              type="range"
              min={4}
              max={90}
              step={1}
              value={duration}
              onChange={(e) => setDuration(+e.target.value)}
              className="w-full"
            />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">اختبار من الثانية</label>
                <input
                  className={input}
                  type="number"
                  min={0}
                  max={duration - 1}
                  value={testFrom}
                  onChange={(e) => setTestFrom(Math.max(0, Math.min(duration - 1, +e.target.value)))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">إلى الثانية</label>
                <input
                  className={input}
                  type="number"
                  min={1}
                  max={duration}
                  value={testTo}
                  onChange={(e) => setTestTo(Math.max(1, Math.min(duration, +e.target.value)))}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              زر التشغيل يعيد تشغيل المقطع المحدد فقط، لتفحص مرحلة تركيب معينة بدقة.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">حجم قطع الليجو: {opts.cols} عمود</label>
                <input
                  type="range"
                  min={6}
                  max={28}
                  value={opts.cols}
                  onChange={(e) => setOpts({ ...opts, cols: +e.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">النص على الفيديو</label>
                <input className={input} value={opts.caption} onChange={(e) => setOpts({ ...opts, caption: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">مقاس الفيديو</label>
                <select className={input} value={aspect} onChange={(e) => setAspect(e.target.value as AspectKey)}>
                  {(Object.keys(ASPECTS) as AspectKey[]).map((k) => (
                    <option key={k} value={k}>{ASPECTS[k].name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">اسم المحل (شريط ختامي)</label>
                <input className={input} value={opts.brand ?? ""} onChange={(e) => setOpts({ ...opts, brand: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">شعار المحل (اختياري، يظهر في الشريط الختامي)</label>
                <input type="file" accept="image/*" className="text-xs" onChange={(e) => onLogo(e.target.files?.[0])} />
                {opts.logo && (
                  <button className="text-xs text-rose-400 mr-3" onClick={() => setOpts({ ...opts, logo: null })}>إزالة الشعار</button>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">رقم الهاتف / واتساب (اختياري)</label>
                <input className={input} dir="ltr" value={opts.phone ?? ""} onChange={(e) => setOpts({ ...opts, phone: e.target.value })} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-slate-400 mb-1">دمج خامة حقيقية على القطع</label>
              <select className={input} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                <option value="none">بدون خامة</option>
                {MATERIALS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                {customMat && <option value="custom">خامتي المرفوعة</option>}
              </select>
              <label className="mt-2 inline-block text-xs text-emerald-400 cursor-pointer">
                + ارفع صورة خامة من عندك (كلادنج، رخام، خشب…)
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onCustomMaterial(e.target.files?.[0])} />
              </label>
              {materialId !== "none" && (
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={Math.round((opts.materialMix ?? 0.45) * 100)}
                  onChange={(e) => setOpts({ ...opts, materialMix: +e.target.value / 100 })}
                  className="w-full mt-2"
                />
              )}
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input type="checkbox" checked={!!opts.shine} onChange={(e) => setOpts({ ...opts, shine: e.target.checked })} />
              لمعان معدني وإضاءة متحركة
            </label>
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={!!(opts.camera && opts.ghost && opts.sparks)}
                onChange={(e) => setOpts({ ...opts, camera: e.target.checked, ghost: e.target.checked, sparks: e.target.checked })}
              />
              مؤثرات سينمائية (حركة كاميرا + مخطط شبحي + شرارات عند التثبيت)
            </label>
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input type="checkbox" checked={!!opts.seamless} onChange={(e) => setOpts({ ...opts, seamless: e.target.checked })} />
              إنهاء بدون فواصل (الجدار يتحول لصورة الواجهة النهائية النظيفة)
            </label>
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input type="checkbox" checked={opts.studs} onChange={(e) => setOpts({ ...opts, studs: e.target.checked })} />
              إظهار نتوءات الليجو أعلى القطع
            </label>
          </div>

          <div className={card}>
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <Music className="w-4 h-4 text-emerald-400" /> الموسيقى الخلفية
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {[...MUSIC_TRACKS].map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${
                    trackId === t.id ? "border-emerald-400 bg-emerald-500/10" : "border-slate-800 bg-slate-950"
                  }`}
                >
                  <button onClick={() => setTrackId(t.id)} className="text-right flex-1">
                    <div className="font-bold text-sm">{t.name}</div>
                    <div className="text-[11px] text-slate-400">{t.mood} · {t.bpm} BPM</div>
                  </button>
                  <button
                    onClick={() => playMusicPreview(t)}
                    className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700"
                    aria-label="تجربة الموسيقى"
                  >
                    {previewing === t.id ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
              ))}
              <button
                onClick={() => setTrackId("none")}
                className={`rounded-xl border p-3 text-right ${
                  trackId === "none" ? "border-emerald-400 bg-emerald-500/10" : "border-slate-800 bg-slate-950"
                }`}
              >
                <div className="font-bold text-sm">بدون موسيقى</div>
                <div className="text-[11px] text-slate-400">تصدير صامت</div>
              </button>
            </div>
          </div>

          {trackId !== "none" && (
            <div className={card}>
              <h2 className="font-bold mb-3 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-emerald-400" /> ضبط الموسيقى قبل التصدير
              </h2>
              <label className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Volume2 className="w-3.5 h-3.5" /> مستوى الصوت: {Math.round(volume * 100)}٪
              </label>
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(+e.target.value)} className="w-full" />
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">قص من بداية الموسيقى: {trimStart.toFixed(1)}ث</label>
                  <input type="range" min={0} max={20} step={0.5} value={trimStart} onChange={(e) => setTrimStart(+e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">إنهاء الموسيقى قبل النهاية بـ: {trimEnd.toFixed(1)}ث</label>
                  <input type="range" min={0} max={duration - 1} step={0.5} value={trimEnd} onChange={(e) => setTrimEnd(+e.target.value)} className="w-full" />
                </div>
              </div>
              <div className="relative h-3 bg-slate-800 rounded-full mt-4 overflow-hidden">
                <div className="absolute inset-y-0 right-0 bg-emerald-500/70" style={{ width: `${(musicLen / duration) * 100}%` }} />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                الموسيقى تبدأ من الثانية {trimStart.toFixed(1)} من المقطوعة وتعمل {musicLen.toFixed(1)}ث من أصل {duration}ث للفيديو. زر المعاينة في بطاقة الموسيقى يطبّق هذه الإعدادات.
              </p>
            </div>
          )}

          <div className={card}>
            <button onClick={exportVideo} disabled={recording} className={`${btn} flex items-center gap-2`}>
              {recording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
              {recording ? `جاري التصدير ${Math.round(recProgress * 100)}٪` : "تصدير فيديو التركيب مع الموسيقى"}
              <Download className="w-4 h-4" />
            </button>
            {recording && (
              <div className="h-2 bg-slate-800 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${recProgress * 100}%` }} />
              </div>
            )}
          </div>
        </>
      )}
    </FeatureShell>
  );
}
