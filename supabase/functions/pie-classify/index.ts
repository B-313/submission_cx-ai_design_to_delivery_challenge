import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatRagContext, retrievePfizerContext } from "../_shared/pfizerRag.ts";
import { requireApiKey } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Jurisdiction lookup (from pie_engine.py) ───
const JURISDICTION_MAP: Record<string, { body: string; framework: string; notes: string; gdpr: boolean }> = {
  "united kingdom": { body: "MHRA", framework: "Human Medicines Regulations 2012 + ABPI Code", notes: "Post-Brexit UK rules. ABPI code governs pharma promotion.", gdpr: true },
  "uk": { body: "MHRA", framework: "Human Medicines Regulations 2012 + ABPI Code", notes: "Post-Brexit UK rules.", gdpr: true },
  "eu": { body: "EMA", framework: "Directive 2001/83/EC", notes: "EU-wide medicinal promotion requirements with national regulator enforcement.", gdpr: true },
  "germany": { body: "EMA + BfArM", framework: "Directive 2001/83/EC + AMG", notes: "HWG for pharma advertising.", gdpr: true },
  "france": { body: "EMA + ANSM", framework: "Directive 2001/83/EC + CSP", notes: "ANSM oversees French pharma.", gdpr: true },
  "spain": { body: "EMA + AEMPS", framework: "Directive 2001/83/EC + RD 1345/2007", notes: "AEMPS is Spanish regulator.", gdpr: true },
  "italy": { body: "EMA + AIFA", framework: "Directive 2001/83/EC + Decree 219/2006", notes: "AIFA governs Italian pharma.", gdpr: true },
  "united states": { body: "FDA", framework: "21 CFR Parts 201, 202", notes: "FDA requires fair balance.", gdpr: false },
  "usa": { body: "FDA", framework: "21 CFR Parts 201, 202", notes: "FDA oversight.", gdpr: false },
  "australia": { body: "TGA", framework: "Therapeutic Goods Advertising Code 2021", notes: "Strict health claims.", gdpr: false },
  "japan": { body: "PMDA", framework: "PMD Act 2014", notes: "PMDA + JPMA code.", gdpr: false },
  "china": { body: "NMPA", framework: "Drug Administration Law 2019", notes: "Strict on foreign claims.", gdpr: false },
  "india": { body: "CDSCO", framework: "Drugs and Cosmetics Act 1940", notes: "CDSCO + MCI guidelines.", gdpr: false },
  "brazil": { body: "ANVISA", framework: "RDC 96/2008 + LGPD", notes: "LGPD is Brazil's GDPR equivalent.", gdpr: false },
  "uae": { body: "MOH UAE", framework: "Federal Law No. 4 of 1983", notes: "MOH must approve pharma ads.", gdpr: false },
  "south africa": { body: "SAHPRA", framework: "Medicines Act 101 of 1965", notes: "SAHPRA replaced MCC.", gdpr: false },
  "singapore": { body: "HSA", framework: "Health Products Act", notes: "HSA is Singapore regulator.", gdpr: false },
  "global": { body: "WCAG 2.1 AA + GDPR", framework: "Safe global defaults", notes: "No specific country.", gdpr: true },
};

// ─── Risk keywords (from pie_engine.py) ───
const HIGH_RISK = [
  "drug", "medicine", "medication", "pharmaceutical", "prescription", "clinical trial", "efficacy",
  "oncology", "cancer", "tumour", "tumor", "chemotherapy", "immunotherapy", "vaccine",
  "adverse event", "side effect", "contraindication", "dosage", "dose",
  "cure", "success", "guaranteed",
];
const MEDIUM_RISK = [
  "patient", "disease", "condition", "symptom", "treatment", "therapy", "healthcare",
  "medical", "clinical", "doctor", "physician", "hospital", "prevention",
];
const LOW_RISK = ["health", "wellness", "information", "resource", "support", "awareness", "education"];

const AUDIENCE_TARGETS: Record<string, { target: number; max: number; label: string }> = {
  patients: { target: 7, max: 8, label: "Plain language (Grade 7-8)" },
  "healthcare providers": { target: 11, max: 13, label: "Professional clinical (Grade 11-13)" },
  "channel partners": { target: 10, max: 11, label: "Business professional (Grade 10-11)" },
  "internal teams": { target: 10, max: 12, label: "Corporate professional (Grade 10-12)" },
};

const BRAND_VOICE_POSITIVE = ["patient", "evidence", "clinical", "science", "safe", "clear", "accessible", "compliant", "approved", "trust"];
const BRAND_VOICE_NEGATIVE = ["cheap", "affordable", "best", "only", "guaranteed", "cure", "miracle", "revolutionary"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGroqWithRetry(payload: Record<string, unknown>, apiKey: string, attempts = 3) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) return response;
      if (response.status === 402) return response;

      if (response.status === 429 || response.status >= 500) {
        if (attempt < attempts) {
          await sleep(attempt * 700);
          continue;
        }
      }

      const text = await response.text();
      throw new Error(`Groq request failed (${response.status}): ${text.slice(0, 300)}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown Groq error");
      if (attempt < attempts) {
        await sleep(attempt * 700);
      }
    }
  }

  throw lastError ?? new Error("Groq request failed after retries");
}

function detectJurisdiction(brief: string, country: string) {
  const search = (brief + " " + country).toLowerCase().replace(/[^\w\s]/g, " ");
  let matched = null;
  let maxLen = 0;
  for (const key of Object.keys(JURISDICTION_MAP)) {
    if (search.includes(key) && key.length > maxLen) {
      matched = key;
      maxLen = key.length;
    }
  }
  if (matched) return { ...JURISDICTION_MAP[matched], country_detected: matched };
  return { body: "WCAG 2.1 AA + GDPR", framework: "Safe global defaults", notes: "No country detected.", gdpr: true, country_detected: null };
}

function scoreRisk(brief: string, jurisdiction: any) {
  const text = brief.toLowerCase().replace(/[^\w\s]/g, " ");
  const highHits = HIGH_RISK.filter(t => text.includes(t));
  const medHits = MEDIUM_RISK.filter(t => text.includes(t));
  const lowHits = LOW_RISK.filter(t => text.includes(t));
  let score = Math.min(1, highHits.length * 0.20 + medHits.length * 0.08 + lowHits.length * 0.03);
  if (jurisdiction?.body?.includes("FDA")) score = Math.min(1, score * 1.15);
  else if (jurisdiction?.body?.includes("EMA") || jurisdiction?.body?.includes("MHRA")) score = Math.min(1, score * 1.10);
  score = Math.round(score * 1000) / 1000;
  const level = score >= 0.75 ? "HIGH" : score >= 0.4 ? "MEDIUM" : "LOW";
  const recs: string[] = [];
  if (level === "HIGH") {
    recs.push("Do NOT make unsubstantiated efficacy or safety claims");
    recs.push("Do NOT use efficacy percentages unless explicitly approved and source-supported");
    recs.push("Include a regulatory disclaimer");
    recs.push("Flag for Medical Affairs review before generation");
  } else if (level === "MEDIUM") {
    recs.push("Add a general medical disclaimer");
    recs.push("Ensure health claims are supported by references");
  } else {
    recs.push("Standard brand compliance check applies");
  }
  if (jurisdiction?.gdpr) recs.push("GDPR: Cookie consent banner required");
  if (jurisdiction?.body?.includes("FDA")) {
    recs.push("FDA fair balance: present side effects and risks with equal prominence to benefits");
  }
  recs.push("Include patient safety language such as 'Talk to your doctor'");
  return { risk_score: score, level, triggers: highHits, medium_triggers: medHits, recommendations: recs };
}

function analyseTone(brief: string) {
  const t = brief.toLowerCase();
  const neg = BRAND_VOICE_NEGATIVE.filter(w => t.includes(w)).length;
  const pos = BRAND_VOICE_POSITIVE.filter(w => t.includes(w)).length;
  const score = Math.max(0.3, Math.min(0.9, 0.6 + pos * 0.05 - neg * 0.1));
  const rounded = Math.round(score * 1000) / 1000;
  return {
    tone_score: rounded,
    inject_guidance: rounded < 0.65,
    label: rounded >= 0.70 ? "on-brand" : rounded >= 0.50 ? "borderline" : "off-brand",
  };
}

function predictReadability(brief: string, audience: string) {
  const sentences = brief.split(/[.!?]+/).filter(s => s.trim());
  const words = brief.split(/\s+/).filter(Boolean);
  const avgSentLen = words.length / Math.max(sentences.length, 1);
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / Math.max(words.length, 1);
  let predicted = Math.round((0.39 * avgSentLen + 11.8 * (avgWordLen / 5) - 15.59) * 10) / 10;
  predicted = Math.max(1, Math.min(20, predicted));
  const targets = AUDIENCE_TARGETS[audience.toLowerCase()] || AUDIENCE_TARGETS.patients;
  const inject = predicted > targets.max;
  const gap = predicted - targets.target;
  return {
    predicted_grade: predicted,
    target_grade: targets.target,
    target_label: targets.label,
    inject_simplify: inject,
    guidance: inject
      ? `Simplify to Grade ${targets.target}: shorter sentences, replace polysyllabic words. Current is ${gap.toFixed(1)} grades above target.`
      : `Readability appropriate for ${audience} (Grade ${predicted} vs target ${targets.target})`,
  };
}

function buildEnrichedPrompt(brief: string, audience: any, jurisdiction: any, risk: any, tone: any, readability: any, context: any, ragContext: string) {
  return JSON.stringify({
    role: "Senior Pfizer digital strategist",
    project_context: {
      buildType: context.buildType || null,
      country: context.country || null,
    },
    pie_output: {
      audience: {
        audience: audience.audience,
        confidence: audience.confidence,
        flag_for_review: audience.flag_for_review,
        flag_reason: audience.flag_reason || null,
      },
      jurisdiction: {
        body: jurisdiction.body,
        framework: jurisdiction.framework,
        gdpr: jurisdiction.gdpr,
      },
      risk: {
        level: risk.level,
        risk_score: risk.risk_score,
        triggers: risk.triggers,
        recommendations: risk.recommendations,
      },
      tone: {
        label: tone.label,
        tone_score: tone.tone_score,
        inject_guidance: tone.inject_guidance,
      },
      readability: {
        predicted_grade: readability.predicted_grade,
        target_grade: readability.target_grade,
        guidance: readability.guidance,
        inject_simplify: readability.inject_simplify,
      },
    },
    generation_rules: [
      "Generate specific Pfizer-ready JSON grounded in the supplied user inputs.",
      "Use Pfizer RAG context to sharpen terminology and compliance posture, not as a substitute for user evidence.",
      "Tone, style, and colours are applied automatically from branding downstream.",
      "Do not invent unsupported claims, metrics, or sections.",
      "Return valid JSON only.",
    ],
    brand_rag_context: ragContext,
    user_request: brief,
  }, null, 2);
}

function calculateScore(audience: any, risk: any, tone: any, readability: any) {
  const compliance = Math.round((1 - risk.risk_score) * 100);
  const toneScore = Math.round(tone.tone_score * 100);
  const audienceScore = Math.round(audience.confidence * 100);
  const gap = Math.max(0, readability.predicted_grade - readability.target_grade);
  const readScore = Math.max(0, Math.round(100 - gap * 10));
  const pie = Math.round(compliance * 0.40 + toneScore * 0.30 + audienceScore * 0.20 + readScore * 0.10);
  const grade = pie >= 90 ? "A" : pie >= 75 ? "B" : pie >= 60 ? "C" : "D";
  const interp = pie >= 90 ? "Ready — strong signal quality" : pie >= 75 ? "Proceed — minor enrichments applied" : pie >= 60 ? "Caution — review recommendations" : "High risk — human review needed";
  return { pie_score: pie, pie_grade: grade, pie_interpretation: interp, breakdown: { compliance, tone: toneScore, audience: audienceScore, readability: readScore } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = requireApiKey(req, corsHeaders);
  if (authError) return authError;

  try {
    const { brief, country, audience: audHint, buildType } = await req.json();
    if (!brief) return new Response(JSON.stringify({ error: "Brief required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    // C1: Audience — use AI for zero-shot classification
    const audResponse = await callGroqWithRetry({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Classify the audience. Return JSON only." },
          { role: "user", content: `Classify this brief's target audience as one of: patients, healthcare providers, channel partners, internal teams.\n\nBrief: "${brief}"\n\nHint from user selection: "${audHint || "none"}"` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_audience",
            description: "Classify the target audience",
            parameters: {
              type: "object",
              properties: {
                audience: { type: "string", enum: ["patients", "healthcare providers", "channel partners", "internal teams"] },
                confidence: { type: "number", description: "0 to 1" },
                flag_for_review: { type: "boolean" },
                flag_reason: { type: "string" },
              },
              required: ["audience", "confidence", "flag_for_review"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify_audience" } },
      }, GROQ_API_KEY);

    if (!audResponse.ok) {
      const status = audResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Audience classification failed");
    }

    const audData = await audResponse.json();
    const audTool = audData.choices?.[0]?.message?.tool_calls?.[0];
    if (!audTool?.function?.arguments) {
      throw new Error("Audience classification did not return a structured response");
    }
    const audienceResult = JSON.parse(audTool.function.arguments);

    // C2-C5: Rule-based classifiers
    const jurisdiction = detectJurisdiction(brief, country || "");
    const risk = scoreRisk(brief, jurisdiction);
    const tone = analyseTone(brief);
    const readability = predictReadability(brief, audienceResult.audience);
    const scoring = calculateScore(audienceResult, risk, tone, readability);

    const ragChunks = await retrievePfizerContext(`${brief}\n${buildType || ""}\n${country || ""}\n${audHint || ""}`);
    if (!ragChunks || ragChunks.length === 0) {
      throw new Error("Pfizer RAG retrieval failed during PIE classification");
    }
    const ragContext = formatRagContext(ragChunks);

    const enriched_prompt = buildEnrichedPrompt(brief, audienceResult, jurisdiction, risk, tone, readability, { buildType, country }, ragContext);

    return new Response(JSON.stringify({
      ...scoring,
      audience: audienceResult,
      jurisdiction,
      risk,
      tone,
      readability,
      rag_context: ragContext,
      enriched_prompt,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("pie-classify error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
