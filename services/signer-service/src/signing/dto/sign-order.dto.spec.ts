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
          "Choose an expiration time at least 30 seconds in the future.",
      }),
    );
  });

  it("accepts GTD with a future expiration", async () => {
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    await expect(
      validateDto({
        orderType: "GTD",
        expiration: Math.floor(Date.now() / 1000) + 60,
      }),
    ).resolves.toHaveLength(0);
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
          "Choose an expiration time at least 30 seconds in the future.",
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
          "Remove the expiration time for this order type.",
      }),
    );
  });

  it("does not expose protocol terms in expiration validation messages", async () => {
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    const errors = await validateDto({ orderType: "GTD" });

    expect(JSON.stringify(errors.map((error) => error.constraints))).not.toMatch(
      /GTD|GTC|FOK|FAK|Unix epoch|expiration\s*=\s*0|undefined|now\+30s/i,
    );
  });
});

describe("SignOrderDto price bounds", () => {
  it("accepts price = 0 (probability lower bound)", async () => {
    await expect(validateDto({ price: 0 })).resolves.toHaveLength(0);
  });

  it("accepts price = 1 (probability upper bound)", async () => {
    await expect(validateDto({ price: 1 })).resolves.toHaveLength(0);
  });

  it("accepts mid-range price (0 < price < 1)", async () => {
    await expect(validateDto({ price: 0.42 })).resolves.toHaveLength(0);
  });

  it("rejects price > 1", async () => {
    const errors = await validateDto({ price: 1.0001 });
    expect(errors.map((error) => error.constraints)).toContainEqual(
      expect.objectContaining({
        max: "Price must be <= 1 (Polymarket probability upper bound)",
      }),
    );
  });

  it("rejects price = 999 (issue example)", async () => {
    const errors = await validateDto({ price: 999 });
    expect(errors.map((error) => error.constraints)).toContainEqual(
      expect.objectContaining({
        max: "Price must be <= 1 (Polymarket probability upper bound)",
      }),
    );
  });

  it("rejects negative price", async () => {
    const errors = await validateDto({ price: -0.01 });
    expect(errors.map((error) => error.constraints)).toContainEqual(
      expect.objectContaining({
        min: "Price must be >= 0 (Polymarket probability lower bound)",
      }),
    );
  });
});
