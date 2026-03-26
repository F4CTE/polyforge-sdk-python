import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";

/**
 * GeoBlockGuard — defense-in-depth geoblocking at the API layer.
 *
 * Reads the `X-Country-Code` and `X-Region-Code` headers (set by nginx via
 * geoip2 module) and enforces three levels of restriction:
 *
 *   1. BLOCKED_COUNTRIES — fully blocked, HTTP 451
 *   2. CLOSE_ONLY_COUNTRIES — may only close positions and redeem; new orders blocked
 *   3. BLOCKED_REGIONS — specific sub-national regions fully blocked (e.g. Crimea)
 *
 * Applied to trading endpoints (order placement, strategy start) but
 * NOT to read-only endpoints (market browsing, discovery).
 *
 * Configure via GEO_BLOCKED_COUNTRIES, GEO_CLOSE_ONLY_COUNTRIES env vars
 * (comma-separated ISO country codes).
 */
@Injectable()
export class GeoBlockGuard implements CanActivate {
  private readonly blockedCountries: string[];
  private readonly closeOnlyCountries: string[];
  private readonly blockedRegions: Record<string, string[]>;

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {
    const rawBlocked =
      this.config.get<string>("GEO_BLOCKED_COUNTRIES") ??
      "US,AU,BE,BY,BI,CF,CG,CU,DE,ET,FR,GB,IR,IQ,IT,KP,LB,LY,MM,NI,NL,RU,SO,SS,SD,SY,VE,YE,ZW,UM";
    this.blockedCountries = rawBlocked
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const rawCloseOnly =
      this.config.get<string>("GEO_CLOSE_ONLY_COUNTRIES") ?? "PL,SG,TH,TW";
    this.closeOnlyCountries = rawCloseOnly
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    // Sub-national region blocks (country → region codes)
    this.blockedRegions = {
      CA: ["ON"],              // Canada: Ontario
      UA: ["43", "14", "09"],  // Ukraine: Crimea, Donetsk, Luhansk
    };
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const country = (
      request.headers["x-country-code"] as string
    )?.toUpperCase();
    const region = (
      request.headers["x-region-code"] as string
    )?.toUpperCase();

    // SECURITY: In production, deny requests without geo headers (may be bypassing gateway)
    if (!country) {
      return process.env.NODE_ENV !== 'production';
    }

    // 1. Fully blocked countries — HTTP 451
    if (this.blockedCountries.includes(country)) {
      throw new HttpException(
        {
          code: "GEO_BLOCKED",
          message: "Service not available in your region",
        },
        451,
      );
    }

    // 2. Sub-national region blocks — HTTP 451
    if (
      region &&
      this.blockedRegions[country] &&
      this.blockedRegions[country].includes(region)
    ) {
      throw new HttpException(
        {
          code: "GEO_BLOCKED",
          message: "Service not available in your region",
        },
        451,
      );
    }

    // 3. Close-only countries — allow close-position and redeem, block new orders
    if (this.closeOnlyCountries.includes(country)) {
      const handler = context.getHandler();
      const controllerMethod = handler.name;

      // Allow only close and redeem operations
      const allowedMethods = [
        "closePosition",
        "redeemPosition",
        "list",          // read-only listing is always allowed
      ];

      if (!allowedMethods.includes(controllerMethod)) {
        throw new HttpException(
          {
            code: "GEO_CLOSE_ONLY",
            message:
              "Only closing positions and redemptions are available in your region",
          },
          451,
        );
      }
    }

    return true;
  }
}
