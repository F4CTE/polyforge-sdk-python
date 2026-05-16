import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const TEST_SECRET = "a]3Fk9$mP!xR7vQ2wL8nJ4cY6bT0uH5s";

describe("JwtStrategy", () => {
  let JwtStrategy: any;

  beforeEach(async () => {
    process.env.USER_JWT_SECRET = TEST_SECRET;
    vi.resetModules();
    const mod = await import("./jwt.strategy");
    JwtStrategy = mod.JwtStrategy;
  });

  afterEach(() => {
    process.env.USER_JWT_SECRET = TEST_SECRET;
  });

  it("can be instantiated with a valid secret", () => {
    expect(() => new JwtStrategy()).not.toThrow();
  });

  it("throws when USER_JWT_SECRET is not set", async () => {
    delete process.env.USER_JWT_SECRET;
    vi.resetModules();
    const mod = await import("./jwt.strategy");
    expect(() => new mod.JwtStrategy()).toThrow(
      "USER_JWT_SECRET environment variable is required",
    );
  });

  it("throws when USER_JWT_SECRET is shorter than 32 characters", async () => {
    process.env.USER_JWT_SECRET = "tooshort";
    vi.resetModules();
    const mod = await import("./jwt.strategy");
    expect(() => new mod.JwtStrategy()).toThrow(
      "USER_JWT_SECRET environment variable is required",
    );
  });

  it("validate() returns the payload as-is", () => {
    const strategy = new JwtStrategy();
    const payload = { sub: "user-1", username: "user" };
    expect(strategy.validate(payload)).toEqual(payload);
  });
});
