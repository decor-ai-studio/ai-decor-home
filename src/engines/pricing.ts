// Self-Updating Smart Pricing Engine
// ------------------------------------
// Estimates material + installation costs from project features using an online
// (incremental) linear regression model. Each real market observation nudges the
// model toward current rates via stochastic gradient descent with L2 regularization,
// so the engine keeps "learning" the local market instead of relying on fixed tables.
//
// Everything here is framework-agnostic pure TypeScript so it can run in the browser
// or on the server, and be unit tested in isolation.

export type MaterialKind =
  | "aluminum_cladding"
  | "acrylic"
  | "led_letters"
  | "installation_accessories";

export const MATERIAL_KINDS: MaterialKind[] = [
  "aluminum_cladding",
  "acrylic",
  "led_letters",
  "installation_accessories",
];

export const MATERIAL_LABELS_AR: Record<MaterialKind, string> = {
  aluminum_cladding: "كلادنج ألمنيوم",
  acrylic: "أكريليك",
  led_letters: "حروف LED مضيئة",
  installation_accessories: "إكسسوارات وتركيب",
};

// Ordered, named feature vector. Keeping the order explicit keeps model weights
// interpretable and serialization stable.
export const PRICE_FEATURES = [
  "quantity", // m² for cladding/acrylic, letter count for letters, unit count otherwise
  "complexity", // 0..1 geometric/design complexity
  "qualityTier", // 1..3 (economy, standard, premium)
  "laborHours", // estimated install hours
  "regionIndex", // 0.8..1.4 cost-of-living / logistics multiplier for the area
] as const;

export type PriceFeatureName = (typeof PRICE_FEATURES)[number];

export type PriceFeatures = Record<PriceFeatureName, number>;

export interface PriceObservation {
  kind: MaterialKind;
  features: PriceFeatures;
  /** Real, invoiced total for this line (currency units, e.g. EGP). */
  observedPrice: number;
  timestamp?: number;
}

export interface PriceBreakdownEntry {
  feature: PriceFeatureName;
  contribution: number;
}

export interface PricePrediction {
  kind: MaterialKind;
  amount: number;
  /** 0..1 — grows as the model sees more, well-fitting observations. */
  confidence: number;
  breakdown: PriceBreakdownEntry[];
  /** Rolling mean absolute error over recent observations (currency units). */
  recentError: number;
}

export interface ModelSnapshot {
  kind: MaterialKind;
  weights: number[];
  bias: number;
  samples: number;
  emaError: number;
}

interface AdaptiveModelOptions {
  learningRate?: number;
  l2?: number;
  errorEma?: number;
}

const FEATURE_COUNT = PRICE_FEATURES.length;

function toVector(features: PriceFeatures): number[] {
  return PRICE_FEATURES.map((name) => features[name]);
}

// Rough seed weights (currency per feature unit) so early predictions are sensible
// before any real observation has been learned. These are priors, not hard values —
// the SGD updates move away from them as market data arrives.
const SEED_WEIGHTS: Record<MaterialKind, number[]> = {
  //             quantity complexity qualityTier laborHours regionIndex
  aluminum_cladding: [280, 1200, 900, 120, 600],
  acrylic: [220, 800, 600, 90, 400],
  led_letters: [380, 1500, 700, 140, 500],
  installation_accessories: [150, 600, 300, 110, 700],
};

const SEED_BIAS: Record<MaterialKind, number> = {
  aluminum_cladding: 500,
  acrylic: 350,
  led_letters: 600,
  installation_accessories: 400,
};

/**
 * Online linear-regression model for a single material kind.
 * Prediction: price = bias + Σ (weightᵢ · featureᵢ).
 * Learning: SGD step on squared error with L2 shrinkage, run once per observation.
 */
export class AdaptiveLinearModel {
  readonly kind: MaterialKind;
  private weights: number[];
  private bias: number;
  private readonly learningRate: number;
  private readonly l2: number;
  private readonly errorEma: number;
  private samples = 0;
  private emaError = 0;

  constructor(kind: MaterialKind, options: AdaptiveModelOptions = {}) {
    this.kind = kind;
    this.weights = [...(SEED_WEIGHTS[kind] ?? new Array<number>(FEATURE_COUNT).fill(0))];
    this.bias = SEED_BIAS[kind] ?? 0;
    this.learningRate = options.learningRate ?? 2e-4;
    this.l2 = options.l2 ?? 1e-4;
    this.errorEma = options.errorEma ?? 0.2;
  }

  predictRaw(features: PriceFeatures): number {
    const x = toVector(features);
    let sum = this.bias;
    for (let i = 0; i < FEATURE_COUNT; i++) {
      sum += (this.weights[i] ?? 0) * (x[i] ?? 0);
    }
    return sum;
  }

  predict(features: PriceFeatures): PricePrediction {
    const x = toVector(features);
    const breakdown: PriceBreakdownEntry[] = PRICE_FEATURES.map((name, i) => ({
      feature: name,
      contribution: Math.round((this.weights[i] ?? 0) * (x[i] ?? 0)),
    }));
    const amount = Math.max(0, Math.round(this.predictRaw(features)));

    // Confidence rises with sample count and falls with normalized recent error.
    const dataConfidence = 1 - Math.exp(-this.samples / 12);
    const errorPenalty = amount > 0 ? Math.min(1, this.emaError / amount) : 1;
    const confidence = clamp01(dataConfidence * (1 - 0.6 * errorPenalty));

    return {
      kind: this.kind,
      amount,
      confidence,
      breakdown,
      recentError: Math.round(this.emaError),
    };
  }

  /** One SGD update from a single real observation. Returns the pre-update error. */
  update(observation: PriceObservation): number {
    const x = toVector(observation.features);
    const predicted = this.predictRaw(observation.features);
    const error = predicted - observation.observedPrice; // dL/dPred for ½·error²

    for (let i = 0; i < FEATURE_COUNT; i++) {
      const grad = error * (x[i] ?? 0) + this.l2 * (this.weights[i] ?? 0);
      this.weights[i] = (this.weights[i] ?? 0) - this.learningRate * grad;
    }
    this.bias -= this.learningRate * error;

    const absError = Math.abs(error);
    this.emaError =
      this.samples === 0 ? absError : this.errorEma * absError + (1 - this.errorEma) * this.emaError;
    this.samples += 1;
    return error;
  }

  /** Learn from a batch, iterating a few epochs for faster convergence on backfills. */
  partialFit(batch: PriceObservation[], epochs = 3): void {
    for (let e = 0; e < epochs; e++) {
      for (const obs of batch) this.update(obs);
    }
  }

  snapshot(): ModelSnapshot {
    return {
      kind: this.kind,
      weights: [...this.weights],
      bias: this.bias,
      samples: this.samples,
      emaError: this.emaError,
    };
  }

  restore(snapshot: ModelSnapshot): void {
    if (snapshot.weights.length === FEATURE_COUNT) this.weights = [...snapshot.weights];
    this.bias = snapshot.bias;
    this.samples = snapshot.samples;
    this.emaError = snapshot.emaError;
  }
}

export interface QuoteLine {
  kind: MaterialKind;
  label: string;
  features: PriceFeatures;
  prediction: PricePrediction;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  /** Weighted overall confidence across all lines. */
  confidence: number;
}

/**
 * Facade over the per-material models. Holds one AdaptiveLinearModel per kind and
 * produces full multi-line quotes.
 */
export class SmartPricingEngine {
  private readonly models = new Map<MaterialKind, AdaptiveLinearModel>();

  constructor(options: AdaptiveModelOptions = {}) {
    for (const kind of MATERIAL_KINDS) {
      this.models.set(kind, new AdaptiveLinearModel(kind, options));
    }
  }

  model(kind: MaterialKind): AdaptiveLinearModel {
    const m = this.models.get(kind);
    if (!m) throw new Error(`Unknown material kind: ${kind}`);
    return m;
  }

  observe(observation: PriceObservation): void {
    this.model(observation.kind).update(observation);
  }

  observeMany(observations: PriceObservation[]): void {
    for (const obs of observations) this.observe(obs);
  }

  estimateLine(kind: MaterialKind, features: PriceFeatures): PricePrediction {
    return this.model(kind).predict(features);
  }

  quote(requests: Array<{ kind: MaterialKind; features: PriceFeatures; label?: string }>): Quote {
    const lines: QuoteLine[] = requests.map((req) => {
      const prediction = this.estimateLine(req.kind, req.features);
      return {
        kind: req.kind,
        label: req.label ?? MATERIAL_LABELS_AR[req.kind],
        features: req.features,
        prediction,
      };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.prediction.amount, 0);
    const confidence =
      subtotal > 0
        ? lines.reduce((sum, l) => sum + l.prediction.confidence * l.prediction.amount, 0) / subtotal
        : lines.length
          ? lines.reduce((sum, l) => sum + l.prediction.confidence, 0) / lines.length
          : 0;

    return { lines, subtotal, confidence: clamp01(confidence) };
  }

  snapshots(): ModelSnapshot[] {
    return MATERIAL_KINDS.map((kind) => this.model(kind).snapshot());
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
