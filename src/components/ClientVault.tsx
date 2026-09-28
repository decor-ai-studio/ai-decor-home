import { ExportDialog } from "@/components/ExportDialog";
import { ZoomableImage } from "@/components/ImageViewer";
import { ArrowRight, Brain, Trash2, ThumbsDown, ThumbsUp, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  buildTasteProfile,
  createClient,
  deleteClient,
  deleteDesign,
  listClients,
  listDesigns,
  rateDesign,
  type ClientRecord,
  type DesignRecord,
  type TasteProfile,
} from "@/lib/clientVault";

function ExportHost({ d, onClose }: { d: DesignRecord | null; onClose: () => void }) {
  return d ? <ExportDialog src={d.resultUrl} kind="image" clientId={d.clientId} onClose={onClose} /> : null;
}

interface Props {
  onBack: () => void;
}

export default function ClientVault({ onBack }: Props) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [active, setActive] = useState<string>("");
  const [exportD, setExportD] = useState<DesignRecord | null>(null);
  const [designs, setDesigns] = useState<DesignRecord[]>([]);
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [name, setName] = useState("");

  const refreshClients = useCallback(async () => {
    const rows = await listClients();
    setClients(rows);
    setActive((prev) => prev || rows[0]?.id || "");
  }, []);

  const refreshDesigns = useCallback(async (clientId: string) => {
    if (!clientId) {
      setDesigns([]);
      setProfile(null);
      return;
    }
    setDesigns(await listDesigns(clientId));
    setProfile(await buildTasteProfile(clientId));
  }, []);

  useEffect(() => {
    void refreshClients();
  }, [refreshClients]);

  useEffect(() => {
    void refreshDesigns(active);
  }, [active, refreshDesigns]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const client = await createClient(name);
    setName("");
    await refreshClients();
    setActive(client.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <ExportHost d={exportD} onClose={() => setExportD(null)} />
      <div className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-sm text-slate-400 hover:text-white flex items-center gap-2 bg-slate-800/60 px-4 py-2 rounded-lg border border-slate-700/60"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </button>
          <div className="flex items-center gap-2 text-sm font-medium text-sky-400">
            <Users className="w-4 h-4" /> ملفات العملاء والتصميمات المحفوظة
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* Clients */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <p className="text-xs text-slate-500">إضافة عميل</p>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم العميل"
                className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm"
              />
              <button onClick={handleAdd} className="rounded-xl bg-sky-500/90 px-3 py-2 text-slate-950">
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 divide-y divide-slate-800/70 overflow-hidden">
            {clients.length === 0 && <p className="p-4 text-sm text-slate-500">لسه مفيش عملاء محفوظين.</p>}
            {clients.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between px-4 py-3 text-sm cursor-pointer ${
                  active === c.id ? "bg-sky-500/10 text-sky-300" : "text-slate-300 hover:bg-slate-800/40"
                }`}
                onClick={() => setActive(c.id)}
              >
                <span>{c.name}</span>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await deleteClient(c.id);
                    setActive("");
                    await refreshClients();
                  }}
                  className="text-slate-600 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Designs */}
        <section className="space-y-6">
          {profile && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Brain className="w-4 h-4 text-sky-400" /> ما تعلّمته الخوارزمية عن هذا العميل
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {profile.samples} تصميم محفوظ — التقييم بالإعجاب يقوّي التعلم.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.keywords.length === 0 && (
                  <span className="text-xs text-slate-600">احفظ تصميمات أكتر عشان تظهر تفضيلاته.</span>
                )}
                {profile.keywords.map((k) => (
                  <span key={k.word} className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-300">
                    {k.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {designs.length === 0 && (
              <p className="text-sm text-slate-500">لا توجد تصميمات محفوظة لهذا العميل بعد.</p>
            )}
            {designs.map((d) => (
              <div key={d.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                <ZoomableImage src={d.resultUrl} alt={d.prompt} className="w-full h-44 object-cover" />
                <div className="p-4 space-y-2">
                  <p className="text-sm text-slate-200 line-clamp-2">{d.prompt || "بدون وصف"}</p>
                  <p className="text-[11px] text-slate-500">
                    {new Date(d.createdAt).toLocaleDateString("ar-EG")} · {d.effects.slice(0, 2).join("، ")}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => setExportD(d)} className="rounded-lg border border-slate-800 px-2 py-1 text-xs text-slate-300">تصدير</button>
                    <button
                      onClick={async () => {
                        await rateDesign(d.id, d.rating === 1 ? 0 : 1);
                        await refreshDesigns(active);
                      }}
                      className={`rounded-lg border px-2 py-1 ${d.rating === 1 ? "border-emerald-500/50 text-emerald-400" : "border-slate-800 text-slate-500"}`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        await rateDesign(d.id, d.rating === -1 ? 0 : -1);
                        await refreshDesigns(active);
                      }}
                      className={`rounded-lg border px-2 py-1 ${d.rating === -1 ? "border-red-500/50 text-red-400" : "border-slate-800 text-slate-500"}`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        await deleteDesign(d.id);
                        await refreshDesigns(active);
                      }}
                      className="ms-auto rounded-lg border border-slate-800 px-2 py-1 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
