import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatRagContext, retrievePfizerContext } from "../_shared/pfizerRag.ts";
import { requireJudgeAccess } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-judge-access-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = requireJudgeAccess(req, corsHeaders);
  if (authError) return authError;

  try {
    const { enrichedPrompt, buildType, audience, country, rawPrompt, fullPrompt, ideationAnswers, sourceContext } = await req.json();
    if (!enrichedPrompt) return new Response(JSON.stringify({ error: "Enriched prompt required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const ragChunks = await retrievePfizerContext(`${enrichedPrompt}\n${buildType || ""}\n${audience || ""}\n${country || ""}`);
    const ragContext = formatRagContext(ragChunks);
    const ideationSummary = ideationAnswers ? JSON.stringify(ideationAnswers, null, 2) : "{}";
    const hasUserSources = Array.isArray(sourceContext) && sourceContext.length > 0;
    const sourceSummary = hasUserSources
      ? sourceContext
          .slice(0, 6)
          .map((s: any, i: number) => `Source ${i + 1}: ${s?.name || "Unnamed"} [${s?.sourceType || "unknown"}]\n${s?.excerpt || ""}`)
          .join("\n\n")
      : "No user-provided documents or links supplied";

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `${enrichedPrompt}\n\n=== RAG BRAND CONTEXT (Company Name docs) ===\n${ragContext}\n\nUse this context to enforce Company Name tone, clarity, and responsible claims. Do not cite chunk IDs in the output.\n\nYou must ground the brief in user-provided context, not generic pharma boilerplate.`,
          },
          {
            role: "user",
            content: `Generate a comprehensive ideation brief for a ${buildType || "webpage"} targeting ${audience || "patients"} in ${country || "Global"}. Use the constraints above and the Company Name RAG context. Return ONLY the JSON structure specified.\n\n=== USER RAW PROMPT ===\n${rawPrompt || ""}\n\n=== IDEATION ANSWERS ===\n${ideationSummary}\n\n=== FULL IDEATION CONTEXT ===\n${fullPrompt || ""}\n\n=== DOCUMENT/LINK EXCERPTS ===\n${sourceSummary}\n\nStrict grounding rules:\n1) Goal, key messages, and content sections must be directly relevant to the user prompt and ideation answers.\n2) "informationFromSources" must describe only user-provided evidence. If no files or links were supplied, say that the brief is grounded in prompt and ideation inputs only.\n3) "inspiration" must describe what PIE added or refined, such as audience shaping, compliance framing, readability, or structure.\n4) Keep contentSections concise, website-ready, and limited to 6 sections with short labels plus short purpose text.\n5) Avoid generic statements that are not tied to the provided context.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_brief",
            description: "Generate a structured website brief",
            parameters: {
              type: "object",
              properties: {
                projectTitle: { type: "string" },
                goal: { type: "string" },
                audience: { type: "string" },
                keyMessages: { type: "array", items: { type: "string" } },
                contentSections: { type: "array", items: { type: "string" } },
                toneAndStyle: { type: "string" },
                informationFromSources: { type: "string", description: "Summarize only user-provided documents, links, or prompt evidence. If no user sources were supplied, say that clearly and do not invent external sources." },
                inspiration: { type: "string", description: "Describe the PIE-added enrichment context such as audience shaping, compliance framing, readability tuning, and structural choices." },
              },
              required: ["projectTitle", "goal", "audience", "keyMessages", "contentSections", "toneAndStyle", "informationFromSources", "inspiration"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_brief" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Brief generation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No structured response");

    return new Response(toolCall.function.arguments, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
