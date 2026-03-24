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
