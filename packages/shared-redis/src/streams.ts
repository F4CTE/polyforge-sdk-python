import type Redis from "ioredis";

export interface StreamLagSnapshot {
  stream: string;
  group: string;
  length: number;
  pending: number;
  oldestPendingMs: number;
  consumers: number;
}

export interface ReclaimedEntry {
  id: string;
  fields: Record<string, string>;
}

export interface ReclaimResult {
  stream: string;
  group: string;
  consumer: string;
  reclaimedCount: number;
  nextCursor: string;
  entries: ReclaimedEntry[];
}

const XPENDING_SUMMARY_LEN = 4;

/**
 * Probe the lag for a single (stream, group) pair.
 *
 * - `length` = total entries written to the stream (XLEN).
 * - `pending` = messages delivered to a consumer but not yet XACK'd.
 * - `oldestPendingMs` = age of the oldest unacked message in milliseconds
 *   (0 when there are no pending entries).
 * - `consumers` = number of registered consumers in the group.
 *
 * If the consumer group does not exist yet (e.g. a service has not booted),
 * all counts return 0 instead of throwing — this lets the monitor tick
 * before producers/consumers come online.
 */
export async function getStreamLag(
  client: Redis,
  stream: string,
  group: string,
): Promise<StreamLagSnapshot> {
  const empty: StreamLagSnapshot = {
    stream,
    group,
    length: 0,
    pending: 0,
    oldestPendingMs: 0,
    consumers: 0,
  };

  let length: number;
  try {
    length = await client.xlen(stream);
  } catch (err) {
    if (isNoSuchKey(err)) return empty;
    throw err;
  }

  let pending = 0;
  let oldestPendingMs = 0;
  try {
    const summary = (await client.xpending(stream, group)) as
      | [number | string, string | null, string | null, unknown]
      | null;

    if (Array.isArray(summary) && summary.length >= XPENDING_SUMMARY_LEN) {
      pending = Number(summary[0] ?? 0);
      const oldestId = summary[1];
      if (oldestId && typeof oldestId === "string") {
        const ms = Number(oldestId.split("-")[0]);
        if (Number.isFinite(ms)) {
          oldestPendingMs = Math.max(0, Date.now() - ms);
        }
      }
    }
  } catch (err) {
    if (isNoGroup(err) || isNoSuchKey(err)) {
      return { ...empty, length };
    }
    throw err;
  }

  let consumers = 0;
  try {
    const info = await client.xinfo("CONSUMERS", stream, group);
    if (Array.isArray(info)) consumers = info.length;
  } catch (err) {
    if (!isNoGroup(err) && !isNoSuchKey(err)) throw err;
  }

  return { stream, group, length, pending, oldestPendingMs, consumers };
}

/**
 * Reclaim stale PEL entries using XAUTOCLAIM.
 *
 * `minIdleMs` is the threshold above which a pending entry is considered
 * abandoned — typically several minutes, longer than any healthy consumer
 * would take. The cursor lets callers paginate; pass "0-0" on the first
 * call and the returned `nextCursor` for follow-ups.
 *
 * NOTE: This call only re-assigns ownership of the entries to `consumer`.
 * The normal XREADGROUP loop on that consumer will then re-deliver them
 * via the ">" or "0" id depending on the loop's design. For loops that
 * always use ">", a small JUSTID consumption pass is required to drain
 * the moved entries; see `consumeReclaimed` below.
 */
export async function reclaimPendingEntries(
  client: Redis,
  stream: string,
  group: string,
  consumer: string,
  minIdleMs: number,
  count = 100,
  startCursor = "0-0",
): Promise<ReclaimResult> {
  try {
    const result = (await client.xautoclaim(
      stream,
      group,
      consumer,
      minIdleMs,
      startCursor,
      "COUNT",
      count,
    )) as [string, Array<[string, string[]]>, string[]] | null;

    if (!result) {
      return {
        stream,
        group,
        consumer,
        reclaimedCount: 0,
        nextCursor: "0-0",
        entries: [],
      };
    }

    const [nextCursor, rawEntries] = result;
    const entries = Array.isArray(rawEntries)
      ? rawEntries
          .filter(
            (e): e is [string, string[]] =>
              Array.isArray(e) &&
              typeof e[0] === "string" &&
              Array.isArray(e[1]),
          )
          .map(([id, fieldArr]) => ({ id, fields: arrayToObject(fieldArr) }))
      : [];

    return {
      stream,
      group,
      consumer,
      reclaimedCount: entries.length,
      nextCursor: nextCursor ?? "0-0",
      entries,
    };
  } catch (err) {
    if (isNoGroup(err) || isNoSuchKey(err)) {
      return {
        stream,
        group,
        consumer,
        reclaimedCount: 0,
        nextCursor: "0-0",
        entries: [],
      };
    }
    throw err;
  }
}

function arrayToObject(fields: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    if (typeof fields[i] === "string") {
      obj[fields[i]] = fields[i + 1] ?? "";
    }
  }
  return obj;
}

function isNoGroup(err: unknown): boolean {
  return err instanceof Error && /NOGROUP/i.test(err.message);
}

function isNoSuchKey(err: unknown): boolean {
  return err instanceof Error && /no such key|WRONGTYPE/i.test(err.message);
}
