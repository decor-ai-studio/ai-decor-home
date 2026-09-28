// Client helper for the AI scene analysis endpoint.
import { NEUTRAL, type Adjustments } from "./imageProcessing";
import { DEFAULT_RENDER, type RenderSettings } from "./renderEngine";

export interface SceneAnalysis {
  summary: string;
  lighting: string;
  materials: string[];
  layers: string[];
  tips: string[];
  render: RenderSettings;
  adjustments: Adjustments;
}

const clamp = (value: unknown, min: number, max: number) => {
  const num = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.round(Math.max(min, Math.min(max, num)));
};

const BIPOLAR: (keyof Adjustments)[] = [
  "exposure",
  "contrast",
  "highlights",
  "shadows",
  "saturation",
  "vibrance",
  "temperature",
  "tint",
];

function normalise(raw: Partial<SceneAnalysis>): SceneAnalysis {
  const adjRaw = (raw.adjustments ?? {}) as Record<string, unknown>;
  const adjustments = { ...NEUTRAL };
  (Object.keys(NEUTRAL) as (keyof Adjustments)[]).forEach((key) => {
    adjustments[key] = clamp(adjRaw[key], BIPOLAR.includes(key) ? -100 : 0, 100);
  });
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  return {
    summary: typeof raw.summary === "string" ? raw.summary : "",
    lighting: typeof raw.lighting === "string" ? raw.lighting : "",
    materials: list(raw.materials),
    layers: list(raw.layers),
    tips: list(raw.tips),
    render: { ...DEFAULT_RENDER, ...(raw.render ?? {}) },
    adjustments,
  };
}

export async function analyzeScene(input: {
  description?: string;
  imageDataUrl?: string | null;
  signal?: AbortSignal;
}): Promise<SceneAnalysis> {
  const res = await fetch("/api/analyze-scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: input.description ?? "",
      ...(input.imageDataUrl ? { imageDataUrl: input.imageDataUrl } : {}),
    }),
    signal: input.signal ?? null,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status}:${detail.slice(0, 300)}`);
  }
  return normalise((await res.json()) as Partial<SceneAnalysis>);
}

export function analysisErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.startsWith("402")) return "رصيد الذكاء الاصطناعي غير كافٍ — اشحن الرصيد وجرّب تاني.";
  if (text.startsWith("429")) return "الطلبات كتير دلوقتي — استنى شوية وحاول مرة أخرى.";
  if (text.startsWith("401") || text.startsWith("500")) return "خدمة الذكاء الاصطناعي غير مهيأة حاليًا.";
  return "تعذّر تحليل المشهد. جرّب مرة أخرى أو اكتب وصفًا أوضح.";
}
