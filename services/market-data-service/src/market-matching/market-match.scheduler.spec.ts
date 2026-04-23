import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketMatchScheduler } from "./market-match.scheduler";

function makeMatchService() {
  return {
    runAutoMatch: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
  } as any;
}

describe("MarketMatchScheduler", () => {
  let scheduler: MarketMatchScheduler;
  let matchService: ReturnType<typeof makeMatchService>;

  beforeEach(() => {
    matchService = makeMatchService();
    scheduler = new MarketMatchScheduler(matchService);
  });

  it("delegates to matchService.runAutoMatch", async () => {
    await scheduler.handleAutoMatch();
    expect(matchService.runAutoMatch).toHaveBeenCalled();
  });

  it("skips when already running", async () => {
    let resolve: () => void;
    matchService.runAutoMatch.mockReturnValue(
      new Promise<{ created: number; skipped: number }>((r) => {
        resolve = () => r({ created: 0, skipped: 0 });
      }),
    );

    const first = scheduler.handleAutoMatch();
    await scheduler.handleAutoMatch();
    expect(matchService.runAutoMatch).toHaveBeenCalledTimes(1);

    resolve!();
    await first;
  });

  it("resets running flag after error", async () => {
    matchService.runAutoMatch.mockRejectedValueOnce(new Error("boom"));
    await scheduler.handleAutoMatch();
    await scheduler.handleAutoMatch();
    expect(matchService.runAutoMatch).toHaveBeenCalledTimes(2);
  });
});
