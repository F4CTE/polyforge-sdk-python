import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { LlmService } from "./llm.service";

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
      let callCount = 0;
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        callCount++;
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

  // ── All providers fail ────────────────────────────────────────────────

  describe("all providers fail", () => {
    it("throws when both Claude and OpenAI fail", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
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
});
