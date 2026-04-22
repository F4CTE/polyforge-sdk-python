// Lightweight TF-IDF for market title similarity scoring.
// No external dependency — works on short prediction-market question strings.

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "will",
  "be",
  "been",
  "to",
  "of",
  "in",
  "for",
  "on",
  "at",
  "by",
  "with",
  "and",
  "or",
  "not",
  "it",
  "its",
  "this",
  "that",
  "from",
  "as",
  "do",
  "does",
  "did",
  "has",
  "have",
  "had",
  "but",
  "if",
  "so",
  "than",
  "too",
  "very",
  "can",
  "just",
  "should",
  "would",
  "could",
  "may",
  "might",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$%]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export type TfIdfVector = Map<string, number>;

export function buildCorpus(documents: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const doc of documents) {
    const seen = new Set(doc);
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  return df;
}

export function tfidfVector(
  tokens: string[],
  df: Map<string, number>,
  totalDocs: number,
): TfIdfVector {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  const vec: TfIdfVector = new Map();
  for (const [term, count] of tf) {
    const idf = Math.log((totalDocs + 1) / ((df.get(term) ?? 0) + 1)) + 1;
    vec.set(term, count * idf);
  }
  return vec;
}

export function cosineSimilarity(a: TfIdfVector, b: TfIdfVector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, va] of a) {
    normA += va * va;
    const vb = b.get(term);
    if (vb !== undefined) dot += va * vb;
  }
  for (const [, vb] of b) normB += vb * vb;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
