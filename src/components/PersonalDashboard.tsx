import { ZoomableImage } from "@/components/ImageViewer";
import { ArrowRight, Sofa, Home, Sparkles, Check, Loader2, Wand2, RefreshCw, Heart, Paintbrush, AlertCircle } from "lucide-react";
import { useRef, useState } from "react";
import UploadZone from "./UploadZone";
import MaskCanvas, { type MaskCanvasHandle } from "./MaskCanvas";
import { aiEditImage, aiErrorMessage, type AiEditResult } from "@/lib/aiImage";
import MaterialLibrary from "./MaterialLibrary";
import RenderControls from "./RenderControls";
import RenderStudio from "./RenderStudio";
import { DEFAULT_RENDER, type RenderSettings } from "@/lib/renderEngine";

interface PersonalDashboardProps {
  onBack: () => void;
}

const STYLES = [
  { name: "مودرن", emoji: "◐", hint: "بسيط وأنيق" },
  { name: "كلاسيك", emoji: "✦", hint: "فخم وتقليدي" },
  { name: "بوهمي", emoji: "✿", hint: "ألوان دافئة" },
  { name: "إسكندنافي", emoji: "◇", hint: "خفيف ومريح" },
];

const SUGGESTIONS = [
  { label: "غرفة المعيشة", icon: Sofa },
  { label: "المطبخ", icon: Home },
  { label: "غرفة النوم", icon: Sparkles },
];

export default function PersonalDashboard({ onBack }: PersonalDashboardProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AiEditResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showMask, setShowMask] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [render, setRender] = useState<RenderSettings>(DEFAULT_RENDER);
  const maskRef = useRef<MaskCanvasHandle>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    if (!imageUrl) {
      setError("ارفع صورة الغرفة الأول");
      return;
    }
    setError(null);
    setGenerating(true);
    setResult(null);
    setPreview(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const maskDataUrl = hasMask ? maskRef.current?.getMaskDataUrl() ?? null : null;
      const res = await aiEditImage({
        imageUrl,
        prompt,
        mode: "personal",
        render,
        maskDataUrl,
        style: selectedStyle,
        signal: controller.signal,
        onFrame: (dataUrl) => setPreview(dataUrl),
      });
      setResult(res);
      setShowMask(false);
    } catch (err) {
      if (!controller.signal.aborted) setError(aiErrorMessage(err));
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-sm text-slate-400 hover:text-white flex items-center gap-2 bg-slate-800/60 px-4 py-2 rounded-lg border border-slate-700/60 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-sm font-medium text-amber-400">تجديد المنازل</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center gap-4 animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sofa className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">جدّد غرف بيتك بنقرة واحدة</h2>
            <p className="text-slate-400 text-sm mt-1">ارفع صورة الغرفة واكتب اللي عايزه — هنطبق التعديلات على الصورة فوراً</p>
          </div>
        </div>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-3 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
          {SUGGESTIONS.map((sg) => {
            const Icon = sg.icon;
            return (
              <button
                key={sg.label}
                onClick={() => setPrompt(sg.label)}
                className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-4 py-2.5 rounded-xl text-sm text-slate-300 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
              >
                <Icon className="w-4 h-4" />
                {sg.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-xl animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <UploadZone
              accent="amber"
              prompt={prompt}
              setPrompt={setPrompt}
              onGenerate={handleGenerate}
              generating={generating}
              promptPlaceholder="مثال: عايز غرفة المعيشة تكون مودرن بألوان دافئة"
              generateLabel="جدّد الآن"
              imageUrl={imageUrl ?? undefined}
              onImageChange={(url) => {
                setImageUrl(url);
                setShowMask(false);
                setResult(null);
                setError(null);
              }}
            />

            {/* Style picker */}
            <div className="mt-6">
              <p className="text-xs text-slate-500 mb-2.5">اختر ستايل التجديد:</p>
              <div className="grid grid-cols-2 gap-3">
                {STYLES.map((style) => (
                  <button
                    key={style.name}
                    onClick={() => setSelectedStyle(style.name)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-right ${selectedStyle === style.name ? "bg-amber-500/10 border-amber-500/40 text-amber-400" : "bg-slate-950/60 border-slate-800/60 text-slate-300 hover:border-slate-600"}`}
                  >
                    <span className="text-xl">{style.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{style.name}</p>
                      <p className="text-xs text-slate-500">{style.hint}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Result + Mask */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-xl animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            {/* Mask toggle */}
            {imageUrl && !generating && (
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800/60">
                <button
                  onClick={() => setShowMask(!showMask)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                    showMask
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-amber-400 hover:border-amber-500/30"
                  }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  {showMask ? "إخفاء أداة التحديد" : "حدد جزء للتعديل"}
                </button>
                {hasMask && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full animate-fade-in">
                    <Check className="w-3.5 h-3.5" />
                    منطقة محددة
                  </span>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {showMask && imageUrl ? (
              <MaskCanvas ref={maskRef} imageUrl={imageUrl} accent="amber" onMaskChange={setHasMask} />
            ) : generating ? (
              <div className="flex flex-col items-center justify-center h-full py-10 gap-4">
                {preview ? (
                  <div className="w-full rounded-2xl overflow-hidden border border-amber-500/30 bg-slate-950">
                    <img
                      src={preview}
                      alt="معاينة أثناء التوليد"
                      className="w-full object-contain blur-2xl transition-[filter] duration-500"
                    />
                  </div>
                ) : null}
                <div className="relative">
                  <Wand2 className="w-12 h-12 text-amber-400 animate-bounce-subtle" />
                  <div className="absolute -inset-3 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                </div>
                <p className="text-slate-400 text-sm text-center">
                  {hasMask ? "جاري تجديد الجزء المحدد بالذكاء الاصطناعي..." : "جاري تجديد غرفتك بجودة عالية..."}
                </p>
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="text-xs px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  إيقاف التوليد
                </button>
              </div>
            ) : result ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">قبل وبعد</h3>
                  <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                    <Check className="w-3.5 h-3.5" /> تم التجديد
                  </span>
                </div>

                {/* Real before/after */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500">قبل</span>
                    <div className="rounded-2xl overflow-hidden border border-slate-700/60">
                      <ZoomableImage src={imageUrl!} alt="قبل" editMode="personal" onSave={setImageUrl} className="w-full h-48 object-cover" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      بعد <Sparkles className="w-3 h-3" />
                    </span>
                    <div className="rounded-2xl overflow-hidden border border-amber-500/30 animate-pulse-glow">
                      <ZoomableImage
                        src={result.outputDataUrl}
                        alt="بعد"
                        editMode="personal"
                        onSave={(outputDataUrl) => setResult((previous) => previous ? { ...previous, outputDataUrl } : previous)}
                        className="w-full h-48 object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* Applied effects */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">التعديلات اللي اتعملت:</p>
                  <div className="flex flex-wrap gap-2">
                    {result.appliedEffects.map((eff) => (
                      <span key={eff} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                        {eff}
                      </span>
                    ))}
                    {result.regionMode && (
                      <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg">
                        تعديل جزئي (منطقة محددة)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href={result.outputDataUrl}
                    download="home-output.jpg"
                    className="flex-1 bg-amber-600 hover:bg-amber-500 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    جرّب تصميم تاني
                  </a>
                  <button
                    onClick={handleGenerate}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 rounded-xl transition-colors"
                  >
                    <Heart className="w-4 h-4 text-slate-300" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-600">
                  {imageUrl ? <Wand2 className="w-8 h-8" /> : <Sofa className="w-8 h-8" />}
                </div>
                <p className="text-slate-500 text-sm max-w-xs">
                  {imageUrl
                    ? "حدد جزء من الصورة للتعديل عليه، أو اكتب طلبك واضغط جدد الآن"
                    : "ارفع صورة الغرفة، اختار ستايل، وقولنا عايز إيه — هنطبق التعديلات على الصورة فوراً"}
                </p>
              </div>
            )}
          </div>
        </div>
        <RenderControls value={render} onChange={setRender} accent="amber" />
        {result && imageUrl && (
          <RenderStudio sourceUrl={imageUrl} renderUrl={result.outputDataUrl} accent="amber" />
        )}
        <MaterialLibrary accent="amber" onSelect={setPrompt} />
      </div>
    </div>
  );
}
