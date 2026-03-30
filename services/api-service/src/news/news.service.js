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
var NewsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsService = void 0;
const common_1 = require("@nestjs/common");
const shared_db_1 = require("@polyforge/shared-db");
let NewsService = NewsService_1 = class NewsService {
    prisma;
    logger = new common_1.Logger(NewsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    // ─── Articles ─────────────────────────────────────────────────────────────
    async getArticles(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const where = {};
        if (query.source) {
            where.source = query.source;
        }
        if (query.sentiment) {
            where.sentiment = query.sentiment;
        }
        const [data, total] = await Promise.all([
            this.prisma.newsArticle.findMany({
                where,
                orderBy: { publishedAt: "desc" },
                skip,
                take: limit,
                include: {
                    signals: {
                        include: {
                            market: {
                                select: { id: true, title: true, slug: true },
                            },
                        },
                        orderBy: { confidence: "desc" },
                    },
                },
            }),
            this.prisma.newsArticle.count({ where }),
        ]);
        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    // ─── Article Detail ───────────────────────────────────────────────────────
    async getArticleById(id) {
        const article = await this.prisma.newsArticle.findUnique({
            where: { id },
            include: {
                signals: {
                    include: {
                        market: {
                            select: { id: true, title: true, slug: true, image: true },
                        },
                    },
                    orderBy: { confidence: "desc" },
                },
            },
        });
        if (!article) {
            throw new common_1.NotFoundException("Article not found");
        }
        return article;
    }
    // ─── Signals ──────────────────────────────────────────────────────────────
    async getSignals(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const where = {};
        if (query.marketId) {
            where.marketId = query.marketId;
        }
        if (query.minConfidence) {
            where.confidence = { gte: query.minConfidence };
        }
        if (query.direction) {
            where.direction = query.direction;
        }
        const [data, total] = await Promise.all([
            this.prisma.newsSignal.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    article: {
                        select: {
                            id: true,
                            title: true,
                            source: true,
                            url: true,
                            imageUrl: true,
                            sentiment: true,
                            publishedAt: true,
                        },
                    },
                    market: {
                        select: { id: true, title: true, slug: true, image: true },
                    },
                },
            }),
            this.prisma.newsSignal.count({ where }),
        ]);
        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
};
exports.NewsService = NewsService;
exports.NewsService = NewsService = NewsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shared_db_1.PrismaService])
], NewsService);
//# sourceMappingURL=news.service.js.map