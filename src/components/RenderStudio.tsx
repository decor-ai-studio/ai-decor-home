import { ZoomableImage } from "@/components/ImageViewer";
import { Download, Eye, EyeOff, Loader2, RotateCcw, SlidersHorizontal, Layers } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BLEND_MODES,
  GRADE_PRESETS,
  NEUTRAL,
  loadImageEl,
  renderPipeline,
  withPreset,
  type Adjustments,
  type BlendMode,
} from "@/lib/imageProcessing";

interface LayerState {
  id: string;
  name: string;
  src: string;
  opacity: number;
  blend: BlendMode;
  visible: boolean;
  locked?: boolean;
}

interface Props {
  sourceUrl: string;
  renderUrl: string;
  accent?: "emerald" | "blue" | "amber";
}

const ACCENT_TEXT = {
  emerald: "text-emerald-400",
  blue: "text-blue-400",
  amber: "text-amber-400",
};

const SLIDERS: { key: keyof Adjustments; label: string; min: number; max: number }[] = [
  { key: "exposure", label: "التعريض", min: -100, max: 100 },
  { key: "contrast", label: "التباين", min: -100, max: 100 },
  { key: "highlights", label: "الإضاءات العالية", min: -100, max: 100 },
  { key: "shadows", label: "الظلال", min: -100, max: 100 },
  { key: "depth", label: "عمق ثلاثي الأبعاد", min: 0, max: 100 },
  { key: "clarity", label: "الوضوح (تباين محلي)", min: 0, max: 100 },
  { key: "sharpen", label: "حدّة التفاصيل", min: 0, max: 100 },
  { key: "bloom", label: "توهج الإضاءة", min: 0, max: 100 },
  { key: "saturation", label: "تشبّع اللون", min: -100, max: 100 },
  { key: "vibrance", label: "نُصوع اللون", min: -100, max: 100 },
  { key: "temperature", label: "حرارة اللون", min: -100, max: 100 },
  { key: "tint", label: "الصبغة", min: -100, max: 100 },
  { key: "vignette", label: "تظليل الأطراف", min: 0, max: 100 },
  { key: "grain", label: "حبيبات فيلمية", min: 0, max: 100 },
];

const PREVIEW_DIM = 760;
const DRAG_DIM = 420; // fast draft while a slider is moving
const EXPORT_DIM = 2048;

export default function RenderStudio({ sourceUrl, renderUrl, accent = "emerald" }: Props) {
  const [adj, setAdj] = useState<Adjustments>(NEUTRAL);
  const [presetId, setPresetId] = useState("neutral");
  const [layers, setLayers] = useState<LayerState[]>([]);
  const [preview, setPreview] = useState<string>(renderUrl);
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState(false);
  const [exporting, setExporting] = useState(false);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const frame = useRef<number | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLayers([
      { id: "base", name: "الصورة الأصلية", src: sourceUrl, opacity: 1, blend: "normal", visible: true, locked: true },
      { id: "render", name: "إظهار الذكاء الاصطناعي", src: renderUrl, opacity: 1, blend: "normal", visible: true },
    ]);
    setPreview(renderUrl);
  }, [sourceUrl, renderUrl]);

  const getImages = useCallback(async (list: LayerState[]) => {
    const out: { img: HTMLImageElement; opacity: number; blend: BlendMode; visible: boolean }[] = [];
    for (const layer of list) {
      let img = imgCache.current.get(layer.src);
      if (!img) {
        img = await loadImageEl(layer.src);
        imgCache.current.set(layer.src, img);
      }
      out.push({ img, opacity: layer.opacity, blend: layer.blend, visible: layer.visible });
    }
    return out;
  }, []);

  // Live preview: coalesced into one animation frame so slider drags stay smooth.
  useEffect(() => {
    if (!layers.length) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setBusy(true);
      void (async () => {
        try {
          const imgs = await getImages(layers);
          setPreview(renderPipeline(imgs, adj, DRAG_DIM, true));
          if (idle.current) clearTimeout(idle.current);
          idle.current = setTimeout(() => {
            setPreview(renderPipeline(imgs, adj, PREVIEW_DIM, true));
          }, 180);
        } catch {
          /* keep the last good preview */
        } finally {
          setBusy(false);
        }
      })();
    });
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [adj, layers, getImages]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const imgs = await getImages(layers);
      const dataUrl = renderPipeline(imgs, adj, EXPORT_DIM);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "render-3d.png";
      a.click();
    } finally {
      setExporting(false);
    }
  };

  const updateLayer = (id: string, patch: Partial<LayerState>) =>
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const activePreset = useMemo(() => GRADE_PRESETS.find((p) => p.id === presetId), [presetId]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <SlidersHorizontal className={`w-4 h-4 ${ACCENT_TEXT[accent]}`} />
          استوديو المعالجة الاحترافي
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onMouseDown={() => setCompare(true)}
            onMouseUp={() => setCompare(false)}
            onMouseLeave={() => setCompare(false)}
            onTouchStart={() => setCompare(true)}
            onTouchEnd={() => setCompare(false)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950/60 text-slate-300 hover:text-white"
          >
            قبل / بعد
          </button>
          <button
            type="button"
            onClick={() => {
              setAdj(NEUTRAL);
              setPresetId("neutral");
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950/60 text-slate-400 hover:text-white flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> تصفير
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-950">
        <ZoomableImage
          src={compare ? sourceUrl : preview}
          alt="معاينة المعالجة"
          className="w-full max-h-[420px] object-contain"
        />
      </div>

      {/* Grade presets */}
      <div className="space-y-2">
        <span className="text-xs text-slate-500">تدرّجات لونية جاهزة</span>
        <div className="flex flex-wrap gap-2">
          {GRADE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.hint}
              onClick={() => {
                setPresetId(preset.id);
                setAdj(withPreset(preset));
              }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                presetId === preset.id
                  ? "bg-slate-100/10 border-slate-400/50 text-white"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {activePreset?.hint && <p className="text-[11px] text-slate-600">{activePreset.hint}</p>}
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {SLIDERS.map((s) => (
          <label key={s.key} className="space-y-1 block">
            <span className="flex items-center justify-between text-[11px] text-slate-400">
              {s.label}
              <span className="text-slate-500 tabular-nums">{adj[s.key]}</span>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={adj[s.key]}
              onChange={(e) => {
                setPresetId("custom");
                setAdj((prev) => ({ ...prev, [s.key]: Number(e.target.value) }));
              }}
              className="w-full accent-emerald-500 h-1.5"
            />
          </label>
        ))}
      </div>

      {/* Layers */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Layers className="w-3.5 h-3.5" /> الطبقات
        </div>
        {layers.map((layer) => (
          <div
            key={layer.id}
            className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-200">{layer.name}</span>
              <button
                type="button"
                onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                className="text-slate-500 hover:text-white"
                aria-label="إظهار/إخفاء الطبقة"
              >
                {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            {!layer.locked && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(layer.opacity * 100)}
                  onChange={(e) => updateLayer(layer.id, { opacity: Number(e.target.value) / 100 })}
                  className="flex-1 accent-emerald-500 h-1.5"
                />
                <select
                  value={layer.blend}
                  onChange={(e) => updateLayer(layer.id, { blend: e.target.value as BlendMode })}
                  className="bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-300 px-2 py-1"
                >
                  {BLEND_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="w-full bg-slate-100 text-slate-900 hover:bg-white disabled:opacity-60 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        تصدير النسخة النهائية بدقة عالية
      </button>
    </div>
  );
}
