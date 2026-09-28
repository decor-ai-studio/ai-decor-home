import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
  MessageCircle,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askRawaq } from "@/lib/assistant.functions";
import {
  SCREEN_LABELS,
  getScreen,
  subscribeScreen,
  type ScreenKey,
} from "@/lib/assistantContext";
import { Input } from "@/components/ui/input";

const NAME_KEY = "rawaq_user_name";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SCREEN_TIPS: Record<ScreenKey, string> = {
  landing:
    "أخبرني أولاً: هل التصميم لواجهة محل أم لغرفة منزلية؟ بعد اختيارك سأحدد لك الخامات المناسبة وميزانيتها التقريبية بالمتر.",
  business:
    "ارفع صورة واجهة المحل وسأقيس المساحة بالمتر، وأقترح نوع الكلادنج المناسب، وأحسب التكلفة التقديرية لكل متر حتى تقارن بين عروض الموردين بثقة.",
  pro:
    "في هذا الوضع اضبط الخامات وسمك الطبقات، وسأخبرك بالمواصفات المطلوبة من المقاول وسعر المتر لكل خامة قبل تصدير التصميم.",
  personal:
    "ارفع صورة الغرفة واكتب ميزانيتك التقريبية، وسأقترح الألوان والخامات مع بدائل أرخص وأغلى حتى يتناسب التصميم مع ميزانيتك تماماً.",
  lab:
    "شغّل محرك التحليل على تصميمك وسأشرح النتائج: جودة الخامة المتوقعة، التكلفة لكل متر، وأي مورد يمنحك أفضل سعر لنفس المواصفات.",
  radar:
    "تابع هنا أحدث صيحات التصميم وأسعار الخامات الحالية في السوق؛ قارن السعر قبل اعتماد تصميمك لتحصل على عرض مطابق لأسعار اليوم لا لأسعار الشهر الماضي.",
  suppliers:
    "قارن بين الموردين بالسعر للمتر ونوع الخامة ومدة التوريد، وسأنصحك بالعرض الأفضل قيمة مقابل السعر، وليس الأرخص فقط، مع تفاصيل ما يجب أن تطلبه من كل مورد قبل الاعتماد.",
  contractors:
    "اختر المقاول حسب التخصص والتقييم وسعر التنفيذ للمتر، وسأخبرك بالأسئلة التي تطرحها عليه قبل التعاقد حتى لا تُفاجأ بتكاليف إضافية.",
  signage:
    "حدد نوع الحروف والإضاءة، وسأخبرك بالسعر التقريبي للمتر وأي المواد أصلح للواجهة الخارجية من ناحية السعر والعمر الافتراضي قبل طلب عرض من المورد.",
  vision:
    "حوّل تصميمك إلى فيديو قصير لعرضه على عميلك؛ الفيديو الذي يوضح الخامات والسعر النهائي يرفع فرص موافقة العميل على العرض بشكل كبير.",
};

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ar-SA";
  utter.rate = 1;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("ar"));
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

export default function RawaqAssistant() {
  const ask = useServerFn(askRawaq);
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [screen, setScreenState] = useState<ScreenKey>("landing");
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem(NAME_KEY) ?? "";
    setUserName(stored);
    setReady(true);
  }, []);

  useEffect(() => setScreenState(getScreen()), []);
  useEffect(() => subscribeScreen(setScreenState), []);

  // Proactive tip while the user moves around the app.
  const firstScreen = useRef(true);
  useEffect(() => {
    if (!userName) return;
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    const tip = SCREEN_TIPS[screen];
    setMessages((m) => [...m, { role: "assistant", content: tip }]);
    if (voiceOn) speak(tip);
  }, [screen, userName, voiceOn]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      const next: ChatMessage[] = [...messages, { role: "user", content: clean }];
      setMessages(next);
      setInput("");
      setBusy(true);
      try {
        const res = await ask({
          data: {
            userName,
            screen: SCREEN_LABELS[screen],
            messages: next.slice(-12),
          },
        });
        const reply = res.text?.trim() || "لم أتمكن من الرد الآن، جرّب مرة أخرى.";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        if (voiceOn) speak(reply);
      } catch (err) {
        console.error("rawaq-error", err);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "تعذّر الاتصال بالمساعد حالياً، حاول مرة أخرى بعد قليل." },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [ask, busy, messages, screen, userName, voiceOn],
  );

  const toggleMic = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "متصفحك لا يدعم التحدث بالصوت، يمكنك الكتابة لي." },
      ]);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "ar-SA";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const said = e.results[0][0].transcript as string;
      setListening(false);
      void send(said);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening, send]);

  const saveName = () => {
    const name = nameDraft.trim();
    if (!name) return;
    localStorage.setItem(NAME_KEY, name);
    setUserName(name);
    setOpen(true);
    const greeting = `أهلاً بك يا ${name}! أنا رواق، مساعدك الشخصي في التصميم. اضغط زر الصوت وتحدث معي في أي وقت.`;
    setMessages([{ role: "assistant", content: greeting }]);
  };

  if (!ready) return null;

  if (!userName) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-primary/30 bg-card/90 p-6 text-center shadow-[0_0_50px_-12px_rgba(16,185,129,0.35)] backdrop-blur-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-600 text-2xl font-bold text-white shadow-[0_0_15px_rgba(45,212,191,0.4)]">
            ر
          </div>
          <h2 className="text-xl font-bold text-foreground">مرحباً بك، أنا رواق</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            مساعدك الشخصي في تصميم الواجهات والديكور. ما اسمك حتى أناديك به؟
          </p>
          <div className="mt-5 flex gap-2">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="اكتب اسمك هنا"
              autoFocus
              className="rounded-2xl"
            />
            <button
              onClick={saveName}
              disabled={!nameDraft.trim()}
              className="rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              تفضّل
            </button>
          </div>
        </div>
      </div>
    );
  }

  const iconBtn =
    "flex h-9 w-9 items-center justify-center rounded-xl text-emerald-100/60 transition-colors hover:bg-white/5 hover:text-emerald-300";

  return (
    <>
      {!open && (
        <div className="group fixed bottom-6 left-6 z-50">
          {/* soft glow halo */}
          <div className="absolute -inset-1 animate-pulse rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 opacity-40 blur transition duration-500 group-hover:opacity-75" />
          <button
            onClick={() => setOpen(true)}
            aria-label="فتح المساعد رواق"
            className="relative flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-card shadow-2xl transition-transform active:scale-90"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/20 to-transparent" />
            <MessageCircle className="relative h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
          </button>
        </div>
      )}

      {open && (
        <div
          className={`fixed bottom-6 left-6 z-50 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[2rem] border border-emerald-500/30 bg-card/90 shadow-[0_0_50px_-12px_rgba(16,185,129,0.35)] backdrop-blur-2xl transition-all duration-500 ${
            maximized ? "h-[min(40rem,calc(100vh-6rem))] w-[min(30rem,calc(100vw-2rem))]" : "h-[28rem] w-[22rem]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-b from-emerald-500/10 to-transparent p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-600 text-lg font-bold text-white shadow-[0_0_15px_rgba(45,212,191,0.4)]">
                  ر
                </div>
                <div className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold leading-tight text-foreground">رواق</h3>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] text-emerald-400/90">{SCREEN_LABELS[screen]}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                className={iconBtn}
                aria-label={voiceOn ? "إيقاف الرد الصوتي" : "تشغيل الرد الصوتي"}
                onClick={() => {
                  const next = !voiceOn;
                  setVoiceOn(next);
                  if (next) speak(`تم تشغيل الصوت يا ${userName}، تفضل بالكلام.`);
                  else window.speechSynthesis?.cancel();
                }}
              >
                {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                className={iconBtn}
                aria-label={maximized ? "تصغير النافذة" : "تكبير النافذة"}
                onClick={() => setMaximized((m) => !m)}
              >
                {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button className={iconBtn} aria-label="إغلاق" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-tl-none bg-gradient-to-br from-emerald-500 to-cyan-700 p-3 text-sm leading-relaxed text-white shadow-lg shadow-emerald-900/30">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[90%] rounded-2xl rounded-tr-none border border-white/10 bg-white/5 p-3 text-sm leading-relaxed text-emerald-50 shadow-inner">
                    {m.content}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <p className="animate-pulse text-xs text-emerald-400/80">رواق يفكر...</p>
            )}
          </div>

          {/* Composer */}
          <div className="p-4 pt-2">
            <div className="flex items-center gap-1 rounded-[1.5rem] border border-white/10 bg-white/5 p-2 pr-4 transition-all focus-within:border-emerald-500/50">
              <button
                onClick={toggleMic}
                aria-label="التحدث بالصوت"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                  listening
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-emerald-400 hover:bg-emerald-500/10"
                }`}
              >
                {listening ? (
                  <Mic className="h-4 w-4 animate-pulse" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder={listening ? "أستمع إليك..." : "اكتب أو تحدث معي"}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                aria-label="إرسال"
                disabled={busy}
                onClick={() => send(input)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1.2rem] bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-900/30 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              >
                <Send className="h-4 w-4 -scale-x-100" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
