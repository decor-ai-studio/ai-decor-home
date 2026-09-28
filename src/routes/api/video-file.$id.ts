import { createFileRoute } from "@tanstack/react-router";
import { getVideoContent } from "@/lib/video-gateway.server";

export const Route = createFileRoute("/api/video-file/$id")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const id = new URL(request.url).pathname.split("/").pop() ?? "";
        if (!id) return new Response("Missing video id", { status: 400 });

        const upstream = await getVideoContent(apiKey, decodeURIComponent(id));
        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          return new Response(detail || "Video download failed", {
            status: upstream.status || 502,
          });
        }
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "video/mp4",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
