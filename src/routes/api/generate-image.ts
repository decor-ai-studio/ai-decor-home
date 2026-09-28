import { createFileRoute } from "@tanstack/react-router";
import { generateImage, imageSettings } from "@/lib/image-gateway.server";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          prompt?: string;
          stream?: boolean;
          size?: string;
          quality?: string;
          background?: string;
          output_format?: string;
        };
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        if (!body.prompt?.trim()) return new Response("Missing prompt", { status: 400 });

        const extra: Record<string, string> = {};
        if (body.size) extra["size"] = body.size;
        if (body.quality) extra["quality"] = body.quality;
        if (body.background) extra["background"] = body.background;
        if (body.output_format) extra["output_format"] = body.output_format;

        const upstream = await generateImage(
          { ...imageSettings, apiKey },
          body.prompt,
          body.stream !== false,
          extra,
        );
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
