import { Injectable, Logger } from "@nestjs/common";
import { BatchItemDto, BatchResponseItem } from "./dto/batch-request.dto";

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  /**
   * Execute a batch of virtual requests against the local API,
   * forwarding the caller's auth token for each sub-request.
   */
  async executeBatch(
    items: BatchItemDto[],
    authToken: string,
    port: number,
  ): Promise<BatchResponseItem[]> {
    const results = await Promise.allSettled(
      items.map((item) => this.executeItem(item, authToken, port)),
    );

    return results.map((result, idx) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      return {
        id: items[idx].id,
        status: 500,
        body: { error: "Internal batch execution error" },
      };
    });
  }

  private async executeItem(
    item: BatchItemDto,
    authToken: string,
    port: number,
  ): Promise<BatchResponseItem> {
    // SECURITY: Allow-list approach for batch paths + URL decode before validation
    const decodedPath = decodeURIComponent(item.path);
    const ALLOWED_PREFIXES = [
      "/api/v1/markets",
      "/api/v1/strategies",
      "/api/v1/orders",
      "/api/v1/portfolio",
      "/api/v1/whales",
      "/api/v1/copy",
      "/api/v1/news",
      "/api/v1/leaderboard",
      "/api/v1/discover",
      "/api/v1/scores",
      "/api/v1/profile",
      "/api/v1/settings",
    ];
    const isAllowed = ALLOWED_PREFIXES.some((p) => decodedPath.startsWith(p));
    if (
      !isAllowed ||
      decodedPath.includes("..") ||
      decodedPath.includes("\\")
    ) {
      return {
        id: item.id,
        status: 400,
        body: { error: "Invalid batch path" },
      };
    }
    const url = `http://127.0.0.1:${port}${item.path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    };

    const init: RequestInit = {
      method: item.method,
      headers,
      signal: AbortSignal.timeout(15_000),
    };

    if (item.body && item.method !== "GET") {
      init.body = JSON.stringify(item.body);
    }

    try {
      const res = await fetch(url, init);
      let body: any;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { id: item.id, status: res.status, body };
    } catch (err) {
      this.logger.warn(
        `Batch item ${item.id} failed: ${item.method} ${item.path} — ${String(err)}`,
      );
      return {
        id: item.id,
        status: 502,
        body: { error: "Upstream request failed" },
      };
    }
  }
}
