// Tracks which screen the user is currently on, so the assistant can give
// advice relevant to what they are doing right now.

export type ScreenKey =
  | "landing"
  | "business"
  | "pro"
  | "personal"
  | "lab"
  | "radar"
  | "suppliers"
  | "contractors"
  | "signage"
  | "vision";

export const SCREEN_LABELS: Record<ScreenKey, string> = {
  landing: "الصفحة الرئيسية لاختيار نوع الاستخدام",
  business: "لوحة الشركات ومقاولي الواجهات",
  pro: "لوحة المصممين المحترفين",
  personal: "لوحة تجديد المنازل للأفراد",
  lab: "مختبر المحركات الذكية",
  radar: "رادار صيحات التصميم",
  suppliers: "دليل الموردين",
  contractors: "دليل المقاولين",
  signage: "استوديو اللافتات والحروف المضيئة",
  vision: "استوديو الفيديو والرؤية",
};

let current: ScreenKey = "landing";
const listeners = new Set<(screen: ScreenKey) => void>();

export function setScreen(screen: ScreenKey) {
  if (current === screen) return;
  current = screen;
  listeners.forEach((l) => l(screen));
}

export function getScreen() {
  return current;
}

export function subscribeScreen(listener: (screen: ScreenKey) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
