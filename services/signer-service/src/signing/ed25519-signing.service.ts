import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import * as crypto from "crypto";
import { PrismaService } from "@polyforge/shared-db";
import { EncryptionService } from "../encryption/encryption.service";
import { ImportUsCredentialsDto } from "./dto/import-us-credentials.dto";

const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

export interface PolymarketUsSignedHeaders {
  "X-PM-Key-Id": string;
  "X-PM-Timestamp": string;
  "X-PM-Signature": string;
}

@Injectable()
export class Ed25519SigningService {
  private readonly logger = new Logger(Ed25519SigningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async importUsCredentials(dto: ImportUsCredentialsDto): Promise<void> {
    const encrypted = this.encryption.encryptWithMasterKey(dto.secretKey);

    await this.prisma.polymarketUsCredential.upsert({
      where: { userId: dto.userId },
      create: {
        userId: dto.userId,
        secretKeyCt: encrypted.ciphertext,
        secretKeyIv: encrypted.iv,
        secretKeyTag: encrypted.tag,
        keyId: dto.keyId,
      },
      update: {
        secretKeyCt: encrypted.ciphertext,
        secretKeyIv: encrypted.iv,
        secretKeyTag: encrypted.tag,
        keyId: dto.keyId,
      },
    });

    this.logger.log(
      `US credentials stored for user ${dto.userId} keyId=${dto.keyId}`,
    );
  }

  async getDecryptedUsCredentials(
    userId: string,
  ): Promise<{ keyId: string; secretKey: Buffer }> {
    const row = await this.prisma.polymarketUsCredential.findUnique({
      where: { userId },
    });
    if (!row) {
      throw new NotFoundException("No Polymarket US credentials for user");
    }

    const secretKey = this.encryption.decryptWithMasterKey(
      row.secretKeyCt,
      row.secretKeyIv,
      row.secretKeyTag,
    );

    return { keyId: row.keyId, secretKey };
  }

  async signRequest(
    userId: string,
    method: string,
    path: string,
    body?: string,
  ): Promise<PolymarketUsSignedHeaders> {
    const creds = await this.getDecryptedUsCredentials(userId);

    try {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const message = `${timestamp}${method.toUpperCase()}${path}${body ?? ""}`;

      const seedBytes = Buffer.from(creds.secretKey.toString("utf8"), "hex");
      const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, seedBytes]);

      let privateKey: crypto.KeyObject;
      try {
        privateKey = crypto.createPrivateKey({
          key: pkcs8Der,
          format: "der",
          type: "pkcs8",
        });
      } finally {
        seedBytes.fill(0);
        pkcs8Der.fill(0);
      }

      const signature = crypto.sign(null, Buffer.from(message), privateKey);

      this.logger.log(
        `US request signed for userId=${userId} method=${method} path=${path}`,
      );

      return {
        "X-PM-Key-Id": creds.keyId,
        "X-PM-Timestamp": timestamp,
        "X-PM-Signature": signature.toString("base64"),
      };
    } finally {
      creds.secretKey.fill(0);
    }
  }

  async deleteUsCredentials(userId: string): Promise<void> {
    const existing = await this.prisma.polymarketUsCredential.findUnique({
      where: { userId },
    });
    if (!existing) {
      throw new NotFoundException("No Polymarket US credentials for user");
    }

    await this.prisma.polymarketUsCredential.delete({
      where: { userId },
    });
    this.logger.log(`US credentials deleted for user ${userId}`);
  }
}
