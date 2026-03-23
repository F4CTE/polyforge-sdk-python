// ─────────────────────────────────────────────────────────────────────────────
// Copy trading types
// ─────────────────────────────────────────────────────────────────────────────

export type CopyMode = "PERCENTAGE" | "FIXED" | "MIRROR";
export type CopyStatus = "ACTIVE" | "PAUSED" | "STOPPED" | "ERROR";

export interface CopyConfig {
  id: string;
  userId: string;
  targetWallet: string;
  mode: CopyMode;
  sizeValue: string;
  maxExposure: string;
  maxDailyLoss: string;
  priceOffset: string;
  status: CopyStatus;
  totalPnl: string;
  totalCopied: number;
  createdAt: string;
  updatedAt: string;
  stoppedAt: string | null;
  trades?: CopyTrade[];
}

export interface CopyTrade {
  id: string;
  configId: string;
  sourceWallet: string;
  sourceTxHash: string | null;
  marketId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  sourceSize: string;
  sourcePrice: string;
  copiedSize: string;
  copiedPrice: string | null;
  status: string;
  orderId: string | null;
  pnl: string | null;
  createdAt: string;
}
