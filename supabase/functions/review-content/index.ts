import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatRagContext, retrievePfizerContext } from "../_shared/pfizerRag.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { brief, buildType, audience, country } = await req.json();
    if (!brief) return new Response(JSON.stringify({ error: "Brief required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const briefText = typeof brief === "string" ? brief : Object.entries(brief).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");
    const ragChunks = retrievePfizerContext(`${briefText}\n${buildType || ""}\n${audience || ""}\n${country || ""}`);
    const ragContext = formatRagContext(ragChunks);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a Pfizer compliance and quality reviewer for a ${buildType || "webpage"} targeting ${audience || "patients"} in ${country || "Global"}.
Review the following content for:
1. Brand compliance (Pfizer voice: clear, scientific, optimistic, human-centred)
2. Grammar and style
3. Accessibility (WCAG 2.1 AA)
4. Regulatory compliance

Use this RAG context from Pfizer source documents to calibrate tone and language quality:
${ragContext}

Be realistic — find real issues. Score 0-100. Severity: high (blocks), medium (should fix), low (minor).`,
          },
          { role: "user", content: briefText },
        ],
        tools: [{
          type: "function",
          function: {
            name: "review_content",
            description: "Return structured review results",
            parameters: {
              type: "object",
              properties: {
                overallScore: { type: "number" },
                complianceIssues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      severity: { type: "string", enum: ["high", "medium", "low"] },
                      field: { type: "string" },
                      contentSnippet: { type: "string" },
                      issue: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["id", "severity", "field", "contentSnippet", "issue", "recommendation"],
                    additionalProperties: false,
                  },
                },
                grammarIssues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      severity: { type: "string", enum: ["high", "medium", "low"] },
                      field: { type: "string" },
                      contentSnippet: { type: "string" },
                      issue: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["id", "severity", "field", "contentSnippet", "issue", "recommendation"],
                    additionalProperties: false,
                  },
                },
                scores: {
                  type: "object",
                  properties: {
                    compliance: { type: "number" },
                    grammar: { type: "number" },
                    brandVoice: { type: "number" },
                    accessibility: { type: "number" },
                  },
                  required: ["compliance", "grammar", "brandVoice", "accessibility"],
                  additionalProperties: false,
                },
              },
              required: ["overallScore", "complianceIssues", "grammarIssues", "scores"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "review_content" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Review failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No structured response");

    return new Response(toolCall.function.arguments, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("review-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
