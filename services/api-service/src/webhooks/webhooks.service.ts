import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  Logger,
} from "@nestjs/common";
import { randomBytes, createHmac } from "crypto";
import { PrismaService } from "@polyforge/shared-db";
import { CreateWebhookDto } from "./dto/create-webhook.dto";

const MAX_WEBHOOKS_PER_USER = 10;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateWebhookDto,
  ): Promise<{ id: string; url: string; events: string[]; secret: string; active: boolean; createdAt: Date }> {
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
      throw new NotFoundException({ code: "NOT_FOUND", message: "Webhook not found" });
    }
    if (webhook.userId !== userId) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Access denied" });
    }
    await this.prisma.webhook.delete({ where: { id } });
  }

  async test(id: string, userId: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Webhook not found" });
    }
    if (webhook.userId !== userId) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Access denied" });
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
  async dispatch(userId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
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
        this.logger.warn(`Webhook delivery failed for ${wh.id}: ${err?.message}`);
      });
    }
  }

  private async deliver(
    url: string,
    secret: string,
    payload: unknown,
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
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
