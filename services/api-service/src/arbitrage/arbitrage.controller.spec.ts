import { describe, it, expect } from "vitest";
import { INTERCEPTORS_METADATA } from "@nestjs/common/constants";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { IdempotencyInterceptor } from "../common/interceptors/idempotency.interceptor";
import { ArbitrageController } from "./arbitrage.controller";
import { ExecuteArbDto } from "./dto/execute-arb.dto";

const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_TTL = "THROTTLER:TTL";
const API_PARAMETERS = "swagger/apiParameters";

function expectRequiredIdempotencyKey(method: object) {
  const interceptors: unknown[] =
    Reflect.getMetadata(INTERCEPTORS_METADATA, method) ?? [];
  const parameters: Array<Record<string, unknown>> =
    Reflect.getMetadata(API_PARAMETERS, method) ?? [];

  expect(interceptors).toContain(IdempotencyInterceptor);
  expect(parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        in: "header",
        name: "Idempotency-Key",
        required: true,
      }),
    ]),
  );
}

function expectThrottleApplied(method: object) {
  const limit: unknown = Reflect.getMetadata(
    `${THROTTLER_LIMIT}default`,
    method,
  );
  const ttl: unknown = Reflect.getMetadata(`${THROTTLER_TTL}default`, method);

  expect(limit, "@Throttle limit must be set").toBeDefined();
  expect(ttl, "@Throttle ttl must be set").toBeDefined();
  // ttl is the canonical 60s window across all mutating money routes
  expect(ttl).toBe(60_000);
}

describe("ArbitrageController — execute/close hardening (POLA-1911)", () => {
  describe("executeArb", () => {
    it("requires Idempotency-Key header (replay protection)", () => {
      expectRequiredIdempotencyKey(ArbitrageController.prototype.executeArb);
    });

    it("has IdempotencyInterceptor applied", () => {
      const interceptors: unknown[] =
        Reflect.getMetadata(
          INTERCEPTORS_METADATA,
          ArbitrageController.prototype.executeArb,
        ) ?? [];
      expect(interceptors).toContain(IdempotencyInterceptor);
    });

    it("has @Throttle applied (60_000ms window)", () => {
      expectThrottleApplied(ArbitrageController.prototype.executeArb);
    });
  });

  describe("closePosition", () => {
    it("requires Idempotency-Key header (replay protection)", () => {
      expectRequiredIdempotencyKey(ArbitrageController.prototype.closePosition);
    });

    it("has IdempotencyInterceptor applied", () => {
      const interceptors: unknown[] =
        Reflect.getMetadata(
          INTERCEPTORS_METADATA,
          ArbitrageController.prototype.closePosition,
        ) ?? [];
      expect(interceptors).toContain(IdempotencyInterceptor);
    });

    it("has @Throttle applied (60_000ms window)", () => {
      expectThrottleApplied(ArbitrageController.prototype.closePosition);
    });
  });
});

describe("ExecuteArbDto — UUID validation (POLA-1911)", () => {
  it("rejects a non-UUID matchId", async () => {
    const dto = plainToInstance(ExecuteArbDto, {
      matchId: "not-a-uuid",
      size: 100,
    });
    const errors = await validate(dto);
    const matchIdError = errors.find((e) => e.property === "matchId");
    expect(matchIdError).toBeDefined();
    expect(Object.keys(matchIdError!.constraints ?? {})).toContain("isUuid");
  });

  it("accepts a valid UUID v4 matchId", async () => {
    const dto = plainToInstance(ExecuteArbDto, {
      matchId: "11111111-2222-4333-8444-555555555555",
      size: 100,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === "matchId")).toBeUndefined();
  });

  it("rejects empty matchId", async () => {
    const dto = plainToInstance(ExecuteArbDto, {
      matchId: "",
      size: 100,
    });
    const errors = await validate(dto);
    const matchIdError = errors.find((e) => e.property === "matchId");
    expect(matchIdError).toBeDefined();
  });
});
