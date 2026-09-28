import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Brain,
  ExternalLink,
  Globe2,
  Lightbulb,
  Loader2,
  Radar,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { fetchDesignTrends, type TrendReport } from "@/lib/trends.functions";
import {
  addObservations,
  clearObservations,
  createTrainedEngine,
  loadObservations,
  signalsToObservations,
} from "@/lib/marketLearning";
import { MATERIAL_LABELS_AR, type PriceFeatures } from "@/engines/pricing";

const TOPICS = [
  { id: "storefront", labelAr: "واجهات المحال" },
  { id: "signage", labelAr: "اللوحات والحروف" },
  { id: "cladding", labelAr: "الكلادنج والخامات" },
  { id: "lighting", labelAr: "الإضاءة والنيون" },
] as const;

type TopicId = (typeof TOPICS)[number]["id"];

// Reference project used to show how learning shifts the estimate.
const REFERENCE: PriceFeatures = {
  quantity: 30,
  complexity: 0.55,
  qualityTier: 2,
  laborHours: 24,
  regionIndex: 1,
};

interface TrendRadarProps {
  onBack: () => void;
}

export default function TrendRadar({ onBack }: TrendRadarProps) {
  const runTrends = useServerFn(fetchDesignTrends);
  const [topics, setTopics] = useState<TopicId[]>(["storefront", "signage", "cladding"]);
  const [brief, setBrief] = useState("");
  const [regionIndex, setRegionIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<TrendReport | null>(null);
  const [learnVersion, setLearnVersion] = useState(0);

  const learning = useMemo(() => {
    const { engine, samples } = createTrainedEngine();
    const quote = engine.quote([
      { kind: "aluminum_cladding", features: REFERENCE },
      { kind: "led_letters", features: { ...REFERENCE, quantity: 12 } },
      { kind: "installation_accessories", features: { ...REFERENCE, quantity: 6 } },
    ]);
    return { samples, quote };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnVersion]);

  const toggleTopic = (id: TopicId) =>
    setTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const analyse = async () => {
    if (!topics.length) {
      toast.error("اختر مجالاً واحداً على الأقل للتحليل");
      return;
    }
    setLoading(true);
    try {
      const result = await runTrends({
        data: { topics, brief: brief.slice(0, 600), regionIndex },
      });
      setReport(result);
      toast.success("تم جلب أحدث الاتجاهات من الويب وتحليلها");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "تعذّر إكمال التحليل، جرّب مرة أخرى بعد قليل",
      );
    } finally {
      setLoading(false);
    }
  };

  const teachEngine = () => {
    if (!report?.priceSignals?.length) return;
    addObservations(signalsToObservations(report.priceSignals, regionIndex));
    setLearnVersion((v) => v + 1);
    toast.success("تم تدريب محرّك التسعير على بيانات السوق الجديدة");
  };

  const resetLearning = () => {
    clearObservations();
    setLearnVersion((v) => v + 1);
    toast.success("تمت إعادة ضبط ذاكرة التعلّم");
  };

  const okSources = report?.sources.filter((s) => s.ok).length ?? 0;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-0 left-1/3 w-[28rem] h-[28rem] bg-blue-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع
        </button>

        <header className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Radar className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                رادار الاتجاهات <span className="gradient-text">بالذكاء الاصطناعي</span>
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                يجلب بيانات حقيقية من الويب ويحللها ليقترح تصميمات ويدرّب محرّك التسعير.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2">
            <Brain className="w-4 h-4 text-emerald-400" />
            عيّنات التعلّم المخزّنة: <span className="text-white font-bold">{learning.samples}</span>
          </div>
        </header>

        {/* Controls */}
        <section className="mt-8 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => {
              const active = topics.includes(topic.id);
              return (
                <button
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    active
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {topic.labelAr}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="اكتب وصف المشروع: مثال — واجهة محل موبايلات 8 متر بالقاهرة، كلادنج أسود مع حروف LED"
              className="w-full resize-none bg-slate-950/70 border border-slate-800 focus:border-emerald-500/60 focus:outline-none rounded-2xl px-4 py-3 text-sm placeholder:text-slate-600"
            />
            <div className="flex flex-col gap-3 md:w-56">
              <label className="text-xs text-slate-400">
                معامل تكلفة المنطقة: <span className="text-white font-bold">{regionIndex.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.8}
                  max={1.4}
                  step={0.02}
                  value={regionIndex}
                  onChange={(e) => setRegionIndex(Number(e.target.value))}
                  className="w-full mt-2 accent-emerald-500"
                />
              </label>
              <button
                onClick={analyse}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-l from-emerald-500 to-blue-600 disabled:opacity-60 px-5 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-transform disabled:hover:translate-y-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe2 className="w-4 h-4" />}
                {loading ? "جاري الجلب والتحليل…" : "اجلب وحلّل من الويب"}
              </button>
            </div>
          </div>
        </section>

        {/* Learning status */}
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {learning.quote.lines.map((line) => (
            <div key={line.kind} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-400">{MATERIAL_LABELS_AR[line.kind]}</p>
              <p className="text-xl font-bold mt-1">
                {line.prediction.amount.toLocaleString("ar-EG")} <span className="text-xs text-slate-500">ج.م</span>
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-emerald-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${Math.round(line.prediction.confidence * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                ثقة النموذج {Math.round(line.prediction.confidence * 100)}%
              </p>
            </div>
          ))}
        </section>

        {report && (
          <div className="mt-8 space-y-8 animate-fade-in-up">
            {/* Summary + sources */}
            <section className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                <Sparkles className="w-4 h-4" />
                ملخص الاتجاهات
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mt-3">{report.summaryAr}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {report.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                      source.ok
                        ? "border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                        : "border-slate-900 text-slate-600"
                    }`}
                  >
                    <ExternalLink className="w-3 h-3" />
                    {source.title.slice(0, 40)}
                  </a>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                تم تحليل {okSources} مصدر مباشر من الويب.
              </p>
            </section>

            {/* Style directions */}
            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                اتجاهات تصميم مقترحة
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {report.styleDirections.map((style) => (
                  <article
                    key={style.nameAr}
                    className="bg-slate-900/70 border border-slate-800 hover:border-blue-500/40 rounded-3xl p-5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold">{style.nameAr}</h3>
                      <span className="text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full shrink-0">
                        رواج {Math.round(style.popularity * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed mt-2">{style.descriptionAr}</p>
                    <div className="flex gap-1.5 mt-3">
                      {style.palette.slice(0, 6).map((color, i) => (
                        <span
                          key={`${color}-${i}`}
                          className="w-7 h-7 rounded-lg border border-white/10"
                          style={{ background: color }}
                          title={color}
                        />
                      ))}
                    </div>
                    <dl className="mt-4 space-y-2 text-xs">
                      <div className="flex gap-2">
                        <dt className="text-slate-500 shrink-0">الكلادنج:</dt>
                        <dd className="text-slate-300">{style.claddingAr}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-slate-500 shrink-0">الحروف:</dt>
                        <dd className="text-slate-300">{style.letteringAr}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>

            {/* Materials + standards */}
            <section className="grid gap-4 md:grid-cols-2">
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5">
                <h3 className="font-bold text-sm mb-3">ملاحظات الخامات</h3>
                <ul className="space-y-3">
                  {report.materialInsights.map((item) => (
                    <li key={item.materialAr} className="text-xs">
                      <p className="text-emerald-300 font-bold">{item.materialAr}</p>
                      <p className="text-slate-400 mt-1">{item.trendAr}</p>
                      <p className="text-slate-500 mt-1">{item.recommendationAr}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  معايير الحروف المضيئة
                </h3>
                <ul className="space-y-3">
                  {report.letteringStandards.map((item) => (
                    <li key={item.titleAr} className="text-xs">
                      <p className="text-amber-300 font-bold">{item.titleAr}</p>
                      <p className="text-slate-400 mt-1">{item.detailAr}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Price signals -> learning */}
            <section className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-emerald-400" />
                  إشارات أسعار السوق
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={teachEngine}
                    className="inline-flex items-center gap-2 text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl hover:bg-emerald-500/25 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    درّب محرّك التسعير
                  </button>
                  <button
                    onClick={resetLearning}
                    className="inline-flex items-center gap-2 text-xs text-slate-400 border border-slate-800 px-3 py-2 rounded-xl hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    تصفير
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs min-w-[520px]">
                  <thead className="text-slate-500">
                    <tr className="text-right">
                      <th className="py-2 font-medium">البند</th>
                      <th className="py-2 font-medium">الكمية</th>
                      <th className="py-2 font-medium">الجودة</th>
                      <th className="py-2 font-medium">ساعات التركيب</th>
                      <th className="py-2 font-medium">السعر المرصود</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {report.priceSignals.map((signal, i) => (
                      <tr key={`${signal.kind}-${i}`} className="border-t border-slate-800/80">
                        <td className="py-2.5">
                          {MATERIAL_LABELS_AR[signal.kind]}
                          <span className="block text-[11px] text-slate-500">{signal.rationaleAr}</span>
                        </td>
                        <td className="py-2.5">{signal.quantity}</td>
                        <td className="py-2.5">{signal.qualityTier}</td>
                        <td className="py-2.5">{signal.laborHours}</td>
                        <td className="py-2.5 font-bold text-emerald-300">
                          {Math.round(signal.observedPrice).toLocaleString("ar-EG")} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                كل تدريب يُخزَّن محلياً ({loadObservations().length} عيّنة) ويُعاد تطبيقه على النموذج عند كل
                فتح للتطبيق.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
