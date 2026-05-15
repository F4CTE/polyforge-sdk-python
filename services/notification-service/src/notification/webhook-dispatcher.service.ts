import { Injectable, Logger } from "@nestjs/common";
import { createHmac } from "crypto";
import { isIP } from "net";
import { lookup as dnsLookup } from "dns/promises";
import { PrismaService } from "@polyforge/shared-db";

/**
 * Dispatches webhook events to registered user webhook URLs.
 * Called by NotificationService when events are processed.
 * Runs all webhook deliveries concurrently with 5s timeout each, single retry on failure.
 * Awaits completion so callers can sequence delivery markers after webhook fanout.
 */
@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dispatch an event to all matching webhooks for a user.
   * Awaits all deliveries — errors are logged, never thrown to caller.
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
      this.logger.warn(
        `Failed to load webhooks for user ${userId}: ${err?.message}`,
      );
      return;
    }

    if (webhooks.length === 0) return;

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    const deliveries = webhooks.map((wh) =>
      this.deliverWithRetry(wh.id, wh.url, wh.secret, payload),
    );
    await Promise.allSettled(deliveries);
  }

  /**
   * Block internal/reserved hostnames and IP ranges (SSRF protection).
   * Handles IPv4, IPv6, IPv4-mapped IPv6, and hostname variants.
   */
  private isBlockedHost(hostname: string): boolean {
    const normalized = hostname.replace(/\.$/, "").toLowerCase();

    // Block well-known internal hostnames
    if (
      normalized === "localhost" ||
      normalized === "metadata.google.internal" ||
      normalized.endsWith(".internal") ||
      normalized.endsWith(".local")
    ) {
      return true;
    }

    // Strip IPv6 brackets if present
    const bare = normalized.startsWith("[")
      ? normalized.slice(1, -1)
      : normalized;

    // Block IPv6 loopback and link-local
    if (bare === "::1" || bare === "::") return true;
    if (
      bare.startsWith("fe80:") ||
      bare.startsWith("fc00:") ||
      bare.startsWith("fd00:")
    ) {
      return true;
    }

    // Handle IPv4-mapped IPv6 (::ffff:127.0.0.1)
    const v4Mapped = bare.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    const ipv4 = v4Mapped ? v4Mapped[1] : isIP(bare) === 4 ? bare : null;

    if (ipv4) {
      const parts = ipv4.split(".").map(Number);
      if (parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;

      // 127.0.0.0/8, 10.0.0.0/8, 0.0.0.0/8
      if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) return true;
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true;
      // 169.254.0.0/16 (link-local)
      if (parts[0] === 169 && parts[1] === 254) return true;
      // 100.64.0.0/10 (CGNAT)
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    }

    return false;
  }

  /**
   * Resolve hostname via DNS and verify the resolved IP is not private/reserved.
   * Closes the TOCTOU gap where fetch() could re-resolve to a different IP.
   */
  private async resolveAndValidate(
    webhookId: string,
    url: string,
  ): Promise<{ parsed: URL; resolvedAddress: string } | null> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      this.logger.warn(`Webhook ${webhookId} blocked — invalid URL`);
      return null;
    }

    if (parsed.protocol !== "https:") {
      this.logger.warn(`Webhook ${webhookId} blocked — non-HTTPS URL`);
      return null;
    }

    if (this.isBlockedHost(parsed.hostname)) {
      this.logger.warn(
        `Webhook ${webhookId} blocked — internal/reserved hostname`,
      );
      return null;
    }

    // Resolve DNS and check the actual IP
    try {
      const { address } = await dnsLookup(parsed.hostname);
      if (this.isBlockedHost(address)) {
        this.logger.warn(
          `Webhook ${webhookId} blocked — resolved IP ${address} is private/reserved`,
        );
        return null;
      }
      return { parsed, resolvedAddress: address };
    } catch (err: any) {
      this.logger.warn(
        `Webhook ${webhookId} blocked — DNS resolution failed: ${err?.message}`,
      );
      return null;
    }
  }

  private async deliverWithRetry(
    webhookId: string,
    url: string,
    secret: string,
    payload: unknown,
  ): Promise<void> {
    const validated = await this.resolveAndValidate(webhookId, url);
    if (!validated) return;

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
      this.logger.warn(
        `Webhook ${webhookId} returned ${res.status}, retrying...`,
      );
    } catch (err: any) {
      this.logger.warn(
        `Webhook ${webhookId} failed: ${err?.message}, retrying...`,
      );
    }

    // Re-validate before retry to prevent DNS rebinding between attempts
    const revalidated = await this.resolveAndValidate(webhookId, url);
    if (!revalidated) return;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.logger.error(
          `Webhook ${webhookId} retry failed with ${res.status}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Webhook ${webhookId} retry failed: ${err?.message}`);
    }
  }
}
