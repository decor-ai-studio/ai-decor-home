import claddingA from "@/assets/materials-cladding-a.jpg";
import claddingB from "@/assets/materials-cladding-b.jpg";
import signageA from "@/assets/materials-signage-a.jpg";
import signageB from "@/assets/materials-signage-b.jpg";

export type MaterialCategory = "cladding" | "letters" | "acrylic";

export interface Material {
  id: string;
  nameAr: string;
  nameEn: string;
  category: MaterialCategory;
  image: string;
  imagePosition: "left" | "center" | "right";
  summary: string;
  specifications: string[];
  prompt: string;
  sourceLabel: string;
  sourceUrl: string;
  trend?: string;
}

export const MATERIAL_CATEGORIES: Array<{ id: "all" | MaterialCategory; label: string }> = [
  { id: "all", label: "الكل" },
  { id: "cladding", label: "كسوات الواجهات" },
  { id: "letters", label: "الحروف المضيئة" },
  { id: "acrylic", label: "الأكريليك والإضاءة" },
];

export const MATERIALS: Material[] = [
  {
    id: "acm-pe",
    nameAr: "كلادنج ألمنيوم مركّب",
    nameEn: "Traditional ACM / ACP",
    category: "cladding",
    image: claddingA,
    imagePosition: "left",
    summary: "خيار اقتصادي متعدد التشطيبات للواجهات التجارية منخفضة المخاطر، مع ضرورة التحقق من نوع القلب ومتطلبات الحريق محلياً.",
    specifications: ["سماكات شائعة 3–6 مم", "تشطيبات PVDF وخشبي ومعدني", "لا يُعتمد قلب PE للمباني عالية الخطورة"],
    prompt: "كسوة واجهة بألواح كلادنج ألمنيوم مركّب فحمية مطفية، فواصل كاسيت دقيقة وطابع تجاري حديث",
    sourceLabel: "ALUCOBOND — المنتجات",
    sourceUrl: "https://www.alucobond.com/products/",
  },
  {
    id: "acm-a2",
    nameAr: "كلادنج A2 مقاوم للحريق",
    nameEn: "A2 Mineral-core ACM",
    category: "cladding",
    image: claddingA,
    imagePosition: "center",
    summary: "ألواح مركّبة بقلب معدني غير قابل للاحتراق تقريباً، وهي من أبرز توجهات السوق للواجهات التجارية الأكثر أماناً.",
    specifications: ["تصنيف شائع A2-s1,d0", "سماكة نموذجية 4 مم", "يجب اعتماد نظام الواجهة كاملاً لا اللوح وحده"],
    prompt: "كسوة واجهة تجارية بكلادنج A2 برونزي دافئ مقاوم للحريق، ألواح كبيرة وفواصل نظيفة وإضاءة معمارية",
    sourceLabel: "ALUCOBOND A2",
    sourceUrl: "https://www.alucobond.com/products/alucobond-a2/",
    trend: "الأكثر طلباً للسلامة",
  },
  {
    id: "solid-aluminium",
    nameAr: "ألمنيوم مصمت",
    nameEn: "Solid Aluminium",
    category: "cladding",
    image: claddingA,
    imagePosition: "right",
    summary: "كسوة معدنية متينة وغير قابلة للاحتراق، مناسبة للتفاصيل المطوية والتشطيبات الفاخرة طويلة العمر.",
    specifications: ["سماكة شائعة 3 مم", "وزن تقريبي 8.1 كجم/م²", "يراعى التمدد الحراري في نظام التثبيت"],
    prompt: "واجهة محل بألواح ألمنيوم مصمت شامبين بملمس مصقول ناعم، حواف مطوية وتفاصيل فاخرة معاصرة",
    sourceLabel: "A1 Facades — Solid Aluminium",
    sourceUrl: "https://a1facades.co.uk/solid-aluminium/",
  },
  {
    id: "hpl",
    nameAr: "ألواح HPL خارجية",
    nameEn: "Exterior Compact HPL",
    category: "cladding",
    image: claddingB,
    imagePosition: "left",
    summary: "ألواح لامينيت مدمجة تمنح مظهر الخشب أو الحجر مع مقاومة جيدة للطقس وسهولة في تنويع هوية المتجر.",
    specifications: ["سماكات واجهات شائعة 6–10 مم", "مطابقة فئات EN 438 الخارجية", "تحتاج تكييفاً بالموقع قبل التركيب"],
    prompt: "واجهة متجر حديثة بألواح HPL خارجية بنقشة بلوط طبيعي دافئ، فواصل سوداء رفيعة وتفاصيل أنيقة",
    sourceLabel: "Fundermax Exterior",
    sourceUrl: "https://www.fundermax.com/en/Products/Exterior/",
  },
  {
    id: "honeycomb",
    nameAr: "ألمنيوم خلية نحل",
    nameEn: "Aluminium Honeycomb",
    category: "cladding",
    image: claddingB,
    imagePosition: "center",
    summary: "لوح خفيف عالي الصلابة يسمح بمقاسات كبيرة واستواء بصري ممتاز للمظلات والواجهات الواسعة.",
    specifications: ["سماكات تقريبية 6–25 مم", "نسبة صلابة إلى وزن مرتفعة", "متاح بأنظمة مصنفة A2"],
    prompt: "مظلة وواجهة تجارية بألواح ألمنيوم خلية نحل فضية ساتان، مساحات كبيرة سلسة وخطوط معمارية نظيفة",
    sourceLabel: "3A Composites — ALUCORE",
    sourceUrl: "https://www.alucore.com/",
    trend: "ألواح كبيرة وخفيفة",
  },
  {
    id: "zinc",
    nameAr: "كسوة زنك معتّق",
    nameEn: "Pre-weathered Zinc",
    category: "cladding",
    image: claddingB,
    imagePosition: "right",
    summary: "معدن طبيعي يتكوّن عليه غشاء حماية ذاتي، ويمنح الواجهة إيقاعاً رأسياً ومظهراً حرفياً راقياً.",
    specifications: ["سماكة نموذجية 0.7–0.8 مم", "قابل لإعادة التدوير", "يتطلب تجويف تهوية خلفي مناسب"],
    prompt: "واجهة بوتيك بكسوة زنك معتّق رمادي مزرق بنظام standing seam رأسي، طابع راقٍ ومستدام",
    sourceLabel: "VMZINC — Facade systems",
    sourceUrl: "https://www.vmzinc.com/facade-systems.html",
  },
  {
    id: "front-lit",
    nameAr: "حروف بارزة بإضاءة أمامية",
    nameEn: "Front-lit Channel Letters",
    category: "letters",
    image: signageA,
    imagePosition: "left",
    summary: "الحل الكلاسيكي عالي الوضوح؛ واجهة أكريليك أوبال مضاءة بوحدات LED داخل جسم معدني.",
    specifications: ["وجه أكريليك شائع 3/16 بوصة", "عمق جسم نموذجي 3–5 بوصات", "وحدات LED خارجية IP67"],
    prompt: "اسم المتجر بحروف بارزة مضيئة من الأمام، وجه أكريليك أوبال وإطار ألمنيوم مصقول وإضاءة بيضاء دافئة متجانسة",
    sourceLabel: "SloanLED — Channel letters",
    sourceUrl: "https://sloanled.com/signage/channel-letter/",
  },
  {
    id: "halo-lit",
    nameAr: "حروف هالو بإضاءة خلفية",
    nameEn: "Reverse / Halo-lit Letters",
    category: "letters",
    image: signageA,
    imagePosition: "center",
    summary: "وجه معدني مصمت يبتعد عن الجدار ليصنع هالة ضوئية ناعمة، مناسب للهويات الراقية والفنادق والبوتيكات.",
    specifications: ["وجه ألمنيوم أو ستانلس", "مباعد خلفي لتوزيع الهالة", "يفضل سطح خلفي مطفي فاتح"],
    prompt: "حروف متجر ستانلس ستيل بإضاءة هالو خلفية ذهبية ناعمة فوق جدار حجري داكن، هوية فاخرة",
    sourceLabel: "Gemini — Lit signage",
    sourceUrl: "https://geminimade.com/signage/illuminated/",
    trend: "مظهر فاخر رائج",
  },
  {
    id: "trimless",
    nameAr: "حروف بدون حواف ظاهرة",
    nameEn: "Trimless Channel Letters",
    category: "letters",
    image: signageA,
    imagePosition: "right",
    summary: "تفصيل حديث يخفي حافة التثبيت حول الوجه، ليظهر الحرف الأكريليك ككتلة ضوئية نقية ومتجانسة.",
    specifications: ["مظهر أمامي بلا Trim Cap", "أوجه أكريليك رفيعة دقيقة", "مناسب للهويات المينيمال"],
    prompt: "حروف بارزة trimless بدون إطار ظاهر، أكريليك أبيض مضيء بالكامل وحواف سلسة على واجهة سوداء حديثة",
    sourceLabel: "Gemini — Fabricated letters",
    sourceUrl: "https://geminimade.com/signage/letters-logos/",
    trend: "تفاصيل مينيمال حديثة",
  },
  {
    id: "neon-flex",
    nameAr: "نيون فليكس سيليكون",
    nameEn: "LED Neon Flex",
    category: "acrylic",
    image: signageB,
    imagePosition: "left",
    summary: "بديل LED مرن للنيون الزجاجي، يكوّن خطوطاً مستمرة وأشكالاً حرة مع استهلاك منخفض وسهولة أكبر في الصيانة.",
    specifications: ["مقاطع شائعة 8×16 أو 16×16 مم", "حماية خارجية IP67/IP68 حسب المنتج", "يراعى نصف قطر الانحناء الأدنى"],
    prompt: "تكوين شعار عربي تجريدي بنيون فليكس سيليكون بلون مرجاني دافئ، خط ضوئي مستمر على جدار فحمي",
    sourceLabel: "SloanLED — FlexiBRITE",
    sourceUrl: "https://sloanled.com/signage/flexibrite/",
  },
  {
    id: "edge-lit",
    nameAr: "أكريليك مضيء من الحواف",
    nameEn: "Edge-lit Acrylic / LGP",
    category: "acrylic",
    image: signageB,
    imagePosition: "center",
    summary: "لوح أكريليك محفور يلتقط الضوء من الحواف، مثالي للوحات الداخلية الرقيقة وإرشادات العرض الأنيقة.",
    specifications: ["أكريليك نموذجي 4–8 مم", "إضاءة LED مخفية بالحافة", "الحفر أو الطباعة يوزعان الضوء"],
    prompt: "لوحة أكريليك شفافة رفيعة مضيئة من الحواف، حفر هندسي تجريدي وإضاءة بيضاء باردة معلقة بمباعدات معدنية",
    sourceLabel: "Perspex — Light Guide Panels",
    sourceUrl: "https://www.perspex.co.uk/",
  },
  {
    id: "seg-lightbox",
    nameAr: "لايت بوكس قماش SEG",
    nameEn: "SEG Fabric Lightbox",
    category: "acrylic",
    image: signageB,
    imagePosition: "right",
    summary: "إطار ألمنيوم نحيف يستقبل قماشاً مطبوعاً بحافة سيليكون، فيمنح صورة كبيرة بإضاءة متجانسة وسهولة تغيير الإعلان.",
    specifications: ["عمق إطارات يبدأ قرابة 30 مم", "قماش Dye-sublimation قابل للتبديل", "إضاءة خلفية متجانسة"],
    prompt: "لايت بوكس SEG نحيف شبه بلا إطار داخل متجر فاخر، قماش مطبوع بتكوين تجريدي وإضاءة خلفية متجانسة",
    sourceLabel: "TEXFRAME — SEG systems",
    sourceUrl: "https://texframe.com/",
    trend: "تبديل حملات سريع",
  },
];