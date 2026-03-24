import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * GeoBlockGuard — defense-in-depth geoblocking at the API layer.
 *
 * Reads the `X-Country-Code` header (set by nginx via geoip2 module)
 * and blocks requests from restricted countries.
 *
 * Applied to trading endpoints (order placement, strategy start) but
 * NOT to read-only endpoints (market browsing, discovery).
 *
 * Configure blocked countries via GEO_BLOCKED_COUNTRIES env var
 * (comma-separated ISO country codes, e.g. "US,KP,IR").
 */
@Injectable()
export class GeoBlockGuard implements CanActivate {
  private readonly blockedCountries: string[];

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>("GEO_BLOCKED_COUNTRIES") ?? "US";
    this.blockedCountries = raw
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const country = (
      request.headers["x-country-code"] as string
    )?.toUpperCase();

    if (country && this.blockedCountries.includes(country)) {
      throw new ForbiddenException({
        code: "GEO_BLOCKED",
        message: "Service not available in your region",
      });
    }

    return true;
  }
}
