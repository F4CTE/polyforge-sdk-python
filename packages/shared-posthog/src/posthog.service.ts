import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { PostHog } from "posthog-node";

const PII_PROPERTY_KEYS = new Set([
  "email",
  "phone",
  "address",
  "walletAddress",
  "mnemonic",
  "privateKey",
  "password",
  "secret",
  "apiKey",
  "token",
  "ssn",
  "passport",
  "creditCard",
]);

function stripPii(
  properties?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!properties) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (PII_PROPERTY_KEYS.has(key)) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

@Injectable()
export class PosthogService implements OnModuleDestroy {
  private readonly logger = new Logger(PosthogService.name);
  private readonly client: PostHog | null;

  constructor() {
    const apiKey = process.env.POSTHOG_API_KEY;
    const host = process.env.POSTHOG_HOST ?? "http://posthog:8000";

    if (apiKey) {
      this.client = new PostHog(apiKey, {
        host,
        flushAt: 20,
        flushInterval: 10_000,
      });
      this.logger.log(`PostHog enabled → ${host}`);
    } else {
      this.client = null;
      this.logger.warn("PostHog disabled (POSTHOG_API_KEY not set)");
    }
  }

  capture(
    distinctId: string,
    event: string,
    properties?: Record<string, unknown>,
  ): void {
    this.client?.capture({
      distinctId,
      event,
      properties: stripPii(properties),
    });
  }

  identify(distinctId: string, properties?: Record<string, unknown>): void {
    this.client?.identify({ distinctId, properties: stripPii(properties) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.shutdown();
    this.logger.log("PostHog client shut down");
  }
}
