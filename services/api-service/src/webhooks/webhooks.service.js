"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WebhooksService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const shared_db_1 = require("@polyforge/shared-db");
const MAX_WEBHOOKS_PER_USER = 10;
let WebhooksService = WebhooksService_1 = class WebhooksService {
    prisma;
    logger = new common_1.Logger(WebhooksService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, dto) {
        const count = await this.prisma.webhook.count({ where: { userId } });
        if (count >= MAX_WEBHOOKS_PER_USER) {
            throw new common_1.UnprocessableEntityException({
                code: "WEBHOOK_LIMIT_REACHED",
                message: `Maximum ${MAX_WEBHOOKS_PER_USER} webhooks per user`,
            });
        }
        const secret = (0, crypto_1.randomBytes)(32).toString("hex");
        const webhook = await this.prisma.webhook.create({
            data: {
                userId,
                url: dto.url,
                events: dto.events,
                secret,
                active: true,
            },
        });
        // Return secret only on creation — never again
        return {
            id: webhook.id,
            url: webhook.url,
            events: webhook.events,
            secret,
            active: webhook.active,
            createdAt: webhook.createdAt,
        };
    }
    async list(userId) {
        return this.prisma.webhook.findMany({
            where: { userId },
            select: {
                id: true,
                url: true,
                events: true,
                active: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async remove(id, userId) {
        const webhook = await this.prisma.webhook.findUnique({ where: { id } });
        if (!webhook) {
            throw new common_1.NotFoundException({ code: "NOT_FOUND", message: "Webhook not found" });
        }
        if (webhook.userId !== userId) {
            throw new common_1.ForbiddenException({ code: "FORBIDDEN", message: "Access denied" });
        }
        await this.prisma.webhook.delete({ where: { id } });
    }
    async test(id, userId) {
        const webhook = await this.prisma.webhook.findUnique({ where: { id } });
        if (!webhook) {
            throw new common_1.NotFoundException({ code: "NOT_FOUND", message: "Webhook not found" });
        }
        if (webhook.userId !== userId) {
            throw new common_1.ForbiddenException({ code: "FORBIDDEN", message: "Access denied" });
        }
        const testPayload = {
            event: "TEST",
            timestamp: new Date().toISOString(),
            data: { message: "This is a test webhook from Polyforge" },
        };
        return this.deliver(webhook.url, webhook.secret, testPayload);
    }
    /**
     * Dispatch event to all matching webhooks for a user.
     * Fire-and-forget — errors are logged, not thrown.
     */
    async dispatch(userId, eventType, data) {
        const webhooks = await this.prisma.webhook.findMany({
            where: {
                userId,
                active: true,
                events: { has: eventType },
            },
        });
        for (const wh of webhooks) {
            const payload = {
                event: eventType,
                timestamp: new Date().toISOString(),
                data,
            };
            // Fire and forget — don't await sequentially in production,
            // but keep simple for now
            this.deliver(wh.url, wh.secret, payload).catch((err) => {
                this.logger.warn(`Webhook delivery failed for ${wh.id}: ${err?.message}`);
            });
        }
    }
    async deliver(url, secret, payload) {
        // SECURITY: Block internal/private network URLs to prevent SSRF
        try {
            const parsed = new URL(url);
            const blockedPrefixes = ["localhost", "127.", "0.0.0.0", "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "192.168.", "169.254.", "[::1]"];
            if (blockedPrefixes.some((p) => parsed.hostname.startsWith(p)) ||
                parsed.hostname.endsWith(".internal") ||
                parsed.protocol !== "https:") {
                return { success: false, statusCode: 0, error: "Internal or non-HTTPS URLs are not allowed" };
            }
        }
        catch {
            return { success: false, statusCode: 0, error: "Invalid URL" };
        }
        const body = JSON.stringify(payload);
        const signature = (0, crypto_1.createHmac)("sha256", secret).update(body).digest("hex");
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Polyforge-Signature": signature,
                    "User-Agent": "Polyforge-Webhook/1.0",
                },
                body,
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) {
                // Retry once
                const retry = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Polyforge-Signature": signature,
                        "User-Agent": "Polyforge-Webhook/1.0",
                    },
                    body,
                    signal: AbortSignal.timeout(5000),
                });
                return { success: retry.ok, statusCode: retry.status };
            }
            return { success: true, statusCode: res.status };
        }
        catch (err) {
            // Retry once on network error
            try {
                const retry = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Polyforge-Signature": signature,
                        "User-Agent": "Polyforge-Webhook/1.0",
                    },
                    body,
                    signal: AbortSignal.timeout(5000),
                });
                return { success: retry.ok, statusCode: retry.status };
            }
            catch (retryErr) {
                return { success: false, error: retryErr?.message ?? "Network error" };
            }
        }
    }
};
exports.WebhooksService = WebhooksService;
exports.WebhooksService = WebhooksService = WebhooksService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], WebhooksService);
//# sourceMappingURL=webhooks.service.js.map