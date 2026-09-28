import { Check, FolderPlus, Loader2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  buildTasteProfile,
  createClient,
  listClients,
  saveDesign,
  type ClientRecord,
} from "@/lib/clientVault";
import type { DesignMode } from "@/lib/aiImage";
import type { RenderSettings } from "@/lib/renderEngine";

interface Props {
  mode: DesignMode;
  prompt: string;
  render: RenderSettings;
  sourceUrl: string | null;
  resultUrl: string;
  effects: string[];
  /** Notifies the parent which client is active so its taste can steer the next design. */
  onClientChange?: (clientId: string | null, hint: string) => void;
}

export default function SaveToClient({
  mode,
  prompt,
  render,
  sourceUrl,
  resultUrl,
  effects,
  onClientChange,
}: Props) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [samples, setSamples] = useState(0);

  useEffect(() => {
    void listClients().then(setClients);
  }, []);

  useEffect(() => {
    if (!clientId) {
      setSamples(0);
      onClientChange?.(null, "");
      return;
    }
    void buildTasteProfile(clientId).then((p) => {
      setSamples(p.samples);
      onClientChange?.(clientId, p.hint);
    });
    // onClientChange is a stable callback in the dashboards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const client = await createClient(newName);
    setClients((prev) => [client, ...prev]);
    setClientId(client.id);
    setNewName("");
    setAdding(false);
  };

  const handleSave = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      await saveDesign({ clientId, mode, prompt, render, sourceUrl, resultUrl, effects });
      setSaved(true);
      const profile = await buildTasteProfile(clientId);
      setSamples(profile.samples);
      onClientChange?.(clientId, profile.hint);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
      <p className="text-xs text-slate-500">حفظ التصميم في ملف العميل</p>
      <div className="flex flex-wrap gap-2">
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="flex-1 min-w-[180px] rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm text-slate-200"
        >
          <option value="">اختر العميل…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-300 hover:border-slate-700 flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> عميل جديد
        </button>
        <button
          onClick={handleSave}
          disabled={!clientId || saving}
          className="rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
          {saved ? "تم الحفظ" : "حفظ للعميل"}
        </button>
      </div>

      {adding && (
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم العميل"
            className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm text-slate-200"
          />
          <button onClick={handleAdd} className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-100">
            إضافة
          </button>
        </div>
      )}

      {clientId > "" && (
        <p className="text-[11px] text-slate-500">
          {samples
            ? `الخوارزمية اتعلمت من ${samples} تصميم لهذا العميل وهتراعي ذوقه في التوليد القادم.`
            : "أول تصميم لهذا العميل — كل ما تحفظ أكتر كل ما التوليد يقرب لذوقه."}
        </p>
      )}
    </div>
  );
}
