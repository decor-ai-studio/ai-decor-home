import { useMemo, useState } from "react";
import { ArrowLeft, Boxes, Clock, Star, Truck, Phone, TrendingDown } from "lucide-react";
import { SUPPLIERS, type Supplier } from "@/data/suppliers";
import { MATERIAL_KINDS, MATERIAL_LABELS_AR, type MaterialKind } from "@/engines/pricing";

type Priority = "price" | "speed" | "quality";

const PRIORITIES: Array<{ id: Priority; label: string }> = [
  { id: "price", label: "الأوفر سعراً" },
  { id: "speed", label: "الأسرع توريداً" },
  { id: "quality", label: "الأعلى جودة" },
];

const WEIGHTS: Record<Priority, { price: number; speed: number; quality: number }> = {
  price: { price: 0.6, speed: 0.15, quality: 0.25 },
  speed: { price: 0.2, speed: 0.55, quality: 0.25 },
  quality: { price: 0.2, speed: 0.15, quality: 0.65 },
};

function scoreSupplier(s: Supplier, priority: Priority): number {
  // Cheaper than market = higher; 0.85 index ≈ 1.0, 1.2 index ≈ 0.
  const price = clamp01((1.2 - s.priceIndex) / 0.35);
  const speed = clamp01(Math.exp(-s.leadTimeDays / 7));
  const quality = clamp01(0.6 * (s.rating / 5) + 0.4 * s.onTimeRate);
  const w = WEIGHTS[priority];
  return clamp01(w.price * price + w.speed * speed + w.quality * quality);
}

function clamp01(v: number) {
  return Number.isNaN(v) ? 0 : Math.min(1, Math.max(0, v));
}

interface Props {
  onBack: () => void;
}

export default function SuppliersBoard({ onBack }: Props) {
  const [kind, setKind] = useState<MaterialKind | "all">("all");
  const [priority, setPriority] = useState<Priority>("price");

  const rows = useMemo(() => {
    const filtered = SUPPLIERS.filter((s) => kind === "all" || s.kinds.includes(kind));
    return filtered
      .map((s) => ({ supplier: s, score: scoreSupplier(s, priority) }))
      .sort((a, b) => b.score - a.score);
  }, [kind, priority]);

  const avgPrice = rows.length
    ? rows.reduce((sum, r) => sum + r.supplier.priceIndex, 0) / rows.length
    : 1;
  const avgLead = rows.length
    ? rows.reduce((sum, r) => sum + r.supplier.leadTimeDays, 0) / rows.length
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Boxes className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                لوحة <span className="text-amber-400">الموردين</span>
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                قارن الموردين حسب الخامة والسعر وسرعة التوريد والالتزام.
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

        {/* Filters */}
        <div className="mt-8 bg-slate-900/70 border border-slate-800 rounded-3xl p-5">
          <p className="text-xs text-slate-500 mb-3">الخامة</p>
          <div className="flex flex-wrap gap-2">
            {(["all", ...MATERIAL_KINDS] as Array<MaterialKind | "all">).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                  kind === k
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                {k === "all" ? "كل الخامات" : MATERIAL_LABELS_AR[k]}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-500 mt-5 mb-3">الأولوية في الترتيب</p>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPriority(p.id)}
                className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                  priority === p.id
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Market summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <SummaryCard
            icon={<TrendingDown className="w-4 h-4" />}
            label="متوسط مستوى السعر"
            value={`${Math.round(avgPrice * 100)}% من سعر السوق`}
          />
          <SummaryCard
            icon={<Clock className="w-4 h-4" />}
            label="متوسط مدة التوريد"
            value={`${avgLead.toFixed(1)} يوم`}
          />
          <SummaryCard
            icon={<Truck className="w-4 h-4" />}
            label="عدد الموردين المطابقين"
            value={`${rows.length} مورد`}
          />
        </div>

        {/* Supplier list */}
        <div className="mt-6 space-y-4">
          {rows.map(({ supplier, score }, idx) => (
            <div
              key={supplier.id}
              className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 hover:border-amber-500/40 transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {idx === 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        الأفضل لأولويتك
                      </span>
                    )}
                    <h3 className="text-lg font-bold">{supplier.name}</h3>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {supplier.city} · أقل طلب: {supplier.minOrder}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-amber-300">{Math.round(score * 100)}%</p>
                  <p className="text-xs text-slate-500">درجة الملاءمة</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <Metric label="مستوى السعر" value={`${Math.round(supplier.priceIndex * 100)}%`} />
                <Metric label="مدة التوريد" value={`${supplier.leadTimeDays} يوم`} />
                <Metric
                  label="تقييم المشترين"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      {supplier.rating.toFixed(1)}
                    </span>
                  }
                />
                <Metric label="الالتزام بالمواعيد" value={`${Math.round(supplier.onTimeRate * 100)}%`} />
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {supplier.kinds.map((k) => (
                  <span
                    key={k}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300"
                  >
                    {MATERIAL_LABELS_AR[k]}
                  </span>
                ))}
              </div>

              <ul className="mt-4 space-y-1.5">
                {supplier.products.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                    {p}
                  </li>
                ))}
              </ul>

              <p className="text-sm text-slate-500 mt-4 leading-relaxed">{supplier.notes}</p>
              <a
                href={`tel:${supplier.phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-2 mt-4 text-sm text-emerald-400 hover:text-emerald-300"
              >
                <Phone className="w-4 h-4" />
                {supplier.phone}
              </a>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-center text-slate-500 py-10">لا يوجد مورد لهذه الخامة حالياً.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-slate-500 text-xs">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold mt-2">{value}</p>
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
