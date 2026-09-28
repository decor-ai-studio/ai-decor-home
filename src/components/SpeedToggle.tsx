import { Gauge, Sparkles } from "lucide-react";
import type { SpeedMode } from "@/lib/renderCache";

interface Props {
  value: SpeedMode;
  onChange: (mode: SpeedMode) => void;
}

export default function SpeedToggle({ value, onChange }: Props) {
  const options: { key: SpeedMode; label: string; note: string; icon: typeof Gauge }[] = [
    { key: "fast", label: "مسودة سريعة", note: "أسرع وأرخص للعرض على العميل", icon: Gauge },
    { key: "quality", label: "جودة قصوى", note: "تفاصيل كاملة للتسليم النهائي", icon: Sparkles },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-500 mb-3">سرعة التوليد</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onChange(opt.key)}
              className={`text-right rounded-xl border px-3 py-2.5 transition-colors ${
                active
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="w-4 h-4" />
                {opt.label}
              </span>
              <span className="block text-[11px] mt-1 text-slate-500">{opt.note}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-600 mt-3">
        أي طلب اتعمل قبل كده بنفس الصورة والوصف بيرجع فوراً من الذاكرة بدون انتظار.
      </p>
    </div>
  );
}
