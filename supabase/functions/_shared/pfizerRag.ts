declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

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

type EmbeddingRow = {
  id: string;
  source: RagChunk["source"];
  text: string;
  similarity: number;
};

type EmbeddingRecord = {
  chunk: RagChunk;
  embedding: number[];
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

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function createEmbedding(input: string): Promise<number[] | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || !input?.trim()) return null;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const embedding = data?.data?.[0]?.embedding;
    return Array.isArray(embedding) ? embedding : null;
  } catch (_) {
    return null;
  }
}

let corpusEmbeddingPromise: Promise<EmbeddingRecord[] | null> | null = null;

async function getCorpusEmbeddings(): Promise<EmbeddingRecord[] | null> {
  if (!corpusEmbeddingPromise) {
    corpusEmbeddingPromise = (async () => {
      const records: EmbeddingRecord[] = [];
      for (const chunk of CORPUS) {
        const embedding = await createEmbedding(`${chunk.source}\n${chunk.text}`);
        if (!embedding) return null;
        records.push({ chunk, embedding });
      }
      return records;
    })();
  }
  return corpusEmbeddingPromise;
}

async function retrieveFromVectorStore(query: string, topK: number): Promise<RagChunk[]> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [];

  const embedding = await createEmbedding(query);
  if (!embedding) return [];

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_rag_documents`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_count: topK,
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    return (data as EmbeddingRow[])
      .filter((row) => typeof row?.text === "string" && row.text.length > 0)
      .map((row) => ({
        id: row.id,
        source: row.source,
        text: row.text,
      }));
  } catch (_) {
    return [];
  }
}

async function retrieveSemanticInMemory(query: string, topK: number): Promise<RagChunk[]> {
  const queryEmbedding = await createEmbedding(query);
  if (!queryEmbedding) return [];

  const corpusEmbeddings = await getCorpusEmbeddings();
  if (!corpusEmbeddings || corpusEmbeddings.length === 0) return [];

  const ranked = corpusEmbeddings
    .map((record) => ({
      chunk: record.chunk,
      score: cosineSimilarity(queryEmbedding, record.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => entry.chunk);

  return ranked;
}

function retrieveLexicalFallback(query: string, topK: number): RagChunk[] {
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

export async function retrievePfizerContext(query: string, topK = 4): Promise<RagChunk[]> {
  const vectorStore = await retrieveFromVectorStore(query, topK);
  if (vectorStore.length > 0) return vectorStore;

  const inMemorySemantic = await retrieveSemanticInMemory(query, topK);
  if (inMemorySemantic.length > 0) return inMemorySemantic;

  return retrieveLexicalFallback(query, topK);
}

export function formatRagContext(chunks: RagChunk[]): string {
  return chunks
    .map((c, idx) => `[${idx + 1}] (${c.source}) ${c.text}`)
    .join("\n");
}
