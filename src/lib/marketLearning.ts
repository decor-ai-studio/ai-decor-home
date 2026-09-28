// Persistent market-learning layer on top of the adaptive pricing engine.
// Observations (from live web/AI market signals or from real invoices the user enters)
// are stored in the browser and replayed into the engine on every load, so the
// cost-estimation model keeps improving across sessions.

import {
  SmartPricingEngine,
  type MaterialKind,
  type PriceFeatures,
  type PriceObservation,
} from "@/engines/pricing";

const STORAGE_KEY = "glowtech.market.observations.v1";
const MAX_OBSERVATIONS = 400;

export interface StoredObservation extends PriceObservation {
  source: "web-ai" | "manual";
  note?: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadObservations(): StoredObservation[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredObservation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveObservations(list: StoredObservation[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_OBSERVATIONS)));
  } catch {
    /* storage full or blocked — learning simply stays in-memory for this session */
  }
}

export function addObservations(items: StoredObservation[]): StoredObservation[] {
  const next = [...loadObservations(), ...items].slice(-MAX_OBSERVATIONS);
  saveObservations(next);
  return next;
}

export function clearObservations(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Builds an engine already trained on everything learned so far. */
export function createTrainedEngine(): { engine: SmartPricingEngine; samples: number } {
  const engine = new SmartPricingEngine();
  const observations = loadObservations();
  if (observations.length) engine.observeMany(observations);
  // Extra epochs on the stored history speed up convergence after a reload.
  if (observations.length > 3) {
    for (const kind of new Set(observations.map((o) => o.kind))) {
      engine.model(kind).partialFit(
        observations.filter((o) => o.kind === kind),
        2,
      );
    }
  }
  return { engine, samples: observations.length };
}

export interface MarketPriceSignal {
  kind: MaterialKind;
  quantity: number;
  complexity: number;
  qualityTier: number;
  laborHours: number;
  observedPrice: number;
  rationaleAr: string;
}

/** Turns AI/web market signals into training observations for the pricing engine. */
export function signalsToObservations(
  signals: MarketPriceSignal[],
  regionIndex: number,
): StoredObservation[] {
  return signals.map((signal) => {
    const features: PriceFeatures = {
      quantity: signal.quantity,
      complexity: Math.min(1, Math.max(0, signal.complexity)),
      qualityTier: Math.min(3, Math.max(1, signal.qualityTier)),
      laborHours: Math.max(0, signal.laborHours),
      regionIndex,
    };
    return {
      kind: signal.kind,
      features,
      observedPrice: Math.max(0, signal.observedPrice),
      timestamp: Date.now(),
      source: "web-ai",
      note: signal.rationaleAr,
    };
  });
}
