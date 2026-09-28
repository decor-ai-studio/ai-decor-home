import { createFileRoute } from "@tanstack/react-router";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

const ADJUSTMENT_KEYS = [
  "exposure",
  "contrast",
  "highlights",
  "shadows",
  "saturation",
  "vibrance",
  "temperature",
  "tint",
  "clarity",
  "sharpen",
  "depth",
  "bloom",
  "vignette",
  "grain",
] as const;

const adjustmentProps = Object.fromEntries(
  ADJUSTMENT_KEYS.map((key) => [key, { type: "number" }]),
);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "lighting", "materials", "layers", "tips", "render", "adjustments"],
  properties: {
    summary: { type: "string" },
    lighting: { type: "string" },
    materials: { type: "array", items: { type: "string" } },
    layers: { type: "array", items: { type: "string" } },
    tips: { type: "array", items: { type: "string" } },
    render: {
      type: "object",
      additionalProperties: false,
      required: ["light", "time", "shadows", "finish", "quality", "depthOfField", "reflections"],
      properties: {
        light: { type: "string", enum: ["front", "left", "right", "top", "back"] },
        time: { type: "string", enum: ["noon", "golden", "dusk", "night", "overcast"] },
        shadows: { type: "string", enum: ["soft", "natural", "dramatic"] },
        finish: { type: "string", enum: ["matte", "satin", "gloss", "metallic", "glass"] },
        quality: { type: "string", enum: ["balanced", "high", "ultra"] },
        depthOfField: { type: "boolean" },
        reflections: { type: "boolean" },
      },
    },
    adjustments: {
      type: "object",
      additionalProperties: false,
      required: [...ADJUSTMENT_KEYS],
      properties: adjustmentProps,
    },
  },
} as const;

const SYSTEM = `You are a senior architectural visualisation artist and colourist.
Analyse the scene the designer supplies (a photo, a written description, or both) and report:
- lighting: direction, quality, colour temperature and shadow behaviour;
- materials: the surfaces you can identify (cladding, glass, metal, wood, acrylic, signage...);
- layers: how you would separate the scene for compositing (background, building, signage, lighting, reflections, foreground...);
- tips: concrete professional retouching advice.
Then propose render settings and post-processing adjustment values that would make the final image
look like a photoreal 3D architectural render. Adjustment values are integers:
exposure/contrast/highlights/shadows/saturation/vibrance/temperature/tint are -100..100,
clarity/sharpen/depth/bloom/vignette/grain are 0..100. Keep them tasteful (mostly between -40 and 55).
Write every text field in clear Egyptian-Arabic-friendly Modern Standard Arabic. No markdown, no emojis.`;

export const Route = createFileRoute("/api/analyze-scene")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as { description?: string; imageDataUrl?: string };
        const description = body.description?.trim() ?? "";
        if (!description && !body.imageDataUrl) {
          return new Response("Missing scene input", { status: 400 });
        }

        const content: Record<string, unknown>[] = [
          {
            type: "input_text",
            text: description
              ? `وصف المشهد من المصمم: ${description}`
              : "حلّل الصورة المرفقة واقترح إعدادات المعالجة المناسبة.",
          },
        ];
        if (body.imageDataUrl) {
          content.push({ type: "input_image", image_url: body.imageDataUrl });
        }

        const upstream = await fetch(GATEWAY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: MODEL,
            stream: true,
            store: false,
            instructions: SYSTEM,
            input: [{ role: "user", content }],
            reasoning: { effort: "low" },
            text: {
              format: { type: "json_schema", name: "scene_analysis", strict: true, schema: SCHEMA },
            },
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          return new Response(detail || "AI gateway error", { status: upstream.status || 502 });
        }

        // Consume the SSE stream server-side and return the assembled JSON object.
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const event = JSON.parse(payload) as {
                type?: string;
                delta?: string;
                response?: { output_text?: string };
              };
              if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
                text += event.delta;
              } else if (event.type === "response.completed" && event.response?.output_text) {
                if (!text) text = event.response.output_text;
              }
            } catch {
              /* ignore keep-alive / partial frames */
            }
          }
        }

        if (!text.trim()) return new Response("Empty analysis", { status: 502 });
        try {
          return Response.json(JSON.parse(text));
        } catch {
          return new Response("Malformed analysis", { status: 502 });
        }
      },
    },
  },
});
