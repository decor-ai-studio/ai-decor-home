import { Sun, Moon, Layers3, Sparkles } from "lucide-react";
import {
  DEFAULT_RENDER,
  FINISH_LABELS,
  LIGHT_LABELS,
  QUALITY_LABELS,
  SHADOW_LABELS,
  TIME_LABELS,
  type Finish,
  type LightDirection,
  type RenderQuality,
  type RenderSettings,
  type ShadowStrength,
  type TimeOfDay,
} from "@/lib/renderEngine";

interface Props {
  value: RenderSettings;
  onChange: (next: RenderSettings) => void;
  accent?: "emerald" | "blue" | "amber";
}

const ACCENTS = {
  emerald: { on: "bg-emerald-500/15 border-emerald-500/50 text-emerald-300", icon: "text-emerald-400" },
  blue: { on: "bg-blue-500/15 border-blue-500/50 text-blue-300", icon: "text-blue-400" },
  amber: { on: "bg-amber-500/15 border-amber-500/50 text-amber-300", icon: "text-amber-400" },
};

function Row<T extends string>({
  label,
  options,
  value,
  onSelect,
  accent,
}: {
  label: string;
  options: Record<T, string>;
  value: T;
  onSelect: (v: T) => void;
  accent: keyof typeof ACCENTS;
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(options) as T[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              value === key
                ? ACCENTS[accent].on
                : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            {options[key]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RenderControls({ value, onChange, accent = "emerald" }: Props) {
  const set = <K extends keyof RenderSettings>(key: K, v: RenderSettings[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Layers3 className={`w-4 h-4 ${ACCENTS[accent].icon}`} />
          محرّك الإظهار ثلاثي الأبعاد
        </div>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_RENDER)}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          إعادة ضبط
        </button>
      </div>

      <Row<LightDirection>
        label="اتجاه الإضاءة"
        options={LIGHT_LABELS}
        value={value.light}
        onSelect={(v) => set("light", v)}
        accent={accent}
      />
      <Row<TimeOfDay>
        label="وقت الإضاءة"
        options={TIME_LABELS}
        value={value.time}
        onSelect={(v) => set("time", v)}
        accent={accent}
      />
      <Row<ShadowStrength>
        label="قوة الظلال"
        options={SHADOW_LABELS}
        value={value.shadows}
        onSelect={(v) => set("shadows", v)}
        accent={accent}
      />
      <Row<Finish>
        label="تشطيب الخامة"
        options={FINISH_LABELS}
        value={value.finish}
        onSelect={(v) => set("finish", v)}
        accent={accent}
      />
      <Row<RenderQuality>
        label="جودة الإظهار"
        options={QUALITY_LABELS}
        value={value.quality}
        onSelect={(v) => set("quality", v)}
        accent={accent}
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => set("reflections", !value.reflections)}
          className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
            value.reflections
              ? ACCENTS[accent].on
              : "bg-slate-950/60 border-slate-800 text-slate-400"
          }`}
        >
          <Sparkles className="w-3 h-3" /> انعكاسات واقعية
        </button>
        <button
          type="button"
          onClick={() => set("depthOfField", !value.depthOfField)}
          className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
            value.depthOfField
              ? ACCENTS[accent].on
              : "bg-slate-950/60 border-slate-800 text-slate-400"
          }`}
        >
          {value.depthOfField ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />} عمق ميدان سينمائي
        </button>
      </div>
    </div>
  );
}
