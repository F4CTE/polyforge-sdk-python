import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private _isHealthy = false;

  get isHealthy(): boolean {
    return this._isHealthy;
  }

  onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: (times: number) => {
        if (times > 10) return null;
        return Math.min(times * 200, 5000);
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    this.client.on("connect", () => {
      this._isHealthy = true;
      this.logger.log("Connected to Redis");
    });

    this.client.on("ready", () => {
      this._isHealthy = true;
      this.logger.log("Redis ready");
    });

    this.client.on("error", (err) => {
      this._isHealthy = false;
      this.logger.error("Redis error", err);
    });

    this.client.on("close", () => {
      this._isHealthy = false;
      this.logger.warn("Redis connection closed");
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log("Disconnected from Redis");
  }

  // ─── Core ──────────────────────────────────────────────────────────────────

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, "EX", ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  // ─── JSON helpers ──────────────────────────────────────────────────────────

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // ─── Streams ───────────────────────────────────────────────────────────────

  async xadd(stream: string, fields: Record<string, string>): Promise<string> {
    const args: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      args.push(key, value);
    }
    return this.client.xadd(stream, "*", ...args) as Promise<string>;
  }

  async xread(
    stream: string,
    lastId: string,
    count = 100,
  ): Promise<{ id: string; fields: Record<string, string> }[]> {
    const results = await this.client.xread(
      "COUNT",
      count,
      "STREAMS",
      stream,
      lastId,
    );
    if (!results) return [];

    const [, entries] = results[0];
    return entries.map(([id, fields]) => ({
      id,
      fields: Object.fromEntries(
        fields.reduce<[string, string][]>((acc, val, i) => {
          if (i % 2 === 0) acc.push([val, fields[i + 1]]);
          return acc;
        }, []),
      ),
    }));
  }
}
