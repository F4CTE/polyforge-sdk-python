import { afterEach, describe, expect, it, vi } from "vitest";

const initMock = vi.fn();

vi.mock("@sentry/nestjs", () => ({
  init: initMock,
}));

describe("signer-service Sentry instrumentation", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
  });

  it("scrubs request body data before sending events", async () => {
    process.env.SENTRY_DSN = "https://public@example.invalid/1";
    await import("./instrument.js");

    const options = initMock.mock.calls[0][0];
    const event = {
      request: {
        data: {
          privateKey: "0x" + "a".repeat(64),
          apiKey: "api-key",
        },
      },
    };

    const scrubbed = options.beforeSend(event);

    expect(scrubbed.request.data).toBeUndefined();
    expect(JSON.stringify(scrubbed)).not.toContain("0x" + "a".repeat(64));
    expect(JSON.stringify(scrubbed)).not.toContain("api-key");
  });
});
