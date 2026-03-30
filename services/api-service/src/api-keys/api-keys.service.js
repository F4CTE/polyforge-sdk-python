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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeysService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
const crypto_1 = require("crypto");
let ApiKeysService = class ApiKeysService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(userId) {
        return this.prisma.apiKey.findMany({
            where: { userId, revoked: false },
            select: {
                id: true,
                name: true,
                prefix: true,
                scopes: true,
                expiresAt: true,
                lastUsedAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });
    }
    async create(userId, dto) {
        const raw = `pf_${(0, crypto_1.randomBytes)(32).toString("hex")}`;
        const prefix = raw.slice(0, 10);
        const tokenHash = (0, crypto_1.createHash)("sha256").update(raw).digest("hex");
        const key = await this.prisma.apiKey.create({
            data: {
                userId,
                name: dto.name.slice(0, 100),
                prefix,
                tokenHash,
                scopes: (dto.scopes ?? ["READ"]),
            },
            select: {
                id: true,
                name: true,
                prefix: true,
                scopes: true,
                createdAt: true,
            },
        });
        // Return the full token only on creation — it's never shown again
        return { ...key, token: raw };
    }
    async revoke(userId, id) {
        const key = await this.prisma.apiKey.findFirst({
            where: { id, userId, revoked: false },
        });
        if (!key)
            throw new common_1.NotFoundException("API key not found");
        await this.prisma.apiKey.update({
            where: { id },
            data: { revoked: true, revokedAt: new Date() },
        });
        return { message: "API key revoked" };
    }
};
exports.ApiKeysService = ApiKeysService;
exports.ApiKeysService = ApiKeysService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], ApiKeysService);
//# sourceMappingURL=api-keys.service.js.map