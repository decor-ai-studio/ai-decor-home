import { useMemo, useState } from "react";
import { ArrowLeft, HardHat, MapPin, Star, Users, Gauge } from "lucide-react";
import { SAMPLE_CONTRACTORS, SAMPLE_RATINGS } from "@/data/contractors";
import {
  matchContractors,
  SPECIALTY_LABELS_AR,
  type MatchResult,
  type Specialty,
} from "@/engines/contractors";

const SPECIALTIES: Specialty[] = ["cladding", "signage", "glass", "lighting", "full_facade"];

const CITIES: Array<{ name: string; lat: number; lng: number }> = [
  { name: "مدينة نصر", lat: 30.0566, lng: 31.3301 },
  { name: "المعادي", lat: 29.9603, lng: 31.2596 },
  { name: "الشيخ زايد", lat: 30.0778, lng: 30.9754 },
  { name: "مصر الجديدة", lat: 30.0875, lng: 31.3286 },
  { name: "6 أكتوبر", lat: 29.9668, lng: 30.9476 },
];

interface Props {
  onBack: () => void;
}

export default function ContractorsBoard({ onBack }: Props) {
  const [specialty, setSpecialty] = useState<Specialty>("cladding");
  const [cityIndex, setCityIndex] = useState(0);
  const [complexity, setComplexity] = useState(0.55);

  const city = CITIES[cityIndex]!;

  const results = useMemo(() => {
    const all = matchContractors(
      {
        complexity,
        location: { lat: city.lat, lng: city.lng },
        specialtyNeeded: specialty,
        clientId: "client_demo",
      },
      SAMPLE_CONTRACTORS,
      { matrix: SAMPLE_RATINGS },
    );
    // Only contractors who actually declare this specialty belong on its board.
    return all.filter((r) => r.contractor.specialties.includes(specialty));
  }, [specialty, complexity, city]);

  const counts = useMemo(() => {
    const map = {} as Record<Specialty, number>;
    for (const s of SPECIALTIES) {
      map[s] = SAMPLE_CONTRACTORS.filter((c) => c.specialties.includes(s)).length;
    }
    return map;
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <HardHat className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                لوحة <span className="text-blue-400">المقاولين</span> حسب التخصص
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                كل تخصص في تبويب مستقل، والترتيب يحسب الجودة والقرب ومناسبة حجم العمل.
              </p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            رجوع
            <ArrowLeft className="w-4 h-4" />
          </button>
        </header>

        {/* Specialty tabs */}
        <div className="mt-8 flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => (
            <button
              key={s}
              onClick={() => setSpecialty(s)}
              className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                specialty === s
                  ? "bg-blue-500/15 border-blue-500/50 text-blue-300"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              {SPECIALTY_LABELS_AR[s]}
              <span className="text-[11px] text-slate-500 ms-2">{counts[s]}</span>
            </button>
          ))}
        </div>

        {/* Project context */}
        <div className="mt-6 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-slate-500 mb-3">موقع المشروع</p>
            <div className="flex flex-wrap gap-2">
              {CITIES.map((c, i) => (
                <button
                  key={c.name}
                  onClick={() => setCityIndex(i)}
                  className={`px-3.5 py-1.5 rounded-xl text-sm border transition-colors ${
                    cityIndex === i
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-3">
              درجة تعقيد المشروع: <span className="text-white font-semibold">{complexity.toFixed(2)}</span>
            </p>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={complexity}
              onChange={(e) => setComplexity(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <p className="text-xs text-slate-500 mt-2">
              ارفع الشريط للمشروعات الكبيرة أو الهندسية المعقدة لترى من يقدر عليها فعلياً.
            </p>
          </div>
        </div>

        {/* Contractor cards */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {results.map((r, idx) => (
            <ContractorCard key={r.contractor.id} result={r} best={idx === 0} />
          ))}
          {results.length === 0 && (
            <p className="text-center text-slate-500 py-10 lg:col-span-2">
              لا يوجد مقاول مسجّل في هذا التخصص حالياً.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ContractorCard({ result, best }: { result: MatchResult; best: boolean }) {
  const { contractor: c, breakdown, score, predictedRating } = result;
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 hover:border-blue-500/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {best && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                الأنسب لمشروعك
              </span>
            )}
            <h3 className="text-lg font-bold">{c.name}</h3>
          </div>
          <p className="text-sm text-slate-400 mt-1 inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {c.city} · {breakdown.distanceKm} كم من المشروع
          </p>
        </div>
        <div className="text-left">
          <p className="text-2xl font-bold text-blue-300">{Math.round(score * 100)}%</p>
          <p className="text-xs text-slate-500">درجة المطابقة</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {c.specialties.map((s) => (
          <span
            key={s}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300"
          >
            {SPECIALTY_LABELS_AR[s]}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-2.5">
        <Bar label="جودة التنفيذ" value={breakdown.quality} color="bg-emerald-500" />
        <Bar label="قرب الموقع" value={breakdown.proximity} color="bg-blue-500" />
        <Bar label="مناسبة حجم العمل" value={breakdown.complexityFit} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Metric
          label="التقييم"
          value={
            <span className="inline-flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              {c.metrics.reviewScore.toFixed(1)}
            </span>
          }
        />
        <Metric label="الالتزام بالمواعيد" value={`${Math.round(c.metrics.scheduleAdherence * 100)}%`} />
        <Metric label="دقة التسعير" value={`${Math.round(c.metrics.costAccuracy * 100)}%`} />
        <Metric
          label="مشروعات منجزة"
          value={
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {c.metrics.completedProjects}
            </span>
          }
        />
      </div>

      {predictedRating !== null && (
        <p className="text-xs text-slate-500 mt-4 inline-flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          تقييم متوقّع لك بناءً على عملاء مشابهين: {predictedRating.toFixed(1)} / 5
        </p>
      )}
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="text-slate-400">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 mt-1.5 overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl px-3 py-2.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold mt-1">{value}</p>
    </div>
  );
}
