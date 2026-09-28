import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const PATTERNS = ["bottom-up", "top-down", "left-right", "right-left", "center-out", "outside-in", "diagonal", "spiral", "random"] as const;
const MATERIALS = ["none", "cladding-a", "cladding-b", "signage-a", "signage-b"] as const;
const TRACKS = ["corporate", "cinematic", "oriental", "electronic", "calm", "none"] as const;

const Input = z.object({ image: z.string().startsWith("data:image/").max(8_000_000) });

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "pattern", "duration", "cols", "trackId", "materialId", "caption", "reason", "steps"],
  properties: {
    subject: { type: "string", description: "وصف قصير بالعربية لمحتوى الصورة" },
    pattern: { type: "string", enum: PATTERNS },
    duration: { type: "integer", minimum: 4, maximum: 90 },
    cols: { type: "integer", minimum: 6, maximum: 28 },
    trackId: { type: "string", enum: TRACKS },
    materialId: { type: "string", enum: MATERIALS, description: "الخامة الحقيقية الأنسب لتُدمج على القطع؛ none لو لا تناسب" },
    caption: { type: "string", description: "نص قصير جذاب بالعربية يظهر على الفيديو" },
    reason: { type: "string", description: "لماذا يناسب هذا التسلسل الصورة، بالعربية" },
    steps: { type: "array", items: { type: "string" }, description: "3-5 مراحل تركيب بالعربية بالترتيب" },
  },
};

const PROMPT = `أنت مخرج فيديوهات تركيب بنمط قطع الليجو. حلّل الصورة واقترح تسلسل تركيب مخصصاً لها.
أنماط التسلسل: bottom-up (من الأساس للأعلى، مناسب للمباني والواجهات)، top-down، left-right، right-left، center-out (العنصر الرئيسي في الوسط)، outside-in (الإطار ثم المركز)، diagonal، spiral (حركة ديناميكية)، random (فني/تجريدي).
cols: عدد أعمدة القطع (تفاصيل دقيقة = أكثر). اختر موسيقى تناسب المزاج. اختر materialId: cladding-a أو cladding-b لواجهات الكلادنج والمعدن والألواح، signage-a أو signage-b للافتات والحروف والإعلانات، أو none إن كانت الصورة داخلية أو لا تناسبها خامة. اكتب كل النصوص بالعربية وباختصار.`;

async function readStreamedText(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") text += ev.delta;
        if (ev.type === "response.failed" || ev.type === "error") throw new Error(ev.response?.error?.message ?? ev.message ?? "فشل التحليل");
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  return text;
}

export const Route = createFileRoute("/api/build-sequence")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Input.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "صورة غير صالحة" }, { status: 400 });
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "مفتاح الذكاء الاصطناعي غير مُعد" }, { status: 500 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          signal: request.signal,
          headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            stream: true,
            store: false,
            reasoning: { effort: "low" },
            input: [
              {
                role: "user",
                content: [
                  { type: "input_text", text: PROMPT },
                  { type: "input_image", image_url: parsed.data.image },
                ],
              },
            ],
            text: { format: { type: "json_schema", name: "build_sequence", strict: true, schema } },
          }),
        });

        if (!res.ok) {
          const msg =
            res.status === 429 ? "طلبات كثيرة، حاول بعد قليل" : res.status === 402 ? "رصيد الذكاء الاصطناعي غير كافٍ" : "تعذّر تحليل الصورة";
          return Response.json({ error: msg }, { status: res.status });
        }
        try {
          const text = await readStreamedText(res);
          return Response.json(JSON.parse(text));
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "تعذّر تحليل الصورة" }, { status: 502 });
        }
      },
    },
  },
});
