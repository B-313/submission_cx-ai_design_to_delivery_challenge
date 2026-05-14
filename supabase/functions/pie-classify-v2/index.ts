import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function requireApiKey(req: Request, corsHeaders: Record<string, string>) {
  const provided = req.headers.get("x-api-key")?.trim();
  if (!provided) return null;
  const validKeys = Deno.env.get("valid_api_keys");
  if (validKeys) {
    const keys = validKeys.split(",").map((k: string) => k.trim());
    if (!keys.includes(provided)) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
  return null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type PieV2Payload = {
  brief_text: string;
  country?: string;
  dept?: string;
  build_type?: string;
  language?: string;
  user_name?: string;
  initial_generated?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = requireApiKey(req, corsHeaders);
  if (authError) return authError;

  try {
    const body = (await req.json()) as Partial<PieV2Payload>;
    const briefText = (body.brief_text ?? "").trim();

    if (!briefText) {
      return new Response(JSON.stringify({ error: "brief_text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pieServiceUrl = Deno.env.get("PIE_PY_SERVICE_URL")?.trim();
    if (!pieServiceUrl) {
      return new Response(
        JSON.stringify({
          error: "PIE_PY_SERVICE_URL is not configured",
          hint: "Set PIE_PY_SERVICE_URL to your Python service endpoint that exposes run_pie.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const upstreamResponse = await fetch(pieServiceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brief_text: briefText,
        country: body.country ?? "",
        dept: body.dept ?? "",
        build_type: body.build_type ?? "",
        language: body.language ?? "English",
        user_name: body.user_name ?? "",
        initial_generated: body.initial_generated ?? "",
      }),
    });

    const upstreamText = await upstreamResponse.text();
    return new Response(upstreamText, {
      status: upstreamResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
