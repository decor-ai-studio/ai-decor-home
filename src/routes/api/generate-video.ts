import { createFileRoute } from "@tanstack/react-router";
import {
  buildLegoAssemblyPrompt,
  createVideoJob,
  parseDataUrl,
} from "@/lib/video-gateway.server";
import { PAID_VIDEO_ENABLED } from "@/lib/features";

export const Route = createFileRoute("/api/generate-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Paid AI video is switched off: refuse before touching the gateway (zero cost).
        if (!PAID_VIDEO_ENABLED) {
          return Response.json({ error: "فيديو الذكاء الاصطناعي المدفوع متوقف. استخدم الفيديو الاقتصادي." }, { status: 410 });
        }
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as {
          imageDataUrl?: string;
          brief?: string;
          duration?: number;
          resolution?: string;
          aspectRatio?: string;
        };
        if (!body.imageDataUrl) return new Response("Missing design image", { status: 400 });
        const image = parseDataUrl(body.imageDataUrl);
        if (!image || !image.mime.startsWith("image/")) {
          return new Response("Design image must be an inline PNG/JPEG/WebP data URL", {
            status: 400,
          });
        }

        const duration = Math.max(3, Math.min(10, Math.round(body.duration ?? 8)));
        const resolution = ["360p", "720p", "1080p", "4k"].includes(body.resolution ?? "")
          ? (body.resolution as string)
          : "1080p";
        const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9";

        const upstream = await createVideoJob(apiKey, {
          prompt: buildLegoAssemblyPrompt(body.brief ?? ""),
          image,
          duration,
          resolution,
          aspectRatio,
        });

        const text = await upstream.text();
        return new Response(text, {
          status: upstream.status,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
