const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "do",
  "does",
  "did",
  "has",
  "have",
  "had",
  "having",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "and",
  "but",
  "or",
  "nor",
  "not",
  "so",
  "yet",
  "both",
  "either",
  "neither",
  "each",
  "every",
  "all",
  "any",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "only",
  "own",
  "same",
  "than",
  "too",
  "very",
  "just",
  "about",
  "up",
  "out",
  "if",
  "then",
  "that",
  "this",
  "these",
  "those",
  "what",
  "which",
  "who",
  "whom",
  "how",
  "when",
  "where",
  "why",
  "it",
  "its",
  "he",
  "she",
  "they",
  "we",
  "you",
  "i",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "our",
  "their",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  const max = Math.max(...tf.values(), 1);
  for (const [k, v] of tf) {
    tf.set(k, v / max);
  }
  return tf;
}

export function buildIdf(documents: string[]): Map<string, number> {
  const df = new Map<string, number>();
  const n = documents.length;

  for (const doc of documents) {
    const seen = new Set(tokenize(doc));
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log(n / (1 + count)) + 1);
  }
  return idf;
}

function tfidfVector(
  text: string,
  idf: Map<string, number>,
): Map<string, number> {
  const tokens = tokenize(text);
  const tf = termFrequency(tokens);
  const vec = new Map<string, number>();
  for (const [term, tfVal] of tf) {
    const idfVal = idf.get(term) ?? 1;
    vec.set(term, tfVal * idfVal);
  }
  return vec;
}

export function cosineSimilarity(
  textA: string,
  textB: string,
  idf: Map<string, number>,
): number {
  const vecA = tfidfVector(textA, idf);
  const vecB = tfidfVector(textB, idf);

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [term, a] of vecA) {
    magA += a * a;
    const b = vecB.get(term);
    if (b !== undefined) dot += a * b;
  }

  for (const [, b] of vecB) {
    magB += b * b;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
