import { ExportDialog } from "@/components/ExportDialog";
import { ZoomableImage } from "@/components/ImageViewer";
import { useRef, useState } from "react";
import {
  ArrowRight,
  Brain,
  Clapperboard,
  Download,
  Film,
  Loader2,
  Sparkles,
  UploadCloud,
  Wand2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  extractKeyframes,
  keyframeFromImage,
  isVideoFile,
  type Keyframe,
} from "@/lib/keyframes";
import { analyzeScene, analysisErrorMessage, type SceneAnalysis } from "@/lib/sceneAnalysis";
import { aiEditImage, aiErrorMessage } from "@/lib/aiImage";
import {
  generateLegoAssemblyVideo,
  legoVideoErrorMessage,
  type LegoVideoStatus,
} from "@/lib/legoVideo";

interface Props {
  onBack: () => void;
}

type Stage = "idle" | "frames" | "analysis" | "design" | "video" | "done";

const STAGE_LABEL: Record<Exclude<Stage, "idle" | "done">, string> = {
  frames: "استخراج أفضل الإطارات من الوسائط…",
  analysis: "تحليل المشهد وقراءة الخامات والإضاءة…",
  design: "بناء التصميم النهائي المخصص…",
  video: "تصيير فيديو التركيب ثلاثي الأبعاد…",
};

const MAX_MEDIA = 100 * 1024 * 1024;

export default function VisionVideoStudio({ onBack }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [exportVideo, setExportVideo] = useState(false);
  const [frames, setFrames] = useState<Keyframe[]>([]);
  const [selected, setSelected] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null);
  const [design, setDesign] = useState<string | null>(null);
  const [effects, setEffects] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progressNote, setProgressNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(8);
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [aspect, setAspect] = useState<"16:9" | "9:16">("16:9");

  const busy = stage !== "idle" && stage !== "done";

  const reset = () => {
    setFrames([]);
    setSelected(0);
    setAnalysis(null);
    setDesign(null);
    setEffects([]);
    setVideoUrl(null);
    setError(null);
    setProgressNote("");
    setStage("idle");
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    reset();
    if (file.size > MAX_MEDIA) {
      setError("حجم الملف أكبر من 100 ميجابايت — استخدم ملف أصغر");
      return;
    }
    setFileName(file.name);
    setStage("frames");
    try {
      if (isVideoFile(file)) {
        const picked = await extractKeyframes(file, {
          samples: 18,
          keep: 4,
          onProgress: (done, total) => setProgressNote(`تحليل الإطار ${done} من ${total}`),
        });
        setFrames(picked);
      } else {
        const url = URL.createObjectURL(file);
        try {
          setFrames([await keyframeFromImage(url)]);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      setStage("idle");
      setProgressNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر قراءة الملف");
      setStage("idle");
    }
  };

  const runPipeline = async () => {
    const frame = frames[selected];
    if (!frame) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setVideoUrl(null);

    try {
      setStage("analysis");
      setProgressNote("");
      const scene = await analyzeScene({
        description: prompt.trim(),
        imageDataUrl: frame.dataUrl,
        signal: controller.signal,
      });
      setAnalysis(scene);

      setStage("design");
      const brief = [
        prompt.trim(),
        scene.summary,
        scene.materials.length ? `خامات المشهد: ${scene.materials.join("، ")}` : "",
        scene.lighting ? `إضاءة: ${scene.lighting}` : "",
      ]
        .filter(Boolean)
        .join(" — ");
      const built = await aiEditImage({
        imageUrl: frame.dataUrl,
        prompt: brief || "حسّن الواجهة وابنِ تصميماً كاملاً واقعياً",
        mode: "business",
        render: scene.render,
        onFrame: (dataUrl) => setDesign(dataUrl),
      });
      setDesign(built.outputDataUrl);
      setEffects(built.appliedEffects);

      setStage("video");
      const result = await generateLegoAssemblyVideo({
        imageDataUrl: built.outputDataUrl,
        brief: prompt.trim(),
        duration,
        resolution,
        aspectRatio: aspect,
        signal: controller.signal,
        onStatus: (status: LegoVideoStatus, progress) =>
          setProgressNote(
            status === "queued"
              ? "المهمة في الطابور…"
              : `جاري التصيير ${progress ? `${progress}%` : ""}`,
          ),
      });
      setVideoUrl(result.videoUrl);
      setStage("done");
      setProgressNote("");
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        stage === "analysis"
          ? analysisErrorMessage(e)
          : stage === "video"
            ? legoVideoErrorMessage(e)
            : raw.includes("no image")
              ? aiErrorMessage(e)
              : legoVideoErrorMessage(e),
      );
      setStage("idle");
    } finally {
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setStage("idle");
    setProgressNote("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white" dir="rtl">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
            <Film className="w-5 h-5" />
          </span>
          <div>
            <h1 className="font-bold">استوديو الذكاء المرئي وفيديو التركيب</h1>
            <p className="text-xs text-slate-400">
              تحليل الصور والفيديوهات · استخراج أفضل الإطارات · تصميم كامل · فيديو تركيب ليجو 3D
            </p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          رجوع
          <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      <main className="px-6 md:px-10 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Left: input + frames */}
        <section className="space-y-6">
          <div
            onClick={() => !busy && inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            className="cursor-pointer border-2 border-dashed border-slate-700 hover:border-fuchsia-500/60 rounded-2xl p-9 text-center transition-colors bg-slate-900/40"
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? undefined)}
            />
            <div className="w-14 h-14 mx-auto rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="mt-3 text-slate-300 font-medium">
              {fileName ?? "ارفع لقطة أو فيديو للمحل أو المبنى"}
            </p>
            <p className="text-xs text-slate-500 mt-1.5">
              MP4 · WebM · MOV · JPG · PNG — حتى 100 ميجابايت
            </p>
          </div>

          {frames.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
                أفضل الإطارات المستخرجة — اختر الإطار الأساسي
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {frames.map((frame, i) => (
                  <button
                    key={`${frame.time}-${i}`}
                    onClick={() => setSelected(i)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                      selected === i
                        ? "border-fuchsia-500 shadow-lg shadow-fuchsia-500/20"
                        : "border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <img src={frame.dataUrl} alt={`إطار ${i + 1}`} className="w-full h-24 object-cover" />
                    <span className="absolute top-1 right-1 text-[10px] bg-black/70 rounded px-1.5 py-0.5">
                      جودة {frame.score}%
                    </span>
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 rounded px-1.5 py-0.5">
                      {frame.time.toFixed(1)}s
                    </span>
                  </button>
                ))}
              </div>
              {frames[selected] && (
                <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-slate-400">
                  <span className="bg-slate-900 border border-slate-800 rounded-full px-2.5 py-1">
                    حِدّة {frames[selected]!.sharpness}%
                  </span>
                  <span className="bg-slate-900 border border-slate-800 rounded-full px-2.5 py-1">
                    تباين {frames[selected]!.contrast}%
                  </span>
                  <span className="bg-slate-900 border border-slate-800 rounded-full px-2.5 py-1">
                    إضاءة {frames[selected]!.exposure}%
                  </span>
                  <span className="bg-slate-900 border border-slate-800 rounded-full px-2.5 py-1">
                    تفاصيل {frames[selected]!.detail}%
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2.5">
            <label className="text-sm font-medium text-slate-300">
              اكتب طلب العميل بالعامية — هنحلله ونبني عليه التصميم والفيديو
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="مثال: كلادنج أسود مطفي مع حروف مضيئة ذهبية باسم «مطعم الأصيل» وإضاءة سبوت"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-fuchsia-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-slate-400 space-y-1.5">
              مدة الفيديو
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
              >
                {[4, 6, 8, 10].map((s) => (
                  <option key={s} value={s}>
                    {s} ثانية
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400 space-y-1.5">
              الدقة
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as "720p" | "1080p")}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </label>
            <label className="text-xs text-slate-400 space-y-1.5">
              الأبعاد
              <select
                value={aspect}
                onChange={(e) => setAspect(e.target.value as "16:9" | "9:16")}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="16:9">أفقي 16:9</option>
                <option value="9:16">رأسي 9:16</option>
              </select>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void runPipeline()}
              disabled={busy || frames.length === 0}
              className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clapperboard className="w-5 h-5" />}
              {busy ? "جاري التنفيذ…" : "حلّل · صمّم · ولّد فيديو التركيب"}
            </button>
            {busy && (
              <button
                onClick={cancel}
                className="px-5 py-3.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-900 transition-colors"
              >
                إلغاء
              </button>
            )}
          </div>

          {busy && (
            <div className="flex items-center gap-2 text-sm text-fuchsia-300 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              {STAGE_LABEL[stage as Exclude<Stage, "idle" | "done">]} {progressNote}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </section>

        {/* Right: analysis, design, video */}
        <section className="space-y-6">
          {analysis && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-400" />
                تحليل المشهد
              </h3>
              {analysis.summary && <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>}
              {analysis.lighting && <p className="text-xs text-slate-400">الإضاءة: {analysis.lighting}</p>}
              {analysis.materials.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {analysis.materials.map((m) => (
                    <span key={m} className="text-[11px] bg-slate-950 border border-slate-800 rounded-full px-2.5 py-1 text-slate-300">
                      {m}
                    </span>
                  ))}
                </div>
              )}
              {analysis.tips.length > 0 && (
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {analysis.tips.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400/70 mt-1.5 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {design && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-emerald-400" />
                التصميم النهائي المبني على الإطار المختار
              </h3>
              <ZoomableImage src={design} alt="التصميم النهائي" className="w-full rounded-xl border border-slate-800" />
              {effects.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {effects.map((e) => (
                    <span key={e} className="text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-full px-2.5 py-1">
                      {e}
                    </span>
                  ))}
                </div>
              )}
              <a
                href={design}
                download="glowtech-design.png"
                className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200"
              >
                <Download className="w-4 h-4" />
                تنزيل التصميم
              </a>
            </div>
          )}

          {videoUrl && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-fuchsia-400" />
                فيديو تركيب الواجهة قطعة بقطعة
              </h3>
              <video src={videoUrl} controls autoPlay loop playsInline className="w-full rounded-xl border border-slate-800 bg-black" />
              <a
                href={videoUrl}
                download="glowtech-assembly.mp4"
                className="inline-flex items-center gap-2 text-sm text-fuchsia-300 hover:text-fuchsia-200"
              >
                <Download className="w-4 h-4" />
                تنزيل الفيديو
              </a>
              <button type="button" onClick={() => setExportVideo(true)} className="ms-4 text-sm text-emerald-300">قوالب التصدير للمنصات</button>
              {exportVideo && <ExportDialog src={videoUrl} kind="video" fileName="glowtech-video" onClose={() => setExportVideo(false)} />}
              <p className="text-[11px] text-slate-500">
                الفيديو متاح داخل هذه الجلسة فقط — نزّله للاحتفاظ به.
              </p>
            </div>
          )}

          {!analysis && !design && !videoUrl && (
            <div className="border border-dashed border-slate-800 rounded-2xl p-10 text-center text-sm text-slate-500">
              ارفع لقطة أو فيديو، اختر أفضل إطار، واكتب طلبك — وهنا هتظهر نتائج التحليل والتصميم وفيديو التركيب.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
