import { createFileRoute } from "@tanstack/react-router";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["editPrompt", "summary", "changes", "preserved", "warnings"],
  properties: {
    // English, image-model-ready edit brief.
    editPrompt: { type: "string" },
    // Arabic explanation shown to the designer.
    summary: { type: "string" },
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "area"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          area: { type: "string" },
        },
      },
    },
    preserved: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

const SYSTEM = `You are a senior architectural / signage design director reviewing a designer's revision request
on an existing design image.

Produce:
1. editPrompt — a precise ENGLISH image-editing brief for a photoreal image model. Describe exactly which
   elements change (materials, colours, signage, lighting, layout, furniture) and explicitly state that the
   camera angle, perspective, geometry and everything not mentioned must stay identical. If the request
   contains Arabic text that must appear in the design, quote it letter-for-letter and require correct
   connected right-to-left Arabic letterforms.
2. summary — a short Arabic paragraph telling the designer what the new version will look like.
3. changes — each concrete modification: title (short Arabic label), detail (Arabic explanation of what
   changed and why it fits), area (Arabic name of the affected part of the design).
4. preserved — Arabic list of what is deliberately kept unchanged.
5. warnings — Arabic list of risks, missing information or requests that may not be technically feasible.
   Use an empty array when there are none.

All Arabic text must be clear, professional Egyptian-friendly Arabic. No markdown, no emojis.`;

export const Route = createFileRoute("/api/revise-design")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as {
          instructions?: string;
          context?: string;
          imageDataUrl?: string;
        };
        const instructions = body.instructions?.trim() ?? "";
        if (!instructions) return new Response("Missing instructions", { status: 400 });

        const content: Record<string, unknown>[] = [
          {
            type: "input_text",
            text: [
              `طلب التعديل من المصمم: ${instructions}`,
              body.context?.trim() ? `سياق إضافي عن المشروع: ${body.context.trim()}` : "",
              body.imageDataUrl
                ? "التصميم الحالي مرفق كصورة — اعتمد عليه في تحديد ما يتغيّر وما يبقى."
                : "لا توجد صورة مرفقة — اعتمد على الوصف النصي.",
            ]
              .filter(Boolean)
              .join("\n"),
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
              format: { type: "json_schema", name: "design_revision", strict: true, schema: SCHEMA },
            },
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          return new Response(detail || "AI gateway error", { status: upstream.status || 502 });
        }

        // Reasoning responses must stream; assemble the JSON server-side.
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
              /* keep-alive / partial frame */
            }
          }
        }

        if (!text.trim()) return new Response("Empty revision", { status: 502 });
        try {
          return Response.json(JSON.parse(text));
        } catch {
          return new Response("Malformed revision", { status: 502 });
        }
      },
    },
  },
});
