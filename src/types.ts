export type AppMode = "business" | "pro" | "personal";

export interface ModeConfig {
  id: AppMode;
  title: string;
  shortTitle: string;
  description: string;
  accent: "emerald" | "blue" | "amber";
  icon: "Building2" | "Palette" | "Sofa";
  features: string[];
}

export const MODES: ModeConfig[] = [
  {
    id: "business",
    title: "أصحاب الشركات ومقاولي الواجهات",
    shortTitle: "الشركات والمقاولين",
    description:
      "تصميم واجهات المحال، الكلادنج، الحروف المضيئة، وحساب التكاليف التقديرية بدقة عالية.",
    accent: "emerald",
    icon: "Building2",
    features: [
      "تصميم واجهات المحلات والشركات",
      "كلادنج وحروف مضيئة بالنيون",
      "حساب التكاليف التقديرية تلقائياً",
      "تصدير ملفات العرض للعملاء",
    ],
  },
  {
    id: "pro",
    title: "المصممين المحترفين",
    shortTitle: "المصممين المحترفين",
    description:
      "دقة هندسية عالية وتصدير مخرجات بصيغة طبقات PSD ومجسمات ثلاثية الأبعاد FBX.",
    accent: "blue",
    icon: "Palette",
    features: [
      "طبقات PSD منفصلة قابلة للتعديل",
      "مجسمات ثلاثية الأبعاد بصيغة FBX",
      "أدوات تحكم هندسي دقيقة",
      "مكتبة مواد وخامات احترافية",
    ],
  },
  {
    id: "personal",
    title: "الأفراد والعملاء العاديين",
    shortTitle: "تجديد المنازل",
    description:
      "تجديد غرف المنزل والشقق بكل بساطة وبنقرة زر واحدة دون أي تعقيد تقني.",
    accent: "amber",
    icon: "Sofa",
    features: [
      "تجديد غرف المنزل بنقرة واحدة",
      "اقتراحات أثاث وألوان متناسقة",
      "معاينة قبل وبعد فورية",
      "بساطة تامة بدون خبرة تقنية",
    ],
  },
];
