import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "@polyforge/shared-redis";

export interface VenueHealth {
  venueId: string;
  displayName: string;
  wsConnected: boolean;
  lastEventAt: string | null;
  latencyMs: number | null;
}

const MARKET_DATA_URL =
  process.env.MARKET_DATA_SERVICE_URL ?? "http://market-data-service:3005";

@Injectable()
export class VenuesService {
  private readonly logger = new Logger(VenuesService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async getHealth(): Promise<VenueHealth[]> {
    const results: VenueHealth[] = [];

    results.push(await this.probeVenue("polymarket", "Polymarket", true));

    const kalshiEnabled = this.config.get<string>("KALSHI_ENABLED") === "true";
    results.push(await this.probeVenue("kalshi", "Kalshi", kalshiEnabled));

    return results;
  }

  private async probeVenue(
    venueId: string,
    displayName: string,
    enabled: boolean,
  ): Promise<VenueHealth> {
    if (!enabled) {
      return {
        venueId,
        displayName,
        wsConnected: false,
        lastEventAt: null,
        latencyMs: null,
      };
    }

    const healthRaw = await this.redis
      .getClient()
      .get("health:market-data-service");
    const serviceHealth = healthRaw ? JSON.parse(healthRaw) : null;

    const lastEventAt = await this.redis
      .getClient()
      .get(`venue:lastEvent:${venueId}`);

    let wsConnected = false;
    let latencyMs: number | null = null;

    if (serviceHealth?.status === "healthy") {
      try {
        const start = Date.now();
        const res = await fetch(`${MARKET_DATA_URL}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        latencyMs = Date.now() - start;
        wsConnected = res.ok;
      } catch {
        wsConnected = false;
      }
    }

    return {
      venueId,
      displayName,
      wsConnected,
      lastEventAt: lastEventAt ?? null,
      latencyMs,
    };
  }
}
