import { Building2, Palette, Sofa, ArrowLeft, Sparkles, Wand2, Zap, Shield, Cpu, Radar, Boxes, HardHat, Type, Film } from "lucide-react";
import { MODES, type AppMode } from "@/types";
import OrbitSlides from "./OrbitSlides";

const ICONS = { Building2, Palette, Sofa } as const;

const ACCENT_STYLES: Record<
  string,
  { border: string; hoverBorder: string; iconBg: string; iconText: string; hoverText: string; glow: string }
> = {
  emerald: {
    border: "border-slate-800",
    hoverBorder: "hover:border-emerald-500/60",
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-400",
    hoverText: "group-hover:text-emerald-400",
    glow: "group-hover:shadow-emerald-500/10",
  },
  blue: {
    border: "border-slate-800",
    hoverBorder: "hover:border-blue-500/60",
    iconBg: "bg-blue-500/10",
    iconText: "text-blue-400",
    hoverText: "group-hover:text-blue-400",
    glow: "group-hover:shadow-blue-500/10",
  },
  amber: {
    border: "border-slate-800",
    hoverBorder: "hover:border-amber-500/60",
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-400",
    hoverText: "group-hover:text-amber-400",
    glow: "group-hover:shadow-amber-500/10",
  },
};

interface LandingPageProps {
  onSelect: (mode: AppMode) => void;
  onOpenLab: () => void;
  onOpenRadar: () => void;
  onOpenSuppliers: () => void;
  onOpenContractors: () => void;
  onOpenSignage: () => void;
  onOpenVision: () => void;
}

export default function LandingPage({
  onSelect,
  onOpenLab,
  onOpenRadar,
  onOpenSuppliers,
  onOpenContractors,
  onOpenSignage,
  onOpenVision,
}: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 radial-glow" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-float" />
      <div className="absolute top-20 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Glow Tech AI Studio</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          النظام يعمل بكفاءة
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-12 pb-20 text-center">
        <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-sm font-medium border border-emerald-500/20 animate-fade-in">
          <Sparkles className="w-4 h-4" />
          منصة الذكاء الاصطناعي للديكور والواجهات
        </span>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mt-6 max-w-3xl leading-tight animate-fade-in-up">
          صمّم واجهاتك وغرفك
          <br />
          <span className="gradient-text">بالذكاء الاصطناعي</span> في ثوانٍ
        </h1>

        <p className="text-slate-400 text-lg max-w-xl mt-5 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          اختر الواجهة المناسبة لاحتياجاتك لنبدأ التصميم فوراً — بكل بساطة وبالعامية المصرية والعربية.
        </p>

        {/* Flying slides orbiting on a circle, with moving shadows */}
        <OrbitSlides className="mt-10 max-w-5xl animate-fade-in-up" />

        {/* Mode cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14 w-full max-w-5xl">
          {MODES.map((mode, idx) => {
            const Icon = ICONS[mode.icon];
            const s = ACCENT_STYLES[mode.accent]!;
            return (
              <button
                key={mode.id}
                onClick={() => onSelect(mode.id)}
                className={`group relative bg-slate-900/80 ${s.border} ${s.hoverBorder} p-7 rounded-3xl text-right transition-all duration-300 shadow-2xl ${s.glow} hover:-translate-y-1 animate-fade-in-up`}
                style={{ animationDelay: `${0.15 + idx * 0.1}s` }}
              >
                <div className={`w-14 h-14 rounded-2xl ${s.iconBg} border border-white/5 flex items-center justify-center ${s.iconText} mb-5 transition-transform group-hover:scale-110`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className={`text-xl font-bold mb-2.5 transition-colors ${s.hoverText}`}>{mode.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-5">{mode.description}</p>
                <ul className="space-y-2">
                  {mode.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.iconText} bg-current opacity-60`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className={`mt-6 flex items-center gap-2 text-sm font-medium ${s.iconText} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  ابدأ الآن
                  <ArrowLeft className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Vision + assembly video studio entry */}
        <button
          onClick={onOpenVision}
          className="group mt-12 inline-flex items-center gap-3 bg-slate-900/80 border border-slate-800 hover:border-fuchsia-500/60 px-6 py-3.5 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 shadow-xl hover:shadow-fuchsia-500/10 animate-fade-in-up"
          style={{ animationDelay: "0.38s" }}
        >
          <span className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 transition-transform group-hover:scale-110">
            <Film className="w-5 h-5" />
          </span>
          <span className="text-right">
            <span className="block text-sm font-bold text-white">استوديو فيديو التركيب الاقتصادي</span>
            <span className="block text-xs text-slate-400">
              يستخرج أفضل إطار · يركّب الواجهة قطعة قطعة بخامات حقيقية · موسيقى · تصدير MP4 جاهز للواتساب والريلز
            </span>
          </span>
          <ArrowLeft className="w-4 h-4 text-fuchsia-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Signage & advertising studio entry */}
        <button
          onClick={onOpenSignage}
          className="group mt-12 inline-flex items-center gap-3 bg-slate-900/80 border border-slate-800 hover:border-amber-500/60 px-6 py-3.5 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 shadow-xl hover:shadow-amber-500/10 animate-fade-in-up"
          style={{ animationDelay: "0.4s" }}
        >
          <span className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 transition-transform group-hover:scale-110">
            <Type className="w-5 h-5" />
          </span>
          <span className="text-right">
            <span className="block text-sm font-bold text-white">استوديو اللوحات والإعلانات</span>
            <span className="block text-xs text-slate-400">
              اكتب اسم المحل واختار الستايل — حروف مضيئة وبوسترات واقعية بجودة عالية
            </span>
          </span>
          <ArrowLeft className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* AI trend radar entry */}
        <button
          onClick={onOpenRadar}
          className="group mt-12 inline-flex items-center gap-3 bg-slate-900/80 border border-slate-800 hover:border-emerald-500/60 px-6 py-3.5 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 shadow-xl hover:shadow-emerald-500/10 animate-fade-in-up"
          style={{ animationDelay: "0.45s" }}
        >
          <span className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 transition-transform group-hover:scale-110">
            <Radar className="w-5 h-5" />
          </span>
          <span className="text-right">
            <span className="block text-sm font-bold text-white">رادار الاتجاهات بالذكاء الاصطناعي</span>
            <span className="block text-xs text-slate-400">
              يجلب أحدث تصميمات الواجهات من الويب ويدرّب محرّك التسعير تلقائياً
            </span>
          </span>
          <ArrowLeft className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Smart engines lab entry */}
        <button
          onClick={onOpenLab}
          className="group mt-10 inline-flex items-center gap-3 bg-slate-900/80 border border-slate-800 hover:border-blue-500/60 px-6 py-3.5 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 shadow-xl hover:shadow-blue-500/10 animate-fade-in-up"
          style={{ animationDelay: "0.5s" }}
        >
          <span className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 transition-transform group-hover:scale-110">
            <Cpu className="w-5 h-5" />
          </span>
          <span className="text-right">
            <span className="block text-sm font-bold text-white">مختبر المحرّكات الذكية</span>
            <span className="block text-xs text-slate-400">تسعير متعلّم · رؤية حاسوبية · مطابقة مقاولين · خط إنتاج</span>
          </span>
          <ArrowLeft className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {/* Suppliers & contractors boards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 w-full max-w-3xl">
          <button
            onClick={onOpenSuppliers}
            className="group inline-flex items-center gap-3 bg-slate-900/80 border border-slate-800 hover:border-amber-500/60 px-5 py-4 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 shadow-xl hover:shadow-amber-500/10 animate-fade-in-up"
            style={{ animationDelay: "0.55s" }}
          >
            <span className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 transition-transform group-hover:scale-110">
              <Boxes className="w-5 h-5" />
            </span>
            <span className="text-right">
              <span className="block text-sm font-bold text-white">لوحة الموردين</span>
              <span className="block text-xs text-slate-400">أسعار الخامات · مدة التوريد · الالتزام والتقييم</span>
            </span>
          </button>

          <button
            onClick={onOpenContractors}
            className="group inline-flex items-center gap-3 bg-slate-900/80 border border-slate-800 hover:border-blue-500/60 px-5 py-4 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 shadow-xl hover:shadow-blue-500/10 animate-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            <span className="w-10 h-10 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 transition-transform group-hover:scale-110">
              <HardHat className="w-5 h-5" />
            </span>
            <span className="text-right">
              <span className="block text-sm font-bold text-white">لوحة المقاولين حسب التخصص</span>
              <span className="block text-xs text-slate-400">كلادنج · لوحات وحروف · زجاج · إضاءة · واجهات متكاملة</span>
            </span>
          </button>
        </div>

        {/* Feature strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mt-16 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            نتائج فورية في ثوانٍ
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            تصدير احترافي PSD و 3D
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            دعم العامية المصرية
          </div>
        </div>
      </section>

      <footer className="relative z-10 text-center text-slate-600 text-sm pb-8">
        Glow Tech AI Studio © 2026 — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}
