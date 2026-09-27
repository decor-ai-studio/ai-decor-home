import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ديكور AI — صمّم منزلك بالذكاء الاصطناعي" },
      { name: "description", content: "ديكور AI يساعدك على تصميم ديكور منزلك بأفكار ذكية ومُلهمة." },
      { property: "og:title", content: "ديكور AI — صمّم منزلك بالذكاء الاصطناعي" },
      { property: "og:description", content: "ديكور AI يساعدك على تصميم ديكور منزلك بأفكار ذكية ومُلهمة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});
