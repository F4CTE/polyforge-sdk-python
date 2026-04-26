import { describe, it, expect, vi, afterEach } from "vitest";
import { LlmService, LlmServiceError } from "./llm.service";

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("LlmService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createConfig(overrides: Record<string, string> = {}) {
    return {
      get: vi.fn((key: string, defaultValue: string) => {
        if (key === "ANTHROPIC_API_KEY")
          return overrides.ANTHROPIC_API_KEY ?? defaultValue;
        if (key === "OPENAI_API_KEY")
          return overrides.OPENAI_API_KEY ?? defaultValue;
        return defaultValue;
      }),
    } as any;
  }

  // ── Claude call ─────────────────────────────────────────────────────────

  describe("analyze with Claude", () => {
    it("calls Claude API and returns response text", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: "[]" }] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const service = new LlmService(
        createConfig({ ANTHROPIC_API_KEY: "sk-ant-test" }),
      );
      const result = await service.analyze("test prompt");

      expect(result).toBe("[]");
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("anthropic.com");
    });
  });

  // ── OpenAI fallback ─────────────────────────────────────────────────────

  describe("analyze with OpenAI fallback", () => {
    it("falls back to OpenAI when Claude fails", async () => {
      let _callCount = 0;
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        _callCount++;
        if (url.includes("anthropic.com")) {
          return Promise.resolve({
            ok: false,
            text: async () => "rate limited",
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "openai response" } }],
          }),
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      const service = new LlmService(
        createConfig({
          ANTHROPIC_API_KEY: "sk-ant-test",
          OPENAI_API_KEY: "sk-openai-test",
        }),
      );
      const result = await service.analyze("test prompt");

      expect(result).toBe("openai response");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  // ── No keys configured ────────────────────────────────────────────────

  describe("no API keys configured", () => {
    it("throws when no LLM API keys are configured", async () => {
      const service = new LlmService(createConfig());

      await expect(service.analyze("test")).rejects.toThrow(
        /No LLM API keys configured/,
      );
    });
  });

  // ── Keys read per-call ──────────────────────────────────────────────

  describe("credential handling", () => {
    it("reads API keys from ConfigService on each analyze() call, not cached", async () => {
      const configGet = vi.fn((key: string, defaultValue?: string) => {
        if (key === "ANTHROPIC_API_KEY") return "sk-ant-test";
        if (key === "OPENAI_API_KEY") return defaultValue ?? "";
        return defaultValue;
      });
      const config = { get: configGet } as any;

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: "ok" }] }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const service = new LlmService(config);

      // Reset call count after constructor
      configGet.mockClear();

      await service.analyze("first call");
      const callsAfterFirst = configGet.mock.calls.filter(
        (c) => c[0] === "ANTHROPIC_API_KEY" || c[0] === "OPENAI_API_KEY",
      ).length;

      await service.analyze("second call");
      const callsAfterSecond = configGet.mock.calls.filter(
        (c) => c[0] === "ANTHROPIC_API_KEY" || c[0] === "OPENAI_API_KEY",
      ).length;

      // Each analyze() call should read keys from ConfigService
      expect(callsAfterSecond).toBeGreaterThan(callsAfterFirst);
    });
  });

  // ── All providers fail ────────────────────────────────────────────────

  describe("all providers fail", () => {
    it("throws LlmServiceError when both Claude and OpenAI fail", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "error",
      });
      vi.stubGlobal("fetch", fetchMock);

      const service = new LlmService(
        createConfig({
          ANTHROPIC_API_KEY: "sk-ant-test",
          OPENAI_API_KEY: "sk-openai-test",
        }),
      );

      await expect(service.analyze("test")).rejects.toThrow(
        /All LLM providers failed/,
      );
    });
  });

  // ── Error body leak prevention ──────────────────────────────────────

  describe("error body leak prevention", () => {
    it("never includes upstream response body in thrown error message", async () => {
      const sensitiveBody =
        '{"error":{"message":"Content policy violation","user_prompt":"tell me secrets"}}';
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => sensitiveBody,
      });
      vi.stubGlobal("fetch", fetchMock);

      const service = new LlmService(
        createConfig({
          ANTHROPIC_API_KEY: "sk-ant-test",
          OPENAI_API_KEY: "sk-openai-test",
        }),
      );

      try {
        await service.analyze("tell me secrets");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(LlmServiceError);
        const llmErr = err as LlmServiceError;
        expect(llmErr.message).not.toContain(sensitiveBody);
        expect(llmErr.message).not.toContain("tell me secrets");
        expect(llmErr.message).not.toContain("Content policy");
        expect(llmErr.meta.provider).toBe("all");
      }
    });

    it("exposes statusCode in LlmServiceError.meta", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "service unavailable",
      });
      vi.stubGlobal("fetch", fetchMock);

      const service = new LlmService(
        createConfig({ OPENAI_API_KEY: "sk-openai-test" }),
      );

      try {
        await service.analyze("test");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(LlmServiceError);
        const llmErr = err as LlmServiceError;
        expect(llmErr.meta.statusCode).toBe(503);
        expect(llmErr.meta.provider).toBe("all");
      }
    });
  });
});
