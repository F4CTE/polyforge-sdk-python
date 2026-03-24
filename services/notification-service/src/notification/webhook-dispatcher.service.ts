import { Injectable, Logger } from "@nestjs/common";
import { createHmac } from "crypto";
import { PrismaService } from "@polyforge/shared-db";

/**
 * Dispatches webhook events to registered user webhook URLs.
 * Called by NotificationService when events are processed.
 * Fire-and-forget with 5s timeout, single retry on failure.
 */
@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dispatch an event to all matching webhooks for a user.
   * Non-blocking — errors are logged, never thrown to caller.
   */
  async dispatch(
    userId: string,
    eventType: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    let webhooks: Array<{ id: string; url: string; secret: string }>;
    try {
      webhooks = await this.prisma.webhook.findMany({
        where: {
          userId,
          active: true,
          events: { has: eventType },
        },
        select: { id: true, url: true, secret: true },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to load webhooks for user ${userId}: ${err?.message}`);
      return;
    }

    if (webhooks.length === 0) return;

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const wh of webhooks) {
      this.deliverWithRetry(wh.id, wh.url, wh.secret, payload).catch(() => {
        // Already logged inside deliverWithRetry
      });
    }
  }

  private async deliverWithRetry(
    webhookId: string,
    url: string,
    secret: string,
    payload: unknown,
  ): Promise<void> {
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    const headers = {
      "Content-Type": "application/json",
      "X-Polyforge-Signature": signature,
      "User-Agent": "Polyforge-Webhook/1.0",
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        this.logger.debug(`Webhook ${webhookId} delivered successfully`);
        return;
      }
      this.logger.warn(`Webhook ${webhookId} returned ${res.status}, retrying...`);
    } catch (err: any) {
      this.logger.warn(`Webhook ${webhookId} failed: ${err?.message}, retrying...`);
    }

    // Single retry
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.logger.error(`Webhook ${webhookId} retry failed with ${res.status}`);
      }
    } catch (err: any) {
      this.logger.error(`Webhook ${webhookId} retry failed: ${err?.message}`);
    }
  }
}
