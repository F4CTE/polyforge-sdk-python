"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const signal_generator_service_1 = require("./signal-generator.service");
// ─── Mocks ──────────────────────────────────────────────────────────────────
function createMockPrisma() {
    return {
        market: { findMany: vitest_1.vi.fn() },
        newsSignal: { create: vitest_1.vi.fn() },
    };
}
function createMockRedis() {
    return {
        xadd: vitest_1.vi.fn().mockResolvedValue("stream-id"),
    };
}
function createMockLlm() {
    return {
        analyze: vitest_1.vi.fn(),
    };
}
// ─── Suite ──────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("SignalGeneratorService", () => {
    let service;
    let prisma;
    let redis;
    let llm;
    (0, vitest_1.beforeEach)(() => {
        prisma = createMockPrisma();
        redis = createMockRedis();
        llm = createMockLlm();
        service = new signal_generator_service_1.SignalGeneratorService(prisma, redis, llm);
    });
    // ── buildPrompt ─────────────────────────────────────────────────────────
    (0, vitest_1.describe)("buildPrompt", () => {
        (0, vitest_1.it)("includes the article title and summary in the prompt", () => {
            const prompt = service.buildPrompt({ title: "Election update", summary: "Big changes ahead" }, [{ id: "m1", title: "Will X win?", slug: "x-win", category: "politics" }]);
            (0, vitest_1.expect)(prompt).toContain("Election update");
            (0, vitest_1.expect)(prompt).toContain("Big changes ahead");
        });
        (0, vitest_1.it)("includes market IDs and titles in the prompt", () => {
            const prompt = service.buildPrompt({ title: "Test", summary: null }, [
                { id: "m1", title: "Market A", slug: "a", category: null },
                { id: "m2", title: "Market B", slug: "b", category: null },
            ]);
            (0, vitest_1.expect)(prompt).toContain("m1");
            (0, vitest_1.expect)(prompt).toContain("Market A");
            (0, vitest_1.expect)(prompt).toContain("m2");
            (0, vitest_1.expect)(prompt).toContain("Market B");
        });
        (0, vitest_1.it)('uses "No summary available." when summary is null', () => {
            const prompt = service.buildPrompt({ title: "Test", summary: null }, []);
            (0, vitest_1.expect)(prompt).toContain("No summary available.");
        });
    });
    // ── parseResponse ───────────────────────────────────────────────────────
    (0, vitest_1.describe)("parseResponse", () => {
        (0, vitest_1.it)("parses valid JSON array of signals", () => {
            const raw = JSON.stringify([
                { marketId: "m1", direction: "BUY", outcome: "YES", confidence: 80, reasoning: "test" },
            ]);
            const result = service.parseResponse(raw);
            (0, vitest_1.expect)(result).toHaveLength(1);
            (0, vitest_1.expect)(result[0]).toMatchObject({
                marketId: "m1",
                direction: "BUY",
                outcome: "YES",
                confidence: 80,
            });
        });
        (0, vitest_1.it)("handles markdown code blocks wrapping JSON", () => {
            const raw = '```json\n[{"marketId":"m1","direction":"SELL","outcome":"NO","confidence":60,"reasoning":"r"}]\n```';
            const result = service.parseResponse(raw);
            (0, vitest_1.expect)(result).toHaveLength(1);
            (0, vitest_1.expect)(result[0].direction).toBe("SELL");
        });
        (0, vitest_1.it)("filters out signals with invalid direction", () => {
            const raw = JSON.stringify([
                { marketId: "m1", direction: "HOLD", outcome: "YES", confidence: 50 },
            ]);
            const result = service.parseResponse(raw);
            (0, vitest_1.expect)(result).toHaveLength(0);
        });
        (0, vitest_1.it)("returns empty array for malformed JSON", () => {
            const result = service.parseResponse("not json at all");
            (0, vitest_1.expect)(result).toEqual([]);
        });
        (0, vitest_1.it)("filters out signals with confidence outside 1-100 range", () => {
            const raw = JSON.stringify([
                { marketId: "m1", direction: "BUY", outcome: "YES", confidence: 0 },
                { marketId: "m2", direction: "BUY", outcome: "YES", confidence: 101 },
            ]);
            const result = service.parseResponse(raw);
            (0, vitest_1.expect)(result).toHaveLength(0);
        });
    });
    // ── generateSignals ─────────────────────────────────────────────────────
    (0, vitest_1.describe)("generateSignals", () => {
        (0, vitest_1.it)("skips when no active markets exist", async () => {
            prisma.market.findMany.mockResolvedValue([]);
            await service.generateSignals({ id: "a1", title: "Test", summary: null });
            (0, vitest_1.expect)(llm.analyze).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("rejects signals with confidence > 95 as suspicious", async () => {
            prisma.market.findMany.mockResolvedValue([
                { id: "m1", title: "Market", slug: "m", category: null },
            ]);
            llm.analyze.mockResolvedValue(JSON.stringify([
                { marketId: "m1", direction: "BUY", outcome: "YES", confidence: 98, reasoning: "r" },
            ]));
            await service.generateSignals({ id: "a1", title: "Test", summary: null });
            (0, vitest_1.expect)(prisma.newsSignal.create).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("creates signal and emits to stream for high-confidence signals", async () => {
            prisma.market.findMany.mockResolvedValue([
                { id: "m1", title: "Market One", slug: "m1", category: null },
            ]);
            llm.analyze.mockResolvedValue(JSON.stringify([
                { marketId: "m1", direction: "BUY", outcome: "YES", confidence: 80, reasoning: "strong signal" },
            ]));
            prisma.newsSignal.create.mockResolvedValue({ id: "sig1" });
            await service.generateSignals({ id: "a1", title: "Test", summary: "Summary" });
            (0, vitest_1.expect)(prisma.newsSignal.create).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(redis.xadd).toHaveBeenCalledWith("stream:events", vitest_1.expect.objectContaining({
                type: "NEWS_SIGNAL",
                marketId: "m1",
                direction: "BUY",
            }));
        });
        (0, vitest_1.it)("skips signals referencing non-existent markets", async () => {
            prisma.market.findMany.mockResolvedValue([
                { id: "m1", title: "Market", slug: "m", category: null },
            ]);
            llm.analyze.mockResolvedValue(JSON.stringify([
                { marketId: "m999", direction: "BUY", outcome: "YES", confidence: 50, reasoning: "r" },
            ]));
            await service.generateSignals({ id: "a1", title: "Test", summary: null });
            (0, vitest_1.expect)(prisma.newsSignal.create).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=signal-generator.service.spec.js.map