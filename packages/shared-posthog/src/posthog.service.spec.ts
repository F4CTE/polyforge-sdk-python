import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockCapture = vi.fn();
const mockIdentify = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock("posthog-node", () => ({
  PostHog: class MockPostHog {
    capture = mockCapture;
    identify = mockIdentify;
    shutdown = mockShutdown;
  },
}));

import { PosthogService } from "./posthog.service";

describe("PosthogService", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    mockCapture.mockClear();
    mockIdentify.mockClear();
    mockShutdown.mockClear();
  });

  describe("when POSTHOG_API_KEY is set", () => {
    let service: PosthogService;

    beforeEach(() => {
      process.env.POSTHOG_API_KEY = "phc_test123";
      process.env.POSTHOG_HOST = "http://posthog:8000";
      service = new PosthogService();
    });

    it("capture delegates to the client", () => {
      service.capture("user-1", "strategy_created", { strategyId: "s-1" });
      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: "user-1",
        event: "strategy_created",
        properties: { strategyId: "s-1" },
      });
    });

    it("identify delegates to the client", () => {
      service.identify("user-1", { email: "a@b.com" });
      expect(mockIdentify).toHaveBeenCalledWith({
        distinctId: "user-1",
        properties: { email: "a@b.com" },
      });
    });

    it("onModuleDestroy shuts down the client", async () => {
      await service.onModuleDestroy();
      expect(mockShutdown).toHaveBeenCalled();
    });
  });

  describe("when POSTHOG_API_KEY is not set", () => {
    let service: PosthogService;

    beforeEach(() => {
      delete process.env.POSTHOG_API_KEY;
      service = new PosthogService();
    });

    it("capture is a no-op", () => {
      expect(() => service.capture("user-1", "test_event")).not.toThrow();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("identify is a no-op", () => {
      expect(() => service.identify("user-1", {})).not.toThrow();
      expect(mockIdentify).not.toHaveBeenCalled();
    });

    it("onModuleDestroy is safe", async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
