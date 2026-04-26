import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArbitrageScheduler } from "./arbitrage.scheduler";

function makeArbitrageService() {
  return { scanAndAlert: vi.fn().mockResolvedValue(0) } as any;
}

function makeConfig() {
  return { get: vi.fn().mockReturnValue("3") } as any;
}

function makeRedis() {
  const client = {
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  };
  return { getClient: () => client } as any;
}

describe("ArbitrageScheduler", () => {
  let scheduler: ArbitrageScheduler;
  let arbitrageService: ReturnType<typeof makeArbitrageService>;
  let config: ReturnType<typeof makeConfig>;

  beforeEach(() => {
    arbitrageService = makeArbitrageService();
    config = makeConfig();
    scheduler = new ArbitrageScheduler(arbitrageService, config, makeRedis());
  });

  it("delegates to arbitrageService.scanAndAlert with configured threshold", async () => {
    config.get.mockReturnValue("5");
    await scheduler.handleArbitrageScan();
    expect(arbitrageService.scanAndAlert).toHaveBeenCalledWith(5);
  });

  it("defaults threshold to 3 when config is missing", async () => {
    config.get.mockReturnValue(undefined);
    await scheduler.handleArbitrageScan();
    expect(arbitrageService.scanAndAlert).toHaveBeenCalledWith(3);
  });

  it("skips when already running", async () => {
    let resolve: () => void;
    arbitrageService.scanAndAlert.mockReturnValue(
      new Promise<number>((r) => {
        resolve = () => r(0);
      }),
    );

    const first = scheduler.handleArbitrageScan();
    await scheduler.handleArbitrageScan();
    expect(arbitrageService.scanAndAlert).toHaveBeenCalledTimes(1);

    resolve!();
    await first;
  });

  it("resets running flag after error", async () => {
    arbitrageService.scanAndAlert.mockRejectedValueOnce(new Error("boom"));
    await scheduler.handleArbitrageScan();
    await scheduler.handleArbitrageScan();
    expect(arbitrageService.scanAndAlert).toHaveBeenCalledTimes(2);
  });
});
