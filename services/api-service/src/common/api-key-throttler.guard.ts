import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    // Track authenticated traffic by user ID so multiple API keys cannot multiply limits.
    const user = req["user"] as { sub?: string } | undefined;
    if (user?.sub) {
      return Promise.resolve(`user:${user.sub}`);
    }
    const apiKeyMeta = req["apiKeyMeta"] as { keyId?: string } | undefined;
    if (apiKeyMeta?.keyId) {
      return Promise.resolve(`apikey:${apiKeyMeta.keyId}`);
    }
    // Fallback to IP for unauthenticated requests
    return Promise.resolve((req["ip"] as string | undefined) ?? "");
  }
}
