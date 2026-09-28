import { AlertCircle, Brain, Check, Layers, Lightbulb, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { analysisErrorMessage, analyzeScene, type SceneAnalysis } from "@/lib/sceneAnalysis";
import { describeRender, type RenderSettings } from "@/lib/renderEngine";
import type { Adjustments } from "@/lib/imageProcessing";

interface Props {
  imageUrl?: string | null;
  accent?: "emerald" | "blue" | "amber";
  onApplyRender: (render: RenderSettings) => void;
  onApplyAdjustments: (adj: Adjustments) => void;
}

const ACCENT = {
  emerald: { text: "text-emerald-400", btn: "bg-emerald-600 hover:bg-emerald-500", ring: "border-emerald-500/40" },
  blue: { text: "text-blue-400", btn: "bg-blue-600 hover:bg-blue-500", ring: "border-blue-500/40" },
  amber: { text: "text-amber-400", btn: "bg-amber-600 hover:bg-amber-500", ring: "border-amber-500/40" },
};

export default function SceneAnalyzer({ imageUrl, accent = "emerald", onApplyRender, onApplyAdjustments }: Props) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null);
  const [applied, setApplied] = useState<"none" | "render" | "grade" | "both">("none");
  const c = ACCENT[accent];

  const run = async () => {
    if (!imageUrl && !description.trim()) {
      setError("ارفع صورة للمشهد أو اكتب وصفًا له الأول.");
      return;
    }
    setLoading(true);
    setError(null);
    setApplied("none");
    try {
      const res = await analyzeScene({ description, imageDataUrl: imageUrl ?? null });
      setAnalysis(res);
    } catch (err) {
      setError(analysisErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const markApplied = (part: "render" | "grade") =>
    setApplied((prev) => (prev === "none" || prev === part ? part : "both"));

  return (
    <div className="mt-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-5" dir="rtl">
      <div className="flex items-center gap-2 mb-1">
        <Brain className={`w-5 h-5 ${c.text}`} />
        <h3 className="font-bold text-slate-100">تحليل المشهد بالذكاء الاصطناعي</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        ارفع صورة أو اكتب وصف المشهد، والذكاء الاصطناعي هيحلل الإضاءة والخامات والطبقات ويقترح إعدادات معالجة احترافية جاهزة للتطبيق.
      </p>

      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={3}
        placeholder="مثال: واجهة كافيه دورين، كلادنج خشبي وزجاج، تصوير بعد المغرب بإضاءة دافئة"
        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600 resize-none"
      />

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={run}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 ${c.btn}`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? "بيحلل المشهد..." : "حلّل المشهد واقترح الإعدادات"}
        </button>
        {imageUrl ? (
          <span className="text-xs text-slate-500">هيتم تحليل الصورة المرفوعة كمان</span>
        ) : (
          <span className="text-xs text-slate-600">بدون صورة — هيتم التحليل من الوصف</span>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {analysis && (
        <div className={`mt-4 space-y-4 border rounded-xl p-4 bg-slate-950/60 ${c.ring}`}>
          {analysis.summary && <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>}

          {analysis.lighting && (
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Lightbulb className="w-3.5 h-3.5" /> قراءة الإضاءة
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.lighting}</p>
            </div>
          )}

          {analysis.materials.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-2">الخامات المكتشفة</div>
              <div className="flex flex-wrap gap-2">
                {analysis.materials.map((item) => (
                  <span key={item} className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.layers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <Layers className="w-3.5 h-3.5" /> تقسيم الطبقات المقترح
              </div>
              <ul className="space-y-1">
                {analysis.layers.map((item) => (
                  <li key={item} className="text-sm text-slate-300">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.tips.length > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-2">نصائح المعالجة</div>
              <ul className="space-y-1">
                {analysis.tips.map((item) => (
                  <li key={item} className="text-sm text-slate-300">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="text-xs text-slate-400 mb-2">إعدادات الإظهار المقترحة</div>
            <div className="flex flex-wrap gap-2">
              {describeRender(analysis.render).map((item) => (
                <span key={item} className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => {
                onApplyRender(analysis.render);
                markApplied("render");
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-xs font-semibold ${c.btn}`}
            >
              {applied === "render" || applied === "both" ? <Check className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />}
              طبّق إعدادات الإظهار
            </button>
            <button
              onClick={() => {
                onApplyAdjustments(analysis.adjustments);
                markApplied("grade");
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold"
            >
              {applied === "grade" || applied === "both" ? <Check className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />}
              طبّق إعدادات المعالجة في الاستوديو
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
