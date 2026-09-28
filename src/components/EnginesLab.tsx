import { useMemo, useReducer, useRef, useState } from "react";
import {
  ArrowRight,
  Cpu,
  ScanSearch,
  Calculator,
  Users,
  Workflow,
  Loader2,
  Check,
  AlertCircle,
  TrendingUp,
  MapPin,
  Star,
  Rocket,
  RotateCcw,
} from "lucide-react";
import UploadZone from "./UploadZone";
import {
  analyzeFacadeFromUrl,
  SURFACE_LABELS_AR,
  type FacadeAnalysis,
} from "@/engines/facadeVision";
import {
  SmartPricingEngine,
  MATERIAL_LABELS_AR,
  type PriceObservation,
  type Quote,
} from "@/engines/pricing";
import {
  matchContractors,
  SPECIALTY_LABELS_AR,
  type MatchResult,
  type Specialty,
} from "@/engines/contractors";
import {
  createProjectState,
  transition,
  STAGE_ORDER,
  STAGE_LABELS_AR,
  stageProgress,
  type ProjectState,
  type PipelineEvent,
  type SelectedMaterial,
} from "@/engines/pipeline";
import { SAMPLE_CONTRACTORS, SAMPLE_RATINGS } from "@/data/contractors";

interface EnginesLabProps {
  onBack: () => void;
}

// Seed the pricing model with a handful of "historical invoices" so the adaptive
// regression starts from a market-calibrated point and can show live learning.
const SEED_OBSERVATIONS: PriceObservation[] = [
  {
    kind: "aluminum_cladding",
    observedPrice: 32000,
    features: { quantity: 90, complexity: 0.5, qualityTier: 2, laborHours: 40, regionIndex: 1 },
  },
  {
    kind: "aluminum_cladding",
    observedPrice: 51000,
    features: { quantity: 140, complexity: 0.7, qualityTier: 3, laborHours: 62, regionIndex: 1.1 },
  },
  {
    kind: "led_letters",
    observedPrice: 9800,
    features: { quantity: 8, complexity: 0.6, qualityTier: 2, laborHours: 14, regionIndex: 1 },
  },
  {
    kind: "acrylic",
    observedPrice: 6400,
    features: { quantity: 12, complexity: 0.4, qualityTier: 2, laborHours: 9, regionIndex: 1 },
  },
  {
    kind: "installation_accessories",
    observedPrice: 4200,
    features: { quantity: 1, complexity: 0.5, qualityTier: 2, laborHours: 16, regionIndex: 1.1 },
  },
];

function pipelineReducer(state: ProjectState, event: PipelineEvent): ProjectState {
  return transition(state, event);
}

export default function EnginesLab({ onBack }: EnginesLabProps) {
  const pricing = useRef<SmartPricingEngine | null>(null);
  if (pricing.current === null) {
    pricing.current = new SmartPricingEngine();
    pricing.current.observeMany(SEED_OBSERVATIONS);
  }

  const [state, dispatch] = useReducer(pipelineReducer, undefined, () => createProjectState());
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | string>(null);
  const [complexity, setComplexity] = useState(0.7);
  const [priceTick, setPriceTick] = useState(0); // forces re-read of mutable engine

  const { context, stage, error } = state;

  const projectComplexity = useMemo(() => {
    if (!context.analysis) return complexity;
    const glass = context.analysis.surfaces.find((s) => s.type === "glass");
    const surfaceVariety = Math.min(1, context.analysis.surfaces.length / 4);
    const glassFactor = glass ? glass.coverageRatio : 0;
    return clamp01(0.4 * surfaceVariety + 0.6 * glassFactor + 0.1);
  }, [context.analysis, complexity]);

  const runAnalysis = async () => {
    if (!imageUrl) return;
    setBusy("analysis");
    try {
      const analysis = await analyzeFacadeFromUrl(imageUrl, {
        floorHeightM: 3.2,
      });
      dispatch({ type: "RUN_ANALYSIS", analysis });
    } finally {
      setBusy(null);
    }
  };

  const runEstimation = () => {
    if (!context.analysis || !pricing.current) return;
    setBusy("estimation");
    const a = context.analysis;
    const claddingSqm = a.recommendation.panel.coverageSqm;
    const letters = a.recommendation.signage.maxCharacters;
    const quote: Quote = pricing.current.quote([
      {
        kind: "aluminum_cladding",
        features: {
          quantity: claddingSqm,
          complexity: projectComplexity,
          qualityTier: 2,
          laborHours: Math.round(claddingSqm * 0.5),
          regionIndex: 1.05,
        },
      },
      {
        kind: "led_letters",
        features: {
          quantity: letters,
          complexity: projectComplexity,
          qualityTier: 2,
          laborHours: Math.round(letters * 1.6),
          regionIndex: 1.05,
        },
      },
      {
        kind: "installation_accessories",
        features: {
          quantity: 1,
          complexity: projectComplexity,
          qualityTier: 2,
          laborHours: 18,
          regionIndex: 1.05,
        },
      },
    ]);
    dispatch({ type: "RUN_ESTIMATION", quote });
    setBusy(null);
  };

  const feedMarketData = () => {
    if (!pricing.current || !context.quote) return;
    // Simulate three fresh invoices that came in ~8% above current estimates,
    // pushing the adaptive model toward a rising market.
    const fresh: PriceObservation[] = context.quote.lines
      .filter((l) => l.kind !== "installation_accessories")
      .map((l) => ({
        kind: l.kind,
        features: l.features,
        observedPrice: Math.round(l.prediction.amount * 1.08),
      }));
    pricing.current.observeMany([...fresh, ...fresh]);
    setPriceTick((t) => t + 1);
    // Re-quote with the updated model so the UI reflects the new market rate.
    runEstimation();
  };

  const selectMaterials = () => {
    if (!context.quote) return;
    const materials: SelectedMaterial[] = context.quote.lines.map((l) => ({
      id: l.kind,
      label: l.label,
      quantity: Math.round(l.features.quantity),
    }));
    dispatch({ type: "SELECT_MATERIALS", materials });
  };

  const specialtyNeeded: Specialty = useMemo(() => {
    const targets = context.analysis?.recommendation.claddingTargets ?? [];
    if ((context.analysis?.surfaces.find((s) => s.type === "glass")?.coverageRatio ?? 0) > 0.3)
      return "glass";
    if (targets.length > 1) return "full_facade";
    return "cladding";
  }, [context.analysis]);

  const matches: MatchResult[] = useMemo(() => {
    if (stage === "capture" || stage === "analysis") return [];
    return matchContractors(
      {
        complexity: projectComplexity,
        location: { lat: 30.0444, lng: 31.2357 }, // downtown Cairo project site
        specialtyNeeded,
        clientId: "client_demo",
      },
      SAMPLE_CONTRACTORS,
      { matrix: SAMPLE_RATINGS, limit: 5 },
    );
  }, [stage, projectComplexity, specialtyNeeded]);

  const assignContractor = (match: MatchResult) => {
    dispatch({ type: "ASSIGN_CONTRACTOR", match });
  };

  const approve = () => dispatch({ type: "APPROVE" });

  const deploy = () => {
    setBusy("deploy");
    const url = `https://glow-${context.projectId.replace(/[^a-z0-9]/gi, "").slice(0, 8)}.vercel.app`;
    dispatch({ type: "DEPLOY", deploymentUrl: url });
    dispatch({ type: "COMPLETE" });
    setBusy(null);
  };

  const reset = () => {
    dispatch({ type: "RESET" });
    setImageUrl(null);
  };

  const pricingSnapshots = pricing.current.snapshots();
  void priceTick; // snapshots depend on the mutable engine; tick forces refresh

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
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-sm font-medium text-blue-400">مختبر المحرّكات الذكية</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <header className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Cpu className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">المحرّكات الخوارزمية لمنصة Glow Tech</h2>
            <p className="text-slate-400 text-sm mt-1">
              أربعة محرّكات متكاملة: تسعير ذكي متعلّم، تحليل بصري للواجهات، مطابقة المقاولين، وخط إنتاج المشروع من الالتقاط حتى النشر.
            </p>
          </div>
        </header>

        <PipelineTracker state={state} />

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Capture + Vision */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-xl space-y-5">
            <SectionTitle icon={<ScanSearch className="w-5 h-5" />} title="1 · الالتقاط وتحليل الواجهة" />
            <UploadZone
              accent="blue"
              prompt=""
              setPrompt={() => {}}
              onGenerate={runAnalysis}
              generating={busy === "analysis"}
              generateLabel="تحليل الواجهة بالرؤية الحاسوبية"
              promptPlaceholder=""
              imageUrl={imageUrl ?? undefined}
              onImageChange={(url) => {
                setImageUrl(url);
                if (url) dispatch({ type: "CAPTURE_IMAGE", imageUrl: url });
              }}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>درجة تعقيد المشروع (تُشتق تلقائياً بعد التحليل)</span>
                <span className="text-blue-400 font-mono">{projectComplexity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={complexity}
                onChange={(e) => setComplexity(Number(e.target.value))}
                disabled={!!context.analysis}
                className="w-full accent-blue-500 disabled:opacity-40"
              />
            </UploadZone>

            {context.analysis && <VisionResult analysis={context.analysis} />}
          </section>

          {/* Pricing */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-xl space-y-5">
            <SectionTitle icon={<Calculator className="w-5 h-5" />} title="2 · محرّك التسعير الذكي المتعلّم" />

            {!context.analysis ? (
              <EmptyHint text="حلّل الواجهة أولاً ليقوم محرّك التسعير بتقدير التكلفة من الأبعاد المكتشفة." />
            ) : (
              <>
                {!context.quote ? (
                  <button
                    onClick={runEstimation}
                    disabled={busy === "estimation"}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {busy === "estimation" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Calculator className="w-4 h-4" />
                    )}
                    توليد التقدير التلقائي
                  </button>
                ) : (
                  <QuoteResult quote={context.quote} onFeed={feedMarketData} />
                )}

                <div className="pt-2 border-t border-slate-800/60">
                  <p className="text-xs text-slate-500 mb-2">حالة النماذج (انحدار خطي تكيّفي):</p>
                  <div className="grid grid-cols-2 gap-2">
                    {pricingSnapshots.map((snap) => (
                      <div
                        key={snap.kind}
                        className="bg-slate-950/60 border border-slate-800/60 rounded-lg px-3 py-2"
                      >
                        <p className="text-[11px] text-slate-400 truncate">
                          {MATERIAL_LABELS_AR[snap.kind]}
                        </p>
                        <p className="text-xs text-slate-300 font-mono">
                          {snap.samples} عيّنة · خطأ {Math.round(snap.emaError).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Contractors */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-xl space-y-5">
          <SectionTitle icon={<Users className="w-5 h-5" />} title="3 · مطابقة وترتيب المقاولين" />
          {matches.length === 0 ? (
            <EmptyHint text="اختر الخامات من التقدير لتفعيل ترتيب المقاولين حسب الجودة والقرب والتخصص والتوصية التعاونية." />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="bg-slate-800/60 border border-slate-700/60 rounded-full px-3 py-1">
                  التخصص المطلوب: {SPECIALTY_LABELS_AR[specialtyNeeded]}
                </span>
                <span className="bg-slate-800/60 border border-slate-700/60 rounded-full px-3 py-1">
                  تعقيد: {projectComplexity.toFixed(2)}
                </span>
                <span className="bg-slate-800/60 border border-slate-700/60 rounded-full px-3 py-1">
                  تصفية تعاونية للعميل client_demo
                </span>
              </div>
              <div className="space-y-3">
                {matches.map((m, i) => (
                  <ContractorCard
                    key={m.contractor.id}
                    rank={i + 1}
                    match={m}
                    assigned={context.assignedContractor?.contractor.id === m.contractor.id}
                    canAssign={stage === "contractor_assignment" || stage === "approval"}
                    onAssign={() => assignContractor(m)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Pipeline actions */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 shadow-xl space-y-5">
          <SectionTitle icon={<Workflow className="w-5 h-5" />} title="4 · خط إنتاج المشروع (آلة الحالات)" />
          <div className="flex flex-wrap gap-3">
            <StepButton
              label="اعتماد اختيار الخامات"
              active={stage === "material_selection"}
              done={STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf("material_selection")}
              onClick={selectMaterials}
              disabled={stage !== "material_selection"}
            />
            <StepButton
              label="اعتماد المشروع"
              active={stage === "approval"}
              done={STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf("approval")}
              onClick={approve}
              disabled={stage !== "approval"}
            />
            <StepButton
              label="التنفيذ والنشر على Vercel"
              active={stage === "deployment"}
              done={stage === "completed"}
              icon={<Rocket className="w-4 h-4" />}
              onClick={deploy}
              disabled={stage !== "deployment" || busy === "deploy"}
            />
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border border-slate-700/60 bg-slate-800/60 text-slate-300 hover:text-white transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              إعادة التهيئة
            </button>
          </div>

          {stage === "completed" && context.deploymentUrl && (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm">
              <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-emerald-300 font-medium">اكتمل المشروع ونُشر بنجاح</p>
                <p className="text-slate-400 font-mono text-xs mt-0.5">{context.deploymentUrl}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// --- Sub-components -----------------------------------------------------------

function PipelineTracker({ state }: { state: ProjectState }) {
  const progress = stageProgress(state.stage);
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-300">مراحل المشروع</span>
        <span className="text-xs text-blue-400 font-mono">{Math.round(progress * 100)}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-l from-emerald-500 to-blue-500 transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {STAGE_ORDER.map((s) => {
          const idx = STAGE_ORDER.indexOf(s);
          const current = STAGE_ORDER.indexOf(state.stage);
          const done = current > idx || state.stage === "completed";
          const active = state.stage === s;
          return (
            <span
              key={s}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                active
                  ? "bg-blue-500/15 text-blue-300 border-blue-500/40"
                  : done
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                    : "bg-slate-800/50 text-slate-500 border-slate-700/50"
              }`}
            >
              {done && !active ? <Check className="w-3 h-3 inline ml-1" /> : null}
              {STAGE_LABELS_AR[s]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function VisionResult({ analysis }: { analysis: FacadeAnalysis }) {
  const { dimensions, surfaces, recommendation } = analysis;
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="العرض" value={`${dimensions.widthMeters} م`} />
        <Stat label="الارتفاع" value={`${dimensions.heightMeters} م`} />
        <Stat label="الأدوار" value={`${dimensions.floors}`} />
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-2">الأسطح المكتشفة:</p>
        <div className="space-y-2">
          {surfaces.map((s) => (
            <div key={s.type} className="flex items-center gap-3">
              <span className="text-xs text-slate-300 w-20">{SURFACE_LABELS_AR[s.type]}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500/70"
                  style={{ width: `${Math.round(s.coverageRatio * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 font-mono w-24 text-left">
                {Math.round(s.coverageRatio * 100)}% · {s.areaSqm}م²
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 space-y-1.5 text-xs text-slate-300">
        <p className="font-medium text-slate-200 mb-1">توصية التوزيع:</p>
        <p>
          ألواح كلادنج: {recommendation.panel.columns}×{recommendation.panel.rows} ={" "}
          {recommendation.panel.totalPanels} لوح ({recommendation.panel.panelWidthMm}×
          {recommendation.panel.panelHeightMm}مم) بفاصل {recommendation.panel.jointGapMm}مم.
        </p>
        <p>
          الحروف المضيئة: ارتفاع {recommendation.signage.letterHeightCm}سم، حتى{" "}
          {recommendation.signage.maxCharacters} حرف، وضوح حتى{" "}
          {recommendation.signage.readableDistanceM}م.
        </p>
        {recommendation.notes.map((n) => (
          <p key={n} className="text-amber-300/80">
            • {n}
          </p>
        ))}
      </div>
    </div>
  );
}

function QuoteResult({ quote, onFeed }: { quote: Quote; onFeed: () => void }) {
  return (
    <div className="space-y-3 animate-fade-in">
      {quote.lines.map((l) => (
        <div
          key={l.kind}
          className="bg-slate-950/60 border border-slate-800/60 rounded-xl px-4 py-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">{l.label}</span>
            <span className="text-sm font-semibold text-slate-100">
              {l.prediction.amount.toLocaleString()} ج.م
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500/70"
                style={{ width: `${Math.round(l.prediction.confidence * 100)}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              ثقة {Math.round(l.prediction.confidence * 100)}%
            </span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <span className="font-bold text-sm">الإجمالي التقديري</span>
        <span className="text-xl font-bold text-blue-400">{quote.subtotal.toLocaleString()} ج.م</span>
      </div>
      <button
        onClick={onFeed}
        className="w-full flex items-center justify-center gap-2 text-xs bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-300 px-4 py-2.5 rounded-xl transition-colors"
      >
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        تحديث بأسعار السوق الجديدة (تدريب النموذج تكيّفياً)
      </button>
    </div>
  );
}

function ContractorCard({
  rank,
  match,
  assigned,
  canAssign,
  onAssign,
}: {
  rank: number;
  match: MatchResult;
  assigned: boolean;
  canAssign: boolean;
  onAssign: () => void;
}) {
  const { contractor, score, breakdown, predictedRating } = match;
  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        assigned
          ? "bg-emerald-500/10 border-emerald-500/30"
          : "bg-slate-950/50 border-slate-800/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center text-xs font-bold text-slate-300">
            {rank}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">{contractor.name}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {contractor.city} · {breakdown.distanceKm} كم
              <span className="mx-1">·</span>
              {contractor.specialties.map((s) => SPECIALTY_LABELS_AR[s]).join("، ")}
            </p>
          </div>
        </div>
        <div className="text-left">
          <div className="text-lg font-bold text-blue-400">{Math.round(score * 100)}</div>
          <div className="text-[10px] text-slate-500">درجة المطابقة</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        <MiniBar label="جودة" value={breakdown.quality} />
        <MiniBar label="قرب" value={breakdown.proximity} />
        <MiniBar label="ملاءمة" value={breakdown.complexityFit} />
        <MiniBar label="توصية" value={breakdown.collaborative} />
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-amber-400" />
          {contractor.metrics.reviewScore.toFixed(1)}
          {predictedRating !== null && (
            <span className="text-slate-500">· متوقّع {predictedRating.toFixed(1)}</span>
          )}
          {!breakdown.specialtyMatch && (
            <span className="text-amber-400/80 mr-2">· تخصص جزئي</span>
          )}
        </span>
        <button
          onClick={onAssign}
          disabled={!canAssign}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            assigned
              ? "bg-emerald-600 text-white"
              : canAssign
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }`}
        >
          {assigned ? "معيَّن" : "إسناد"}
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
        {icon}
      </span>
      <h3 className="font-bold text-lg">{title}</h3>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl py-2.5">
      <div className="text-base font-bold text-slate-100">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500/70" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <div className="text-[10px] text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-sm text-slate-500 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl px-4 py-6 text-center">
      {text}
    </div>
  );
}

function StepButton({
  label,
  active,
  done,
  disabled,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  done: boolean;
  disabled: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
        done
          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
          : active
            ? "bg-blue-600 hover:bg-blue-500 text-white border-blue-500"
            : "bg-slate-800/60 text-slate-500 border-slate-700/60 cursor-not-allowed"
      }`}
    >
      {done ? <Check className="w-4 h-4" /> : icon}
      {label}
    </button>
  );
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
