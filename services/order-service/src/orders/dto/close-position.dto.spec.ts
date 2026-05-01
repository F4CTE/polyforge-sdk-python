import { describe, expect, it } from "vitest";
import { validate } from "class-validator";
import { ClosePositionDto } from "./close-position.dto";

const BASE_DTO = {
  userId: "user-1",
  tokenId: "token-1",
  marketId: "market-1",
  size: "10",
};

async function validateDto(overrides: Partial<ClosePositionDto>) {
  const dto = Object.assign(new ClosePositionDto(), BASE_DTO, overrides);
  return validate(dto);
}

function sizeConstraintsFor(errors: Awaited<ReturnType<typeof validateDto>>) {
  return errors.find((error) => error.property === "size")?.constraints ?? {};
}

describe("ClosePositionDto.size validation", () => {
  it("accepts a plain integer string", async () => {
    await expect(validateDto({ size: "10" })).resolves.toHaveLength(0);
  });

  it("accepts a decimal string", async () => {
    await expect(validateDto({ size: "10.5" })).resolves.toHaveLength(0);
  });

  it("accepts a leading-zero decimal", async () => {
    await expect(validateDto({ size: "0.0000000001" })).resolves.toHaveLength(
      0,
    );
  });

  it("rejects a negative size string", async () => {
    const errors = await validateDto({ size: "-100" });
    expect(sizeConstraintsFor(errors)).toHaveProperty("matches");
  });

  it("rejects scientific notation", async () => {
    const errors = await validateDto({ size: "1e10" });
    expect(sizeConstraintsFor(errors)).toHaveProperty("matches");
  });

  it("rejects hex literal", async () => {
    const errors = await validateDto({ size: "0x10" });
    expect(sizeConstraintsFor(errors)).toHaveProperty("matches");
  });

  it("rejects NaN literal", async () => {
    const errors = await validateDto({ size: "NaN" });
    expect(sizeConstraintsFor(errors)).toHaveProperty("matches");
  });

  it("rejects Infinity literal", async () => {
    const errors = await validateDto({ size: "Infinity" });
    expect(sizeConstraintsFor(errors)).toHaveProperty("matches");
  });

  it("rejects an empty string", async () => {
    const errors = await validateDto({ size: "" });
    expect(sizeConstraintsFor(errors)).toHaveProperty("isNotEmpty");
  });

  it("rejects whitespace padding", async () => {
    const errors = await validateDto({ size: " 10 " });
    expect(sizeConstraintsFor(errors)).toHaveProperty("matches");
  });

  it("rejects a 31-character size string (over MaxLength)", async () => {
    const errors = await validateDto({ size: "1".repeat(31) });
    expect(sizeConstraintsFor(errors)).toHaveProperty("maxLength");
  });

  it("accepts a 30-character size string (at MaxLength boundary)", async () => {
    await expect(validateDto({ size: "1".repeat(30) })).resolves.toHaveLength(
      0,
    );
  });
});
