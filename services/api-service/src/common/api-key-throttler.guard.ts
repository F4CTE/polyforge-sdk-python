import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    // For API key requests, track by key ID
    const apiKeyMeta = req["apiKeyMeta"] as { keyId?: string } | undefined;
    if (apiKeyMeta?.keyId) {
      return Promise.resolve(`apikey:${apiKeyMeta.keyId}`);
    }
    // For authenticated users, track by user ID (each user gets their own bucket)
    const user = req["user"] as { sub?: string } | undefined;
    if (user?.sub) {
      return Promise.resolve(`user:${user.sub}`);
    }
    // Fallback to IP for unauthenticated requests
    return Promise.resolve((req["ip"] as string | undefined) ?? "");
  }
}
