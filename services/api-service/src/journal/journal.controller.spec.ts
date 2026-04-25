import { describe, it, expect } from "vitest";
import { JournalController } from "./journal.controller";

describe("JournalController — guard metadata", () => {
  it("list method is defined", () => {
    expect(JournalController.prototype.list).toBeDefined();
  });

  it("create method is defined", () => {
    expect(JournalController.prototype.create).toBeDefined();
  });

  it("update method is defined", () => {
    expect(JournalController.prototype.update).toBeDefined();
  });

  it("remove method is defined and has HttpCode metadata", () => {
    const method = JournalController.prototype.remove;
    expect(method).toBeDefined();
    const statusCode: unknown = Reflect.getMetadata("__httpCode__", method);
    expect(statusCode).toBe(204);
  });
});
