import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { PostHog } from "posthog-node";

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
    this.client?.capture({ distinctId, event, properties });
  }

  identify(distinctId: string, properties?: Record<string, unknown>): void {
    this.client?.identify({ distinctId, properties });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.shutdown();
    this.logger.log("PostHog client shut down");
  }
}
