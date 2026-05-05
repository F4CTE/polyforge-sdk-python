import { describe, expect, it, vi } from "vitest";
import { logCloudWatchMetric } from "./cloudwatch-metrics";

describe("logCloudWatchMetric", () => {
  it("logs an EMF payload in the Polyforge namespace", () => {
    const logger = { log: vi.fn() };

    logCloudWatchMetric(logger, {
      name: "OrderLatencyMs",
      value: 42,
      unit: "Milliseconds",
      dimensions: { Service: "order-service" },
      properties: { intentId: "intent-1" },
    });

    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        _aws: expect.objectContaining({
          CloudWatchMetrics: [
            expect.objectContaining({
              Namespace: "Polyforge",
              Dimensions: [["Service"]],
              Metrics: [{ Name: "OrderLatencyMs", Unit: "Milliseconds" }],
            }),
          ],
        }),
        Service: "order-service",
        OrderLatencyMs: 42,
        intentId: "intent-1",
      }),
      "cloudwatch metric",
    );
  });
});
