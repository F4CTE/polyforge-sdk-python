import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type RelayerTransactionState =
  | "STATE_NEW"
  | "STATE_EXECUTED"
  | "STATE_MINED"
  | "STATE_CONFIRMED"
  | "STATE_INVALID"
  | "STATE_FAILED";

export type RelayerWalletType = "SAFE" | "PROXY";

export interface RelayerTransaction {
  transactionID: string;
  transactionHash: string;
  from: string;
  to: string;
  proxyAddress: string;
  data: string;
  nonce: string;
  value: string;
  signature: string;
  state: RelayerTransactionState;
  type: RelayerWalletType;
  owner: string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitTransactionRequest {
  from: string;
  to: string;
  proxyWallet: string;
  data: string;
  nonce: string;
  signature: string;
  signatureParams: {
    gasPrice: string;
    operation: string;
    safeTxnGas: string;
    baseGas: string;
    gasToken: string;
    refundReceiver: string;
  };
  type: RelayerWalletType;
}

export interface SubmitTransactionResponse {
  transactionID: string;
  state: string;
}

export interface RelayerAuthHeaders {
  RELAYER_API_KEY: string;
  RELAYER_API_KEY_ADDRESS: string;
}

export interface RelayerAddressResponse {
  address: string;
  nonce: string;
}

const RETRY_DELAYS_MS = [500, 1000, 2000];

@Injectable()
export class PolymarketRelayerService {
  private readonly logger = new Logger(PolymarketRelayerService.name);
  private readonly relayerUrl: string;

  constructor(config: ConfigService) {
    this.relayerUrl = config.get<string>(
      "POLYMARKET_RELAYER_URL",
      "https://relayer-v2.polymarket.com",
    );
  }

  async checkSafeDeployed(address: string): Promise<{ deployed: boolean }> {
    return this.withRetry(() =>
      fetch(
        `${this.relayerUrl}/deployed?address=${encodeURIComponent(address)}`,
        { signal: AbortSignal.timeout(10_000) },
      ),
    );
  }

  async getTransaction(id: string): Promise<RelayerTransaction[]> {
    return this.withRetry(() =>
      fetch(`${this.relayerUrl}/transaction?id=${encodeURIComponent(id)}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getNonce(
    address: string,
    type: RelayerWalletType,
  ): Promise<{ nonce: string }> {
    const params = new URLSearchParams({ address, type });
    return this.withRetry(() =>
      fetch(`${this.relayerUrl}/nonce?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getRecentTransactions(
    auth: RelayerAuthHeaders,
  ): Promise<RelayerTransaction[]> {
    return this.withRetry(() =>
      fetch(`${this.relayerUrl}/transactions`, {
        headers: {
          RELAYER_API_KEY: auth.RELAYER_API_KEY,
          RELAYER_API_KEY_ADDRESS: auth.RELAYER_API_KEY_ADDRESS,
        },
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async getRelayerAddress(
    address: string,
    type: RelayerWalletType,
  ): Promise<RelayerAddressResponse> {
    const params = new URLSearchParams({ address, type });
    return this.withRetry(() =>
      fetch(`${this.relayerUrl}/relay-payload?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  async submitTransaction(
    req: SubmitTransactionRequest,
    auth: RelayerAuthHeaders,
  ): Promise<SubmitTransactionResponse> {
    return this.withRetry(() =>
      fetch(`${this.relayerUrl}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          RELAYER_API_KEY: auth.RELAYER_API_KEY,
          RELAYER_API_KEY_ADDRESS: auth.RELAYER_API_KEY_ADDRESS,
        },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(15_000),
      }),
    );
  }

  async getApiKeys(
    auth: RelayerAuthHeaders,
  ): Promise<Array<Record<string, unknown>>> {
    return this.withRetry(() =>
      fetch(`${this.relayerUrl}/api-keys`, {
        headers: {
          RELAYER_API_KEY: auth.RELAYER_API_KEY,
          RELAYER_API_KEY_ADDRESS: auth.RELAYER_API_KEY_ADDRESS,
        },
        signal: AbortSignal.timeout(10_000),
      }),
    );
  }

  private async withRetry<T>(call: () => Promise<Response>): Promise<T> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const res = await call();

      if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
        this.logger.warn(
          `Relayer 429 rate-limited, retrying in ${RETRY_DELAYS_MS[attempt]}ms (attempt ${attempt + 1})`,
        );
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Relayer API error ${res.status}: ${body}`);
      }

      return res.json() as Promise<T>;
    }

    throw new Error("Relayer API error 429: rate limit exhausted");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
