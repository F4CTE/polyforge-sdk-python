import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  Logger,
} from "@nestjs/common";
import { isIPv4 } from "net";
import { randomBytes, createHmac } from "crypto";
import { PrismaService } from "@polyforge/shared-db";
import { CreateWebhookDto } from "./dto/create-webhook.dto";

const MAX_WEBHOOKS_PER_USER = 10;

/**
 * Returns true if the hostname resolves to a private/internal address that
 * webhook delivery must never reach (SSRF protection).
 *
 * Uses numeric range checks for IPv4 to correctly cover full RFC 1918 blocks:
 *   10.0.0.0/8, 172.16.0.0/12 (172.16–172.31), 192.168.0.0/16,
 *   127.0.0.0/8 (loopback), 169.254.0.0/16 (link-local),
 *   100.64.0.0/10 (CGNAT / AWS internal).
 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h === "metadata.google.internal"
  )
    return true;
  if (h === "[::1]" || h === "::1" || h.startsWith("fe80:")) return true;
  if (h.endsWith(".internal") || h.endsWith(".local")) return true;

  if (isIPv4(h)) {
    const parts = h.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  }
  return false;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateWebhookDto,
  ): Promise<{
    id: string;
    url: string;
    events: string[];
    secret: string;
    active: boolean;
    createdAt: Date;
  }> {
    const count = await this.prisma.webhook.count({ where: { userId } });
    if (count >= MAX_WEBHOOKS_PER_USER) {
      throw new UnprocessableEntityException({
        code: "WEBHOOK_LIMIT_REACHED",
        message: `Maximum ${MAX_WEBHOOKS_PER_USER} webhooks per user`,
      });
    }

    const secret = randomBytes(32).toString("hex");

    const webhook = await this.prisma.webhook.create({
      data: {
        userId,
        url: dto.url,
        events: dto.events,
        secret,
        active: true,
      },
    });

    // Return secret only on creation — never again
    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret,
      active: webhook.active,
      createdAt: webhook.createdAt,
    };
  }

  async list(userId: string) {
    return this.prisma.webhook.findMany({
      where: { userId },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Webhook not found",
      });
    }
    if (webhook.userId !== userId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Access denied",
      });
    }
    await this.prisma.webhook.delete({ where: { id } });
  }

  async test(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Webhook not found",
      });
    }
    if (webhook.userId !== userId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Access denied",
      });
    }

    const testPayload = {
      event: "TEST",
      timestamp: new Date().toISOString(),
      data: { message: "This is a test webhook from Polyforge" },
    };

    return this.deliver(webhook.url, webhook.secret, testPayload);
  }

  /**
   * Dispatch event to all matching webhooks for a user.
   * Fire-and-forget — errors are logged, not thrown.
   */
  async dispatch(
    userId: string,
    eventType: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        userId,
        active: true,
        events: { has: eventType },
      },
    });

    for (const wh of webhooks) {
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data,
      };

      // Fire and forget — don't await sequentially in production,
      // but keep simple for now
      this.deliver(wh.url, wh.secret, payload).catch((err) => {
        this.logger.warn(
          `Webhook delivery failed for ${wh.id}: ${err?.message}`,
        );
      });
    }
  }

  private async deliver(
    url: string,
    secret: string,
    payload: unknown,
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    // SECURITY: Block internal/private network URLs to prevent SSRF.
    // Uses numeric range checks instead of string-prefix matching to correctly
    // cover the full RFC 1918 172.16.0.0/12 block (172.16–172.31).
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        return {
          success: false,
          statusCode: 0,
          error: "Internal or non-HTTPS URLs are not allowed",
        };
      }
      if (isPrivateHost(parsed.hostname)) {
        return {
          success: false,
          statusCode: 0,
          error: "Internal or non-HTTPS URLs are not allowed",
        };
      }
    } catch {
      return { success: false, statusCode: 0, error: "Invalid URL" };
    }

    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Polyforge-Signature": signature,
          "User-Agent": "Polyforge-Webhook/1.0",
        },
        body,
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });

      if (!res.ok) {
        // Retry once
        const retry = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Polyforge-Signature": signature,
            "User-Agent": "Polyforge-Webhook/1.0",
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        return { success: retry.ok, statusCode: retry.status };
      }

      return { success: true, statusCode: res.status };
    } catch (err: any) {
      // Retry once on network error
      try {
        const retry = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Polyforge-Signature": signature,
            "User-Agent": "Polyforge-Webhook/1.0",
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        return { success: retry.ok, statusCode: retry.status };
      } catch (retryErr: any) {
        return { success: false, error: retryErr?.message ?? "Network error" };
      }
    }
  }
}
