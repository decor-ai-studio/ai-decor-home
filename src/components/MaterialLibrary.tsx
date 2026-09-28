import { useMemo, useState } from "react";
import { Check, ExternalLink, Info, Layers3, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MATERIALS, MATERIAL_CATEGORIES, type Material, type MaterialCategory } from "@/data/materials";

type Accent = "emerald" | "blue" | "amber";

interface MaterialLibraryProps {
  accent?: Accent;
  compact?: boolean;
  onSelect?: (prompt: string) => void;
}

const accents: Record<Accent, { text: string; border: string; active: string; button: string }> = {
  emerald: { text: "text-emerald-400", border: "hover:border-emerald-500/50", active: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300", button: "bg-emerald-600 hover:bg-emerald-500" },
  blue: { text: "text-blue-400", border: "hover:border-blue-500/50", active: "border-blue-500/50 bg-blue-500/10 text-blue-300", button: "bg-blue-600 hover:bg-blue-500" },
  amber: { text: "text-amber-400", border: "hover:border-amber-500/50", active: "border-amber-500/50 bg-amber-500/10 text-amber-300", button: "bg-amber-600 hover:bg-amber-500" },
};

const imagePosition = { left: "0% center", center: "50% center", right: "100% center" } as const;

export default function MaterialLibrary({ accent = "emerald", compact = false, onSelect }: MaterialLibraryProps) {
  const [category, setCategory] = useState<"all" | MaterialCategory>("all");
  const [selected, setSelected] = useState<Material | null>(null);
  const theme = accents[accent];
  const visible = useMemo(() => MATERIALS.filter((item) => category === "all" || item.category === category), [category]);

  const choose = (material: Material) => {
    onSelect?.(material.prompt);
    setSelected(null);
  };

  return (
    <section aria-labelledby={`materials-${accent}`} className={compact ? "space-y-4" : "bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-5"}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className={`flex items-center gap-2 ${theme.text}`}>
            <Layers3 className="w-5 h-5" />
            <h3 id={`materials-${accent}`} className="font-bold text-lg">مكتبة خامات السوق</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">صور توضيحية ومواصفات مرجعية لاختيار خامة التصميم</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="تصنيفات الخامات">
          {MATERIAL_CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={category === item.id}
              onClick={() => setCategory(item.id)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${category === item.id ? theme.active : "border-slate-700/70 text-slate-400 hover:text-slate-200"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}>
        {visible.map((material) => (
          <button
            key={material.id}
            type="button"
            onClick={() => setSelected(material)}
            className={`group overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 text-right transition-all ${theme.border} hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current`}
            aria-label={`عرض تفاصيل ${material.nameAr}`}
          >
            <div className="relative h-28 overflow-hidden">
              <img
                src={material.image}
                alt={`صورة توضيحية لخامة ${material.nameAr}`}
                loading="lazy"
                width={1536}
                height={1024}
                className="h-full w-[300%] max-w-none object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                style={{ objectPosition: imagePosition[material.imagePosition], transform: `translateX(${material.imagePosition === "left" ? "0" : material.imagePosition === "center" ? "33.333%" : "66.666%"})` }}
              />
              {material.trend && <span className="absolute top-2 right-2 rounded-full bg-slate-950/85 px-2 py-1 text-[10px] text-white backdrop-blur">{material.trend}</span>}
              <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950 to-transparent" />
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-semibold text-slate-100">{material.nameAr}</p>
              <p className="truncate text-[11px] text-slate-500" dir="ltr">{material.nameEn}</p>
            </div>
          </button>
        ))}
      </div>

      {!compact && <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />آخر مراجعة: 20 يونيو 2025 — الصور توضيحية. اعتمد المواصفات النهائية وشهادات الحريق من المورد والجهة المحلية.</p>}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto border-slate-700 bg-slate-900 p-0 text-white sm:max-w-2xl">
            <div className="h-56 overflow-hidden rounded-t-lg">
              <img
                src={selected.image}
                alt={`تفاصيل ${selected.nameAr}`}
                loading="lazy"
                width={1536}
                height={1024}
                className="h-full w-[300%] max-w-none object-cover"
                style={{ objectPosition: imagePosition[selected.imagePosition], transform: `translateX(${selected.imagePosition === "left" ? "0" : selected.imagePosition === "center" ? "33.333%" : "66.666%"})` }}
              />
            </div>
            <div className="space-y-5 p-6">
              <div>
                <DialogTitle className="text-right text-xl">{selected.nameAr}</DialogTitle>
                <DialogDescription className="mt-1 text-right text-slate-500" dir="ltr">{selected.nameEn}</DialogDescription>
              </div>
              <p className="text-sm leading-7 text-slate-300">{selected.summary}</p>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="mb-3 text-xs font-semibold text-slate-400">مواصفات سريعة</p>
                <ul className="space-y-2">
                  {selected.specifications.map((spec) => <li key={spec} className="flex gap-2 text-sm text-slate-300"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${theme.text}`} />{spec}</li>)}
                </ul>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                  <ExternalLink className="h-3.5 w-3.5" /> المصدر: {selected.sourceLabel}
                </a>
                {onSelect && <button type="button" onClick={() => choose(selected)} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${theme.button}`}><Sparkles className="h-4 w-4" />استخدم في التصميم</button>}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}