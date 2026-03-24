import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // For API key requests, track by key ID
    if (req.apiKeyMeta?.keyId) {
      return `apikey:${req.apiKeyMeta.keyId}`;
    }
    // For authenticated users, track by user ID (each user gets their own bucket)
    if (req.user?.sub) {
      return `user:${req.user.sub}`;
    }
    // Fallback to IP for unauthenticated requests
    return req.ip;
  }
}
