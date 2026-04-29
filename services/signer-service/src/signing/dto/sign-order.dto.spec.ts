import { describe, expect, it, vi, afterEach } from "vitest";
import { validate } from "class-validator";
import { SignOrderDto } from "./sign-order.dto";

const BASE_DTO = {
  userId: "user-1",
  requestId: "req-1",
  tokenId: "token-1",
  side: "BUY" as const,
  size: 10,
  price: 0.5,
  orderType: "GTC" as const,
};

async function validateDto(overrides: Partial<SignOrderDto>) {
  const dto = Object.assign(new SignOrderDto(), BASE_DTO, overrides);
  return validate(dto);
}

describe("SignOrderDto orderType/expiration validation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts GTC without expiration", async () => {
    await expect(validateDto({ orderType: "GTC" })).resolves.toHaveLength(0);
  });

  it("rejects GTD without expiration", async () => {
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    const errors = await validateDto({ orderType: "GTD" });

    expect(errors.map((error) => error.constraints)).toContainEqual(
      expect.objectContaining({
        orderTypeExpirationRule:
          "GTD orders require expiration as a future Unix epoch (at least 30s ahead)",
      }),
    );
  });

  it("rejects GTD with a past expiration", async () => {
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    const errors = await validateDto({
      orderType: "GTD",
      expiration: 1_700_000_000,
    });

    expect(errors.map((error) => error.constraints)).toContainEqual(
      expect.objectContaining({
        orderTypeExpirationRule:
          "GTD orders require expiration as a future Unix epoch (at least 30s ahead)",
      }),
    );
  });

  it("rejects FOK with non-zero expiration", async () => {
    const errors = await validateDto({
      orderType: "FOK",
      expiration: 1_800_000_000,
    });

    expect(errors.map((error) => error.constraints)).toContainEqual(
      expect.objectContaining({
        orderTypeExpirationRule:
          "FOK orders must have expiration = 0 or undefined",
      }),
    );
  });
});
