import { Logger } from "@nestjs/common";
import { RedisService } from "./redis.service";

const logger = new Logger("RunOncePerCluster");

export async function runOncePerCluster<T>(opts: {
  redis: RedisService;
  key: string;
  ttlMs: number;
  job: () => Promise<T>;
}): Promise<T | null> {
  const client = opts.redis.getClient();
  const acquired = await client.set(opts.key, "1", "PX", opts.ttlMs, "NX");
  if (acquired !== "OK") return null;
  try {
    return await opts.job();
  } catch (err) {
    logger.error(`Job ${opts.key} failed`, err);
    // Delete lock on failure so the job can be retried on the next call;
    // for successes, rely on the Redis key TTL to prevent re-execution.
    await client.del(opts.key).catch(() => {});
    throw err;
  }
}
