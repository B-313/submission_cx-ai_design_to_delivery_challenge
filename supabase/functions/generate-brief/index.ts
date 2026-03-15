import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatRagContext, retrievePfizerContext } from "../_shared/pfizerRag.ts";
import { requireJudgeAccess } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-judge-access-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type GenerationInput = {
  userRawPrompt: string;
  questionnaireAnswers: Record<string, unknown>;
  documents: { name: string; source: string; excerpt: string }[];
  links: { name: string; url: string; excerpt: string }[];
};

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

      if (response.status === 402) {
        return response;
      }

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeGenerationInput(rawGenerationInput: unknown, rawPrompt: unknown, ideationAnswers: unknown, sourceContext: unknown): GenerationInput {
  const provided = asRecord(rawGenerationInput);
  const questionnaireAnswers = asRecord(provided.questionnaireAnswers || ideationAnswers);
  const sources = Array.isArray(sourceContext) ? sourceContext : [];

  const documents = Array.isArray(provided.documents)
    ? provided.documents
    : sources
        .filter((source: any) => source?.sourceType === "document")
        .map((source: any) => ({
          name: asString(source?.name) || "Unnamed document",
          source: asString(source?.source),
          excerpt: asString(source?.excerpt).slice(0, 3000),
        }));

  const links = Array.isArray(provided.links)
    ? provided.links
    : sources
        .filter((source: any) => source?.sourceType === "link")
        .map((source: any) => ({
          name: asString(source?.name) || "Unnamed link",
          url: asString(source?.source),
          excerpt: asString(source?.excerpt).slice(0, 3000),
        }));

  return {
    userRawPrompt: asString(provided.userRawPrompt) || asString(rawPrompt),
    questionnaireAnswers,
    documents: documents.map((item: any) => ({
      name: asString(item?.name) || "Unnamed document",
      source: asString(item?.source),
      excerpt: asString(item?.excerpt).slice(0, 3000),
    })),
    links: links.map((item: any) => ({
      name: asString(item?.name) || "Unnamed link",
      url: asString(item?.url),
      excerpt: asString(item?.excerpt).slice(0, 3000),
    })),
  };
}

function formatQuestionnaireAnswers(answers: Record<string, unknown>) {
  const entries = Object.entries(answers).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
  });

  if (entries.length === 0) return "No questionnaire answers supplied";

  return entries
    .map(([label, value]) => `${label}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join("\n");
}

function formatSourceSummary(input: GenerationInput) {
  const docSummary = input.documents
    .slice(0, 6)
    .map((doc, index) => `Document ${index + 1}: ${doc.name}\nSource: ${doc.source || "Not provided"}\nExcerpt: ${doc.excerpt || "No excerpt provided"}`);
  const linkSummary = input.links
    .slice(0, 6)
    .map((link, index) => `Link ${index + 1}: ${link.name}\nURL: ${link.url || "Not provided"}\nExcerpt: ${link.excerpt || "No excerpt provided"}`);
  const merged = [...docSummary, ...linkSummary];
  return merged.length > 0 ? merged.join("\n\n") : "No user-provided documents or links supplied";
}

const GENERIC_PHRASES = [
  "cutting-edge",
  "transformative",
  "world-class",
  "leading solution",
  "innovative platform",
  "seamless experience",
  "empower users",
  "best-in-class",
  "revolutionary",
  "optimize outcomes",
];

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function uniqueTokens(value: string): string[] {
  return [...new Set(tokenize(value))];
}

function validateBriefOutput(parsed: any, structuredInput: GenerationInput): string[] {
  const issues: string[] = [];
  const sections = Array.isArray(parsed?.contentSections) ? parsed.contentSections.filter((item: unknown) => typeof item === "string" && item.trim().length > 0) : [];

  if (!parsed?.projectTitle || String(parsed.projectTitle).trim().length < 6) issues.push("projectTitle is too short or missing");
  if (!parsed?.goal || String(parsed.goal).trim().length < 24) issues.push("goal is too short or missing");
  if (!parsed?.audience || String(parsed.audience).trim().length < 6) issues.push("audience is too short or missing");
  if (sections.length < 4 || sections.length > 6) issues.push("contentSections must include 4 to 6 items");
  if (sections.some((section: string) => !section.includes(" - "))) issues.push("every content section must use 'Section title - short purpose' format");

  const combinedOutput = [
    String(parsed?.projectTitle || ""),
    String(parsed?.goal || ""),
    String(parsed?.audience || ""),
    ...sections,
    String(parsed?.toneAndStyle || ""),
    String(parsed?.informationFromSources || ""),
    String(parsed?.inspiration || ""),
  ].join("\n").toLowerCase();

  const genericHits = GENERIC_PHRASES.filter((phrase) => combinedOutput.includes(phrase));
  if (genericHits.length >= 2) {
    issues.push(`output contains generic language (${genericHits.slice(0, 3).join(", ")})`);
  }

  const groundingSourceText = [
    structuredInput.userRawPrompt,
    ...Object.entries(structuredInput.questionnaireAnswers).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(" ") : String(v ?? "")}`),
    ...structuredInput.documents.map((doc) => `${doc.name} ${doc.excerpt}`),
    ...structuredInput.links.map((link) => `${link.name} ${link.excerpt}`),
  ].join("\n");

  const groundingTerms = uniqueTokens(groundingSourceText)
    .filter((term) => !["about", "with", "from", "that", "this", "your", "their", "have", "will", "which", "where", "patient", "patients"].includes(term))
    .slice(0, 80);
  if (groundingTerms.length > 0) {
    const outputTokens = new Set(uniqueTokens(combinedOutput));
    const overlapCount = groundingTerms.filter((term) => outputTokens.has(term)).length;
    if (overlapCount < Math.min(3, groundingTerms.length)) {
      issues.push("output is insufficiently grounded in prompt/questionnaire/source language");
    }
  }

  if (/rag|corpus|knowledge base/i.test(String(parsed?.informationFromSources || ""))) {
    issues.push("informationFromSources must not reference RAG corpus");
  }

  if (!/pie/i.test(String(parsed?.inspiration || "")) || !/rag/i.test(String(parsed?.inspiration || ""))) {
    issues.push("inspiration must explicitly describe both PIE and RAG influence");
  }

  return issues;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = requireJudgeAccess(req, corsHeaders);
  if (authError) return authError;

  try {
    const {
      enrichedPrompt,
      pieContext,
      generationInput: rawGenerationInput,
      buildType,
      audience,
      country,
      rawPrompt,
      fullPrompt,
      ideationAnswers,
      sourceContext,
    } = await req.json();
    if (!enrichedPrompt) return new Response(JSON.stringify({ error: "Enriched prompt required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!pieContext || typeof pieContext !== "object") {
      return new Response(JSON.stringify({ error: "PIE context required for generation" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const structuredInput = normalizeGenerationInput(rawGenerationInput, rawPrompt, ideationAnswers, sourceContext);
    const ragChunks = await retrievePfizerContext(`${enrichedPrompt}\n${JSON.stringify(structuredInput.questionnaireAnswers)}\n${buildType || ""}\n${audience || ""}\n${country || ""}`);
    if (!ragChunks || ragChunks.length === 0) {
      throw new Error("Pfizer RAG retrieval failed");
    }
    const ragContext = formatRagContext(ragChunks);
    const ideationSummary = formatQuestionnaireAnswers(structuredInput.questionnaireAnswers);
    const sourceSummary = formatSourceSummary(structuredInput);
    const pieSummary = JSON.stringify(pieContext || {}, null, 2);
    const groundingPacket = JSON.stringify(structuredInput, null, 2);

    const baseMessages: { role: "system" | "user"; content: string }[] = [
      {
        role: "system",
        content: `You are Pfizer's web briefing engine. Produce a specific Pfizer-ready content brief JSON, not generic pharma boilerplate.\n\nUse all four grounding sources together:\n1. Structured user generation input\n2. PIE output\n3. Enriched prompt\n4. Pfizer RAG context\n\nNon-negotiable rules:\n- Every field must trace back to the structured input, PIE output, or the Pfizer RAG context.\n- If the user did not provide enough detail, say so plainly instead of inventing specifics.\n- Tone, style, and colours are applied automatically from branding downstream. Do not invent colour palettes, typography directions, or visual styling systems.\n- toneAndStyle must describe only voice, clarity, readability, and compliance posture.\n- informationFromSources must summarize only user-provided documents and links, never the Pfizer RAG corpus.\n- inspiration must explain what PIE and RAG sharpened or constrained in the brief.\n- contentSections must be website-ready and specific, with each item using the pattern \"Section title - short purpose\".\n- Return only the function call payload.`,
      },
      {
        role: "user",
        content: `Generate a comprehensive ideation brief for a ${buildType || "webpage"} targeting ${audience || "patients"} in ${country || "Global"}. Return ONLY the JSON structure specified.\n\n=== STRUCTURED GENERATION INPUT ===\n${groundingPacket}\n\n=== QUESTIONNAIRE SUMMARY ===\n${ideationSummary}\n\n=== PIE OUTPUT ===\n${pieSummary}\n\n=== ENRICHED PIE PROMPT ===\n${enrichedPrompt}\n\n=== PFIZER RAG CONTEXT ===\n${ragContext}\n\n=== FULL IDEATION CONTEXT ===\n${fullPrompt || ""}\n\n=== USER SOURCE EVIDENCE ===\n${sourceSummary}\n\nStrict grounding rules:\n1) Goal and content sections must be directly relevant to the raw prompt, questionnaire answers, or user-provided evidence.\n2) Keep the brief specific to the supplied context; do not fall back to generic pharma claims or stock sections.\n3) If documents or links are missing detail, acknowledge that gap instead of inventing proof points.\n4) Keep contentSections limited to 4-6 items, each in the form \"Section title - short purpose\".\n5) informationFromSources must mention only user-provided documents/links or explicitly say none were provided.\n6) inspiration must summarize how PIE and Pfizer RAG refined the brief, such as audience shaping, compliance framing, readability, and terminology discipline.\n7) keyMessages must match contentSections exactly.\n8) Do not restate that brand styling will be applied later, except implicitly through toneAndStyle.`,
      },
    ];

    const tools = [{
          type: "function",
          function: {
            name: "generate_brief",
            description: "Generate a structured website brief",
            parameters: {
              type: "object",
              properties: {
                projectTitle: { type: "string", description: "Specific project title grounded in the user prompt and questionnaire answers." },
                goal: { type: "string", description: "One clear sentence describing the page goal for the exact audience and use case." },
                audience: { type: "string", description: "Specific audience description taken from the questionnaire answers or prompt context." },
                contentSections: { type: "array", items: { type: "string" }, description: "Four to six section entries formatted as 'Section title - short purpose'." },
                toneAndStyle: { type: "string", description: "Voice and readability guidance only. Do not mention colour palettes or visual design systems." },
                informationFromSources: { type: "string", description: "Summarize only user-provided documents, links, or prompt evidence. If no user sources were supplied, say that clearly and do not invent external sources." },
                inspiration: { type: "string", description: "Describe how PIE output and Pfizer RAG context refined the brief, including audience shaping, compliance framing, terminology, and readability." },
              },
              required: ["projectTitle", "goal", "audience", "contentSections", "toneAndStyle", "informationFromSources", "inspiration"],
              additionalProperties: false,
            },
          },
        }];

    let parsed: any = null;
    let lastIssues: string[] = [];

    for (let contentAttempt = 1; contentAttempt <= 2; contentAttempt += 1) {
      const correctiveNote = contentAttempt === 1
        ? null
        : `Regenerate and fix these QA issues exactly:\n- ${lastIssues.join("\n- ")}\nReturn only corrected function payload JSON.`;

      const response = await callGroqWithRetry({
        model: "llama-3.3-70b-versatile",
        temperature: contentAttempt === 1 ? 0.2 : 0.1,
        messages: correctiveNote ? [...baseMessages, { role: "user", content: correctiveNote }] : baseMessages,
        tools,
        tool_choice: { type: "function", function: { name: "generate_brief" } },
      }, GROQ_API_KEY);

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Brief generation failed");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("No structured response");

      const candidate = JSON.parse(toolCall.function.arguments);
      const issues = validateBriefOutput(candidate, structuredInput);

      if (issues.length === 0) {
        parsed = candidate;
        break;
      }

      lastIssues = issues;
    }

    if (!parsed) {
      throw new Error(`Generated brief failed grounding QA: ${lastIssues.slice(0, 3).join("; ")}`);
    }

    if (Array.isArray(parsed?.contentSections)) {
      parsed.keyMessages = parsed.contentSections;
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
