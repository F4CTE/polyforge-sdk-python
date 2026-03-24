import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";
import * as crypto from "crypto";
import { CredentialsService } from "../credentials/credentials.service";
import { GasSponsorService } from "../gas/gas-sponsor.service";
import { SignOrderDto } from "./dto/sign-order.dto";

export interface SignedOrder {
  /** Signed order payload for Polymarket CLOB API */
  order: Record<string, unknown>;
  /** Builder attribution headers */
  builderHeaders: {
    POLY_BUILDER_API_KEY: string;
    POLY_BUILDER_TIMESTAMP: string;
    POLY_BUILDER_PASSPHRASE: string;
    POLY_BUILDER_SIGNATURE: string;
  };
  /** Whether the platform sponsored gas fees for this transaction */
  gasSponsored: boolean;
}

const NONCE_CACHE_TTL = 30; // 30 seconds
const FEE_RATE_CACHE_TTL = 300; // 5 minutes

/**
 * Signs Polymarket CLOB orders using the user's stored credentials.
 *
 * In dev: uses a stub signer that produces deterministic fake signatures
 *         (mock-polymarket accepts any payload).
 * In prod: uses @polymarket/clob-client for real EIP712 signing.
 *
 * SECURITY: Decrypted credentials are held in memory only for the duration
 * of a single signing call. They are never logged or cached.
 */
@Injectable()
export class SigningService implements OnModuleInit {
  private readonly logger = new Logger(SigningService.name);
  private readonly chainId: number;
  private readonly builderApiKey: string;
  private readonly builderSecret: string;
  private readonly builderPassphrase: string;
  private readonly isDev: boolean;
  private readonly clobApiUrl: string;

  constructor(
    private readonly credentials: CredentialsService,
    private readonly config: ConfigService,
    private readonly gasSponsor: GasSponsorService,
    private readonly redis: RedisService,
  ) {
    this.chainId = parseInt(this.config.get<string>("CHAIN_ID") ?? "137", 10);
    this.builderApiKey = this.config.get<string>("POLY_BUILDER_API_KEY") ?? "";
    this.builderSecret = this.config.get<string>("POLY_BUILDER_SECRET") ?? "";
    this.builderPassphrase =
      this.config.get<string>("POLY_BUILDER_PASSPHRASE") ?? "";
    this.isDev = this.config.get<string>("NODE_ENV") !== "production";
    this.clobApiUrl =
      this.config.get<string>("CLOB_API_URL") ?? "https://clob.polymarket.com";
  }

  onModuleInit() {
    if (this.isDev && this.chainId === 137) {
      this.logger.warn('Running in dev mode with MAINNET chain ID (137) — use 80002 for testnet');
    }

    if (!this.isDev) {
      // Verify CLOB credentials are configured for production
      if (!this.clobApiUrl || this.clobApiUrl.includes("mock")) {
        throw new Error("Production requires real CLOB_API_URL");
      }
      if (!this.builderApiKey || !this.builderSecret || !this.builderPassphrase) {
        throw new Error(
          "Production requires POLY_BUILDER_API_KEY, POLY_BUILDER_SECRET, and POLY_BUILDER_PASSPHRASE",
        );
      }
    }
  }

  async signOrder(dto: SignOrderDto): Promise<SignedOrder> {
    const {
      userId,
      requestId,
      tokenId,
      side,
      size,
      price,
      orderType,
      expiration,
    } = dto;

    // Retrieve decrypted credentials (never logs them)
    const creds = await this.credentials.getDecryptedCredentials(userId);

    let order: Record<string, unknown>;

    if (this.isDev) {
      this.logger.warn(
        "DEV MODE: Using stub signer — orders will NOT be submitted to Polymarket",
      );
      order = this.stubSign({
        tokenId,
        side,
        size,
        price,
        orderType,
        expiration,
        sigType: creds.sigType,
      });
    } else {
      order = await this.eip712Sign(creds, {
        tokenId,
        side,
        size,
        price,
        orderType,
        expiration,
      });
    }

    const builderHeaders = this.buildBuilderHeaders(requestId);

    // Use configurable gas estimate from environment
    const gasEstimate = parseFloat(
      this.config.get<string>("GAS_ESTIMATE_MATIC") ?? "0.002",
    );
    const gasSponsored = await this.gasSponsor.sponsorGas(
      userId,
      gasEstimate,
    );

    this.logger.log(
      `Order signed for user=${userId} requestId=${requestId} tokenId=${tokenId} side=${side}` +
        ` gasSponsored=${gasSponsored}`,
    );

    return { order, builderHeaders, gasSponsored };
  }

  // ─── Dev stub signer ─────────────────────────────────────────────────────

  private stubSign(params: {
    tokenId: string;
    side: string;
    size: number;
    price: number;
    orderType: string;
    expiration?: number;
    sigType: number;
  }): Record<string, unknown> {
    return {
      salt: crypto.randomBytes(16).toString("hex"),
      maker: "0x0000000000000000000000000000000000000001",
      signer: "0x0000000000000000000000000000000000000001",
      taker: "0x0000000000000000000000000000000000000000",
      tokenId: params.tokenId,
      makerAmount: String(Math.round(params.size * 1_000_000)),
      takerAmount: String(Math.round(params.size * params.price * 1_000_000)),
      expiration: String(params.expiration ?? 0),
      nonce: "0",
      feeRateBps: "0",
      side: params.side === "BUY" ? 0 : 1,
      signatureType: params.sigType,
      signature: "0x" + crypto.randomBytes(65).toString("hex"),
      orderType: params.orderType,
    };
  }

  // ─── Production EIP712 signer ─────────────────────────────────────────────

  private async eip712Sign(
    creds: {
      privateKey: string;
      apiKey: string;
      apiSecret: string;
      apiPassphrase: string;
      safeAddress: string | null;
      sigType: number;
    },
    params: {
      tokenId: string;
      side: "BUY" | "SELL";
      size: number;
      price: number;
      orderType: string;
      expiration?: number;
    },
  ): Promise<Record<string, unknown>> {
    // Dynamic import to avoid hard dependency in dev builds
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClobClient } = require("@polymarket/clob-client");

    const client = new ClobClient(
      this.clobApiUrl,
      this.chainId,
      undefined, // ethers provider (not needed for signing)
      {
        key: creds.apiKey,
        secret: creds.apiSecret,
        passphrase: creds.apiPassphrase,
      },
      creds.sigType,
      creds.privateKey,
      creds.safeAddress ?? undefined,
      {
        apiKey: this.builderApiKey,
        secret: this.builderSecret,
        passphrase: this.builderPassphrase,
      },
    );

    // Fetch nonce from Polymarket relayer (cached 30s in Redis)
    const nonce = await this.fetchNonce(creds.safeAddress ?? creds.apiKey);

    // Fetch fee rate from Polymarket (cached 5min in Redis)
    const feeRateBps = await this.fetchFeeRate(params.tokenId);

    const order = await client.createOrder({
      tokenID: params.tokenId,
      price: params.price,
      side: params.side,
      size: params.size,
      feeRateBps,
      nonce: String(nonce),
      expiration: String(params.expiration ?? 0),
    });

    return order as Record<string, unknown>;
  }

  // ─── Nonce and Fee Rate Fetching ────────────────────────────────────────────

  /**
   * Fetches the current nonce for the wallet address from the Polymarket relayer.
   * Cached in Redis with a 30s TTL to reduce API calls.
   * In dev mode, returns 0.
   */
  private async fetchNonce(walletAddress: string): Promise<number> {
    if (this.isDev) return 0;

    const cacheKey = `polymarket:nonce:${walletAddress}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return parseInt(cached, 10);

    try {
      const res = await fetch(
        `${this.clobApiUrl}/nonce?address=${encodeURIComponent(walletAddress)}`,
        { signal: AbortSignal.timeout(5_000) },
      );
      if (res.ok) {
        const data = await res.json();
        const nonce = Number(data.nonce ?? data ?? 0);
        await this.redis.set(cacheKey, String(nonce), NONCE_CACHE_TTL);
        return nonce;
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch nonce for ${walletAddress}: ${(err as Error).message}`);
    }

    return 0; // fallback
  }

  /**
   * Fetches the fee rate for a token from Polymarket.
   * Cached in Redis with a 5-minute TTL.
   * In dev mode, returns "0".
   */
  private async fetchFeeRate(tokenId: string): Promise<string> {
    if (this.isDev) return "0";

    const cacheKey = `polymarket:feeRate:${tokenId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) return cached;

    try {
      const res = await fetch(
        `${this.clobApiUrl}/fee-rate?tokenId=${encodeURIComponent(tokenId)}`,
        { signal: AbortSignal.timeout(5_000) },
      );
      if (res.ok) {
        const data = await res.json();
        const feeRate = String(data.feeRateBps ?? data ?? "0");
        await this.redis.set(cacheKey, feeRate, FEE_RATE_CACHE_TTL);
        return feeRate;
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch fee rate for ${tokenId}: ${(err as Error).message}`);
    }

    return "0"; // fallback
  }

  // ─── Redeem position ─────────────────────────────────────────────────────

  async redeemPosition(
    userId: string,
    tokenId: string,
  ): Promise<{ txHash: string; gasSponsored: boolean }> {
    const creds = await this.credentials.getDecryptedCredentials(userId);

    let txHash: string;

    if (this.isDev) {
      this.logger.warn(
        "DEV MODE: Using stub redemption — positions will NOT be redeemed on Polymarket",
      );
      // Stub: return a fake transaction hash
      txHash = "dev-redemption-" + crypto.randomBytes(16).toString("hex");
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ClobClient } = require("@polymarket/clob-client");

      const client = new ClobClient(
        this.clobApiUrl,
        this.chainId,
        undefined,
        {
          key: creds.apiKey,
          secret: creds.apiSecret,
          passphrase: creds.apiPassphrase,
        },
        creds.sigType,
        creds.privateKey,
        creds.safeAddress ?? undefined,
      );

      const result = await client.redeemPositions([tokenId]);
      txHash = result?.transactionHash ?? "0x0";
    }

    // Use configurable gas estimate for redemptions (slightly higher than orders)
    const gasEstimateRedemption = parseFloat(
      this.config.get<string>("GAS_ESTIMATE_MATIC") ?? "0.002",
    ) * 1.5;
    const gasSponsored = await this.gasSponsor.sponsorGas(
      userId,
      gasEstimateRedemption,
    );

    this.logger.log(
      `Position redeemed for user=${userId} tokenId=${tokenId} gasSponsored=${gasSponsored}`,
    );

    return { txHash, gasSponsored };
  }

  // ─── Builder HMAC headers ─────────────────────────────────────────────────

  private buildBuilderHeaders(
    requestId: string,
  ): SignedOrder["builderHeaders"] {
    const timestamp = String(Math.floor(Date.now() / 1000));

    const message = `${timestamp}${requestId}`;
    const signature = crypto
      .createHmac("sha256", this.builderSecret)
      .update(message)
      .digest("hex");

    return {
      POLY_BUILDER_API_KEY: this.builderApiKey,
      POLY_BUILDER_TIMESTAMP: timestamp,
      POLY_BUILDER_PASSPHRASE: this.builderPassphrase,
      POLY_BUILDER_SIGNATURE: signature,
    };
  }
}
