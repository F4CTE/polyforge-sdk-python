import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface DepositRequest {
  address: string;
}

export interface DepositResponse {
  address: {
    evm: string;
    svm: string;
    btc: string;
  };
  note?: string;
}

export interface WithdrawalRequest {
  address: string;
  toChainId: string;
  toTokenAddress: string;
  recipientAddr: string;
}

export interface QuoteRequest {
  fromAmountBaseUnit: string;
  fromChainId: string;
  fromTokenAddress: string;
  recipientAddress: string;
  toChainId: string;
  toTokenAddress: string;
}

export interface QuoteResponse {
  quoteId: string;
  estCheckoutTimeMs: number;
  estInputUsd: number;
  estOutputUsd: number;
  estToTokenBaseUnit: string;
  estFeeBreakdown: {
    appFeeUsd: number;
    fillCostUsd: number;
    gasUsd: number;
    totalImpactUsd: number;
    [key: string]: unknown;
  };
}

export interface SupportedAsset {
  chainId: string;
  chainName: string;
  token: {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
  };
  minCheckoutUsd: number;
}

export interface SupportedAssetsResponse {
  supportedAssets: SupportedAsset[];
}

export type BridgeTransactionStatus =
  | "DEPOSIT_DETECTED"
  | "PROCESSING"
  | "ORIGIN_TX_CONFIRMED"
  | "SUBMITTED"
  | "COMPLETED"
  | "FAILED";

export interface BridgeTransaction {
  fromChainId: string;
  fromTokenAddress: string;
  fromAmountBaseUnit: string;
  toChainId: string;
  toTokenAddress: string;
  status: BridgeTransactionStatus;
  txHash?: string;
  createdTimeMs?: number;
}

export interface TransactionStatusResponse {
  transactions: BridgeTransaction[];
}

const RETRY_DELAYS_MS = [500, 1000, 2000];

@Injectable()
export class PolymarketBridgeService {
  private readonly logger = new Logger(PolymarketBridgeService.name);
  private readonly bridgeUrl: string;

  constructor(config: ConfigService) {
    this.bridgeUrl = config.get<string>(
      "POLYMARKET_BRIDGE_URL",
      "https://bridge.polymarket.com",
    );
  }

  async createDepositAddresses(req: DepositRequest): Promise<DepositResponse> {
    return this.withRetry(() =>
      fetch(`${this.bridgeUrl}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async createWithdrawalAddresses(
    req: WithdrawalRequest,
  ): Promise<DepositResponse> {
    return this.withRetry(() =>
      fetch(`${this.bridgeUrl}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async getQuote(req: QuoteRequest): Promise<QuoteResponse> {
    return this.withRetry(() =>
      fetch(`${this.bridgeUrl}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getSupportedAssets(): Promise<SupportedAssetsResponse> {
    return this.withRetry(() =>
      fetch(`${this.bridgeUrl}/supported-assets`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getTransactionStatus(
    address: string,
  ): Promise<TransactionStatusResponse> {
    return this.withRetry(() =>
      fetch(`${this.bridgeUrl}/status/${encodeURIComponent(address)}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  private async withRetry<T>(call: () => Promise<Response>): Promise<T> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const res = await call();

      if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
        this.logger.warn(
          `Bridge 429 rate-limited, retrying in ${RETRY_DELAYS_MS[attempt]}ms (attempt ${attempt + 1})`,
        );
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Bridge API error ${res.status}: ${body}`);
      }

      return res.json() as Promise<T>;
    }

    throw new Error("Bridge API error 429: rate limit exhausted");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
