// Computer Vision Facade Analyzer
// --------------------------------
// Client-side facade analysis over a canvas ImageData. The pipeline:
//   1. Downscale to a fixed analysis grid (cells).
//   2. Per cell, compute luminance, luminance variance (texture), edge density
//      (Sobel), saturation and hue.
//   3. Classify each cell into a surface type from those features.
//   4. Group cells into surfaces, estimate real-world dimensions, and derive
//      cladding-panel and LED-signage layout recommendations.
//
// This is a heuristic analyzer (not a neural net) but it works fully offline and
// gives explainable, tunable output. All numeric thresholds live in DEFAULT_CONFIG.

export type SurfaceType = "glass" | "concrete" | "masonry" | "metal" | "unknown";

export const SURFACE_LABELS_AR: Record<SurfaceType, string> = {
  glass: "زجاج",
  concrete: "خرسانة",
  masonry: "طوب / حجر",
  metal: "معدن",
  unknown: "غير محدد",
};

export interface CellFeatures {
  col: number;
  row: number;
  luminance: number; // 0..1 mean brightness
  texture: number; // 0..1 normalized local variance
  edgeDensity: number; // 0..1 Sobel magnitude
  saturation: number; // 0..1
  hue: number; // 0..360
  type: SurfaceType;
}

export interface GridBounds {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface DetectedSurface {
  type: SurfaceType;
  coverageRatio: number; // 0..1 share of analyzed area
  confidence: number; // 0..1
  cells: number;
  /** Approximate bounding region in grid coordinates. */
  bounds: GridBounds;
  /** Estimated real-world area in m² given the facade size estimate. */
  areaSqm: number;
}

export interface FacadeDimensions {
  widthMeters: number;
  heightMeters: number;
  aspectRatio: number;
  /** How the estimate was derived. */
  method: "reference-height" | "assumed-floors";
  floors: number;
}

export interface PanelLayout {
  panelWidthMm: number;
  panelHeightMm: number;
  columns: number;
  rows: number;
  totalPanels: number;
  /** Uniform joint gap distributed to fill the wall, in millimetres. */
  jointGapMm: number;
  coverageSqm: number;
}

export interface SignageLayout {
  letterHeightCm: number;
  /** Readable distance rule-of-thumb (≈ 3 m per cm of letter height). */
  readableDistanceM: number;
  recommendedLetterSpacingCm: number;
  maxCharacters: number;
  mountingBandYRatio: number; // 0..1 vertical placement (0 = top)
}

export interface LayoutRecommendation {
  claddingTargets: SurfaceType[];
  panel: PanelLayout;
  signage: SignageLayout;
  notes: string[];
}

export interface FacadeAnalysis {
  grid: { cols: number; rows: number };
  cells: CellFeatures[];
  dimensions: FacadeDimensions;
  surfaces: DetectedSurface[];
  recommendation: LayoutRecommendation;
}

export interface AnalyzeOptions {
  cols?: number;
  rows?: number;
  /** Known height of a reference element (e.g. a door) in meters, if available. */
  referenceHeightM?: number;
  /** Fraction of image height the reference element occupies (0..1). */
  referenceHeightRatio?: number;
  /** Assumed floor height in meters when no reference is provided. */
  floorHeightM?: number;
  panelWidthMm?: number;
  panelHeightMm?: number;
}

interface AnalyzerConfig {
  cols: number;
  rows: number;
  floorHeightM: number;
  panelWidthMm: number;
  panelHeightMm: number;
}

const DEFAULT_CONFIG: AnalyzerConfig = {
  cols: 16,
  rows: 12,
  floorHeightM: 3.2,
  panelWidthMm: 1220,
  panelHeightMm: 2440,
};

// --- Public API --------------------------------------------------------------

export function analyzeFacade(imageData: ImageData, options: AnalyzeOptions = {}): FacadeAnalysis {
  const config: AnalyzerConfig = {
    cols: options.cols ?? DEFAULT_CONFIG.cols,
    rows: options.rows ?? DEFAULT_CONFIG.rows,
    floorHeightM: options.floorHeightM ?? DEFAULT_CONFIG.floorHeightM,
    panelWidthMm: options.panelWidthMm ?? DEFAULT_CONFIG.panelWidthMm,
    panelHeightMm: options.panelHeightMm ?? DEFAULT_CONFIG.panelHeightMm,
  };

  const cells = computeCellFeatures(imageData, config);
  for (const cell of cells) cell.type = classifyCell(cell);

  const dimensions = estimateDimensions(imageData, config, options);
  const surfaces = groupSurfaces(cells, config, dimensions);
  const recommendation = recommendLayout(surfaces, dimensions, config);

  return {
    grid: { cols: config.cols, rows: config.rows },
    cells,
    dimensions,
    surfaces,
    recommendation,
  };
}

/** Convenience: analyze straight from an image URL (loads + rasterizes to canvas). */
export async function analyzeFacadeFromUrl(
  url: string,
  options: AnalyzeOptions = {},
): Promise<FacadeAnalysis> {
  const imageData = await imageDataFromUrl(url, 512);
  return analyzeFacade(imageData, options);
}

// --- Feature extraction ------------------------------------------------------

function computeCellFeatures(imageData: ImageData, config: AnalyzerConfig): CellFeatures[] {
  const { width, height, data } = imageData;
  const { cols, rows } = config;
  const cellW = width / cols;
  const cellH = height / rows;
  const cells: CellFeatures[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor(col * cellW);
      const y0 = Math.floor(row * cellH);
      const x1 = Math.min(width, Math.floor((col + 1) * cellW));
      const y1 = Math.min(height, Math.floor((row + 1) * cellH));

      let sumL = 0;
      let sumL2 = 0;
      let sumSat = 0;
      let sumHue = 0;
      let hueWeight = 0;
      let edgeAccum = 0;
      let count = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4;
          const r = (data[idx] ?? 0) / 255;
          const g = (data[idx + 1] ?? 0) / 255;
          const b = (data[idx + 2] ?? 0) / 255;
          const { l, s, h } = rgbToHsl(r, g, b);
          sumL += l;
          sumL2 += l * l;
          sumSat += s;
          if (s > 0.08) {
            sumHue += h;
            hueWeight += 1;
          }

          // Sobel-ish horizontal+vertical gradient on luminance, cheap 1-step.
          if (x + 1 < x1 && y + 1 < y1) {
            const idxR = (y * width + (x + 1)) * 4;
            const idxD = ((y + 1) * width + x) * 4;
            const lR = luminance(
              (data[idxR] ?? 0) / 255,
              (data[idxR + 1] ?? 0) / 255,
              (data[idxR + 2] ?? 0) / 255,
            );
            const lD = luminance(
              (data[idxD] ?? 0) / 255,
              (data[idxD + 1] ?? 0) / 255,
              (data[idxD + 2] ?? 0) / 255,
            );
            edgeAccum += Math.abs(l - lR) + Math.abs(l - lD);
          }
          count += 1;
        }
      }

      const n = Math.max(1, count);
      const meanL = sumL / n;
      const variance = Math.max(0, sumL2 / n - meanL * meanL);
      cells.push({
        col,
        row,
        luminance: meanL,
        texture: clamp01(variance * 12), // scale variance into a usable 0..1 band
        edgeDensity: clamp01((edgeAccum / n) * 6),
        saturation: clamp01(sumSat / n),
        hue: hueWeight > 0 ? sumHue / hueWeight : 0,
        type: "unknown",
      });
    }
  }

  return cells;
}

// --- Classification ----------------------------------------------------------

function classifyCell(cell: CellFeatures): SurfaceType {
  const { luminance: l, texture, edgeDensity, saturation, hue } = cell;

  // Glass: bright, smooth (low texture), often cool/desaturated with hard specular edges.
  const glassScore =
    score(l, 0.55, 0.25) * 1.1 +
    score(1 - texture, 0.75, 0.25) +
    score(1 - saturation, 0.7, 0.3) * 0.8 +
    (hue > 170 && hue < 260 ? 0.4 : 0);

  // Masonry (brick/stone): warm hue, high texture, regular fine edges.
  const masonryScore =
    score(texture, 0.6, 0.25) * 1.1 +
    score(edgeDensity, 0.55, 0.3) +
    (hue < 45 || hue > 330 ? 0.6 : 0) +
    score(saturation, 0.4, 0.3) * 0.7;

  // Concrete: mid luminance, low saturation, low-mid texture, few sharp edges.
  const concreteScore =
    score(l, 0.5, 0.25) +
    score(1 - saturation, 0.75, 0.25) * 1.1 +
    score(1 - edgeDensity, 0.65, 0.3) +
    score(1 - texture, 0.55, 0.3) * 0.6;

  // Metal: low saturation, high contrast/edges, can be bright or dark.
  const metalScore =
    score(1 - saturation, 0.7, 0.3) +
    score(edgeDensity, 0.6, 0.3) * 1.1 +
    score(texture, 0.45, 0.3) * 0.5 +
    score(Math.abs(l - 0.5) * 2, 0.6, 0.4) * 0.6;

  const scores: Array<[SurfaceType, number]> = [
    ["glass", glassScore],
    ["masonry", masonryScore],
    ["concrete", concreteScore],
    ["metal", metalScore],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const best = scores[0];
  if (!best || best[1] < 0.7) return "unknown";
  return best[0];
}

// Triangular affinity: 1 at target, decaying to 0 at target ± tolerance.
function score(value: number, target: number, tolerance: number): number {
  return Math.max(0, 1 - Math.abs(value - target) / tolerance);
}

// --- Dimensions --------------------------------------------------------------

function estimateDimensions(
  imageData: ImageData,
  config: AnalyzerConfig,
  options: AnalyzeOptions,
): FacadeDimensions {
  const aspect = imageData.width / imageData.height;

  if (options.referenceHeightM && options.referenceHeightRatio && options.referenceHeightRatio > 0) {
    const heightMeters = options.referenceHeightM / options.referenceHeightRatio;
    const widthMeters = heightMeters * aspect;
    return {
      widthMeters: round1(widthMeters),
      heightMeters: round1(heightMeters),
      aspectRatio: round2(aspect),
      method: "reference-height",
      floors: Math.max(1, Math.round(heightMeters / config.floorHeightM)),
    };
  }

  // No reference: assume the facade is ~1 floor tall unless it is clearly a tall,
  // portrait-oriented building. Coarse but transparent.
  const floors = aspect < 0.8 ? 3 : aspect < 1.2 ? 2 : 1;
  const heightMeters = floors * config.floorHeightM;
  const widthMeters = heightMeters * aspect;
  return {
    widthMeters: round1(widthMeters),
    heightMeters: round1(heightMeters),
    aspectRatio: round2(aspect),
    method: "assumed-floors",
    floors,
  };
}

// --- Surface grouping --------------------------------------------------------

function groupSurfaces(
  cells: CellFeatures[],
  config: AnalyzerConfig,
  dimensions: FacadeDimensions,
): DetectedSurface[] {
  const totalCells = cells.length || 1;
  const facadeArea = dimensions.widthMeters * dimensions.heightMeters;

  const byType = new Map<SurfaceType, CellFeatures[]>();
  for (const cell of cells) {
    const list = byType.get(cell.type) ?? [];
    list.push(cell);
    byType.set(cell.type, list);
  }

  const surfaces: DetectedSurface[] = [];
  for (const [type, list] of byType) {
    if (type === "unknown" || list.length === 0) continue;
    let minCol = config.cols;
    let minRow = config.rows;
    let maxCol = 0;
    let maxRow = 0;
    for (const c of list) {
      minCol = Math.min(minCol, c.col);
      minRow = Math.min(minRow, c.row);
      maxCol = Math.max(maxCol, c.col);
      maxRow = Math.max(maxRow, c.row);
    }
    const coverageRatio = list.length / totalCells;
    // Confidence: cohesive (fills its own bounding box) + meaningful coverage.
    const boxCells = (maxCol - minCol + 1) * (maxRow - minRow + 1);
    const cohesion = boxCells > 0 ? list.length / boxCells : 0;
    const confidence = clamp01(0.4 * cohesion + 0.6 * Math.min(1, coverageRatio * 3));

    surfaces.push({
      type,
      coverageRatio: round2(coverageRatio),
      confidence: round2(confidence),
      cells: list.length,
      bounds: { col: minCol, row: minRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1 },
      areaSqm: round1(coverageRatio * facadeArea),
    });
  }

  surfaces.sort((a, b) => b.coverageRatio - a.coverageRatio);
  return surfaces;
}

// --- Layout recommendation ---------------------------------------------------

function recommendLayout(
  surfaces: DetectedSurface[],
  dimensions: FacadeDimensions,
  config: AnalyzerConfig,
): LayoutRecommendation {
  // Cladding goes on solid (non-glass) surfaces.
  const claddingTargets = surfaces
    .filter((s) => s.type === "concrete" || s.type === "masonry" || s.type === "metal")
    .map((s) => s.type);
  const claddableArea = surfaces
    .filter((s) => claddingTargets.includes(s.type))
    .reduce((sum, s) => sum + s.areaSqm, 0);

  const wallWmm = dimensions.widthMeters * 1000;
  const wallHmm = dimensions.heightMeters * 1000;
  const columns = Math.max(1, Math.floor(wallWmm / config.panelWidthMm));
  const rows = Math.max(1, Math.floor(wallHmm / config.panelHeightMm));
  const usedWidth = columns * config.panelWidthMm;
  // Distribute the leftover width evenly as joints between and around panels.
  const jointGapMm = columns > 1 ? Math.round((wallWmm - usedWidth) / (columns + 1)) : 0;

  const panel: PanelLayout = {
    panelWidthMm: config.panelWidthMm,
    panelHeightMm: config.panelHeightMm,
    columns,
    rows,
    totalPanels: columns * rows,
    jointGapMm: Math.max(0, jointGapMm),
    coverageSqm: round1(claddableArea > 0 ? claddableArea : dimensions.widthMeters * dimensions.heightMeters),
  };

  // Signage: letter height ≈ 12% of facade height, capped to a sane range.
  const letterHeightCm = clampRange(dimensions.heightMeters * 100 * 0.12, 15, 120);
  const letterSpacingCm = round1(letterHeightCm * 0.25);
  // A letter's average advance width ≈ 0.7·height; account for inter-letter spacing.
  const advanceCm = letterHeightCm * 0.7 + letterSpacingCm;
  const usableWidthCm = dimensions.widthMeters * 100 * 0.8; // keep 10% margin each side
  const maxCharacters = Math.max(1, Math.floor(usableWidthCm / advanceCm));

  const signage: SignageLayout = {
    letterHeightCm: round1(letterHeightCm),
    readableDistanceM: round1(letterHeightCm * 3),
    recommendedLetterSpacingCm: letterSpacingCm,
    maxCharacters,
    mountingBandYRatio: 0.18,
  };

  const notes: string[] = [];
  if (surfaces.some((s) => s.type === "glass" && s.coverageRatio > 0.25)) {
    notes.push("نسبة زجاج مرتفعة — يفضّل تثبيت الحروف على شريط علوي مصمت بدل الزجاج.");
  }
  if (dimensions.method === "assumed-floors") {
    notes.push("الأبعاد تقديرية بافتراض ارتفاع الأدوار — أدخل ارتفاع مرجعي (كالباب) لدقة أعلى.");
  }
  if (claddingTargets.length === 0) {
    notes.push("لم يتم رصد سطح مصمت واضح — راجع زاوية التصوير أو الإضاءة.");
  }

  return { claddingTargets: unique(claddingTargets), panel, signage, notes };
}

// --- Canvas helpers ----------------------------------------------------------

export async function imageDataFromUrl(url: string, maxDim = 512): Promise<ImageData> {
  const img = await loadImage(url);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w === 0 || h === 0) throw new Error("Image has no dimensions");
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

// --- Math utils --------------------------------------------------------------

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
