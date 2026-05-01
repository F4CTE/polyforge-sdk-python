import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StreamMonitorService } from "./stream-monitor.service";

function makeRedis(client: Record<string, unknown>) {
  return { getClient: vi.fn().mockReturnValue(client) } as never;
}

describe("StreamMonitorService", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Spy on Logger prototype so we can capture log levels per tick.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Logger } = require("@nestjs/common");
    warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    debugSpy = vi.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("logs at debug level when no thresholds are breached", async () => {
    const client = {
      xlen: vi.fn().mockResolvedValue(10),
      xpending: vi.fn().mockResolvedValue([0, null, null, null]),
      xinfo: vi.fn().mockResolvedValue([]),
    };
    const svc = new StreamMonitorService(makeRedis(client));
    svc.setIntervalMs(5_000);
    svc.register({ stream: "s", group: "g" });

    await vi.advanceTimersByTimeAsync(5_500);

    expect(debugSpy).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns when stream length exceeds the configured threshold", async () => {
    const client = {
      xlen: vi.fn().mockResolvedValue(20_000),
      xpending: vi.fn().mockResolvedValue([0, null, null, null]),
      xinfo: vi.fn().mockResolvedValue([]),
    };
    const svc = new StreamMonitorService(makeRedis(client));
    svc.setIntervalMs(5_000);
    svc.register({ stream: "s", group: "g", lengthWarn: 1_000 });

    await vi.advanceTimersByTimeAsync(5_500);

    expect(warnSpy).toHaveBeenCalled();
  });

  it("warns when pending count exceeds the configured threshold", async () => {
    const client = {
      xlen: vi.fn().mockResolvedValue(0),
      xpending: vi.fn().mockResolvedValue([100, "0-0", "x", []]),
      xinfo: vi.fn().mockResolvedValue([]),
    };
    const svc = new StreamMonitorService(makeRedis(client));
    svc.setIntervalMs(5_000);
    svc.register({ stream: "s", group: "g", pendingWarn: 10 });

    await vi.advanceTimersByTimeAsync(5_500);

    expect(warnSpy).toHaveBeenCalled();
  });

  it("clears the timer on module destroy", async () => {
    const client = {
      xlen: vi.fn().mockResolvedValue(0),
      xpending: vi.fn().mockResolvedValue([0, null, null, null]),
      xinfo: vi.fn().mockResolvedValue([]),
    };
    const svc = new StreamMonitorService(makeRedis(client));
    svc.setIntervalMs(5_000);
    svc.register({ stream: "s", group: "g" });
    svc.onModuleDestroy();

    await vi.advanceTimersByTimeAsync(20_000);

    expect(client.xlen).not.toHaveBeenCalled();
  });
});
