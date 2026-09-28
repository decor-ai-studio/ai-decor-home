import { useRef, useState } from "react";
import {
  ArrowRight,
  Download,
  Loader2,
  Sparkles,
  Type,
  AlertCircle,
  Square,
  Wand2,
} from "lucide-react";
import { aiGeneratePoster, aiErrorMessage, type PosterOptions } from "@/lib/aiImage";

interface SignageStudioProps {
  onBack: () => void;
}

const LAYOUTS: { id: PosterOptions["layout"]; label: string; hint: string }[] = [
  { id: "storefront", label: "معاينة واجهة محل", hint: "صورة واقعية للمحل باللوحة مضيئة" },
  { id: "letters", label: "حروف مجسمة مضيئة", hint: "صورة استوديو للحروف بالإضاءة" },
  { id: "poster", label: "بوستر إعلاني", hint: "تصميم إعلان جاهز للطباعة" },
  { id: "mockup", label: "موك أب على مبنى", hint: "اللوحة مركبة على واجهة حقيقية" },
];

const STYLES = [
  "مودرن فاخر",
  "كلاسيك ذهبي",
  "مينيمال أبيض",
  "نيون ليلي",
  "صناعي معدني",
  "خط عربي فني",
];

const PALETTES = [
  "أسود وذهبي",
  "أبيض وفضي",
  "أخضر زمردي وأسود",
  "أزرق نيون وكحلي",
  "أحمر وأسود",
  "بيج ودافئ",
];

const BRAND_TYPES = [
  "مطعم",
  "كافيه",
  "محل ملابس",
  "صيدلية",
  "معرض سيارات",
  "سوبر ماركت",
  "عيادة",
  "شركة",
];

const RATIOS: { id: PosterOptions["ratio"]; label: string }[] = [
  { id: "1536x1024", label: "عريض 3:2" },
  { id: "1024x1024", label: "مربع 1:1" },
  { id: "1024x1536", label: "طولي 2:3" },
];

export default function SignageStudio({ onBack }: SignageStudioProps) {
  const [text, setText] = useState("");
  const [subText, setSubText] = useState("");
  const [brandType, setBrandType] = useState(BRAND_TYPES[0]!);
  const [style, setStyle] = useState(STYLES[0]!);
  const [palette, setPalette] = useState(PALETTES[0]!);
  const [layout, setLayout] = useState<PosterOptions["layout"]>("storefront");
  const [ratio, setRatio] = useState<PosterOptions["ratio"]>("1536x1024");

  const [finalQuality, setFinalQuality] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("اكتب اسم المحل أو نص اللوحة الأول");
      return;
    }
    setError(null);
    setGenerating(true);
    setIsFinal(false);
    setImage(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await aiGeneratePoster({
        text,
        subText,
        brandType,
        style,
        palette,
        layout,
        ratio,
        quality: finalQuality ? "high" : "medium",
        signal: controller.signal,
        onFrame: (dataUrl, final) => {
          setImage(dataUrl);
          setIsFinal(final);
        },
      });
    } catch (err) {
      if (!controller.signal.aborted) setError(aiErrorMessage(err));
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  const chip = (active: boolean) =>
    `text-xs px-3 py-1.5 rounded-lg border transition-colors ${
      active
        ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
        : "bg-slate-800/60 text-slate-300 border-slate-700/60 hover:border-amber-500/40 hover:text-amber-300"
    }`;

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
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-sm font-medium text-amber-400">استوديو اللوحات والإعلانات</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center gap-4 animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Type className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">اكتب النص والذكاء الاصطناعي يصممه</h2>
            <p className="text-slate-400 text-sm mt-1">
              اسم المحل + الستايل = لوحة مضيئة أو بوستر إعلاني واقعي بجودة عالية
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls */}
          <div
            className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-xl space-y-6 animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="space-y-2.5">
              <label className="text-sm font-medium text-slate-300">نص اللوحة (اسم المحل)</label>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="مثال: مطاعم النخبة"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-sm font-medium text-slate-300">سطر إضافي (اختياري)</label>
              <input
                value={subText}
                onChange={(e) => setSubText(e.target.value)}
                placeholder="مثال: مشويات وسي فود — فرع المعادي"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2.5">نوع المخرج:</p>
              <div className="grid grid-cols-2 gap-2.5">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLayout(l.id)}
                    className={`p-3.5 rounded-xl border text-right transition-all ${
                      layout === l.id
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                        : "bg-slate-950/60 border-slate-800/60 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <p className="text-sm font-medium">{l.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{l.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2.5">نوع النشاط:</p>
              <div className="flex flex-wrap gap-2">
                {BRAND_TYPES.map((b) => (
                  <button key={b} onClick={() => setBrandType(b)} className={chip(brandType === b)}>
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2.5">ستايل التصميم والخط:</p>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={chip(style === s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2.5">الألوان:</p>
              <div className="flex flex-wrap gap-2">
                {PALETTES.map((p) => (
                  <button key={p} onClick={() => setPalette(p)} className={chip(palette === p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2.5">مقاس الصورة:</p>
              <div className="flex flex-wrap gap-2">
                {RATIOS.map((r) => (
                  <button key={r.id} onClick={() => setRatio(r.id)} className={chip(ratio === r.id)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-400">
              <input type="checkbox" className="mt-0.5" checked={finalQuality} onChange={(e) => setFinalQuality(e.target.checked)} />
              <span>جودة قصوى للتصميم النهائي فقط (تستهلك رصيدًا أكثر بكثير). اتركها مغلقة أثناء التجربة.</span>
            </label>

            <div className="flex gap-2.5">
              <button
                onClick={handleGenerate}
                disabled={generating || !text.trim()}
                className="flex-1 bg-amber-600 hover:bg-amber-500 px-6 py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري التصميم...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    صمّم اللوحة
                  </>
                )}
              </button>
              {generating && (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  إيقاف
                </button>
              )}
            </div>
          </div>

          {/* Output */}
          <div
            className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-xl animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {image ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">
                    {isFinal ? "التصميم النهائي" : "معاينة أثناء التوليد..."}
                  </h3>
                  {!isFinal && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
                </div>
                <div className="rounded-2xl overflow-hidden border border-amber-500/30 bg-slate-950">
                  <img
                    src={image}
                    alt="تصميم اللوحة"
                    className={`w-full object-contain transition-[filter] duration-500 ${
                      isFinal ? "blur-0" : "blur-2xl"
                    }`}
                  />
                </div>
                {isFinal && (
                  <a
                    href={image}
                    download="glowtech-signage.png"
                    className="w-full bg-amber-600 hover:bg-amber-500 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    تحميل التصميم بجودة عالية
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-24 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-600">
                  <Wand2 className="w-8 h-8" />
                </div>
                <p className="text-slate-500 text-sm max-w-xs">
                  اكتب نص اللوحة واختار الستايل، وهنولّدلك تصميم واقعي جاهز للعميل.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
