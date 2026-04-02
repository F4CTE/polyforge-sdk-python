import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@polyforge/shared-db";
import { randomBytes, createHash } from "crypto";

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, revoked: false },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(userId: string, dto: { name: string; scopes?: string[] }) {
    const raw = `pf_${randomBytes(32).toString("hex")}`;
    const prefix = raw.slice(0, 10);
    const tokenHash = createHash("sha256").update(raw).digest("hex");

    const key = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name.slice(0, 100),
        prefix,
        tokenHash,
        scopes: (dto.scopes ?? ["READ"]) as any,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        createdAt: true,
      },
    });

    // Return the full token only on creation — it's never shown again
    return { ...key, token: raw };
  }

  async revoke(userId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, userId, revoked: false },
    });
    if (!key) throw new NotFoundException("API key not found");

    await this.prisma.apiKey.update({
      where: { id },
      data: { revoked: true, revokedAt: new Date() },
    });
    return { message: "API key revoked" };
  }
}
