type RagChunk = {
  id: string;
  source: "Pfizer Blue Book 2025" | "Pfizer Principles for Clear Health Communication";
  text: string;
};

const CORPUS: RagChunk[] = [
  {
    id: "bb-values-1",
    source: "Pfizer Blue Book 2025",
    text: "Pfizer decisions and communications should reflect the four core values: Courage, Excellence, Equity, and Joy. Voice should be accountable, respectful, and mission-driven.",
  },
  {
    id: "bb-integrity-1",
    source: "Pfizer Blue Book 2025",
    text: "Communications must be truthful, balanced, and compliant. Avoid exaggeration, absolute claims, and misleading benefit language. Use substantiated statements and approved references.",
  },
  {
    id: "bb-speakup-1",
    source: "Pfizer Blue Book 2025",
    text: "Use clear, respectful language that encourages speaking up and responsible conduct. Do not normalize cutting corners on quality, compliance, or patient safety.",
  },
  {
    id: "bb-patient-first-1",
    source: "Pfizer Blue Book 2025",
    text: "Patient impact should remain central. Content should communicate value to patients and healthcare stakeholders without over-promising outcomes.",
  },
  {
    id: "pp-clarity-1",
    source: "Pfizer Principles for Clear Health Communication",
    text: "Write in plain language. Prefer short sentences, active voice, and familiar words. Define technical terms only when needed and keep explanations concise.",
  },
  {
    id: "pp-structure-1",
    source: "Pfizer Principles for Clear Health Communication",
    text: "Organize content with clear headings, logical sections, and scannable formatting. Front-load critical information and keep calls to action explicit.",
  },
  {
    id: "pp-audience-1",
    source: "Pfizer Principles for Clear Health Communication",
    text: "Tailor reading level and tone to audience type. Patient-facing content should be easy to understand and action-oriented. HCP-facing content can be more technical but still clear.",
  },
  {
    id: "pp-balance-1",
    source: "Pfizer Principles for Clear Health Communication",
    text: "Present benefits and risks responsibly. Avoid promotional superlatives and unsupported certainty. Use balanced framing and avoid ambiguity in safety language.",
  },
  {
    id: "pp-inclusion-1",
    source: "Pfizer Principles for Clear Health Communication",
    text: "Use inclusive, respectful, non-stigmatizing language. Avoid assumptions about identity, condition, literacy, or access.",
  },
  {
    id: "pp-cta-1",
    source: "Pfizer Principles for Clear Health Communication",
    text: "Calls to action should be specific and user-centered. Tell the user exactly what to do next and what outcome to expect.",
  },
];

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccardScore(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function retrievePfizerContext(query: string, topK = 4): RagChunk[] {
  const q = tokenize(query || "");
  const scored = CORPUS.map((chunk) => {
    const score = jaccardScore(q, tokenize(chunk.text));
    return { chunk, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.chunk);

  return scored.length > 0 ? scored : CORPUS.slice(0, topK);
}

export function formatRagContext(chunks: RagChunk[]): string {
  return chunks
    .map((c, idx) => `[${idx + 1}] (${c.source}) ${c.text}`)
    .join("\n");
}
