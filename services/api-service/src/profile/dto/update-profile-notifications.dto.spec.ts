import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { UpdateProfileNotificationsDto } from "./update-profile-notifications.dto";

describe("UpdateProfileNotificationsDto validation", () => {
  it("accepts valid boolean fields", async () => {
    const dto = plainToInstance(UpdateProfileNotificationsDto, {
      emailEnabled: true,
      onOrderFilled: false,
      onStrategyError: true,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects non-boolean values", async () => {
    const dto = plainToInstance(UpdateProfileNotificationsDto, {
      emailEnabled: "true",
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("emailEnabled");
  });

  it("rejects unknown fields via whitelist", async () => {
    const dto = plainToInstance(UpdateProfileNotificationsDto, {
      emailEnabled: true,
      __proto__: { polluted: true },
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.every((e) => e.property !== "__proto__")).toBe(true);
  });

  it("accepts empty object (all fields optional)", async () => {
    const dto = plainToInstance(UpdateProfileNotificationsDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
