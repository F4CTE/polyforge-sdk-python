import { describe, it, expect } from "vitest";
import { JournalController } from "./journal.controller";

describe("JournalController — guard metadata", () => {
  it("list method is defined", () => {
    expect(JournalController.prototype.list).toBeDefined();
  });

  it("controller has UseGuards decorator for JwtAuthGuard", () => {
    const guards: unknown = Reflect.getMetadata(
      "__guards__",
      JournalController,
    );
    expect(guards).toBeDefined();
    expect(Array.isArray(guards)).toBe(true);
  });

  it("controller is decorated with Controller('journal') path", () => {
    const path: unknown = Reflect.getMetadata("path", JournalController);
    expect(path).toBe("journal");
  });

  it("list method uses GET http method", () => {
    const method: unknown = Reflect.getMetadata(
      "method",
      JournalController.prototype.list,
    );
    expect(method).toBeDefined();
  });
});
