// Per-client design library: every generated design can be saved under a client,
// reopened later, and used to teach the engine that client's taste.

import { idb, isBrowser, STORE_CLIENTS, STORE_DESIGNS } from "./vaultDb";
import { DEFAULT_RENDER, type RenderSettings } from "./renderEngine";
import type { DesignMode } from "./aiImage";

export interface ClientRecord {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  createdAt: number;
}

export interface DesignRecord {
  id: string;
  clientId: string;
  mode: DesignMode;
  prompt: string;
  style?: string | null;
  render: RenderSettings;
  sourceThumb?: string | null;
  resultUrl: string;
  effects: string[];
  rating: 1 | 0 | -1;
  createdAt: number;
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* ---------------- clients ---------------- */

export async function listClients(): Promise<ClientRecord[]> {
  if (!isBrowser()) return [];
  const rows = await idb.all<ClientRecord>(STORE_CLIENTS).catch(() => []);
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function createClient(name: string, phone?: string, note?: string): Promise<ClientRecord> {
  const record: ClientRecord = { id: uid(), name: name.trim() || "عميل بدون اسم", createdAt: Date.now() };
  if (phone?.trim()) record.phone = phone.trim();
  if (note?.trim()) record.note = note.trim();
  await idb.put(STORE_CLIENTS, record);
  return record;
}

export async function deleteClient(clientId: string): Promise<void> {
  const designs = await listDesigns(clientId);
  await Promise.all(designs.map((d) => idb.del(STORE_DESIGNS, d.id)));
  await idb.del(STORE_CLIENTS, clientId);
}

/* ---------------- designs ---------------- */

export async function listDesigns(clientId?: string): Promise<DesignRecord[]> {
  if (!isBrowser()) return [];
  const rows = await idb.all<DesignRecord>(STORE_DESIGNS).catch(() => []);
  return rows
    .filter((d) => !clientId || d.clientId === clientId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveDesign(input: {
  clientId: string;
  mode: DesignMode;
  prompt: string;
  style?: string | null;
  render?: RenderSettings;
  sourceUrl?: string | null;
  resultUrl: string;
  effects?: string[];
}): Promise<DesignRecord> {
  const record: DesignRecord = {
    id: uid(),
    clientId: input.clientId,
    mode: input.mode,
    prompt: input.prompt,
    style: input.style ?? null,
    render: input.render ?? DEFAULT_RENDER,
    sourceThumb: input.sourceUrl ? await shrink(input.sourceUrl, 420) : null,
    resultUrl: await shrink(input.resultUrl, 1400),
    effects: input.effects ?? [],
    rating: 0,
    createdAt: Date.now(),
  };
  await idb.put(STORE_DESIGNS, record);
  return record;
}

export async function rateDesign(id: string, rating: 1 | 0 | -1): Promise<void> {
  const design = await idb.get<DesignRecord>(STORE_DESIGNS, id);
  if (!design) return;
  await idb.put(STORE_DESIGNS, { ...design, rating });
}

export async function deleteDesign(id: string): Promise<void> {
  await idb.del(STORE_DESIGNS, id);
}

/* ---------------- learning ---------------- */

export interface TasteProfile {
  samples: number;
  keywords: { word: string; weight: number }[];
  render: RenderSettings;
  /** Extra direction appended to the prompt so new designs follow the client's taste. */
  hint: string;
}

const STOP = new Set([
  "عايز", "عاوز", "من", "في", "على", "مع", "الى", "إلى", "ده", "دي", "يكون", "و", "او", "أو",
  "the", "and", "with", "for", "a", "of",
]);

/** Learns a client's taste from their saved (and rated) designs. */
export async function buildTasteProfile(clientId: string): Promise<TasteProfile> {
  const designs = await listDesigns(clientId);
  const weightOf = (d: DesignRecord) => (d.rating === 1 ? 3 : d.rating === -1 ? -2 : 1);
  const scores = new Map<string, number>();
  for (const d of designs) {
    const w = weightOf(d);
    const words = `${d.prompt} ${d.style ?? ""} ${d.effects.join(" ")}`
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t.toLowerCase()));
    for (const word of words) scores.set(word, (scores.get(word) ?? 0) + w);
  }
  const keywords = [...scores.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, weight]) => ({ word, weight }));

  // Most frequent render settings among the designs the client liked (or kept).
  const liked = designs.filter((d) => d.rating >= 0);
  const pick = <K extends keyof RenderSettings>(key: K): RenderSettings[K] => {
    const tally = new Map<string, number>();
    for (const d of liked) {
      const value = String(d.render?.[key] ?? DEFAULT_RENDER[key]);
      tally.set(value, (tally.get(value) ?? 0) + (d.rating === 1 ? 3 : 1));
    }
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (best === undefined) return DEFAULT_RENDER[key];
    if (best === "true" || best === "false") return (best === "true") as RenderSettings[K];
    return best as RenderSettings[K];
  };

  const render: RenderSettings = liked.length
    ? {
        light: pick("light"),
        time: pick("time"),
        shadows: pick("shadows"),
        finish: pick("finish"),
        quality: pick("quality"),
        depthOfField: pick("depthOfField"),
        reflections: pick("reflections"),
      }
    : DEFAULT_RENDER;

  const hint = keywords.length
    ? `تفضيلات هذا العميل المتعلمة من أعماله السابقة: ${keywords.map((k) => k.word).join("، ")}. راعِ نفس الذوق ما لم يطلب غير ذلك.`
    : "";

  return { samples: designs.length, keywords, render, hint };
}

/* ---------------- helpers ---------------- */

/** Downscales a data URL / blob URL so the library stays light and loads fast. */
export async function shrink(src: string, maxDim: number): Promise<string> {
  if (!isBrowser()) return src;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("load failed"));
      el.src = src;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale >= 1 && src.startsWith("data:image/jpeg")) return src;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return src;
  }
}
