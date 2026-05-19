import { describe, expect, it } from "vitest";
import { createCorsOriginDelegate, getAllowedCorsOrigins } from "./cors-origin";

describe("createCorsOriginDelegate", () => {
  it("allows configured origins", () => {
    const delegate = createCorsOriginDelegate({
      configuredOrigins:
        "https://app.polyforge.test, https://admin.polyforge.test",
      includeDevOrigins: false,
    });
    const callbackCalls: Array<[Error | null, boolean]> = [];

    delegate("https://admin.polyforge.test", (error, allowed) => {
      callbackCalls.push([error, allowed]);
    });

    expect(callbackCalls).toEqual([[null, true]]);
  });

  it("rejects disallowed origins with an error", () => {
    const delegate = createCorsOriginDelegate({
      configuredOrigins: "https://app.polyforge.test",
      includeDevOrigins: false,
    });
    const blockedOrigin = "https://evil.example";
    const callbackCalls: Array<[Error | null, boolean]> = [];

    delegate(blockedOrigin, (error, allowed) => {
      callbackCalls.push([error, allowed]);
    });

    expect(callbackCalls).toEqual([
      [new Error("CORS: origin not allowed"), false],
    ]);
  });

  it("silently rejects originless requests", () => {
    const delegate = createCorsOriginDelegate({
      configuredOrigins: "https://app.polyforge.test",
      includeDevOrigins: false,
    });
    const callbackCalls: Array<[Error | null, boolean]> = [];

    delegate(undefined, (error, allowed) => {
      callbackCalls.push([error, allowed]);
    });

    expect(callbackCalls).toEqual([[null, false]]);
  });

  it("rejects disallowed origins with custom dev origins (regression: admin-api path)", () => {
    const delegate = createCorsOriginDelegate({
      configuredOrigins: "https://admin.polyforge.test",
      includeDevOrigins: true,
      devOrigins: ["http://localhost:4300", "http://localhost:8080"] as const,
    });
    const blockedOrigin = "https://attacker.example";
    const callbackCalls: Array<[Error | null, boolean]> = [];

    delegate(blockedOrigin, (error, allowed) => {
      callbackCalls.push([error, allowed]);
    });

    expect(callbackCalls).toEqual([
      [new Error("CORS: origin not allowed"), false],
    ]);
  });
});

describe("getAllowedCorsOrigins", () => {
  it("trims configured origins and ignores empty entries", () => {
    expect(
      getAllowedCorsOrigins({
        configuredOrigins:
          " https://app.polyforge.test, ,https://admin.polyforge.test ",
        includeDevOrigins: false,
      }),
    ).toEqual(["https://app.polyforge.test", "https://admin.polyforge.test"]);
  });

  it("includes caller-provided dev origins only when requested", () => {
    const options = {
      configuredOrigins: "https://app.polyforge.test",
      devOrigins: ["http://localhost:4300"],
    };

    expect(
      getAllowedCorsOrigins({ ...options, includeDevOrigins: true }),
    ).toEqual(["https://app.polyforge.test", "http://localhost:4300"]);
    expect(
      getAllowedCorsOrigins({ ...options, includeDevOrigins: false }),
    ).toEqual(["https://app.polyforge.test"]);
  });
});
