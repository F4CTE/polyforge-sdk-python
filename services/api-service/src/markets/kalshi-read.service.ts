import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface ComboCollection {
  collection_ticker: string;
  title: string;
  category: string;
  status: string;
  markets_count: number;
  series_ticker?: string;
}

export interface ComboTickerLookup {
  event_ticker: string;
  market_ticker: string;
}

export interface ComboLeg {
  ticker: string;
  outcome: "yes" | "no";
}

@Injectable()
export class KalshiReadService {
  private readonly logger = new Logger(KalshiReadService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>("KALSHI_BASE_URL") ??
      "https://api.elections.kalshi.com/trade-api/v2";
  }

  async getCollections(
    seriesTicker?: string,
    limit = 50,
    cursor?: string,
  ): Promise<{ collections: ComboCollection[]; cursor: string }> {
    const params = new URLSearchParams();
    if (seriesTicker) params.set("series_ticker", seriesTicker);
    if (limit) params.set("limit", String(limit));
    if (cursor) params.set("cursor", cursor);

    const qs = params.toString();
    const url = `/events/multivariate${qs ? `?${qs}` : ""}`;
    const res = await this.fetch(url);

    if (!res.ok) {
      this.logger.warn(`Kalshi MVE collections returned ${res.status}`);
      return { collections: [], cursor: "" };
    }

    const data = (await res.json()) as {
      multivariate_contracts?: ComboCollection[];
      cursor?: string;
    };

    return {
      collections: data.multivariate_contracts ?? [],
      cursor: data.cursor ?? "",
    };
  }

  async getCollection(
    collectionTicker: string,
  ): Promise<ComboCollection | null> {
    const res = await this.fetch(
      `/events/multivariate/${encodeURIComponent(collectionTicker)}`,
    );

    if (!res.ok) {
      if (res.status === 404) return null;
      this.logger.warn(`Kalshi MVE collection returned ${res.status}`);
      return null;
    }

    const data = (await res.json()) as {
      multivariate_contract?: ComboCollection;
    };
    return data.multivariate_contract ?? null;
  }

  async lookupTicker(
    collectionTicker: string,
    legs: ComboLeg[],
  ): Promise<ComboTickerLookup | null> {
    const res = await this.fetchJson(
      `/events/multivariate/${encodeURIComponent(collectionTicker)}/lookup`,
      {
        method: "POST",
        body: JSON.stringify({
          selected_markets: legs.map((l) => ({
            ticker: l.ticker,
            yes: l.outcome === "yes",
          })),
        }),
      },
    );

    if (!res.ok) {
      this.logger.warn(`Kalshi combo ticker lookup returned ${res.status}`);
      return null;
    }

    return (await res.json()) as ComboTickerLookup;
  }

  private fetch(path: string): Promise<Response> {
    return globalThis.fetch(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(10_000),
    });
  }

  private fetchJson(path: string, opts: RequestInit): Promise<Response> {
    return globalThis.fetch(`${this.baseUrl}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...opts.headers },
      signal: AbortSignal.timeout(10_000),
    });
  }
}
