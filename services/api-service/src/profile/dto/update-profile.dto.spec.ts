import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { UpdateProfileDto } from "./update-profile.dto";

describe("UpdateProfileDto avatarUrl validation", () => {
  it("accepts a valid https URL", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      avatarUrl: "https://cdn.example.com/avatar.png",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects a data: URI", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      avatarUrl: "data:image/svg+xml,<svg></svg>",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "avatarUrl")).toBe(true);
  });

  it("rejects an http URL", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      avatarUrl: "http://example.com/avatar.png",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "avatarUrl")).toBe(true);
  });

  it("rejects a javascript: URI", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      avatarUrl: "javascript:alert(1)",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "avatarUrl")).toBe(true);
  });
});
