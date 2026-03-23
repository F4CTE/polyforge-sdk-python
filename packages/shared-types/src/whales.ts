// ─────────────────────────────────────────────────────────────────────────────
// Whale tracking types
// ─────────────────────────────────────────────────────────────────────────────

export interface WhaleAlert {
  id: string;
  walletAddress: string;
  marketId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  size: string;
  price: string;
  notional: string;
  txHash: string | null;
  detectedAt: string;
  market?: {
    id: string;
    title: string;
    slug: string;
    image: string | null;
  };
}

export interface WhaleProfile {
  walletAddress: string;
  totalVolume: string;
  totalPnl: string;
  tradeCount: number;
  winRate: string;
  lastTradeAt: string | null;
  updatedAt?: string;
}

export interface WhaleFollow {
  id: string;
  userId: string;
  walletAddress: string;
  createdAt: string;
  profile?: WhaleProfile | null;
}

export interface WhaleTradeEvent {
  type: "WHALE_TRADE";
  walletAddress: string;
  marketId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  notional: string;
  marketTitle: string;
  alertId: string;
  ts: string;
}
