"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var BatchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchService = void 0;
const common_1 = require("@nestjs/common");
let BatchService = BatchService_1 = class BatchService {
    logger = new common_1.Logger(BatchService_1.name);
    /**
     * Execute a batch of virtual requests against the local API,
     * forwarding the caller's auth token for each sub-request.
     */
    async executeBatch(items, authToken, port) {
        const results = await Promise.allSettled(items.map((item) => this.executeItem(item, authToken, port)));
        return results.map((result, idx) => {
            if (result.status === "fulfilled") {
                return result.value;
            }
            return {
                id: items[idx].id,
                status: 500,
                body: { error: "Internal batch execution error" },
            };
        });
    }
    async executeItem(item, authToken, port) {
        // SECURITY: Allow-list approach for batch paths + URL decode before validation
        const decodedPath = decodeURIComponent(item.path);
        const ALLOWED_PREFIXES = ["/api/v1/markets", "/api/v1/strategies", "/api/v1/orders", "/api/v1/portfolio", "/api/v1/whales", "/api/v1/copy", "/api/v1/news", "/api/v1/leaderboard", "/api/v1/discover", "/api/v1/scores", "/api/v1/profile", "/api/v1/settings"];
        const isAllowed = ALLOWED_PREFIXES.some((p) => decodedPath.startsWith(p));
        if (!isAllowed || decodedPath.includes("..") || decodedPath.includes("\\")) {
            return { id: item.id, status: 400, body: { error: "Invalid batch path" } };
        }
        const url = `http://127.0.0.1:${port}${item.path}`;
        const headers = {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
        };
        const init = {
            method: item.method,
            headers,
            signal: AbortSignal.timeout(15_000),
        };
        if (item.body && item.method !== "GET") {
            init.body = JSON.stringify(item.body);
        }
        try {
            const res = await fetch(url, init);
            let body;
            try {
                body = await res.json();
            }
            catch {
                body = null;
            }
            return { id: item.id, status: res.status, body };
        }
        catch (err) {
            this.logger.warn(`Batch item ${item.id} failed: ${item.method} ${item.path} — ${String(err)}`);
            return {
                id: item.id,
                status: 502,
                body: { error: "Upstream request failed" },
            };
        }
    }
};
exports.BatchService = BatchService;
exports.BatchService = BatchService = BatchService_1 = __decorate([
    (0, common_1.Injectable)()
], BatchService);
//# sourceMappingURL=batch.service.js.map