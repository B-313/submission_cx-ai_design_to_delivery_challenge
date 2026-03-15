import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { brief, mode } = await req.json();

    if (!brief || typeof brief !== "string" || brief.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Brief text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a Prompt Intelligence Engine for web design compliance. You analyze website briefs and content prompts.

When given a brief, you MUST call the "analyze_brief" tool with your analysis. Analyze for:

1. **Compliance Score** (0-100): Rate overall compliance readiness considering brand consistency, accessibility (WCAG 2.1 AA), regulatory requirements, and content quality.

2. **Issues Found**: Identify specific problems in these categories:
   - "brand": Brand inconsistency issues (tone, voice, visual direction)
   - "accessibility": Accessibility gaps (alt text, contrast, semantic structure)  
   - "regulatory": Regulatory/legal risks (disclaimers, data collection, claims)
   - "content": Content quality issues (clarity, structure, completeness)
   - "technical": Technical concerns (performance, SEO, responsive design)

3. **Recommendations**: Actionable fixes for each issue, with priority (high/medium/low).

4. **Suggested Components**: Recommend design system components that would best serve this brief (e.g., Hero, CTA, Card Grid, Testimonials, FAQ, Form, Navigation, Footer).

5. **Compliant Rewrite**: Provide an improved version of the brief that addresses all issues found.

Be specific, actionable, and explain WHY each issue matters.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this website brief:\n\n${brief}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_brief",
              description: "Return structured analysis of the website brief",
              parameters: {
                type: "object",
                properties: {
                  compliance_score: {
                    type: "number",
                    description: "Overall compliance score from 0-100",
                  },
                  summary: {
                    type: "string",
                    description: "Brief 1-2 sentence summary of the analysis",
                  },
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: {
                          type: "string",
                          enum: ["brand", "accessibility", "regulatory", "content", "technical"],
                        },
                        severity: {
                          type: "string",
                          enum: ["high", "medium", "low"],
                        },
                        title: { type: "string" },
                        description: { type: "string" },
                        fix: { type: "string" },
                      },
                      required: ["category", "severity", "title", "description", "fix"],
                      additionalProperties: false,
                    },
                  },
                  suggested_components: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["name", "reason"],
                      additionalProperties: false,
                    },
                  },
                  compliant_rewrite: {
                    type: "string",
                    description: "Improved version of the brief addressing all compliance issues",
                  },
                },
                required: ["compliance_score", "summary", "issues", "suggested_components", "compliant_rewrite"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_brief" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI did not return structured analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
