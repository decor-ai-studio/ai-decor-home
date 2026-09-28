// Client helper for the AI design-revision endpoint.

export interface RevisionChange {
  title: string;
  detail: string;
  area: string;
}

export interface DesignRevisionPlan {
  editPrompt: string;
  summary: string;
  changes: RevisionChange[];
  preserved: string[];
  warnings: string[];
}

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function normalise(raw: Partial<DesignRevisionPlan>): DesignRevisionPlan {
  const changes = Array.isArray(raw.changes)
    ? raw.changes
        .map((item) => ({
          title: typeof item?.title === "string" ? item.title : "",
          detail: typeof item?.detail === "string" ? item.detail : "",
          area: typeof item?.area === "string" ? item.area : "",
        }))
        .filter((item) => item.title || item.detail)
    : [];
  return {
    editPrompt: typeof raw.editPrompt === "string" ? raw.editPrompt : "",
    summary: typeof raw.summary === "string" ? raw.summary : "",
    changes,
    preserved: strings(raw.preserved),
    warnings: strings(raw.warnings),
  };
}

export async function planDesignRevision(input: {
  instructions: string;
  context?: string;
  imageDataUrl?: string | null;
  signal?: AbortSignal;
}): Promise<DesignRevisionPlan> {
  const res = await fetch("/api/revise-design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instructions: input.instructions,
      context: input.context ?? "",
      ...(input.imageDataUrl ? { imageDataUrl: input.imageDataUrl } : {}),
    }),
    signal: input.signal ?? null,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status}:${detail.slice(0, 300)}`);
  }
  const plan = normalise((await res.json()) as Partial<DesignRevisionPlan>);
  if (!plan.editPrompt) throw new Error("502:empty");
  return plan;
}

export function revisionErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.startsWith("402")) return "رصيد الذكاء الاصطناعي غير كافٍ — اشحن الرصيد وجرّب تاني.";
  if (text.startsWith("429")) return "الطلبات كتير دلوقتي — استنى شوية وحاول مرة أخرى.";
  if (text.startsWith("403")) return "الخدمة غير متاحة للحساب الحالي حاليًا.";
  if (text.startsWith("401") || text.startsWith("500")) return "خدمة الذكاء الاصطناعي غير مهيأة حاليًا.";
  return "تعذّر تنفيذ التعديل. اكتب طلبك بشكل أوضح وجرّب تاني.";
}
