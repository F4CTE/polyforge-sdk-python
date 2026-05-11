import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import * as crypto from "crypto";
import { PrismaService } from "@polyforge/shared-db";
import { EncryptionService } from "../encryption/encryption.service";
import { ImportUsCredentialsDto } from "./dto/import-us-credentials.dto";
import {
  polymarketUsCredentialDekAad,
  polymarketUsCredentialFieldAad,
} from "../credentials/credential-aad";

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
    const { dek, encryptedDek, dekIv, kekVersion } =
      this.encryption.generateDek({
        aad: polymarketUsCredentialDekAad(dto.userId),
      });

    let secretKeyEnc: ReturnType<typeof this.encryption.encryptFieldBytes>;
    try {
      const rawSeed = Buffer.from(dto.secretKey, "hex");
      try {
        secretKeyEnc = this.encryption.encryptFieldBytes(rawSeed, dek, {
          aad: polymarketUsCredentialFieldAad(dto.userId, "secretKey"),
        });
      } finally {
        rawSeed.fill(0);
      }
    } finally {
      dek.fill(0);
    }

    await this.prisma.polymarketUsCredential.upsert({
      where: { userId: dto.userId },
      create: {
        userId: dto.userId,
        encryptedDek,
        dekIv,
        kekVersion,
        secretKeyCt: secretKeyEnc.ciphertext,
        secretKeyIv: secretKeyEnc.iv,
        secretKeyTag: secretKeyEnc.tag,
        keyId: dto.keyId,
      },
      update: {
        encryptedDek,
        dekIv,
        kekVersion,
        secretKeyCt: secretKeyEnc.ciphertext,
        secretKeyIv: secretKeyEnc.iv,
        secretKeyTag: secretKeyEnc.tag,
        keyId: dto.keyId,
      },
    });

    this.logger.log(
      `US credentials stored for user ${dto.userId} keyId=${dto.keyId}`,
    );
  }

  private async getDecryptedSecretKey(
    userId: string,
  ): Promise<{ keyId: string; secretKey: Buffer }> {
    const row = await this.prisma.polymarketUsCredential.findUnique({
      where: { userId },
    });
    if (!row) {
      throw new NotFoundException("No Polymarket US credentials for user");
    }

    const dek = this.encryption.decryptDek(
      row.encryptedDek,
      row.dekIv,
      row.kekVersion,
      {
        aad: polymarketUsCredentialDekAad(userId),
        allowLegacyNoAadFallback: true,
      },
    );

    try {
      const secretKey = this.encryption.decryptFieldBytes(
        row.secretKeyCt,
        row.secretKeyIv,
        row.secretKeyTag,
        dek,
        {
          aad: polymarketUsCredentialFieldAad(userId, "secretKey"),
          allowLegacyNoAadFallback: true,
        },
      );
      return { keyId: row.keyId, secretKey };
    } finally {
      dek.fill(0);
    }
  }

  async signRequest(
    userId: string,
    method: string,
    path: string,
    body?: string,
  ): Promise<PolymarketUsSignedHeaders> {
    const creds = await this.getDecryptedSecretKey(userId);

    try {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const message = `${timestamp}${method.toUpperCase()}${path}${body ?? ""}`;

      const seedBytes = Buffer.from(creds.secretKey);
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
