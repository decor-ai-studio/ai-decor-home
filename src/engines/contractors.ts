// Contractor Rating & Matching Algorithm
// ---------------------------------------
// Ranks execution contractors for a given project using two complementary signals:
//
//   1. Content-based weighted scoring — normalizes objective metrics (schedule
//      adherence, cost-estimation accuracy, reviews), geographic proximity, and
//      complexity fit into a single weighted score.
//   2. Collaborative filtering — user-based cosine similarity over a client ×
//      contractor rating matrix, predicting how the requesting client would rate a
//      contractor based on how similar clients rated them.
//
// The final match score blends both, so a new client with no history still gets
// solid content-based rankings, while returning clients benefit from personalization.

export type GeoPoint = { lat: number; lng: number };

export type Specialty = "cladding" | "signage" | "glass" | "lighting" | "full_facade";

export const SPECIALTY_LABELS_AR: Record<Specialty, string> = {
  cladding: "كلادنج",
  signage: "لوحات وحروف",
  glass: "واجهات زجاجية",
  lighting: "إضاءة",
  full_facade: "واجهات متكاملة",
};

export interface ContractorMetrics {
  scheduleAdherence: number; // 0..1 — share of milestones met on time
  costAccuracy: number; // 0..1 — 1 = quotes match final invoices
  reviewScore: number; // 0..5 — mean customer review
  completedProjects: number;
}

export interface Contractor {
  id: string;
  name: string;
  location: GeoPoint;
  city: string;
  specialties: Specialty[];
  /** Complexity sweet spot this contractor handles best, 0..1. */
  capability: number;
  metrics: ContractorMetrics;
}

export interface ProjectRequirements {
  complexity: number; // 0..1
  location: GeoPoint;
  specialtyNeeded: Specialty;
  /** Optional requesting client id to enable collaborative personalization. */
  clientId?: string;
}

export interface MatchWeights {
  quality: number;
  proximity: number;
  complexityFit: number;
  collaborative: number;
}

export const DEFAULT_WEIGHTS: MatchWeights = {
  quality: 0.4,
  proximity: 0.2,
  complexityFit: 0.2,
  collaborative: 0.2,
};

export interface ScoreBreakdown {
  quality: number; // 0..1
  proximity: number; // 0..1
  complexityFit: number; // 0..1
  collaborative: number; // 0..1 (predicted rating, normalized)
  specialtyMatch: boolean;
  distanceKm: number;
}

export interface MatchResult {
  contractor: Contractor;
  score: number; // 0..1 final blended score
  breakdown: ScoreBreakdown;
  /** Predicted collaborative rating on a 0..5 scale, if computable. */
  predictedRating: number | null;
}

/** client id -> (contractor id -> rating 0..5). Sparse by design. */
export type RatingMatrix = Record<string, Record<string, number>>;

// --- Quality scoring ---------------------------------------------------------

function qualityScore(metrics: ContractorMetrics): number {
  const review = clamp01(metrics.reviewScore / 5);
  // Experience saturates: 40 projects ≈ fully "seasoned".
  const experience = 1 - Math.exp(-metrics.completedProjects / 40);
  return clamp01(
    0.35 * clamp01(metrics.scheduleAdherence) +
      0.3 * clamp01(metrics.costAccuracy) +
      0.25 * review +
      0.1 * experience,
  );
}

// --- Geographic proximity ----------------------------------------------------

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Exponential decay: 1 on-site, ~0.6 at 50 km, tail off beyond ~150 km.
function proximityScore(distanceKm: number, halfLifeKm = 60): number {
  return clamp01(Math.exp(-distanceKm / halfLifeKm));
}

// --- Complexity fit ----------------------------------------------------------

// Gaussian around the contractor's capability sweet spot. Over-qualified is fine
// (asymmetric): penalize under-capability more than over-capability.
function complexityFitScore(projectComplexity: number, capability: number): number {
  const diff = projectComplexity - capability;
  const sigma = diff > 0 ? 0.22 : 0.4; // stricter when project exceeds capability
  return clamp01(Math.exp(-(diff * diff) / (2 * sigma * sigma)));
}

// --- Collaborative filtering -------------------------------------------------

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const key of Object.keys(a)) {
    const av = a[key] ?? 0;
    magA += av * av;
    const bv = b[key];
    if (bv !== undefined) dot += av * bv;
  }
  for (const key of Object.keys(b)) {
    const bv = b[key] ?? 0;
    magB += bv * bv;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Predict how `clientId` would rate `contractorId` (0..5) using user-based CF.
 * Returns null when there isn't enough overlapping data to say anything useful.
 */
export function predictRating(
  clientId: string,
  contractorId: string,
  matrix: RatingMatrix,
): number | null {
  const target = matrix[clientId];
  if (!target) return null;
  if (target[contractorId] !== undefined) return target[contractorId] ?? null;

  let weightedSum = 0;
  let simSum = 0;
  for (const otherId of Object.keys(matrix)) {
    if (otherId === clientId) continue;
    const other = matrix[otherId];
    if (!other) continue;
    const rating = other[contractorId];
    if (rating === undefined) continue;
    const sim = cosineSimilarity(target, other);
    if (sim <= 0) continue;
    weightedSum += sim * rating;
    simSum += sim;
  }
  if (simSum === 0) return null;
  return weightedSum / simSum;
}

// --- Matching ----------------------------------------------------------------

export function scoreContractor(
  contractor: Contractor,
  project: ProjectRequirements,
  weights: MatchWeights,
  matrix?: RatingMatrix,
): MatchResult {
  const quality = qualityScore(contractor.metrics);
  const distanceKm = haversineKm(contractor.location, project.location);
  const proximity = proximityScore(distanceKm);
  const complexityFit = complexityFitScore(project.complexity, contractor.capability);
  const specialtyMatch =
    contractor.specialties.includes(project.specialtyNeeded) ||
    contractor.specialties.includes("full_facade");

  let predictedRating: number | null = null;
  if (project.clientId && matrix) {
    predictedRating = predictRating(project.clientId, contractor.id, matrix);
  }
  // Fall back to the contractor's own mean review when CF can't personalize.
  const collaborative = clamp01(
    (predictedRating ?? contractor.metrics.reviewScore) / 5,
  );

  const effectiveWeights = matrix && project.clientId ? weights : redistributeCollaborative(weights);

  let score =
    effectiveWeights.quality * quality +
    effectiveWeights.proximity * proximity +
    effectiveWeights.complexityFit * complexityFit +
    effectiveWeights.collaborative * collaborative;

  // Hard-ish gate: a specialty mismatch is a strong negative signal, not fatal.
  if (!specialtyMatch) score *= 0.55;

  return {
    contractor,
    score: clamp01(score),
    predictedRating: predictedRating === null ? null : round2(predictedRating),
    breakdown: {
      quality: round2(quality),
      proximity: round2(proximity),
      complexityFit: round2(complexityFit),
      collaborative: round2(collaborative),
      specialtyMatch,
      distanceKm: round1(distanceKm),
    },
  };
}

export function matchContractors(
  project: ProjectRequirements,
  contractors: Contractor[],
  options: { weights?: MatchWeights; matrix?: RatingMatrix; limit?: number } = {},
): MatchResult[] {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const results = contractors.map((c) => scoreContractor(c, project, weights, options.matrix));
  results.sort((a, b) => b.score - a.score);
  return typeof options.limit === "number" ? results.slice(0, options.limit) : results;
}

// When collaborative data is unavailable, spread its weight across the other
// content-based signals so scores stay normalized to ~[0,1].
function redistributeCollaborative(weights: MatchWeights): MatchWeights {
  const remaining = weights.quality + weights.proximity + weights.complexityFit;
  if (remaining === 0) {
    return { quality: 0.34, proximity: 0.33, complexityFit: 0.33, collaborative: 0 };
  }
  const factor = 1 / remaining;
  return {
    quality: weights.quality * factor,
    proximity: weights.proximity * factor,
    complexityFit: weights.complexityFit * factor,
    collaborative: 0,
  };
}

// --- utils -------------------------------------------------------------------

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
