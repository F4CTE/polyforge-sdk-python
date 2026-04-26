import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { BadRequestException } from "@nestjs/common";

// Inline the pipe logic for unit testing without full NestJS DI
const MARKET_ID_PATTERN = /^[A-Za-z0-9_\-:.]{1,255}$/;

function validateMarketId(value: string): string {
  if (!MARKET_ID_PATTERN.test(value)) {
    throw new BadRequestException("Invalid marketId format");
  }
  return value;
}

describe("MarketIdPipe validation", () => {
  it("accepts a valid Kalshi ticker", () => {
    expect(validateMarketId("KXSPYWOMP-26APR26")).toBe("KXSPYWOMP-26APR26");
  });

  it("accepts a UUID-like market ID", () => {
    expect(
      validateMarketId("550e8400-e29b-41d4-a716-446655440000"),
    ).toBeDefined();
  });

  it("accepts a Polymarket condition ID with colons", () => {
    expect(validateMarketId("poly:0xabc123")).toBeDefined();
  });

  it("rejects an empty string", () => {
    expect(() => validateMarketId("")).toThrow(BadRequestException);
  });

  it("rejects a string longer than 255 chars", () => {
    expect(() => validateMarketId("a".repeat(256))).toThrow(
      BadRequestException,
    );
  });

  it("rejects path traversal characters", () => {
    expect(() => validateMarketId("../etc/passwd")).toThrow(
      BadRequestException,
    );
  });

  it("rejects URL-encoded characters", () => {
    expect(() => validateMarketId("market%00id")).toThrow(BadRequestException);
  });

  it("rejects spaces", () => {
    expect(() => validateMarketId("market id")).toThrow(BadRequestException);
  });
});
