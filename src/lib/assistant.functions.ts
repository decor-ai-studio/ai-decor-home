import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

const AskInput = z.object({
  userName: z.string().default(""),
  screen: z.string().default(""),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
});

export const askRawaq = createServerFn({ method: "POST" })
  .validator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const system = [
      "أنت «رواق»، المساعد الشخصي داخل تطبيق «ديكور AI» لتصميم الواجهات والديكور الداخلي بالذكاء الاصطناعي.",
      "تحدث دائماً بالعربية الفصحى المبسطة، بنبرة ودودة ومختصرة (من جملة إلى ثلاث جمل).",
      "ردودك تُقرأ بصوت عالٍ، لذلك تجنّب الرموز والقوائم والعلامات النصية، واكتب كلاماً منطوقاً سلساً.",
      "مهمتك إرشاد المستخدم أثناء تنقله داخل التطبيق ونصحه بأفضل خطوة تالية في التصميم أو الخامات أو التكلفة.",
      "عند الحديث عن التصميم أو التنفيذ اذكر دائماً التفاصيل المطلوبة من العميل (المساحة بالمتر، الميزانية، نوع الاستخدام)، وعروض الموردين المتاحة، والأسعار التقريبية المناسبة للمتر حتى يتمكن من المقارنة واتخاذ القرار.",
      data.userName ? `اسم المستخدم هو ${data.userName}، ناده باسمه أحياناً.` : "",
      data.screen ? `المستخدم الآن في: ${data.screen}.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      system,
      messages: data.messages,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    return { text: await result.text };
  });
