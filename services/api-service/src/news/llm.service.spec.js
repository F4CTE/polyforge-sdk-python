"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const llm_service_1 = require("./llm.service");
// ─── Suite ──────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("LlmService", () => {
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.unstubAllGlobals();
    });
    function createConfig(overrides = {}) {
        return {
            get: vitest_1.vi.fn((key, defaultValue) => {
                if (key === "ANTHROPIC_API_KEY")
                    return overrides.ANTHROPIC_API_KEY ?? defaultValue;
                if (key === "OPENAI_API_KEY")
                    return overrides.OPENAI_API_KEY ?? defaultValue;
                return defaultValue;
            }),
        };
    }
    // ── Claude call ─────────────────────────────────────────────────────────
    (0, vitest_1.describe)("analyze with Claude", () => {
        (0, vitest_1.it)("calls Claude API and returns response text", async () => {
            const fetchMock = vitest_1.vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ content: [{ text: "[]" }] }),
            });
            vitest_1.vi.stubGlobal("fetch", fetchMock);
            const service = new llm_service_1.LlmService(createConfig({ ANTHROPIC_API_KEY: "sk-ant-test" }));
            const result = await service.analyze("test prompt");
            (0, vitest_1.expect)(result).toBe("[]");
            (0, vitest_1.expect)(fetchMock).toHaveBeenCalledOnce();
            const [url] = fetchMock.mock.calls[0];
            (0, vitest_1.expect)(url).toContain("anthropic.com");
        });
    });
    // ── OpenAI fallback ─────────────────────────────────────────────────────
    (0, vitest_1.describe)("analyze with OpenAI fallback", () => {
        (0, vitest_1.it)("falls back to OpenAI when Claude fails", async () => {
            let callCount = 0;
            const fetchMock = vitest_1.vi.fn().mockImplementation((url) => {
                callCount++;
                if (url.includes("anthropic.com")) {
                    return Promise.resolve({ ok: false, text: async () => "rate limited" });
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ choices: [{ message: { content: "openai response" } }] }),
                });
            });
            vitest_1.vi.stubGlobal("fetch", fetchMock);
            const service = new llm_service_1.LlmService(createConfig({ ANTHROPIC_API_KEY: "sk-ant-test", OPENAI_API_KEY: "sk-openai-test" }));
            const result = await service.analyze("test prompt");
            (0, vitest_1.expect)(result).toBe("openai response");
            (0, vitest_1.expect)(fetchMock).toHaveBeenCalledTimes(2);
        });
    });
    // ── No keys configured ────────────────────────────────────────────────
    (0, vitest_1.describe)("no API keys configured", () => {
        (0, vitest_1.it)("throws when no LLM API keys are configured", async () => {
            const service = new llm_service_1.LlmService(createConfig());
            await (0, vitest_1.expect)(service.analyze("test")).rejects.toThrow(/No LLM API keys configured/);
        });
    });
    // ── All providers fail ────────────────────────────────────────────────
    (0, vitest_1.describe)("all providers fail", () => {
        (0, vitest_1.it)("throws when both Claude and OpenAI fail", async () => {
            const fetchMock = vitest_1.vi.fn().mockResolvedValue({
                ok: false,
                text: async () => "error",
            });
            vitest_1.vi.stubGlobal("fetch", fetchMock);
            const service = new llm_service_1.LlmService(createConfig({ ANTHROPIC_API_KEY: "sk-ant-test", OPENAI_API_KEY: "sk-openai-test" }));
            await (0, vitest_1.expect)(service.analyze("test")).rejects.toThrow(/All LLM providers failed/);
        });
    });
});
//# sourceMappingURL=llm.service.spec.js.map