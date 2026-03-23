// ─────────────────────────────────────────────────────────────────────────────
// AI News Pipeline types
// ─────────────────────────────────────────────────────────────────────────────

export type NewsSentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export interface NewsArticle {
  id: string;
  source: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  sentiment: NewsSentiment;
  publishedAt: string;
  ingestedAt: string;
  signals?: NewsSignal[];
}

export interface NewsSignal {
  id: string;
  articleId: string;
  marketId: string;
  direction: "BUY" | "SELL";
  outcome: "YES" | "NO";
  confidence: number;
  reasoning: string | null;
  createdAt: string;
  article?: NewsArticle;
  market?: {
    id: string;
    title: string;
    slug: string;
    image: string | null;
  };
}

export interface NewsSignalEvent {
  type: "NEWS_SIGNAL";
  signalId: string;
  articleId: string;
  marketId: string;
  direction: "BUY" | "SELL";
  outcome: "YES" | "NO";
  confidence: number;
  articleTitle: string;
  marketTitle: string;
  ts: string;
}
