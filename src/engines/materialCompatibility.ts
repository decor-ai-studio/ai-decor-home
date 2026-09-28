// Materials & Compatibility Learning Module
// ------------------------------------------
// Three cooperating parts, all pure/framework-agnostic TypeScript:
//
//   1. Material Knowledge Base + Learning  — a structured, self-updating dataset of
//      signage/facade material specifications (durability, hot-climate weather
//      resistance, UV stability, service life). Field reports nudge each spec toward
//      observed reality via EMA, so the base "learns" the local market and climate.
//
//   2. Compatibility Matrix + Validation Engine — deterministic rules that evaluate
//      combinations (e.g. LED Kelvin/voltage vs an acrylic face, cladding colour vs
//      illuminated-letter finish, low-grade vinyl on hot outdoor cladding) and either
//      warn or emit an auto-correction that can be applied to the selection.
//
//   3. Scoring — a durability + compatibility score and an estimated effective
//      lifespan for the whole selection under a given exposure (hot-climate default).
//
// The pipeline (see pipeline.ts) calls `assessSelection` automatically whenever
// materials are selected after a facade capture.

// --- Material taxonomy -------------------------------------------------------

export type MaterialClass =
  | "acm_cladding" // Aluminium Composite Panel / cladding
  | "acrylic" // Acrylic face / sheet
  | "polycarbonate" // Polycarbonate face / sheet
  | "stainless_letters" // Stainless-steel fabricated letters
  | "led_module" // LED illumination modules
  | "vinyl"; // Adhesive vinyl film / graphics

export const MATERIAL_CLASSES: MaterialClass[] = [
  "acm_cladding",
  "acrylic",
  "polycarbonate",
  "stainless_letters",
  "led_module",
  "vinyl",
];

export const MATERIAL_CLASS_LABELS_AR: Record<MaterialClass, string> = {
  acm_cladding: "كلادنج ألمنيوم مركّب",
  acrylic: "أكريليك",
  polycarbonate: "بولي كربونيت",
  stainless_letters: "حروف ستانلس ستيل",
  led_module: "وحدات LED",
  vinyl: "فينيل لاصق",
};

// --- Knowledge base ----------------------------------------------------------

export interface MaterialSpec {
  /** 0..1 mechanical robustness / impact + structural resistance. */
  durability: number;
  /** 0..1 performance under sustained high ambient heat. */
  weatherResistanceHot: number;
  /** 0..1 resistance to UV yellowing / colour fade. */
  uvStability: number;
  /** Upper-bound outdoor service life in years for a standard grade. */
  maxLifespanYears: number;
  /** Number of learned field observations folded into this spec. */
  samples: number;
}

export type MaterialKnowledgeBase = Record<MaterialClass, MaterialSpec>;

// Seed priors from manufacturer datasheets and hot-climate field experience.
// These are starting points; `MaterialKnowledgeEngine.learn` moves them over time.
const SEED_KNOWLEDGE_BASE: MaterialKnowledgeBase = {
  acm_cladding: { durability: 0.86, weatherResistanceHot: 0.82, uvStability: 0.8, maxLifespanYears: 20, samples: 0 },
  acrylic: { durability: 0.6, weatherResistanceHot: 0.68, uvStability: 0.7, maxLifespanYears: 12, samples: 0 },
  polycarbonate: { durability: 0.82, weatherResistanceHot: 0.6, uvStability: 0.45, maxLifespanYears: 10, samples: 0 },
  stainless_letters: { durability: 0.95, weatherResistanceHot: 0.9, uvStability: 0.97, maxLifespanYears: 25, samples: 0 },
  led_module: { durability: 0.7, weatherResistanceHot: 0.62, uvStability: 0.75, maxLifespanYears: 8, samples: 0 },
  vinyl: { durability: 0.4, weatherResistanceHot: 0.35, uvStability: 0.4, maxLifespanYears: 5, samples: 0 },
};

/** A real-world observation used to update the knowledge base. All 0..1 except lifespan. */
export interface FieldReport {
  class: MaterialClass;
  /** Observed effective service life in years (before replacement / major failure). */
  observedLifespanYears?: number;
  /** Condition retention after hot-climate exposure (1 = like new). */
  weatherRetention?: number;
  /** Colour/clarity retention after UV exposure (1 = like new). */
  uvRetention?: number;
  /** Structural/finish retention after mechanical wear (1 = like new). */
  durabilityRetention?: number;
  timestamp?: number;
}

// --- Selection & exposure model ---------------------------------------------

export interface LedSpec {
  /** Correlated colour temperature in Kelvin (e.g. 2700, 4000, 6500). */
  kelvin: number;
  /** Nominal DC drive voltage (12 or 24 for standard sign modules). */
  voltageV: number;
}

export type MaterialGrade = "low" | "standard" | "high";
export type MaterialRole = "cladding" | "letters" | "face" | "lighting" | "graphics";

export interface MaterialSelection {
  class: MaterialClass;
  role?: MaterialRole;
  /** Finish / surface colour as #rrggbb, used for harmony checks. */
  colorHex?: string;
  /** Human finish label (e.g. "PVDF فحمي مطفي"). */
  finish?: string;
  grade?: MaterialGrade;
  led?: LedSpec;
}

export interface ExposureContext {
  outdoor: boolean;
  /** Peak ambient air temperature the installation sees, °C. */
  peakAmbientC: number;
  /** Peak UV index at the site. */
  uvIndexPeak: number;
  /** Coastal / salt-spray environment. */
  coastal: boolean;
}

/** Default hot, high-UV, inland climate (e.g. Gulf / Upper Egypt summer). */
export const HOT_CLIMATE_EXPOSURE: ExposureContext = {
  outdoor: true,
  peakAmbientC: 46,
  uvIndexPeak: 11,
  coastal: false,
};

// --- Compatibility results ---------------------------------------------------

export type IssueSeverity = "info" | "warning" | "critical";

export type CorrectionField = "grade" | "class" | "ledKelvin" | "ledVoltageV";

export interface CompatibilityCorrection {
  targetIndex: number;
  field: CorrectionField;
  from: string | number;
  to: string | number;
  rationaleAr: string;
}

export interface CompatibilityIssue {
  code: string;
  severity: IssueSeverity;
  messageAr: string;
  /** Indexes into the selection array that this issue concerns. */
  involves: number[];
  autoCorrection?: CompatibilityCorrection;
}

export interface CompatibilityReport {
  /** 0..100 — how well the chosen materials work together. */
  compatibilityScore: number;
  /** 0..100 — expected resilience of the selection under the given exposure. */
  durabilityScore: number;
  /** 0..100 — blended headline score. */
  overallScore: number;
  /** Effective lifespan bottleneck across the selection, in years. */
  estimatedLifespanYears: number;
  issues: CompatibilityIssue[];
  /** The selection after applying every auto-correction (safe to preview to the user). */
  correctedSelection: MaterialSelection[];
  appliedCorrections: CompatibilityCorrection[];
  exposure: ExposureContext;
}

// --- Compatibility rules -----------------------------------------------------
// Each rule inspects the full selection and returns zero or more issues.

type Rule = (selection: MaterialSelection[], exposure: ExposureContext, kb: MaterialKnowledgeBase) => CompatibilityIssue[];

const STANDARD_LED_VOLTAGES = [12, 24];
const ACRYLIC_KELVIN_MIN = 2700;
const ACRYLIC_KELVIN_MAX = 6500;

/** LED drive voltage must be a standard sign voltage; snap to the nearest otherwise. */
const ruleLedVoltage: Rule = (selection) => {
  const issues: CompatibilityIssue[] = [];
  selection.forEach((item, index) => {
    const led = item.led;
    if (item.class !== "led_module" || !led) return;
    if (STANDARD_LED_VOLTAGES.includes(led.voltageV)) return;
    const nearest = led.voltageV < 18 ? 12 : 24;
    issues.push({
      code: "led_voltage_nonstandard",
      severity: "warning",
      messageAr: `جهد وحدات LED (${led.voltageV} فولت) غير قياسي — الموصى به ${nearest} فولت لضمان ثبات الإضاءة والعمر الافتراضي.`,
      involves: [index],
      autoCorrection: {
        targetIndex: index,
        field: "ledVoltageV",
        from: led.voltageV,
        to: nearest,
        rationaleAr: "توحيد الجهد على أقرب قيمة قياسية للسوق.",
      },
    });
  });
  return issues;
};

/** LED colour temperature driving an acrylic face must sit in a face-safe Kelvin band. */
const ruleLedKelvinVsAcrylic: Rule = (selection) => {
  const issues: CompatibilityIssue[] = [];
  const hasAcrylicFace = selection.some(
    (m) => m.class === "acrylic" && (m.role === "face" || m.role === undefined),
  );
  if (!hasAcrylicFace) return issues;

  selection.forEach((item, index) => {
    const led = item.led;
    if (item.class !== "led_module" || !led) return;
    if (led.kelvin >= ACRYLIC_KELVIN_MIN && led.kelvin <= ACRYLIC_KELVIN_MAX) return;
    const corrected = led.kelvin < ACRYLIC_KELVIN_MIN ? ACRYLIC_KELVIN_MIN : ACRYLIC_KELVIN_MAX;
    issues.push({
      code: "led_kelvin_out_of_face_range",
      severity: "warning",
      messageAr: `حرارة لون LED (${led.kelvin}K) خارج النطاق المناسب لوجه الأكريليك — يُنصح بين ${ACRYLIC_KELVIN_MIN}K و${ACRYLIC_KELVIN_MAX}K لتفادي بهتان الوجه أو ظهور نقاط ساخنة.`,
      involves: [index],
      autoCorrection: {
        targetIndex: index,
        field: "ledKelvin",
        from: led.kelvin,
        to: corrected,
        rationaleAr: "ضبط حرارة اللون داخل نطاق آمن لوجه الأكريليك.",
      },
    });
  });
  return issues;
};

/** Low-grade vinyl exposed to hot outdoor cladding degrades fast; push to a cast/high grade. */
const ruleVinylHotOutdoor: Rule = (selection, exposure) => {
  const issues: CompatibilityIssue[] = [];
  const onCladding = selection.some((m) => m.class === "acm_cladding");
  selection.forEach((item, index) => {
    if (item.class !== "vinyl") return;
    const isLowGrade = item.grade === "low" || item.grade === undefined;
    if (!(exposure.outdoor && exposure.peakAmbientC >= 40 && isLowGrade)) return;
    issues.push({
      code: "low_grade_vinyl_hot_exposure",
      severity: "critical",
      messageAr: onCladding
        ? "فينيل منخفض الجودة على كسوة معرّضة لحرارة عالية — سيتقشّر ويبهت خلال مواسم قليلة. استخدم فينيل مصبوب (cast) عالي الجودة."
        : "فينيل منخفض الجودة في بيئة حارة خارجية — العمر الافتراضي قصير جداً. ارفع الدرجة إلى فينيل مصبوب عالي الجودة.",
      involves: [index],
      autoCorrection: {
        targetIndex: index,
        field: "grade",
        from: item.grade ?? "low",
        to: "high",
        rationaleAr: "ترقية إلى فينيل مصبوب مقاوم للحرارة والأشعة فوق البنفسجية.",
      },
    });
  });
  return issues;
};

/** Polycarbonate outdoors with high UV needs a UV-stabilised (high) grade. */
const rulePolycarbonateUv: Rule = (selection, exposure, kb) => {
  const issues: CompatibilityIssue[] = [];
  selection.forEach((item, index) => {
    if (item.class !== "polycarbonate") return;
    const lowUv = kb.polycarbonate.uvStability < 0.6;
    const isLowGrade = item.grade === "low" || item.grade === undefined;
    if (!(exposure.outdoor && exposure.uvIndexPeak >= 8 && lowUv && isLowGrade)) return;
    issues.push({
      code: "polycarbonate_uv_risk",
      severity: "warning",
      messageAr: "بولي كربونيت غير مثبّت ضد الأشعة في موقع عالي UV — سيميل للاصفرار. اختر درجة مثبّتة UV على الوجهين.",
      involves: [index],
      autoCorrection: {
        targetIndex: index,
        field: "grade",
        from: item.grade ?? "low",
        to: "high",
        rationaleAr: "اعتماد درجة مقاومة للأشعة فوق البنفسجية.",
      },
    });
  });
  return issues;
};

/** Stainless letters in a coastal/salt environment want marine (316 ≈ high) grade. */
const ruleStainlessCoastal: Rule = (selection, exposure) => {
  const issues: CompatibilityIssue[] = [];
  if (!exposure.coastal) return issues;
  selection.forEach((item, index) => {
    if (item.class !== "stainless_letters") return;
    const isLowGrade = item.grade === "low" || item.grade === undefined;
    if (!isLowGrade) return;
    issues.push({
      code: "stainless_coastal_grade",
      severity: "warning",
      messageAr: "حروف ستانلس بدرجة قياسية في بيئة ساحلية مالحة — قد يظهر صدأ سطحي. استخدم درجة بحرية (316).",
      involves: [index],
      autoCorrection: {
        targetIndex: index,
        field: "grade",
        from: item.grade ?? "low",
        to: "high",
        rationaleAr: "الترقية إلى ستانلس بحري 316 لمقاومة التآكل الملحي.",
      },
    });
  });
  return issues;
};

/** Cladding colour vs illuminated-letter finish: flag clashing hues, suggest harmony. */
const ruleColorHarmony: Rule = (selection) => {
  const issues: CompatibilityIssue[] = [];
  const cladding = findIndexed(selection, (m) => m.class === "acm_cladding" && !!m.colorHex);
  const letters = findIndexed(
    selection,
    (m) => (m.class === "stainless_letters" || m.class === "acrylic") && (m.role === "letters" || m.role === "face") && !!m.colorHex,
  );
  if (!cladding || !letters) return issues;

  const a = hexToHsl(cladding.item.colorHex as string);
  const b = hexToHsl(letters.item.colorHex as string);
  if (!a || !b) return issues;

  const harmony = hueHarmony(a.h, b.h);
  // Both reasonably saturated but neither analogous nor complementary/triadic ⇒ visual clash.
  const bothVivid = a.s > 0.3 && b.s > 0.3;
  if (bothVivid && harmony === "clash") {
    issues.push({
      code: "color_disharmony",
      severity: "info",
      messageAr: "لون الكسوة وتشطيب الحروف المضيئة غير متناغمين بصرياً — جرّب تدرجاً متجاوراً أو لوناً مكمّلاً لإبراز الحروف ليلاً.",
      involves: [cladding.index, letters.index],
    });
  }
  return issues;
};

const RULES: Rule[] = [
  ruleLedVoltage,
  ruleLedKelvinVsAcrylic,
  ruleVinylHotOutdoor,
  rulePolycarbonateUv,
  ruleStainlessCoastal,
  ruleColorHarmony,
];

// --- Scoring -----------------------------------------------------------------

const SEVERITY_PENALTY: Record<IssueSeverity, number> = { info: 5, warning: 15, critical: 35 };

interface DurabilityResult {
  durabilityScore: number;
  estimatedLifespanYears: number;
}

function scoreDurability(
  selection: MaterialSelection[],
  exposure: ExposureContext,
  kb: MaterialKnowledgeBase,
): DurabilityResult {
  if (selection.length === 0) return { durabilityScore: 0, estimatedLifespanYears: 0 };

  const heatStress = exposure.outdoor ? clamp01((exposure.peakAmbientC - 30) / 25) : 0; // 0 @30°C → 1 @55°C
  const uvStress = exposure.outdoor ? clamp01(exposure.uvIndexPeak / 12) : 0;

  let sum = 0;
  let minLife = Number.POSITIVE_INFINITY;

  for (const item of selection) {
    const spec = kb[item.class];
    const gradeFactor = item.grade === "low" ? 0.82 : item.grade === "high" ? 1.08 : 1;
    const effective = clamp01(
      (spec.durability * 0.4 +
        (1 - heatStress * (1 - spec.weatherResistanceHot)) * 0.3 +
        (1 - uvStress * (1 - spec.uvStability)) * 0.3) *
        gradeFactor,
    );
    sum += effective;
    minLife = Math.min(minLife, spec.maxLifespanYears * effective);
  }

  return {
    durabilityScore: Math.round((sum / selection.length) * 100),
    estimatedLifespanYears: round1(minLife === Number.POSITIVE_INFINITY ? 0 : minLife),
  };
}

// --- Public assessment API ---------------------------------------------------

/**
 * Evaluate a full material selection: run every compatibility rule, apply the
 * auto-corrections, and score durability + compatibility for the given exposure.
 * Pure and deterministic — the same inputs always yield the same report.
 */
export function assessSelection(
  selection: MaterialSelection[],
  exposure: ExposureContext = HOT_CLIMATE_EXPOSURE,
  kb: MaterialKnowledgeBase = SEED_KNOWLEDGE_BASE,
): CompatibilityReport {
  const issues = RULES.flatMap((rule) => rule(selection, exposure, kb));

  const compatibilityPenalty = issues.reduce((sum, issue) => sum + SEVERITY_PENALTY[issue.severity], 0);
  const compatibilityScore = clampRange(100 - compatibilityPenalty, 0, 100);

  const appliedCorrections = issues
    .map((issue) => issue.autoCorrection)
    .filter((c): c is CompatibilityCorrection => c !== undefined);
  const correctedSelection = applyCorrections(selection, appliedCorrections);

  // Durability is scored on the corrected selection — this is what the client would build.
  const { durabilityScore, estimatedLifespanYears } = scoreDurability(correctedSelection, exposure, kb);

  const overallScore = Math.round(compatibilityScore * 0.5 + durabilityScore * 0.5);

  return {
    compatibilityScore,
    durabilityScore,
    overallScore,
    estimatedLifespanYears,
    issues,
    correctedSelection,
    appliedCorrections,
    exposure,
  };
}

function applyCorrections(
  selection: MaterialSelection[],
  corrections: CompatibilityCorrection[],
): MaterialSelection[] {
  return selection.map((item, index) => {
    const forItem = corrections.filter((c) => c.targetIndex === index);
    if (forItem.length === 0) return { ...item };
    let next: MaterialSelection = { ...item };
    for (const c of forItem) {
      switch (c.field) {
        case "grade":
          next = { ...next, grade: c.to as MaterialGrade };
          break;
        case "class":
          next = { ...next, class: c.to as MaterialClass };
          break;
        case "ledKelvin":
          next = { ...next, led: { ...ensureLed(next.led), kelvin: Number(c.to) } };
          break;
        case "ledVoltageV":
          next = { ...next, led: { ...ensureLed(next.led), voltageV: Number(c.to) } };
          break;
      }
    }
    return next;
  });
}

function ensureLed(led: LedSpec | undefined): LedSpec {
  return led ?? { kelvin: 4000, voltageV: 24 };
}

// --- Self-updating knowledge engine -----------------------------------------

interface LearnOptions {
  /** EMA weight for each new observation (0..1). Higher reacts faster. */
  learningRate?: number;
}

/**
 * Holds a mutable copy of the knowledge base and folds in field reports over time.
 * Learned specs are then used by `assess`, so pricing/vision consumers see specs
 * that track real hot-climate performance instead of static datasheet numbers.
 */
export class MaterialKnowledgeEngine {
  private readonly kb: MaterialKnowledgeBase;
  private readonly learningRate: number;

  constructor(options: LearnOptions = {}) {
    this.kb = cloneKnowledgeBase(SEED_KNOWLEDGE_BASE);
    this.learningRate = options.learningRate ?? 0.25;
  }

  knowledgeBase(): MaterialKnowledgeBase {
    return cloneKnowledgeBase(this.kb);
  }

  spec(materialClass: MaterialClass): MaterialSpec {
    return { ...this.kb[materialClass] };
  }

  /** Fold one field observation into the matching spec via EMA. */
  learn(report: FieldReport): MaterialSpec {
    const spec = this.kb[report.class];
    const a = this.learningRate;

    if (report.weatherRetention !== undefined) {
      spec.weatherResistanceHot = ema(spec.weatherResistanceHot, clamp01(report.weatherRetention), a);
    }
    if (report.uvRetention !== undefined) {
      spec.uvStability = ema(spec.uvStability, clamp01(report.uvRetention), a);
    }
    if (report.durabilityRetention !== undefined) {
      spec.durability = ema(spec.durability, clamp01(report.durabilityRetention), a);
    }
    if (report.observedLifespanYears !== undefined && report.observedLifespanYears >= 0) {
      spec.maxLifespanYears = round1(ema(spec.maxLifespanYears, report.observedLifespanYears, a));
    }
    spec.samples += 1;
    return { ...spec };
  }

  learnMany(reports: FieldReport[]): void {
    for (const report of reports) this.learn(report);
  }

  /** Assess a selection against the *learned* knowledge base. */
  assess(selection: MaterialSelection[], exposure: ExposureContext = HOT_CLIMATE_EXPOSURE): CompatibilityReport {
    return assessSelection(selection, exposure, this.kb);
  }
}

// --- helpers -----------------------------------------------------------------

function cloneKnowledgeBase(kb: MaterialKnowledgeBase): MaterialKnowledgeBase {
  const out = {} as MaterialKnowledgeBase;
  for (const cls of MATERIAL_CLASSES) out[cls] = { ...kb[cls] };
  return out;
}

function ema(previous: number, observation: number, alpha: number): number {
  return alpha * observation + (1 - alpha) * previous;
}

interface Indexed {
  item: MaterialSelection;
  index: number;
}

function findIndexed(
  selection: MaterialSelection[],
  predicate: (m: MaterialSelection) => boolean,
): Indexed | null {
  for (let i = 0; i < selection.length; i++) {
    const item = selection[i];
    if (item && predicate(item)) return { item, index: i };
  }
  return null;
}

type Harmony = "analogous" | "complementary" | "triadic" | "clash";

function hueHarmony(h1: number, h2: number): Harmony {
  const diff = Math.abs(((h1 - h2 + 540) % 360) - 180); // 0 = opposite, 180 = identical
  const separation = 180 - diff; // 0 = identical, 180 = opposite
  if (separation <= 35) return "analogous";
  if (separation >= 150) return "complementary";
  if (Math.abs(separation - 120) <= 20) return "triadic";
  return "clash";
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m || !m[1]) return null;
  const int = Number.parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
