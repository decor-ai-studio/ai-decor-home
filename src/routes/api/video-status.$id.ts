import { createFileRoute } from "@tanstack/react-router";
import { getVideoJob } from "@/lib/video-gateway.server";

export const Route = createFileRoute("/api/video-status/$id")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const id = new URL(request.url).pathname.split("/").pop() ?? "";
        if (!id) return new Response("Missing video id", { status: 400 });

        const upstream = await getVideoJob(apiKey, decodeURIComponent(id));
        const text = await upstream.text();
        return new Response(text, {
          status: upstream.status,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
