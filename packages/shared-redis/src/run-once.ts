import { Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { RedisService } from "./redis.service";

const logger = new Logger("RunOncePerCluster");

export async function runOncePerCluster<T>(opts: {
  redis: RedisService;
  key: string;
  ttlMs: number;
  job: () => Promise<T>;
}): Promise<T | null> {
  const client = opts.redis.getClient();
  const lockToken = randomUUID();
  const acquired = await client.set(
    opts.key,
    lockToken,
    "PX",
    opts.ttlMs,
    "NX",
  );
  if (acquired !== "OK") return null;
  try {
    return await opts.job();
  } catch (err) {
    logger.error(`Job ${opts.key} failed`, err);
    await client
      .eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        opts.key,
        lockToken,
      )
      .catch(() => {});
    throw err;
  }
}
