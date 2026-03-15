type RagChunk = {
  id: string;
  source:
    | "Company Name Brand Guide"
    | "UK MHRA Blue Guide"
    | "UK ABPI Code"
    | "UK Human Medicines Regulations 2012"
    | "EU EMA Directive 2001/83/EC"
    | "US FDA Fair Balance"
    | "US FDA DTC Advertising"
    | "AU TGA Advertising Code 2021"
    | "AU TGA Advertising Approval";
  text: string;
};

const CORPUS: RagChunk[] = [
  {
    id: "cn-brand-1",
    source: "Company Name Brand Guide",
    text: "Company Name content should be clear, evidence-based, respectful, and patient-centred. Avoid hype, absolute claims, and unsupported certainty.",
  },
  {
    id: "cn-brand-2",
    source: "Company Name Brand Guide",
    text: "Use plain language, short sentences, and transparent risk-benefit framing. Keep calls to action specific, safe, and appropriate for the audience.",
  },
  {
    id: "uk-mhra-1",
    source: "UK MHRA Blue Guide",
    text: "United Kingdom: MHRA guidance and the Blue Guide (gov.uk/mhra, gov.uk/blue-guide [web:36]) require medicinal promotion to be accurate, balanced, and not misleading.",
  },
  {
    id: "uk-abpi-1",
    source: "UK ABPI Code",
    text: "United Kingdom: ABPI Code of Practice (abpi.org.uk/code-of-practice [web:26]) sets standards for promotional claims, substantiation, and responsible communications.",
  },
  {
    id: "uk-hmr-1",
    source: "UK Human Medicines Regulations 2012",
    text: "United Kingdom: Human Medicines Regulations 2012 (legislation.gov.uk/uksi/2012/1916 [web:24]) apply to medicinal product advertising and related restrictions.",
  },
  {
    id: "eu-ema-1",
    source: "EU EMA Directive 2001/83/EC",
    text: "European Union: EMA framework with Directive 2001/83/EC (ema.europa.eu [web:45]) and national agencies (for example BfArM Germany, AIFA Italy) governs medicinal promotion and information quality.",
  },
  {
    id: "us-fda-1",
    source: "US FDA Fair Balance",
    text: "United States: FDA prescription drug advertising requires fair balance under 21 CFR 202.1 (fda.gov/drugs/drug-advertising [web:46][web:51]). Benefit and risk information must be balanced and understandable.",
  },
  {
    id: "us-dtc-1",
    source: "US FDA DTC Advertising",
    text: "United States: Direct-to-consumer promotion follows FDA prescription drug advertising rules (fda.gov/drugs/prescription-drug-advertising).",
  },
  {
    id: "au-tga-1",
    source: "AU TGA Advertising Code 2021",
    text: "Australia: Therapeutic Goods Advertising Code 2021 applies (tga.gov.au [web:44][web:50]) and requires compliant claim language and audience suitability.",
  },
  {
    id: "au-tga-2",
    source: "AU TGA Advertising Approval",
    text: "Australia: Pre-approval requirements may apply for advertising in specific contexts (tga.gov.au/advertising-approval).",
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
