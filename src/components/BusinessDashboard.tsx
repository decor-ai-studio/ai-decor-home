import { ZoomableImage } from "@/components/ImageViewer";
import { ArrowRight, Calculator, FileText, Lightbulb, Download, Check, Loader2, Paintbrush, Wand2, AlertCircle, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import UploadZone from "./UploadZone";
import MaskCanvas, { type MaskCanvasHandle } from "./MaskCanvas";
import { aiEditImage, aiErrorMessage, type AiEditResult } from "@/lib/aiImage";
import MaterialLibrary from "./MaterialLibrary";
import RenderControls from "./RenderControls";
import RenderStudio from "./RenderStudio";
import { DEFAULT_RENDER, type RenderSettings } from "@/lib/renderEngine";

interface BusinessDashboardProps {
  onBack: () => void;
}

interface CostItem {
  label: string;
  qty: string;
  unit: string;
  cost: number;
}

const COST_ITEMS: CostItem[] = [
  { label: "كلادنج ألومنيوم أسود", qty: "24", unit: "م²", cost: 7200 },
  { label: "حروف نيون LED مضيئة", qty: "8", unit: "حرف", cost: 3200 },
  { label: "إضاءة خارجية LED", qty: "12", unit: "وحدة", cost: 1800 },
  { label: "تركيب وتشطيب", qty: "1", unit: "حصة", cost: 2500 },
];

export default function BusinessDashboard({ onBack }: BusinessDashboardProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AiEditResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showMask, setShowMask] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [render, setRender] = useState<RenderSettings>(DEFAULT_RENDER);
  const maskRef = useRef<MaskCanvasHandle>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    if (!imageUrl) {
      setError("ارفع صورة الواجهة الأول");
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
        mode: "business",
        render,
        maskDataUrl,
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

  const total = COST_ITEMS.reduce((sum, i) => sum + i.cost, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-sm text-slate-400 hover:text-white flex items-center gap-2 bg-slate-800/60 px-4 py-2 rounded-lg border border-slate-700/60 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">لوحة الشركات والمقاولين</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center gap-4 animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Lightbulb className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">تصميم واجهات المحلات وحساب التكاليف</h2>
            <p className="text-slate-400 text-sm mt-1">ارفع صورة الواجهة واكتب طلبك بالعامية — هنطبق التعديلات على الصورة فوراً</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Input */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-xl animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <UploadZone
              accent="emerald"
              prompt={prompt}
              setPrompt={setPrompt}
              onGenerate={handleGenerate}
              generating={generating}
              promptPlaceholder="مثال: عايز كلادنج أسود وحروف مضيئة نيون اسم المحل «النخبة»"
              generateLabel="توليد التصميم"
              imageUrl={imageUrl ?? undefined}
              onImageChange={(url) => {
                setImageUrl(url);
                setShowMask(false);
                setResult(null);
                setError(null);
              }}
            />

            {/* Quick presets */}
            <div className="mt-6">
              <p className="text-xs text-slate-500 mb-2.5">قوالب جاهزة:</p>
              <div className="flex flex-wrap gap-2">
                {["كلادنج أسود فاخر", "حروف نيون ذهبية", "واجهة زجاجية حديثة", "إضاءة ديكورية", "واجهة معدنية"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPrompt(p)}
                    className="text-xs bg-slate-800/60 border border-slate-700/60 px-3 py-1.5 rounded-lg text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Result + Mask */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-xl animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            {/* Mask mode toggle */}
            {imageUrl && !generating && (
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800/60">
                <button
                  onClick={() => setShowMask(!showMask)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                    showMask
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-emerald-400 hover:border-emerald-500/30"
                  }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  {showMask ? "إخفاء أداة التحديد" : "تحديد منطقة للتعديل"}
                </button>
                {hasMask && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full animate-fade-in">
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
              <MaskCanvas ref={maskRef} imageUrl={imageUrl} accent="emerald" onMaskChange={setHasMask} />
            ) : generating ? (
              <div className="flex flex-col items-center justify-center h-full py-10 gap-4">
                {preview ? (
                  <div className="w-full rounded-2xl overflow-hidden border border-emerald-500/30 bg-slate-950">
                    <img
                      src={preview}
                      alt="معاينة أثناء التوليد"
                      className="w-full object-contain blur-2xl transition-[filter] duration-500"
                    />
                  </div>
                ) : null}
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                <p className="text-slate-400 text-sm text-center">
                  {hasMask ? "جاري تعديل المنطقة المحددة بالذكاء الاصطناعي..." : "جاري توليد الواجهة بجودة عالية..."}
                </p>
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="text-xs px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                >
                  إيقاف التوليد
                </button>
              </div>
            ) : result ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">التصميم والتكلفة التقديرية</h3>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    <Check className="w-3.5 h-3.5" /> جاهز
                  </span>
                </div>

                {/* Before / After images */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <span className="text-xs text-slate-500">الصورة الأصلية</span>
                    <div className="rounded-2xl overflow-hidden border border-slate-700/60">
                      <ZoomableImage src={imageUrl!} alt="الأصلية" editMode="business" onSave={setImageUrl} className="w-full h-40 object-cover" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      بعد التعديل <Sparkles className="w-3 h-3" />
                    </span>
                    <div className="rounded-2xl overflow-hidden border border-emerald-500/30 animate-pulse-glow">
                      <ZoomableImage
                        src={result.outputDataUrl}
                        alt="النتيجة"
                        editMode="business"
                        onSave={(outputDataUrl) => setResult((previous) => previous ? { ...previous, outputDataUrl } : previous)}
                        className="w-full h-40 object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* Applied effects */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">التعديلات المطبقة:</p>
                  <div className="flex flex-wrap gap-2">
                    {result.appliedEffects.map((eff) => (
                      <span key={eff} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
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

                {/* Cost breakdown */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
                    <Calculator className="w-4 h-4 text-emerald-400" />
                    تفصيل التكاليف التقديري
                  </div>
                  {COST_ITEMS.map((item) => (
                    <div key={item.label} className="flex items-center justify-between bg-slate-950/60 rounded-xl px-4 py-3 border border-slate-800/60">
                      <div>
                        <p className="text-sm text-slate-200">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.qty} {item.unit}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-300">{item.cost.toLocaleString()} ج.م</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="font-bold">الإجمالي التقديري</span>
                    <span className="text-xl font-bold text-emerald-400">{total.toLocaleString()} ج.م</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href={result.outputDataUrl}
                    download="design-output.png"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    تحميل التصميم
                  </a>
                  <button className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm">
                    <FileText className="w-4 h-4" />
                    عرض تفصيلي
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-600">
                  {imageUrl ? <Wand2 className="w-8 h-8" /> : <Lightbulb className="w-8 h-8" />}
                </div>
                <p className="text-slate-500 text-sm max-w-xs">
                  {imageUrl
                    ? "حدد منطقة للتعديل الجزئي، أو اكتب طلبك واضغط توليد لتطبيق التعديلات على الصورة"
                    : "ارفع صورة الواجهة واكتب طلبك، وهنطبق التعديلات المرئية ونحسبلك التكلفة فوراً"}
                </p>
              </div>
            )}
          </div>
        </div>
        <RenderControls value={render} onChange={setRender} accent="emerald" />
        {result && imageUrl && (
          <RenderStudio sourceUrl={imageUrl} renderUrl={result.outputDataUrl} accent="emerald" />
        )}
        <MaterialLibrary accent="emerald" onSelect={setPrompt} />
      </div>
    </div>
  );
}
