"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ai_service_1 = require("./ai.service");
const mock_db_1 = require("../../test/helpers/mock-db");
// ─── Suite ──────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("AiService", () => {
    let service;
    let db;
    (0, vitest_1.beforeEach)(() => {
        db = (0, mock_db_1.createMockDb)();
        service = new ai_service_1.AiService(db);
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    // ── Intent matching ─────────────────────────────────────────────────────────
    (0, vitest_1.describe)("intent matching", () => {
        (0, vitest_1.it)('matches "my strategies" to list_strategies intent', async () => {
            db.strategy.findMany.mockResolvedValue([]);
            const result = await service.query("user-1", "show me my strategies");
            (0, vitest_1.expect)(result.intent).toBe("list_strategies");
        });
        (0, vitest_1.it)('matches "portfolio" to get_portfolio intent', async () => {
            db.position.findMany.mockResolvedValue([]);
            const result = await service.query("user-1", "what is my portfolio?");
            (0, vitest_1.expect)(result.intent).toBe("get_portfolio");
        });
        (0, vitest_1.it)('matches "whale" to get_whale_feed intent', async () => {
            db.whaleAlert.findMany.mockResolvedValue([]);
            const result = await service.query("user-1", "show me whale activity");
            (0, vitest_1.expect)(result.intent).toBe("get_whale_feed");
        });
        (0, vitest_1.it)('matches "news signals" to get_news_signals intent', async () => {
            db.newsSignal.findMany.mockResolvedValue([]);
            const result = await service.query("user-1", "what are the latest news signals?");
            (0, vitest_1.expect)(result.intent).toBe("get_news_signals");
        });
    });
    // ── Summary generation ──────────────────────────────────────────────────────
    (0, vitest_1.describe)("summary generation", () => {
        (0, vitest_1.it)("returns a summary string with data count", async () => {
            db.strategy.findMany.mockResolvedValue([
                { id: "1", name: "Momentum", status: "RUNNING", createdAt: new Date() },
                { id: "2", name: "Mean Rev", status: "IDLE", createdAt: new Date() },
            ]);
            const result = await service.query("user-1", "my strategies");
            (0, vitest_1.expect)(result.summary).toContain("2");
            (0, vitest_1.expect)(result.summary).toContain("strategies");
            (0, vitest_1.expect)(result.data).toHaveLength(2);
        });
    });
    // ── Unknown intent ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)("unknown intent", () => {
        (0, vitest_1.it)('returns "unknown" intent for unmatched queries', async () => {
            const result = await service.query("user-1", "xyzzy foobar gibberish");
            (0, vitest_1.expect)(result.intent).toBe("unknown");
            (0, vitest_1.expect)(result.data).toBeNull();
            (0, vitest_1.expect)(result.summary).toContain("didn't understand");
        });
    });
    // ── Error handling ──────────────────────────────────────────────────────────
    (0, vitest_1.describe)("error handling", () => {
        (0, vitest_1.it)("returns an error summary when a handler throws", async () => {
            db.strategy.findMany.mockRejectedValue(new Error("DB unavailable"));
            const result = await service.query("user-1", "my strategies");
            (0, vitest_1.expect)(result.intent).toBe("list_strategies");
            (0, vitest_1.expect)(result.summary).toContain("error");
        });
    });
});
//# sourceMappingURL=ai.service.spec.js.map