// Client-safe server functions: live web research + AI analysis of storefront /
// signage / cladding / illuminated-lettering trends, plus market price signals
// that feed the self-learning pricing engine.

import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";
import { researchWeb, buildCorpus, RESEARCH_TOPICS, type ResearchTopic } from "./webResearch.server";

const TrendInput = z.object({
  topics: z.array(z.enum(["storefront", "signage", "cladding", "lighting"])).min(1),
  brief: z.string().max(600),
  regionIndex: z.number().min(0.6).max(2),
});

/** Strict-compatible: object root, every property required, no defaults, no constraints. */
const TrendSchema = z.object({
  summaryAr: z.string(),
  styleDirections: z.array(
        z.object({
      nameAr: z.string(),
      descriptionAr: z.string(),
      palette: z.array(z.string()),
      claddingAr: z.string(),
      letteringAr: z.string(),
      popularity: z.number(),
    }),
  ),
  materialInsights: z.array(
    z.object({
      materialAr: z.string(),
      trendAr: z.string(),
      recommendationAr: z.string(),
    }),
  ),
  letteringStandards: z.array(
    z.object({
      titleAr: z.string(),
      detailAr: z.string(),
    }),
  ),
  priceSignals: z.array(
    z.object({
      kind: z.enum(["aluminum_cladding", "acrylic", "led_letters", "installation_accessories"]),
      quantity: z.number(),
      complexity: z.number(),
      qualityTier: z.number(),
      laborHours: z.number(),
      observedPrice: z.number(),
      rationaleAr: z.string(),
    }),
  ),
});

export type TrendReport = z.infer<typeof TrendSchema> & {
  sources: Array<{ url: string; title: string; ok: boolean }>;
  generatedAt: number;
};

export const fetchDesignTrends = createServerFn({ method: "POST" })
  .validator((input: unknown) => TrendInput.parse(input))
  .handler(async ({ data }): Promise<TrendReport> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const topics = data.topics as ResearchTopic[];
    const sources = await researchWeb(topics.length ? topics : RESEARCH_TOPICS);
    const corpus = buildCorpus(sources);

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      output: Output.object({ schema: TrendSchema }),
      system: [
        "أنت خبير تصميم واجهات المحال واللوحات الدعائية والكلادنج والحروف المضيئة في السوق المصري والعربي.",
        "حلّل محتوى الويب المرفق واستخرج اتجاهات التصميم الحديثة، ثم اربطها بمعايير التنفيذ المحلية.",
        "اكتب كل النصوص بالعربية الواضحة. أعطِ 3 إلى 4 اتجاهات تصميم، 3 ملاحظات مواد،",
        "3 معايير للحروف المضيئة، و4 إشارات تسعير واقعية بالجنيه المصري (سعر إجمالي للبند).",
        "popularity رقم بين 0 و 1، complexity بين 0 و 1، qualityTier بين 1 و 3.",
        "palette عبارة عن أكواد ألوان hex.",
      ].join(" "),
      prompt: [
        `طلب المستخدم: ${data.brief || "اتجاهات عامة حديثة لواجهات المحال والحروف المضيئة"}`,
        `معامل تكلفة المنطقة: ${data.regionIndex}`,
        corpus
          ? `محتوى مأخوذ من الويب الآن:\n${corpus}`
          : "لم يتعذّر جلب محتوى الويب؛ اعتمد على خبرتك واذكر ذلك في الملخص.",
      ].join("\n\n"),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const report = await result.output;

    return {
      ...report,
      sources: sources.map((s) => ({ url: s.url, title: s.title, ok: s.ok })),
      generatedAt: Date.now(),
    };
  });
