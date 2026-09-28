import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, Save, SlidersHorizontal, X } from "lucide-react";
import { listClients, type ClientRecord } from "@/lib/clientVault";
import {
  DEFAULT_SETTINGS, PRESETS, QUALITY_LABEL, exportImage, exportVideo, getClientPrefs, saveClientPrefs, targetSize,
  type ExportSettings, type MediaKind, type Quality,
} from "@/lib/exportPresets";

interface Props {
  src: string;
  kind: MediaKind;
  clientId?: string | null;
  fileName?: string;
  onClose: () => void;
}

export function ExportDialog({ src, kind, clientId: initialClient = null, fileName = "rawaq-export", onClose }: Props) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientId, setClientId] = useState<string | null>(initialClient);
  const [s, setS] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("");

  const presets = useMemo(() => PRESETS.filter((p) => p.kinds.includes(kind)), [kind]);
  useEffect(() => { listClients().then(setClients); }, []);
  useEffect(() => {
    const saved = getClientPrefs(clientId, kind);
    setS(saved ?? { ...DEFAULT_SETTINGS, presetId: presets[0]!.id });
    setMsg(saved ? "تم تحميل الإعدادات المفضلة لهذا العميل" : "");
  }, [clientId, kind, presets]);

  const preset = presets.find((p) => p.id === s.presetId) ?? presets[0]!;
  const size = targetSize(preset, s.quality);
  const platforms = [...new Set(presets.map((p) => p.platform))];

  const run = async () => {
    setBusy(true); setProgress(0); setMsg("");
    try {
      let blob: Blob, ext: string;
      if (kind === "image") { blob = await exportImage(src, s); ext = s.imageFormat === "jpeg" ? "jpg" : s.imageFormat; }
      else ({ blob, ext } = await exportVideo(src, { ...s, presetId: preset.id }, setProgress));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName}-${preset.id}-${size.w}x${size.h}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setMsg("تم التصدير بنجاح");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "فشل التصدير");
    } finally { setBusy(false); }
  };

  const save = () => {
    saveClientPrefs(clientId, kind, { ...s, presetId: preset.id });
    setMsg(clientId ? "تم حفظ الإعدادات كمفضلة لهذا العميل" : "تم حفظها كإعدادات افتراضية");
  };

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-lg border text-xs text-right transition-colors ${active ? "bg-emerald-500/15 border-emerald-400/60 text-emerald-200" : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600"}`;

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="قوالب التصدير">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-5 text-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-emerald-400" /> قوالب تصدير {kind === "image" ? "الصورة" : "الفيديو"}</h3>
          <button onClick={onClose} aria-label="إغلاق" className="p-2 rounded-lg border border-slate-800"><X className="w-4 h-4" /></button>
        </div>

        <label className="block text-xs text-slate-400 space-y-1">
          <span>العميل (تُحفظ الإعدادات المفضلة لكل عميل)</span>
          <select value={clientId ?? ""} onChange={(e) => setClientId(e.target.value || null)} className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-100">
            <option value="">بدون عميل (افتراضي)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <div className="space-y-3">
          <p className="text-xs text-slate-400">المنصة والمقاس</p>
          {platforms.map((pl) => (
            <div key={pl} className="space-y-1.5">
              <p className="text-[11px] text-slate-500">{pl}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {presets.filter((p) => p.platform === pl).map((p) => (
                  <button key={p.id} type="button" onClick={() => setS({ ...s, presetId: p.id })} className={chip(p.id === preset.id)}>
                    <div>{p.label}</div>
                    <div className="text-[10px] opacity-60 tabular-nums">{p.width}×{p.height}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <p className="text-xs text-slate-400">الجودة</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
                <button key={q} type="button" onClick={() => setS({ ...s, quality: q })} className={chip(s.quality === q)}>{QUALITY_LABEL[q]}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-slate-400">ملاءمة الإطار</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setS({ ...s, fit: "cover" })} className={chip(s.fit === "cover")}>ملء وقص</button>
              <button type="button" onClick={() => setS({ ...s, fit: "contain" })} className={chip(s.fit === "contain")}>احتواء بإطار</button>
            </div>
          </div>
          {kind === "image" && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400">الصيغة</p>
              <div className="grid grid-cols-3 gap-2">
                {(["png", "jpeg", "webp"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setS({ ...s, imageFormat: f })} className={chip(s.imageFormat === f)}>{f.toUpperCase()}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">المقاس النهائي: <span className="tabular-nums text-slate-200">{size.w}×{size.h}</span>{kind === "video" && " · يُعاد ترميز الفيديو داخل المتصفح بطول المقطع"}</p>

        {busy && kind === "video" && (
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        )}
        {msg && <p className="text-xs text-emerald-300">{msg}</p>}

        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={save} className="px-4 py-2 rounded-lg border border-slate-700 text-sm flex items-center gap-1.5"><Save className="w-4 h-4" /> حفظ كمفضلة</button>
          <button type="button" disabled={busy} onClick={run} className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} تصدير
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
