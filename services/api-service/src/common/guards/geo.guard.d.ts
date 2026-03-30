import { CanActivate, ExecutionContext } from "@nestjs/common";
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
export declare class GeoBlockGuard implements CanActivate {
    private readonly config;
    private readonly reflector;
    private readonly blockedCountries;
    private readonly closeOnlyCountries;
    private readonly blockedRegions;
    constructor(config: ConfigService, reflector: Reflector);
    canActivate(context: ExecutionContext): boolean;
}
//# sourceMappingURL=geo.guard.d.ts.map