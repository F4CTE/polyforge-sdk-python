import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { privateKeyHexBytesToEthAddress } from "@polyforge/crypto-native";
import {
  CredentialsService,
  DecryptedCredentials,
  zeroCredentials,
} from "../credentials/credentials.service";
import { NativeEip712Service } from "./native-eip712.service";
import { NativeCtfService } from "./native-ctf.service";
import { SignOrderDto } from "./dto/sign-order.dto";
import {
  RedeemPositionDto,
  SplitPositionDto,
  MergePositionDto,
} from "./dto/ctf-operations.dto";

export interface KalshiJwtResult {
  token: string;
  expiresAt: number;
}

export interface SignedOrder {
  /** Signed order payload for Polymarket CLOB V2 API */
  order: Record<string, unknown>;
  /** Builder attribution headers */
  builderHeaders: {
    POLY_BUILDER_API_KEY: string;
    POLY_BUILDER_TIMESTAMP: string;
    POLY_BUILDER_PASSPHRASE: string;
    POLY_BUILDER_SIGNATURE: string;
  };
}

/**
 * Signs Polymarket CLOB V2 orders using the user's stored credentials.
 *
 * Signing mode is controlled by the SIGNING_MODE env variable:
 *   - "stub":       uses a stub signer that produces fake signatures (dev only)
 *   - "production": uses NativeEip712Service for real EIP-712 V2 signing
 *   - Defaults to "stub" when NODE_ENV=development, "production" otherwise
 *
 * V2 changes: no more nonce or feeRateBps — timestamp (ms) is embedded in the
 * order struct. Fees are set at match time by the exchange.
 *
 * SECURITY: SIGNING_MODE=stub is only allowed when NODE_ENV=development.
 * Decrypted credentials are held in memory only for the duration
 * of a single signing call. They are never logged or cached.
 */
@Injectable()
export class SigningService implements OnModuleInit {
  private readonly logger = new Logger(SigningService.name);
  private readonly chainId: number;
  private readonly isStubMode: boolean;
  private readonly clobApiUrl: string;
  private readonly builderCode: string;
  private rpcUrl: string;

  constructor(
    private readonly credentials: CredentialsService,
    private readonly config: ConfigService,
    private readonly nativeEip712: NativeEip712Service,
    private readonly nativeCtf: NativeCtfService,
  ) {
    this.chainId = parseInt(this.config.get<string>("CHAIN_ID") ?? "137", 10);

    const nodeEnv = this.config.get<string>("NODE_ENV");
    const signingMode =
      this.config.get<string>("SIGNING_MODE") ??
      (nodeEnv === "development" ? "stub" : "production");

    if (signingMode === "stub" && nodeEnv !== "development") {
      throw new Error(
        `FATAL: Stub signing mode is only allowed in development (current NODE_ENV=${nodeEnv}). ` +
          "Remove SIGNING_MODE=stub or set SIGNING_MODE=production.",
      );
    }

    this.isStubMode = signingMode === "stub";
    this.clobApiUrl =
      this.config.get<string>("CLOB_API_URL") ?? "https://clob.polymarket.com";
    this.builderCode =
      this.config.get<string>("POLYMARKET_BUILDER_CODE") ?? "";
    this.rpcUrl = this.config.get<string>("POLYGON_RPC_URL") ?? "";
  }

  /** Read builder credentials on demand — never cached in class instance memory */
  private getBuilderCredentials(): {
    apiKey: string;
    secret: string;
    passphrase: string;
  } {
    return {
      apiKey: this.config.get<string>("POLY_BUILDER_API_KEY") ?? "",
      secret: this.config.get<string>("POLY_BUILDER_SECRET") ?? "",
      passphrase: this.config.get<string>("POLY_BUILDER_PASSPHRASE") ?? "",
    };
  }

  onModuleInit() {
    if (this.isStubMode) {
      this.logger.warn(
        [
          "╔══════════════════════════════════════════════════════════╗",
          "║  STUB SIGNER ACTIVE — orders will NOT reach Polymarket  ║",
          "║  Set SIGNING_MODE=production for real signing              ║",
          "╚══════════════════════════════════════════════════════════╝",
        ].join("\n"),
      );
    }

    if (this.isStubMode && this.chainId === 137) {
      this.logger.warn(
        "Running in stub mode with MAINNET chain ID (137) — use 80002 for testnet",
      );
    }

    if (!this.isStubMode) {
      // Verify CLOB credentials are configured for production
      if (!this.clobApiUrl || this.clobApiUrl.includes("mock")) {
        throw new Error("Production requires real CLOB_API_URL");
      }
      const { apiKey, secret, passphrase } = this.getBuilderCredentials();
      if (!apiKey || !secret || !passphrase) {
        throw new Error(
          "Production requires POLY_BUILDER_API_KEY, POLY_BUILDER_SECRET, and POLY_BUILDER_PASSPHRASE",
        );
      }
      if (!this.builderCode) {
        this.logger.warn(
          "POLYMARKET_BUILDER_CODE is not set — orders will not be attributed to a builder",
        );
      }
      if (
        !this.rpcUrl ||
        this.rpcUrl.includes("localhost") ||
        this.rpcUrl === "https://polygon-rpc.com"
      ) {
        throw new Error(
          "Production requires a private POLYGON_RPC_URL — public RPCs leak server IP and are unreliable",
        );
      }
    } else if (!this.rpcUrl) {
      this.rpcUrl = "https://polygon-rpc.com";
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
      tickSize,
      negRisk,
      postOnly,
    } = dto;

    // Retrieve decrypted credentials (never logs them)
    const creds = await this.credentials.getDecryptedCredentials(userId);

    try {
      let order: Record<string, unknown>;

      if (this.isStubMode) {
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
          builder: this.builderCode || undefined,
        });
      } else {
        order = await this.eip712Sign(creds, {
          tokenId,
          side,
          size,
          price,
          orderType,
          expiration,
          tickSize,
          negRisk,
          postOnly,
          builder: this.builderCode || undefined,
        });
      }

      const builderHeaders = this.buildBuilderHeaders(requestId);

      this.logger.log(
        `Order signed for user=${userId} requestId=${requestId} tokenId=${tokenId} side=${side}`,
      );

      return { order, builderHeaders };
    } finally {
      zeroCredentials(creds);
    }
  }

  // ─── Kalshi JWT signing ───────────────────────────────────────────────────

  async signKalshiJwt(
    _userId: string,
    _requestId: string,
  ): Promise<KalshiJwtResult> {
    const kalshiKeyId = this.config.getOrThrow<string>("KALSHI_KEY_ID");
    const kalshiPrivateKeyPem = this.config.getOrThrow<string>(
      "KALSHI_PRIVATE_KEY_PEM",
    );

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 1800; // 30-minute TTL

    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT", kid: kalshiKeyId }),
    ).toString("base64url");

    const payload = Buffer.from(
      JSON.stringify({ sub: kalshiKeyId, iat: now, exp }),
    ).toString("base64url");

    const signingInput = `${header}.${payload}`;

    const signature = crypto
      .sign("sha256", Buffer.from(signingInput), {
        key: kalshiPrivateKeyPem,
        // Kalshi requires RSA-PSS with SHA-256: https://docs.kalshi.com/#authentication
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      })
      .toString("base64url");

    this.logger.log(
      `Kalshi JWT signed for userId=${_userId} requestId=${_requestId} exp=${exp}`,
    );

    return { token: `${signingInput}.${signature}`, expiresAt: exp };
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
    builder?: string;
  }): Record<string, unknown> {
    return {
      salt: crypto.randomBytes(16).toString("hex"),
      maker: "0x0000000000000000000000000000000000000001",
      signer: "0x0000000000000000000000000000000000000001",
      tokenId: params.tokenId,
      makerAmount: String(Math.round(params.size * 1_000_000)),
      takerAmount: String(Math.round(params.size * params.price * 1_000_000)),
      expiration: String(params.expiration ?? 0),
      timestamp: String(Date.now()),
      metadata: "0x",
      builder: params.builder ?? "0x0000000000000000000000000000000000000000",
      side: params.side === "BUY" ? 0 : 1,
      signatureType: params.sigType,
      signature: "0x" + crypto.randomBytes(65).toString("hex"),
      orderType: params.orderType,
    };
  }

  // ─── Production EIP-712 V2 signer ─────────────────────────────────────────

  private async eip712Sign(
    creds: DecryptedCredentials,
    params: {
      tokenId: string;
      side: "BUY" | "SELL";
      size: number;
      price: number;
      orderType: string;
      expiration?: number;
      tickSize?: string;
      negRisk?: boolean;
      postOnly?: boolean;
      builder?: string;
    },
  ): Promise<Record<string, unknown>> {
    // Derive the EOA wallet address entirely in Rust — private key never becomes a JS string.
    const eoaBytes = privateKeyHexBytesToEthAddress(creds.privateKey);
    const eoaAddress = "0x" + eoaBytes.toString("hex");
    const walletAddress = creds.safeAddress ?? eoaAddress;

    this.logger.debug(`Signing V2 order for wallet=${walletAddress}`);

    // Sign via Rust NAPI secp256k1 — private key stays in Rust Zeroizing memory,
    // is wiped as soon as signOrder() returns, and never materializes as a JS string.
    const signed = await this.nativeEip712.signOrder(creds, this.chainId, {
      tokenId: params.tokenId,
      side: params.side,
      size: params.size,
      price: params.price,
      expiration: params.expiration ?? 0,
      timestamp: Date.now(),
      negRisk: params.negRisk,
      builder: params.builder,
    });
    return signed as unknown as Record<string, unknown>;
  }

  // ─── Redeem position ─────────────────────────────────────────────────────

  async redeemPosition(dto: RedeemPositionDto): Promise<{ txHash: string }> {
    const { userId } = dto;

    if (this.isStubMode) {
      this.logger.warn(
        "DEV MODE: Using stub redemption — positions will NOT be redeemed on Polymarket",
      );
      return {
        txHash: "dev-redemption-" + crypto.randomBytes(16).toString("hex"),
      };
    }

    const creds = await this.credentials.getDecryptedCredentials(userId);
    try {
      return await this.nativeCtf.redeemPosition(
        creds,
        this.chainId,
        this.rpcUrl,
        {
          conditionId: dto.conditionId,
          indexSets: dto.indexSets.map((s) => BigInt(s)),
          collateralToken: dto.collateralToken,
          parentCollectionId: dto.parentCollectionId,
        },
      );
    } finally {
      zeroCredentials(creds);
    }
  }

  // ─── CTF Split / Merge ──────────────────────────────────────────────────

  async splitPosition(dto: SplitPositionDto): Promise<{ txHash: string }> {
    const { userId } = dto;

    if (this.isStubMode) {
      this.logger.warn("DEV MODE: Stub split");
      return { txHash: `dev-split-${Date.now()}` };
    }

    const creds = await this.credentials.getDecryptedCredentials(userId);
    try {
      return await this.nativeCtf.splitPosition(
        creds,
        this.chainId,
        this.rpcUrl,
        {
          conditionId: dto.conditionId,
          partition: dto.partition.map((s) => BigInt(s)),
          amount: BigInt(dto.amount),
          collateralToken: dto.collateralToken,
          parentCollectionId: dto.parentCollectionId,
        },
      );
    } finally {
      zeroCredentials(creds);
    }
  }

  async mergePosition(dto: MergePositionDto): Promise<{ txHash: string }> {
    const { userId } = dto;

    if (this.isStubMode) {
      this.logger.warn("DEV MODE: Stub merge");
      return { txHash: `dev-merge-${Date.now()}` };
    }

    const creds = await this.credentials.getDecryptedCredentials(userId);
    try {
      return await this.nativeCtf.mergePosition(
        creds,
        this.chainId,
        this.rpcUrl,
        {
          conditionId: dto.conditionId,
          partition: dto.partition.map((s) => BigInt(s)),
          amount: BigInt(dto.amount),
          collateralToken: dto.collateralToken,
          parentCollectionId: dto.parentCollectionId,
        },
      );
    } finally {
      zeroCredentials(creds);
    }
  }

  // ─── Builder HMAC headers ─────────────────────────────────────────────────

  private buildBuilderHeaders(
    requestId: string,
  ): SignedOrder["builderHeaders"] {
    const { apiKey, secret, passphrase } = this.getBuilderCredentials();
    const timestamp = String(Math.floor(Date.now() / 1000));

    const message = `${timestamp}${requestId}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(message)
      .digest("hex");

    return {
      POLY_BUILDER_API_KEY: apiKey,
      POLY_BUILDER_TIMESTAMP: timestamp,
      POLY_BUILDER_PASSPHRASE: passphrase,
      POLY_BUILDER_SIGNATURE: signature,
    };
  }
}
