// Server-only Lovable AI Gateway video helpers. LOVABLE_API_KEY never leaves the server.

export const VIDEO_BASE_URL = "https://ai.gateway.lovable.dev";
export const VIDEO_MODEL = "google/gemini-omni-1.1-flash";

export interface VideoJob {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  progress?: number;
  error?: { code?: string; message?: string };
}

const authHeaders = (apiKey: string) => ({ Authorization: `Bearer ${apiKey}` });

/** Split a data URL into its base64 payload and mime type. */
export function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  const mime = match[1] ?? "image/png";
  const data = match[2] ?? "";
  if (!data) return null;
  return { mime, data };
}

/**
 * Lego-style assembly brief: the uploaded design is the final state, and the clip
 * builds the facade up to it piece by piece. Rules follow the video model guidance:
 * one continuous shot, plain negatives, explicit audio direction.
 */
export function buildLegoAssemblyPrompt(brief: string) {
  return [
    "Animate the supplied architectural design image <IMAGE_REF_0> as a photorealistic 3D construction sequence.",
    "The shop facade assembles itself piece by piece like Lego bricks snapping together: first the bare structural frame, then cladding panels flying in and clicking into place row by row, then the glass storefront, then the illuminated channel letters sliding onto the fascia and switching on with a warm light spill, and finally the exterior spotlights and pavement details.",
    "Every piece rotates gently into position with believable weight, precise seams and accurate contact shadows. Keep the building geometry, proportions, materials, colours, layout and the exact wording of all signage identical to the supplied image.",
    "Camera: one slow steady push-in on the facade, in a single continuous shot, no scene cuts.",
    "[0-2s] structural frame assembles. [2-5s] cladding panels snap on. [5-7s] glass and signage lock in and the lights switch on. Ends on the finished facade matching the supplied image exactly.",
    "Photorealistic architectural visualisation quality, physically based materials, ray-traced reflections, crisp edges. Consider micro-detail and timing.",
    "Audio: light mechanical click and snap sounds as pieces lock together, a soft whoosh on each flying panel, a subtle cinematic build. No dialogue. No narration. No music lyrics.",
    "No cartoon look, no toy plastic bricks in the final frame, no on-screen text other than the signage in the image, no watermark.",
    brief.trim() ? `Additional client direction, respect it exactly: ${brief.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createVideoJob(
  apiKey: string,
  body: {
    prompt: string;
    image: { mime: string; data: string };
    duration: number;
    resolution: string;
    aspectRatio?: string;
  },
) {
  return fetch(`${VIDEO_BASE_URL}/v1/videos`, {
    method: "POST",
    headers: { ...authHeaders(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VIDEO_MODEL,
      input: [
        { type: "text", text: body.prompt },
        { type: "image", data: body.image.data, mime_type: body.image.mime },
      ],
      response_format: {
        type: "video",
        resolution: body.resolution,
        duration: `${Math.round(body.duration)}s`,
        ...(body.aspectRatio ? { aspect_ratio: body.aspectRatio } : {}),
      },
      generation_config: { video_config: { task: "image_to_video" } },
    }),
  });
}

export function getVideoJob(apiKey: string, id: string) {
  return fetch(`${VIDEO_BASE_URL}/v1/videos/${encodeURIComponent(id)}`, {
    headers: authHeaders(apiKey),
  });
}

export function getVideoContent(apiKey: string, id: string) {
  return fetch(`${VIDEO_BASE_URL}/v1/videos/${encodeURIComponent(id)}/content`, {
    headers: authHeaders(apiKey),
  });
}
