import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-5">
        <img src="/icons/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
        <span className="text-lg font-bold">ديكور AI</span>
      </header>

      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1 text-sm text-secondary-foreground">
          <Sparkles className="h-4 w-4" />
          مدعوم بالذكاء الاصطناعي
        </span>
        <h1 className="text-4xl font-bold leading-tight md:text-6xl">
          أهلاً بك في ديكور AI
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          صمّم مساحتك المثالية بسهولة — ارفع صورة غرفتك ودع الذكاء الاصطناعي يقترح عليك أجمل الأفكار.
        </p>
        <Button size="lg" className="mt-10">ابدأ التصميم</Button>
      </section>
    </main>
  );
}
