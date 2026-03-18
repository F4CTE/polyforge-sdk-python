import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { CredentialsService } from "../credentials/credentials.service";
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
}

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
export class SigningService {
  private readonly logger = new Logger(SigningService.name);
  private readonly chainId: number;
  private readonly builderApiKey: string;
  private readonly builderSecret: string;
  private readonly builderPassphrase: string;
  private readonly isDev: boolean;

  constructor(
    private readonly credentials: CredentialsService,
    private readonly config: ConfigService,
  ) {
    this.chainId = parseInt(this.config.get<string>("CHAIN_ID") ?? "137", 10);
    this.builderApiKey = this.config.get<string>("POLY_BUILDER_API_KEY") ?? "";
    this.builderSecret = this.config.get<string>("POLY_BUILDER_SECRET") ?? "";
    this.builderPassphrase =
      this.config.get<string>("POLY_BUILDER_PASSPHRASE") ?? "";
    this.isDev = this.config.get<string>("NODE_ENV") !== "production";
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

    this.logger.log(
      `Order signed for user=${userId} requestId=${requestId} tokenId=${tokenId} side=${side}`,
    );

    return { order, builderHeaders };
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
      process.env.CLOB_API_URL ?? "https://clob.polymarket.com",
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

    const order = await client.createOrder({
      tokenID: params.tokenId,
      price: params.price,
      side: params.side,
      size: params.size,
      feeRateBps: "0",
      nonce: "0",
      expiration: String(params.expiration ?? 0),
    });

    return order as Record<string, unknown>;
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
