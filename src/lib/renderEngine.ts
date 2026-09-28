// Photoreal / 3D render directives that are appended to every AI image request.
// These turn a plain edit request into a CGI-grade architectural visualisation brief.

export type LightDirection = "front" | "left" | "right" | "top" | "back";
export type TimeOfDay = "noon" | "golden" | "dusk" | "night" | "overcast";
export type ShadowStrength = "soft" | "natural" | "dramatic";
export type Finish = "matte" | "satin" | "gloss" | "metallic" | "glass";
export type RenderQuality = "balanced" | "high" | "ultra";

export interface RenderSettings {
  light: LightDirection;
  time: TimeOfDay;
  shadows: ShadowStrength;
  finish: Finish;
  quality: RenderQuality;
  depthOfField: boolean;
  reflections: boolean;
}

export const DEFAULT_RENDER: RenderSettings = {
  light: "front",
  time: "golden",
  shadows: "natural",
  finish: "satin",
  quality: "ultra",
  depthOfField: false,
  reflections: true,
};

export const LIGHT_LABELS: Record<LightDirection, string> = {
  front: "أمامية",
  left: "من اليسار",
  right: "من اليمين",
  top: "من أعلى",
  back: "خلفية (هالة)",
};

export const TIME_LABELS: Record<TimeOfDay, string> = {
  noon: "ظهيرة",
  golden: "ساعة ذهبية",
  dusk: "غروب",
  night: "ليل",
  overcast: "غائم",
};

export const SHADOW_LABELS: Record<ShadowStrength, string> = {
  soft: "ظلال ناعمة",
  natural: "ظلال طبيعية",
  dramatic: "ظلال درامية",
};

export const FINISH_LABELS: Record<Finish, string> = {
  matte: "مطفي",
  satin: "ساتان",
  gloss: "لامع",
  metallic: "معدني",
  glass: "زجاجي",
};

export const QUALITY_LABELS: Record<RenderQuality, string> = {
  balanced: "متوازن",
  high: "عالي",
  ultra: "فائق",
};

const LIGHT_BRIEF: Record<LightDirection, string> = {
  front: "key light placed frontally, even illumination across the facade with only short falling shadows",
  left: "key light from the left, long directional shadows falling to the right, clear side modelling",
  right: "key light from the right, long directional shadows falling to the left, clear side modelling",
  top: "high overhead key light, tight contact shadows under every ledge and protruding element",
  back: "backlit rim lighting that separates the subject from the background with a glowing halo edge",
};

const TIME_BRIEF: Record<TimeOfDay, string> = {
  noon: "bright midday sun, neutral 5600K daylight, crisp sky",
  golden: "golden hour sunlight, warm 3200K light, long soft shadows",
  dusk: "blue-hour dusk, deep blue ambient sky with the artificial lighting clearly visible",
  night: "night scene, the signage and interior lighting are the main light sources with realistic light spill on surrounding surfaces",
  overcast: "soft overcast daylight, large diffuse light source, very low contrast shadows",
};

const SHADOW_BRIEF: Record<ShadowStrength, string> = {
  soft: "very soft, wide penumbra shadows with strong ambient bounce light",
  natural: "physically accurate shadows with correct density, contact occlusion and ambient bounce",
  dramatic: "deep high-contrast shadows with sharp edges and pronounced ambient occlusion in every crevice",
};

const FINISH_BRIEF: Record<Finish, string> = {
  matte: "matte micro-rough surfaces with diffuse shading and no visible specular highlights",
  satin: "satin finish with a soft broad specular roll-off",
  gloss: "high-gloss surfaces with sharp specular highlights and clean mirror-like reflections",
  metallic: "brushed and anodised metal surfaces with anisotropic highlights and metallic reflectance",
  glass: "transparent glass surfaces with correct refraction, fresnel edge reflection and visible interior depth",
};

const QUALITY_BRIEF: Record<RenderQuality, string> = {
  balanced: "clean render, accurate proportions and materials",
  high: "high-detail render: resolved material texture, correct micro-shading, no smearing",
  ultra: "ultra-detailed photoreal CGI render in the quality of a top architectural visualisation studio: 8K-class micro detail, physically based materials, global illumination, ray-traced reflections, correct subsurface behaviour, zero artefacts and zero blurred geometry",
};

/** The render brief appended to the user's request before it reaches the image model. */
export function buildRenderDirectives(settings: RenderSettings): string {
  const lines = [
    `Render as a physically based 3D visualisation: ${QUALITY_BRIEF[settings.quality]}.`,
    `Lighting: ${LIGHT_BRIEF[settings.light]}; ${TIME_BRIEF[settings.time]}.`,
    `Shadows: ${SHADOW_BRIEF[settings.shadows]}.`,
    `Materials: ${FINISH_BRIEF[settings.finish]}.`,
    settings.reflections
      ? "Include accurate reflections, light bounce between surfaces and realistic specular response on glass, metal and wet ground."
      : "Keep reflections minimal and non-distracting.",
    settings.depthOfField
      ? "Use a shallow cinematic depth of field with the subject tack-sharp and the background gently defocused."
      : "Keep the whole frame in sharp focus, edge to edge.",
    "Geometry must stay perfectly straight and perspective-correct; edges crisp, panel seams and joints consistent, no warping, melting or duplicated elements.",
  ];
  return lines.join("\n");
}

/** Short Arabic chips describing what was applied, for the UI. */
export function describeRender(settings: RenderSettings): string[] {
  return [
    `إضاءة ${LIGHT_LABELS[settings.light]}`,
    TIME_LABELS[settings.time],
    SHADOW_LABELS[settings.shadows],
    `خامة ${FINISH_LABELS[settings.finish]}`,
    `جودة ${QUALITY_LABELS[settings.quality]}`,
    ...(settings.reflections ? ["انعكاسات واقعية"] : []),
    ...(settings.depthOfField ? ["عمق ميدان سينمائي"] : []),
  ];
}
