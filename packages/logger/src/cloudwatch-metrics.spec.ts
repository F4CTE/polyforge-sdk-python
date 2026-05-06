import { describe, expect, it, vi } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";
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

  it("preserves Error details when logs use a structured err field", () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString("utf8"));
        callback();
      },
    });
    const logger = pino(stream);
    const err = new Error("redis down");
    err.stack = "Error: redis down\n    at consumeLoop (stream.ts:42:7)";

    logger.error(
      {
        event: "STREAM_CONSUME_ERROR",
        err,
      },
      "stream consume error",
    );

    const entry = JSON.parse(lines.join(""));
    expect(entry).toMatchObject({
      event: "STREAM_CONSUME_ERROR",
      msg: "stream consume error",
      err: {
        type: "Error",
        message: "redis down",
        stack: expect.stringContaining("consumeLoop"),
      },
    });
  });
});
