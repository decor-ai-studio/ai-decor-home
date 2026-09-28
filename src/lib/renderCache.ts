// Speed layer for AI design/render generation:
// 1) a persistent result cache, so repeating a request returns instantly and costs nothing
// 2) a "fast draft" speed mode that asks the gateway for a cheaper/quicker image

import { hashKey, idb, isBrowser, STORE_CACHE } from "./vaultDb";
import type { RenderSettings } from "./renderEngine";

export type SpeedMode = "fast" | "quality";

export interface SpeedProfile {
  /** Gateway image quality parameter. */
  quality: "medium" | "high";
  /** Number of progressive preview frames requested while generating. */
  partialImages: number;
  labelAr: string;
}

export const SPEED_PROFILES: Record<SpeedMode, SpeedProfile> = {
  // each streamed preview frame is billed as extra output, so keep it to a single one
  fast: { quality: "medium", partialImages: 1, labelAr: "مسودة سريعة" },
  quality: { quality: "high", partialImages: 1, labelAr: "جودة قصوى" },
};

interface CacheEntry {
  key: string;
  dataUrl: string;
  createdAt: number;
}

const MAX_ENTRIES = 60;
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // two weeks

export function cacheKey(parts: {
  imageSignature: string;
  prompt: string;
  mode: string;
  style?: string | null;
  render?: RenderSettings;
  mask?: string | null;
  speed: SpeedMode;
}): string {
  return hashKey(
    JSON.stringify([
      parts.imageSignature,
      parts.prompt.trim(),
      parts.mode,
      parts.style ?? "",
      parts.render ?? null,
      parts.mask ? hashKey(parts.mask) : "",
      parts.speed,
    ]),
  );
}

export async function readCache(key: string): Promise<string | null> {
  if (!isBrowser()) return null;
  try {
    const entry = await idb.get<CacheEntry>(STORE_CACHE, key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > MAX_AGE_MS) {
      await idb.del(STORE_CACHE, key);
      return null;
    }
    return entry.dataUrl;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, dataUrl: string): Promise<void> {
  if (!isBrowser()) return;
  try {
    await idb.put<CacheEntry>(STORE_CACHE, { key, dataUrl, createdAt: Date.now() });
    const all = await idb.all<CacheEntry>(STORE_CACHE);
    if (all.length > MAX_ENTRIES) {
      const stale = all.sort((a, b) => a.createdAt - b.createdAt).slice(0, all.length - MAX_ENTRIES);
      await Promise.all(stale.map((e) => idb.del(STORE_CACHE, e.key)));
    }
  } catch {
    /* cache is best-effort */
  }
}

export async function clearRenderCache(): Promise<void> {
  if (!isBrowser()) return;
  await idb.clear(STORE_CACHE).catch(() => undefined);
}

/** Cheap signature of an image source without hashing megabytes of base64. */
export function imageSignature(src: string): string {
  if (src.length <= 4096) return hashKey(src);
  return hashKey(`${src.length}:${src.slice(0, 2048)}:${src.slice(-2048)}`);
}
