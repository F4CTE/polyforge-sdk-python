import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { validateBlockConfigs, BlockLike } from "./block-config.validator";

function block(type: string, config?: Record<string, unknown>): BlockLike {
  return { type, config };
}

describe("validateBlockConfigs", () => {
  it("passes blocks without pct config", () => {
    expect(() =>
      validateBlockConfigs([block("set_stop_loss", {})]),
    ).not.toThrow();
    expect(() =>
      validateBlockConfigs([block("take_profit", {})]),
    ).not.toThrow();
  });

  it("passes non-pct-validated block types", () => {
    expect(() =>
      validateBlockConfigs([block("BUY", { pct: "0" })]),
    ).not.toThrow();
    expect(() =>
      validateBlockConfigs([block("PRICE_ABOVE", { pct: "-1" })]),
    ).not.toThrow();
  });

  it("passes valid pct values", () => {
    expect(() =>
      validateBlockConfigs([block("set_stop_loss", { pct: "0.1" })]),
    ).not.toThrow();
    expect(() =>
      validateBlockConfigs([block("take_profit", { pct: "0.2" })]),
    ).not.toThrow();
    expect(() =>
      validateBlockConfigs([block("set_stop_loss", { pct: 0.05 })]),
    ).not.toThrow();
    expect(() =>
      validateBlockConfigs([block("take_profit", { pct: 0.5 })]),
    ).not.toThrow();
  });

  it("rejects pct <= 0 for set_stop_loss", () => {
    expect(() =>
      validateBlockConfigs([block("set_stop_loss", { pct: "0" })]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateBlockConfigs([block("set_stop_loss", { pct: 0 })]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateBlockConfigs([block("set_stop_loss", { pct: "-0.1" })]),
    ).toThrow(BadRequestException);
  });

  it("rejects pct >= 1 for take_profit", () => {
    expect(() =>
      validateBlockConfigs([block("take_profit", { pct: "1" })]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateBlockConfigs([block("take_profit", { pct: 1.0 })]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateBlockConfigs([block("take_profit", { pct: "1.5" })]),
    ).toThrow(BadRequestException);
  });

  it("rejects non-numeric pct", () => {
    expect(() =>
      validateBlockConfigs([block("set_stop_loss", { pct: "abc" })]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateBlockConfigs([block("take_profit", { pct: null })]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateBlockConfigs([block("take_profit", { pct: undefined })]),
    ).not.toThrow();
  });

  it("returns INVALID_BLOCK_CONFIG error code", () => {
    try {
      validateBlockConfigs([block("set_stop_loss", { pct: "0" })]);
      expect.fail("Expected BadRequestException");
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response).toBeDefined();
      expect(err.response.code).toBe("INVALID_BLOCK_CONFIG");
      expect(err.response.blockType).toBe("set_stop_loss");
    }
  });

  it("handles uppercase block types (import flow)", () => {
    expect(() =>
      validateBlockConfigs([block("SET_STOP_LOSS", { pct: "0.15" })]),
    ).not.toThrow();
    expect(() =>
      validateBlockConfigs([block("TAKE_PROFIT", { pct: "0.25" })]),
    ).not.toThrow();
    expect(() =>
      validateBlockConfigs([block("SET_STOP_LOSS", { pct: "0" })]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateBlockConfigs([block("SET_TAKE_PROFIT", { pct: "1.0" })]),
    ).toThrow(BadRequestException);
  });

  it("validates mixed blocks in array", () => {
    const blocks: BlockLike[] = [
      block("BUY", { size: "10" }),
      block("set_stop_loss", { pct: "0.1" }),
      block("PRICE_ABOVE", { threshold: "0.5" }),
      block("take_profit", { pct: "0.2" }),
      block("SELL", { size: "5" }),
    ];
    expect(() => validateBlockConfigs(blocks)).not.toThrow();
  });

  it("throws on first invalid block in mixed array", () => {
    const blocks: BlockLike[] = [
      block("BUY", { size: "10" }),
      block("set_stop_loss", { pct: "-0.5" }),
      block("take_profit", { pct: "0.2" }),
    ];
    expect(() => validateBlockConfigs(blocks)).toThrow(BadRequestException);
  });

  it("handles empty blocks array", () => {
    expect(() => validateBlockConfigs([])).not.toThrow();
  });
});
