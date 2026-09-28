// End-to-End Project Pipeline & State Machine
// -------------------------------------------
// A pure, deterministic finite state machine that drives a project from onsite
// capture through automated estimation, material selection, contractor assignment,
// and deployment. Transitions are declared in TRANSITIONS with per-transition guards,
// so illegal moves (e.g. estimating before analysis) are rejected rather than crashing.
//
// The reducer is side-effect free: `transition(state, event)` returns the next state.
// Wire it to React state, a store, or the server the same way.

import type { FacadeAnalysis } from "./facadeVision";
import type { Quote } from "./pricing";
import type { MatchResult } from "./contractors";

export type ProjectStage =
  | "capture"
  | "analysis"
  | "estimation"
  | "material_selection"
  | "contractor_assignment"
  | "approval"
  | "deployment"
  | "completed"
  | "cancelled";

export const STAGE_LABELS_AR: Record<ProjectStage, string> = {
  capture: "التقاط الصورة",
  analysis: "تحليل الواجهة",
  estimation: "التقدير التلقائي",
  material_selection: "اختيار الخامات",
  contractor_assignment: "إسناد المقاول",
  approval: "اعتماد العميل",
  deployment: "التنفيذ والنشر",
  completed: "مكتمل",
  cancelled: "ملغي",
};

/** The order the happy-path advances through, for progress UIs. */
export const STAGE_ORDER: ProjectStage[] = [
  "capture",
  "analysis",
  "estimation",
  "material_selection",
  "contractor_assignment",
  "approval",
  "deployment",
  "completed",
];

export interface SelectedMaterial {
  id: string;
  label: string;
  quantity: number;
}

export interface ProjectContext {
  projectId: string;
  captureImageUrl: string | null;
  analysis: FacadeAnalysis | null;
  quote: Quote | null;
  selectedMaterials: SelectedMaterial[];
  assignedContractor: MatchResult | null;
  approvedAt: number | null;
  deploymentUrl: string | null;
  updatedAt: number;
}

export type PipelineEvent =
  | { type: "CAPTURE_IMAGE"; imageUrl: string }
  | { type: "RUN_ANALYSIS"; analysis: FacadeAnalysis }
  | { type: "RUN_ESTIMATION"; quote: Quote }
  | { type: "SELECT_MATERIALS"; materials: SelectedMaterial[] }
  | { type: "ASSIGN_CONTRACTOR"; match: MatchResult }
  | { type: "APPROVE"; at?: number }
  | { type: "DEPLOY"; deploymentUrl: string }
  | { type: "COMPLETE" }
  | { type: "CANCEL"; reason?: string }
  | { type: "RESET" };

export interface ProjectState {
  stage: ProjectStage;
  context: ProjectContext;
  /** Populated when the last dispatched event was rejected. Cleared on success. */
  error: string | null;
}

interface TransitionRule {
  event: PipelineEvent["type"];
  to: ProjectStage;
  /** Returns null if allowed, or an Arabic error string if blocked. */
  guard?: (ctx: ProjectContext, event: PipelineEvent) => string | null;
  reduce: (ctx: ProjectContext, event: PipelineEvent) => ProjectContext;
}

function makeContext(projectId: string): ProjectContext {
  return {
    projectId,
    captureImageUrl: null,
    analysis: null,
    quote: null,
    selectedMaterials: [],
    assignedContractor: null,
    approvedAt: null,
    deploymentUrl: null,
    updatedAt: Date.now(),
  };
}

export function createProjectState(projectId = `prj_${Date.now().toString(36)}`): ProjectState {
  return { stage: "capture", context: makeContext(projectId), error: null };
}

// Transition table keyed by the current stage. CANCEL and RESET are handled
// globally in `transition` so they don't need to be repeated per stage.
const TRANSITIONS: Partial<Record<ProjectStage, TransitionRule[]>> = {
  capture: [
    {
      event: "CAPTURE_IMAGE",
      to: "analysis",
      reduce: (ctx, e) =>
        e.type === "CAPTURE_IMAGE" ? { ...ctx, captureImageUrl: e.imageUrl } : ctx,
    },
  ],
  analysis: [
    {
      event: "RUN_ANALYSIS",
      to: "estimation",
      guard: (ctx) => (ctx.captureImageUrl ? null : "لا توجد صورة ملتقطة للتحليل"),
      reduce: (ctx, e) => (e.type === "RUN_ANALYSIS" ? { ...ctx, analysis: e.analysis } : ctx),
    },
    // Allow re-capturing before analysis is accepted.
    {
      event: "CAPTURE_IMAGE",
      to: "analysis",
      reduce: (ctx, e) =>
        e.type === "CAPTURE_IMAGE" ? { ...ctx, captureImageUrl: e.imageUrl, analysis: null } : ctx,
    },
  ],
  estimation: [
    {
      event: "RUN_ESTIMATION",
      to: "material_selection",
      guard: (ctx) => (ctx.analysis ? null : "يجب تحليل الواجهة قبل التقدير"),
      reduce: (ctx, e) => (e.type === "RUN_ESTIMATION" ? { ...ctx, quote: e.quote } : ctx),
    },
  ],
  material_selection: [
    {
      event: "SELECT_MATERIALS",
      to: "contractor_assignment",
      guard: (ctx, e) => {
        if (!ctx.quote) return "لا يوجد تقدير مبني عليه اختيار الخامات";
        if (e.type === "SELECT_MATERIALS" && e.materials.length === 0)
          return "اختر خامة واحدة على الأقل";
        return null;
      },
      reduce: (ctx, e) =>
        e.type === "SELECT_MATERIALS" ? { ...ctx, selectedMaterials: e.materials } : ctx,
    },
  ],
  contractor_assignment: [
    {
      event: "ASSIGN_CONTRACTOR",
      to: "approval",
      guard: (ctx) =>
        ctx.selectedMaterials.length > 0 ? null : "يجب اختيار الخامات قبل إسناد المقاول",
      reduce: (ctx, e) =>
        e.type === "ASSIGN_CONTRACTOR" ? { ...ctx, assignedContractor: e.match } : ctx,
    },
  ],
  approval: [
    {
      event: "APPROVE",
      to: "deployment",
      guard: (ctx) => (ctx.assignedContractor ? null : "لا يوجد مقاول معتمد بعد"),
      reduce: (ctx, e) => ({
        ...ctx,
        approvedAt: (e.type === "APPROVE" && e.at) || Date.now(),
      }),
    },
    // Bounce back to reassign a different contractor before approving.
    {
      event: "ASSIGN_CONTRACTOR",
      to: "approval",
      reduce: (ctx, e) =>
        e.type === "ASSIGN_CONTRACTOR" ? { ...ctx, assignedContractor: e.match } : ctx,
    },
  ],
  deployment: [
    {
      event: "DEPLOY",
      to: "deployment",
      guard: (ctx) => (ctx.approvedAt ? null : "لم يتم اعتماد المشروع بعد"),
      reduce: (ctx, e) => (e.type === "DEPLOY" ? { ...ctx, deploymentUrl: e.deploymentUrl } : ctx),
    },
    {
      event: "COMPLETE",
      to: "completed",
      guard: (ctx) => (ctx.deploymentUrl ? null : "لا يوجد رابط نشر لإتمام المشروع"),
      reduce: (ctx) => ctx,
    },
  ],
};

/** Pure reducer. Never throws; rejected events return state with `error` set. */
export function transition(state: ProjectState, event: PipelineEvent): ProjectState {
  if (event.type === "RESET") {
    return createProjectState(state.context.projectId);
  }
  if (event.type === "CANCEL") {
    return {
      stage: "cancelled",
      context: { ...state.context, updatedAt: Date.now() },
      error: null,
    };
  }
  if (state.stage === "cancelled" || state.stage === "completed") {
    return { ...state, error: "المشروع في حالة نهائية — أعد التهيئة للبدء من جديد" };
  }

  const rules = TRANSITIONS[state.stage] ?? [];
  const rule = rules.find((r) => r.event === event.type);
  if (!rule) {
    return {
      ...state,
      error: `الحدث «${event.type}» غير مسموح في مرحلة «${STAGE_LABELS_AR[state.stage]}»`,
    };
  }

  const blocked = rule.guard ? rule.guard(state.context, event) : null;
  if (blocked) {
    return { ...state, error: blocked };
  }

  const context = { ...rule.reduce(state.context, event), updatedAt: Date.now() };
  return { stage: rule.to, context, error: null };
}

/** Which event types are valid right now — handy for enabling/disabling UI. */
export function availableEvents(state: ProjectState): PipelineEvent["type"][] {
  if (state.stage === "cancelled" || state.stage === "completed") return ["RESET"];
  const rules = TRANSITIONS[state.stage] ?? [];
  const events = rules.map((r) => r.event);
  return [...new Set<PipelineEvent["type"]>([...events, "CANCEL", "RESET"])];
}

/** 0..1 progress along the happy path, for progress bars. */
export function stageProgress(stage: ProjectStage): number {
  if (stage === "cancelled") return 0;
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0) return 0;
  return idx / (STAGE_ORDER.length - 1);
}
