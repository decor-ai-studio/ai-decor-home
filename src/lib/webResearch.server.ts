// Server-only live web research: fetches public pages about storefront / signage /
// cladding design trends and reduces them to plain text the model can analyse.

export interface WebSource {
  url: string;
  title: string;
  ok: boolean;
  chars: number;
  excerpt: string;
}

const SOURCE_SETS: Record<string, string[]> = {
  storefront: [
    "https://www.archdaily.com/search/projects/categories/commercial-architecture",
    "https://www.dezeen.com/tag/shops/",
    "https://en.wikipedia.org/wiki/Storefront",
  ],
  signage: [
    "https://en.wikipedia.org/wiki/Channel_letters",
    "https://en.wikipedia.org/wiki/Neon_sign",
    "https://www.dezeen.com/tag/signage/",
  ],
  cladding: [
    "https://en.wikipedia.org/wiki/Aluminium_composite_panel",
    "https://en.wikipedia.org/wiki/Rainscreen",
    "https://www.archdaily.com/tag/facade",
  ],
  lighting: [
    "https://en.wikipedia.org/wiki/LED_lamp",
    "https://en.wikipedia.org/wiki/Architectural_lighting_design",
    "https://www.dezeen.com/tag/lighting-design/",
  ],
};

export type ResearchTopic = keyof typeof SOURCE_SETS;

export const RESEARCH_TOPICS = Object.keys(SOURCE_SETS) as ResearchTopic[];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? stripHtml(match[1]).slice(0, 140) : fallback;
}

async function fetchOne(url: string, perSourceChars: number): Promise<WebSource> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "GlowTechAIStudio/1.0 (+design-trend-research)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) {
      return { url, title: url, ok: false, chars: 0, excerpt: "" };
    }
    const html = await res.text();
    const text = stripHtml(html).slice(0, perSourceChars);
    return {
      url,
      title: extractTitle(html, url),
      ok: text.length > 200,
      chars: text.length,
      excerpt: text,
    };
  } catch {
    return { url, title: url, ok: false, chars: 0, excerpt: "" };
  }
}

/** Fetches every source for the given topics in parallel; failures are reported, never thrown. */
export async function researchWeb(
  topics: ResearchTopic[],
  perSourceChars = 6000,
): Promise<WebSource[]> {
  const urls = Array.from(new Set(topics.flatMap((topic) => SOURCE_SETS[topic] ?? [])));
  return Promise.all(urls.map((url) => fetchOne(url, perSourceChars)));
}

export function buildCorpus(sources: WebSource[], maxChars = 24000): string {
  let corpus = "";
  for (const source of sources) {
    if (!source.ok) continue;
    const block = `\n### SOURCE: ${source.title}\nURL: ${source.url}\n${source.excerpt}\n`;
    if (corpus.length + block.length > maxChars) break;
    corpus += block;
  }
  return corpus.trim();
}
