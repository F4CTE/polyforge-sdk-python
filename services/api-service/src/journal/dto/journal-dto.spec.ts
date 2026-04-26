import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CreateJournalEntryDto } from "./create-journal-entry.dto";
import { UpdateJournalEntryDto } from "./update-journal-entry.dto";

describe("CreateJournalEntryDto tags validation", () => {
  it("accepts tags within bounds", async () => {
    const dto = plainToInstance(CreateJournalEntryDto, {
      orderId: "abc-123",
      tags: ["momentum", "scalp"],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects more than 20 tags", async () => {
    const dto = plainToInstance(CreateJournalEntryDto, {
      orderId: "abc-123",
      tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "tags")).toBe(true);
  });

  it("rejects a tag longer than 50 characters", async () => {
    const dto = plainToInstance(CreateJournalEntryDto, {
      orderId: "abc-123",
      tags: ["a".repeat(51)],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "tags")).toBe(true);
  });
});

describe("UpdateJournalEntryDto tags validation", () => {
  it("rejects more than 20 tags", async () => {
    const dto = plainToInstance(UpdateJournalEntryDto, {
      tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "tags")).toBe(true);
  });

  it("rejects a tag longer than 50 characters", async () => {
    const dto = plainToInstance(UpdateJournalEntryDto, {
      tags: ["a".repeat(51)],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "tags")).toBe(true);
  });
});
