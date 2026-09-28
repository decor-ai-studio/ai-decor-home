import type { MaterialKind } from "@/engines/pricing";

export interface Supplier {
  id: string;
  name: string;
  city: string;
  /** Material families this supplier actually stocks. */
  kinds: MaterialKind[];
  /** Headline products in Arabic. */
  products: string[];
  /** Relative price level vs. market average (1 = market average). */
  priceIndex: number;
  /** Typical delivery time in days. */
  leadTimeDays: number;
  /** 0..5 buyer rating. */
  rating: number;
  /** Share of orders delivered on the promised date, 0..1. */
  onTimeRate: number;
  /** Minimum order, in m² or units depending on the family. */
  minOrder: string;
  notes: string;
  phone: string;
}

export const SUPPLIERS: Supplier[] = [
  {
    id: "sp_alnasr",
    name: "النصر للألمنيوم والكلادنج",
    city: "العبور",
    kinds: ["aluminum_cladding", "installation_accessories"],
    products: ["ألواح ACM سماكة 4 مم", "تشطيبات PVDF وخشبي", "بروفيلات تثبيت ومرابط"],
    priceIndex: 0.94,
    leadTimeDays: 4,
    rating: 4.6,
    onTimeRate: 0.91,
    minOrder: "20 م²",
    notes: "أسعار جيدة للكميات الكبيرة، مع شهادات مقاومة حريق للقلب المعدني.",
    phone: "+20 100 000 0011",
  },
  {
    id: "sp_delta",
    name: "دلتا بانل",
    city: "المحلة الكبرى",
    kinds: ["aluminum_cladding"],
    products: ["ألواح كلادنج مقاومة للحريق", "ألواح مثقبة للتهوية"],
    priceIndex: 1.12,
    leadTimeDays: 9,
    rating: 4.8,
    onTimeRate: 0.95,
    minOrder: "50 م²",
    notes: "الأنسب للمشروعات التي تطلب اعتمادات حريق ومواصفات فنية دقيقة.",
    phone: "+20 100 000 0022",
  },
  {
    id: "sp_noor_acrylic",
    name: "نور أكريليك",
    city: "شبرا الخيمة",
    kinds: ["acrylic", "led_letters"],
    products: ["ألواح أكريليك ناشرة للضوء 3–5 مم", "أكريليك ملوّن", "أحرف مقطوعة CNC"],
    priceIndex: 0.98,
    leadTimeDays: 3,
    rating: 4.4,
    onTimeRate: 0.88,
    minOrder: "لوح واحد",
    notes: "قص CNC داخلي، مناسب للطلبات الصغيرة والسريعة.",
    phone: "+20 100 000 0033",
  },
  {
    id: "sp_lumen",
    name: "لومِن لمستلزمات الإضاءة",
    city: "وسط القاهرة",
    kinds: ["led_letters", "installation_accessories"],
    products: ["مودولات LED 12V", "محوّلات ومغذّيات", "شرائط LED بعزل IP65"],
    priceIndex: 1.05,
    leadTimeDays: 2,
    rating: 4.7,
    onTimeRate: 0.93,
    minOrder: "10 وحدات",
    notes: "ضمان سنتين على المودولات، مع بيانات لومن فعلية لكل موديل.",
    phone: "+20 100 000 0044",
  },
  {
    id: "sp_sharq",
    name: "الشرق للتوريدات الفنية",
    city: "الإسكندرية",
    kinds: ["installation_accessories", "acrylic"],
    products: ["مسامير وبراغي ستانلس", "سيليكون إنشائي", "زوايا ألمنيوم"],
    priceIndex: 0.9,
    leadTimeDays: 6,
    rating: 4.1,
    onTimeRate: 0.82,
    minOrder: "لا يوجد",
    notes: "أرخص خيار للمستلزمات الاستهلاكية، لكن التوريد لشمال الدلتا أسرع.",
    phone: "+20 100 000 0055",
  },
  {
    id: "sp_royal",
    name: "رويال جلاس آند بانل",
    city: "6 أكتوبر",
    kinds: ["aluminum_cladding", "acrylic", "installation_accessories"],
    products: ["كلادنج بتشطيب معدني", "أكريليك شفاف", "أنظمة تثبيت كاسيت"],
    priceIndex: 1.0,
    leadTimeDays: 5,
    rating: 4.5,
    onTimeRate: 0.9,
    minOrder: "30 م²",
    notes: "توريد متكامل يقلّل عدد الموردين في المشروع الواحد.",
    phone: "+20 100 000 0066",
  },
];
