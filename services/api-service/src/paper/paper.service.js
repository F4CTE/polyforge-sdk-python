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
exports.PaperService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
let PaperService = class PaperService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSummary(userId) {
        const [orderCount, positions] = await Promise.all([
            this.prisma.paperOrder.count({ where: { userId } }),
            this.prisma.paperPosition.findMany({
                where: { userId },
                select: {
                    tokenId: true,
                    outcome: true,
                    size: true,
                    avgPrice: true,
                    realizedPnl: true,
                },
            }),
        ]);
        const pnl = positions.reduce((acc, p) => acc + parseFloat(String(p.realizedPnl ?? 0)), 0);
        return {
            pnl: pnl.toFixed(2),
            positions: positions.map((p) => ({
                tokenId: p.tokenId,
                side: p.outcome,
                size: String(p.size),
                unrealizedPnl: "0",
            })),
            orderCount,
        };
    }
    async reset(userId) {
        await Promise.all([
            this.prisma.paperOrder.deleteMany({ where: { userId } }),
            this.prisma.paperPosition.deleteMany({ where: { userId } }),
        ]);
        return { reset: true };
    }
};
exports.PaperService = PaperService;
exports.PaperService = PaperService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], PaperService);
//# sourceMappingURL=paper.service.js.map