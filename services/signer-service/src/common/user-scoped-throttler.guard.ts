import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class UserScopedThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const method = String(req.method ?? "").toUpperCase();
    const path = String(req.routerPath ?? req.routeOptions?.url ?? req.url ?? "");

    if (method === "POST" && path.endsWith("/sign/order")) {
      const userId = (req.user as any)?.id ?? (req.user as any)?.sub ?? req.body?.userId;
      if (typeof userId === "string" && userId.length > 0) {
        return `user:${userId}`;
      }
    }

    return super.getTracker(req);
  }
}
